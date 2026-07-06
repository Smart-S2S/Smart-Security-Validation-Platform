"""Per-tool configuration: parameter default overrides + API keys.

Admin edits these from Settings > Pentest Tools > a tool's "Operation
Properties" view. Two destinations:

* **Parameter defaults** are stored as JSON in the tool's own `pentest_tools`
  row (`config_json`) and also written onto the operation parameter rows so the
  operation forms show them. They survive a catalog re-seed because
  `reapply_all()` re-applies them on startup.
* **API keys** for tools that own a config file (currently theHarvester) are
  written to that file in its native format (``~/.theHarvester/api-keys.yaml``),
  merged into the existing template so unrelated sources are left untouched.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path

import yaml

from backend.services.mysql_db import mysql_conn


_LOCK = threading.RLock()
_COLUMN_READY = False

_THEHARVESTER_YAML = Path.home() / ".theHarvester" / "api-keys.yaml"
# Tools whose API keys live in a dedicated config file (not just the DB row).
FILE_TOOLS = {"theharvester"}


# --------------------------------------------------------------------------- #
# DB config (pentest_tools.config_json)
# --------------------------------------------------------------------------- #
def _ensure_column() -> None:
    global _COLUMN_READY
    if _COLUMN_READY:
        return
    with _LOCK:
        if _COLUMN_READY:
            return
        with mysql_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT COUNT(*) AS c FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'pentest_tools' AND COLUMN_NAME = 'config_json'
                    """
                )
                if not (cur.fetchone() or {}).get("c"):
                    cur.execute("ALTER TABLE pentest_tools ADD COLUMN config_json TEXT NULL")
            conn.commit()
        _COLUMN_READY = True


def get_raw_config(tool_key: str) -> dict:
    _ensure_column()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT config_json FROM pentest_tools WHERE tool_key = %s", (tool_key,))
            row = cur.fetchone()
    raw = row.get("config_json") if row else None
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_raw_config(tool_key: str, config: dict) -> None:
    _ensure_column()
    payload = json.dumps(config, ensure_ascii=False)
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            # The row is normally created by list_tools() reconcile; upsert anyway.
            cur.execute(
                """
                INSERT INTO pentest_tools (tool_key, config_json) VALUES (%s, %s)
                ON DUPLICATE KEY UPDATE config_json = VALUES(config_json)
                """,
                (tool_key, payload),
            )
        conn.commit()


# --------------------------------------------------------------------------- #
# Parameter defaults → operation parameter rows
# --------------------------------------------------------------------------- #
def tool_params(tool_key: str) -> list[dict]:
    """Distinct parameters of a tool (union across its operations), with the
    current effective default — drives the defaults form."""
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT p.param_key, MAX(p.label) AS label, MAX(p.param_type) AS param_type,
                       MAX(p.default_value) AS default_value, MAX(p.options_json) AS options_json,
                       MIN(p.sort_order) AS sort_order
                FROM ai_operation_params p
                JOIN ai_operations o ON o.id = p.operation_id
                WHERE o.tool_key = %s
                GROUP BY p.param_key
                ORDER BY sort_order, param_key
                """,
                (tool_key,),
            )
            rows = cur.fetchall() or []
    out = []
    for r in rows:
        opts = r.get("options_json")
        try:
            choices = json.loads(opts) if opts else []
        except Exception:
            choices = []
        out.append({
            "key": r["param_key"],
            "label": r.get("label") or r["param_key"],
            "type": r.get("param_type") or "string",
            "default": r.get("default_value") or "",
            "choices": choices if isinstance(choices, list) else [],
        })
    return out


def apply_param_defaults(tool_key: str) -> int:
    """Write the saved param defaults onto the tool's operation parameter rows
    (both YZO and 3YM catalogs). Returns the number of rows touched."""
    defaults = (get_raw_config(tool_key).get("param_defaults") or {})
    if not defaults:
        return 0
    n = 0
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            for pk, val in defaults.items():
                sval = "" if val is None else str(val)
                cur.execute(
                    """
                    UPDATE ai_operation_params SET default_value = %s
                    WHERE param_key = %s AND operation_id IN (
                        SELECT id FROM ai_operations WHERE tool_key = %s)
                    """,
                    (sval, pk, tool_key),
                )
                n += cur.rowcount
                cur.execute(
                    """
                    UPDATE step_item_parameters SET default_value = %s
                    WHERE param_key = %s AND item_id IN (
                        SELECT id FROM step_items WHERE item_key IN (
                            SELECT operation_key FROM ai_operations WHERE tool_key = %s))
                    """,
                    (sval, pk, tool_key),
                )
                n += cur.rowcount
        conn.commit()
    return n


def reapply_all() -> None:
    """Re-apply every tool's saved param defaults (call after a catalog re-seed,
    e.g. on startup, so admin overrides are not lost)."""
    _ensure_column()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT tool_key FROM pentest_tools WHERE config_json IS NOT NULL AND config_json <> ''")
            keys = [r["tool_key"] for r in cur.fetchall() or []]
    for k in keys:
        try:
            apply_param_defaults(k)
        except Exception:
            pass
    # theHarvester's `source` choices depend on which API keys are filled in;
    # recompute them regardless of whether it has other saved config.
    try:
        _apply_theharvester_source_choices()
    except Exception:
        pass


# --------------------------------------------------------------------------- #
# theHarvester api-keys.yaml
# --------------------------------------------------------------------------- #
def _read_yaml(path: Path) -> dict:
    try:
        with open(path, encoding="utf-8") as fh:
            data = yaml.safe_load(fh) or {}
        return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except Exception:
        return {}


# theHarvester sources that work without an API key — always offered in the
# `source` dropdown. Keyed sources are added only once their key is filled in.
_THEHARVESTER_NOKEY = [
    "duckduckgo", "crtsh", "dnsdumpster", "hackertarget", "rapiddns", "otx",
    "yahoo", "urlscan", "certspotter", "waybackarchive", "subdomaincenter",
]


def theharvester_source_choices() -> list[str]:
    """No-key sources + every keyed source whose API key is filled in, then 'all'."""
    apikeys = _read_yaml(_THEHARVESTER_YAML).get("apikeys") or {}
    keyed = []
    for source, slot in apikeys.items():
        if not isinstance(slot, dict):
            continue
        fields = [f for f in ("key", "id", "secret") if f in slot]
        # Available only when every required field for that source is filled.
        if fields and all(str(slot.get(f) or "").strip() for f in fields):
            keyed.append(source)
    out, seen = [], set()
    for s in _THEHARVESTER_NOKEY + sorted(keyed):
        if s not in seen:
            seen.add(s)
            out.append(s)
    out.append("all")
    return out


def _apply_theharvester_source_choices() -> None:
    """Write the computed `source` choices onto theHarvester's operation params
    (both catalogs) so the operation forms only offer usable sources."""
    opts = json.dumps(theharvester_source_choices())
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE ai_operation_params SET options_json = %s
                WHERE param_key = 'source' AND operation_id IN (
                    SELECT id FROM ai_operations WHERE tool_key = 'theharvester')
                """,
                (opts,),
            )
            cur.execute(
                """
                UPDATE step_item_parameters SET options_json = %s
                WHERE param_key = 'source' AND item_id IN (
                    SELECT id FROM step_items WHERE item_key IN (
                        SELECT operation_key FROM ai_operations WHERE tool_key = 'theharvester'))
                """,
                (opts,),
            )
        conn.commit()


def theharvester_key_fields() -> list[dict]:
    """API-key field descriptors from theHarvester's own template (values NOT
    returned — only a 'set' flag per field)."""
    apikeys = _read_yaml(_THEHARVESTER_YAML).get("apikeys") or {}
    out = []
    for source in sorted(apikeys):
        slot = apikeys[source] if isinstance(apikeys[source], dict) else {}
        fields = [f for f in ("key", "id", "secret") if f in slot] or ["key"]
        out.append({
            "source": source,
            "fields": fields,
            "set": {f: bool(str(slot.get(f) or "").strip()) for f in fields},
        })
    return out


def save_theharvester_keys(updates: dict) -> None:
    """Merge {source: {field: value}} into the existing api-keys.yaml. Empty
    values keep the stored key (so the UI never needs to echo secrets)."""
    data = _read_yaml(_THEHARVESTER_YAML)
    apikeys = data.setdefault("apikeys", {})
    for source, slots in (updates or {}).items():
        if not isinstance(slots, dict):
            continue
        entry = apikeys.setdefault(source, {})
        if not isinstance(entry, dict):
            entry = {}
            apikeys[source] = entry
        for field, val in slots.items():
            v = str(val or "").strip()
            if v:
                entry[field] = v
    _THEHARVESTER_YAML.parent.mkdir(parents=True, exist_ok=True)
    with open(_THEHARVESTER_YAML, "w", encoding="utf-8") as fh:
        yaml.safe_dump(data, fh, default_flow_style=False, sort_keys=False, allow_unicode=True)


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #
def get_tool_config(tool_key: str) -> dict:
    """Everything the config UI needs for one tool."""
    cfg = get_raw_config(tool_key)
    result = {
        "tool": tool_key,
        "params": tool_params(tool_key),
        "param_defaults": cfg.get("param_defaults") or {},
        "has_api_file": tool_key in FILE_TOOLS,
        "api_key_fields": theharvester_key_fields() if tool_key == "theharvester" else [],
    }
    if tool_key == "theharvester":
        # The `source` dropdown is dynamic: no-key sources + sources with a key.
        choices = theharvester_source_choices()
        for p in result["params"]:
            if p["key"] == "source":
                p["choices"] = choices
                if p.get("default") not in choices:
                    p["default"] = choices[0] if choices else ""
    return result


def save_tool_config(tool_key: str, *, param_defaults: dict | None = None, api_keys: dict | None = None) -> dict:
    with _LOCK:
        cfg = get_raw_config(tool_key)
        if param_defaults is not None:
            cfg["param_defaults"] = {str(k): ("" if v is None else str(v)) for k, v in param_defaults.items()}
        _save_raw_config(tool_key, cfg)

    applied = apply_param_defaults(tool_key)
    wrote_file = False
    if tool_key == "theharvester":
        if api_keys:
            save_theharvester_keys(api_keys)
            wrote_file = True
        # Refresh the `source` dropdown so newly-keyed sources become selectable.
        _apply_theharvester_source_choices()
    return {"ok": True, "applied_params": applied, "wrote_file": wrote_file}
