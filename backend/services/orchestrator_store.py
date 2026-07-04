import json
import os
import re
import shutil
import threading
from datetime import datetime, timezone
from pathlib import Path

from backend.services.mysql_db import init_mysql_schema, mysql_conn


_LOCK = threading.Lock()
_VALID_RISK = {"low", "medium", "high", "critical"}
_VALID_WORKFLOW_KEYS = {"scan", "attack", "remediation"}
_SCRIPT_ROOT = Path(os.getenv("SSVP_TOOL_SCRIPTS_DIR", "data/tool_scripts"))
_STEP_ITEM_SCRIPT_ROOT = Path(os.getenv("SSVP_STEP_ITEM_SCRIPTS_DIR", "data/step_item_scripts"))
_STEP_SCRIPT_TEMPLATE_MARKER = "SSVP_SCRIPT_TEMPLATE_V1"

_FIXED_WORKFLOW_STEPS = [
    {
        "id": 1,
        "step_key": "scan",
        "step_name": "Tarama",
        "description": "Yetkili hedefte savunma odakli tarama ve dogrulama islemleri.",
        "sort_order": 10,
        "role_required": "test",
        "ai_prompt_hint": "Servis kesfi, port dogrulama, evidence toplama.",
        "is_active": True,
    },
    {
        "id": 2,
        "step_key": "attack",
        "step_name": "Atak",
        "description": "Yetkili ortamlarda kontrollu aktif dogrulama aksiyonlari.",
        "sort_order": 20,
        "role_required": "attack",
        "ai_prompt_hint": "Yalnizca izinli ve savunma amacli dogrulama aksiyonlari oner.",
        "is_active": True,
    },
    {
        "id": 3,
        "step_key": "remediation",
        "step_name": "Duzenleme",
        "description": "Risk azaltimi ve duzeltme adimlarini planla ve dogrula.",
        "sort_order": 30,
        "role_required": "remediation",
        "ai_prompt_hint": "Hardening, konfig duzeltmeleri, retest kriterleri.",
        "is_active": True,
    },
]


def _slugify(value: str | None, fallback: str = "item") -> str:
    text = re.sub(r"[^a-zA-Z0-9_-]+", "_", (value or "").strip().lower()).strip("_")
    return text or fallback


def _tool_script_dir(workflow_key: str, category_key: str, action_key: str) -> Path:
    return _SCRIPT_ROOT / _slugify(workflow_key, "scan") / _slugify(category_key, "general") / _slugify(action_key, "tool")


def _build_script_filename(action_key: str, sequence: int) -> str:
    return f"{_slugify(action_key, 'tool')}_{int(sequence)}.py"


def _extract_script_sequence(filename: str | None, fallback: int) -> int:
    match = re.search(r"_(\d+)\.py$", (filename or "").strip().lower())
    if match:
        try:
            value = int(match.group(1))
            if value > 0:
                return value
        except Exception:
            pass
    return fallback


def _next_script_sequence(cur, tool_id: int) -> int:
    cur.execute("SELECT COUNT(*) AS count FROM tool_scripts WHERE tool_id = %s", (tool_id,))
    row = cur.fetchone() or {"count": 0}
    return int(row.get("count") or 0) + 1


def _write_script_file(*, workflow_key: str, category_key: str, action_key: str, sequence: int, content: bytes) -> tuple[str, str]:
    script_dir = _tool_script_dir(workflow_key, category_key, action_key)
    script_dir.mkdir(parents=True, exist_ok=True)
    filename = _build_script_filename(action_key, sequence)
    file_path = script_dir / filename
    if file_path.exists():
        raise ValueError("SCRIPT_NAME_CONFLICT")

    file_path.write_bytes(content)
    return filename, str(file_path)


def _replace_script_file(*, existing_file_path: str | None, workflow_key: str, category_key: str, action_key: str, sequence: int, content: bytes) -> tuple[str, str]:
    if existing_file_path:
        old = Path(existing_file_path)
        if old.exists():
            old.unlink(missing_ok=True)

    return _write_script_file(
        workflow_key=workflow_key,
        category_key=category_key,
        action_key=action_key,
        sequence=sequence,
        content=content,
    )


def _relocate_tool_scripts(*, tool_id: int, workflow_key: str, category_key: str, action_key: str) -> None:
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, sort_order, file_path
                FROM tool_scripts
                WHERE tool_id = %s
                ORDER BY sort_order ASC, id ASC
                """,
                (tool_id,),
            )
            rows = cur.fetchall() or []

            for index, row in enumerate(rows, start=1):
                old_path = Path(row.get("file_path") or "")
                if not old_path.exists():
                    continue

                new_dir = _tool_script_dir(workflow_key, category_key, action_key)
                new_dir.mkdir(parents=True, exist_ok=True)
                old_name = old_path.name or row.get("filename")
                sequence = _extract_script_sequence(old_name, index)
                new_name = _build_script_filename(action_key, sequence)
                new_path = new_dir / new_name
                if new_path.exists() and new_path != old_path:
                    raise ValueError("SCRIPT_NAME_CONFLICT")

                if new_path != old_path:
                    shutil.move(str(old_path), str(new_path))

                cur.execute(
                    """
                    UPDATE tool_scripts
                    SET filename = %s,
                        file_path = %s,
                        updated_at = %s
                    WHERE id = %s
                    """,
                    (new_name, str(new_path), _utc_now_iso(), int(row["id"])),
                )
        conn.commit()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_risk(value: str | None) -> str:
    normalized = (value or "low").strip().lower()
    if normalized not in _VALID_RISK:
        return "low"
    return normalized


def _normalize_workflow_key(value: str | None) -> str:
    normalized = (value or "scan").strip().lower()
    if normalized not in _VALID_WORKFLOW_KEYS:
        return "scan"
    return normalized


def _normalize_text(value: str | None, fallback: str = "") -> str:
    text = (value or "").strip()
    if text:
        return text
    return fallback


def _default_script_source(category: str, step: str) -> str:
    safe_category = _normalize_text(category, "general")
    safe_step = _normalize_text(step, "custom_step")
    return f'''#!/usr/bin/env python3
"""SSVP custom script: {safe_category} / {safe_step}."""

import json
import os
import sys


def log(message: str) -> None:
    print(f"[LOG] {{message}}", flush=True)


def main() -> int:
    raw = os.getenv("SSVP_INPUT_JSON", "{{}}")
    try:
        payload = json.loads(raw)
    except Exception:
        payload = {{}}

    target = str(payload.get("target") or "")
    params = payload.get("parameters") or {{}}

    log("Script basladi")
    log(f"Target: {{target}}")
    log(f"Params keys: {{', '.join(sorted(params.keys()))}}")

    result = {{
        "ok": True,
        "message": "Custom script tamamlandi",
        "target": target,
        "parameters": params,
    }}
    print("SSVP_RESULT_JSON:" + json.dumps(result, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
'''


def _script_template_prelude() -> str:
    return f'''# {_STEP_SCRIPT_TEMPLATE_MARKER}
import json
import os


def ssvp_input():
    raw = os.getenv("SSVP_INPUT_JSON", "{{}}")
    try:
        return json.loads(raw)
    except Exception:
        return {{}}


def ssvp_log(message):
    print(f"[SSVP_LOG] {{message}}", flush=True)


def ssvp_emit_result(data):
    print("SSVP_RESULT_JSON:" + json.dumps(data, ensure_ascii=False), flush=True)
'''


def _ensure_step_script_template(script_source: str) -> str:
    text = script_source or ""
    if _STEP_SCRIPT_TEMPLATE_MARKER in text:
        return text

    prelude = _script_template_prelude().strip() + "\n\n"
    return prelude + text


def _safe_loads(raw: str | None, fallback):
    if not raw:
        return fallback
    try:
        return json.loads(raw)
    except Exception:
        return fallback


def _build_db_step_key(workflow_key: str, category_key: str, step_key: str) -> str:
    return _slugify(f"{workflow_key}_{category_key}_{step_key}", "step")


def _resolve_or_create_category_id(cur, *, workflow_key: str, category_key: str) -> int:
    normalized_workflow = _normalize_workflow_key(workflow_key)
    normalized_category = _slugify(category_key, "general")
    now = _utc_now_iso()

    cur.execute(
        """
        SELECT id
        FROM progress_categories
        WHERE category_key = %s
        LIMIT 1
        """,
        (normalized_category,),
    )
    row = cur.fetchone()
    if row:
        return int(row["id"])

    cur.execute(
        """
        INSERT INTO progress_categories (
            category_key, display_name, workflow_key, description,
            is_active, created_at, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (
            normalized_category,
            normalized_category,
            normalized_workflow,
            "",
            1,
            now,
            now,
        ),
    )
    return int(cur.lastrowid)


def _resolve_or_create_step_id(
    cur,
    *,
    workflow_key: str,
    category_key: str,
    step_key: str,
    display_name: str,
    description: str = "",
) -> tuple[int, str, str, str]:
    normalized_workflow = _normalize_workflow_key(workflow_key)
    normalized_category = _slugify(category_key, "general")
    normalized_step_key = _slugify(step_key, "custom_step")
    compound_key = _build_db_step_key(normalized_workflow, normalized_category, normalized_step_key)
    category_id = _resolve_or_create_category_id(
        cur,
        workflow_key=normalized_workflow,
        category_key=normalized_category,
    )
    now = _utc_now_iso()

    cur.execute(
        """
        SELECT id
        FROM steps
        WHERE step_key = %s
        LIMIT 1
        """,
        (compound_key,),
    )
    row = cur.fetchone()
    if row:
        return int(row["id"]), normalized_workflow, normalized_category, normalized_step_key

    cur.execute(
        """
        INSERT INTO steps (
            step_key, display_name, workflow_key, category_id,
            description, is_active, created_at, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            compound_key,
            _normalize_text(display_name, normalized_step_key),
            normalized_workflow,
            category_id,
            _normalize_text(description, ""),
            1,
            now,
            now,
        ),
    )

    return int(cur.lastrowid), normalized_workflow, normalized_category, normalized_step_key


def _load_step_context(cur, step_id: int) -> tuple[int, str, str, str] | None:
    cur.execute(
        """
        SELECT s.id, s.step_key, s.workflow_key, pc.category_key
        FROM steps s
        JOIN progress_categories pc ON pc.id = s.category_id
        WHERE s.id = %s
        LIMIT 1
        """,
        (int(step_id),),
    )
    row = cur.fetchone()
    if not row:
        return None

    workflow_key = _normalize_workflow_key(row.get("workflow_key"))
    category_key = _slugify(row.get("category_key"), "general")
    raw_step_key = _slugify(row.get("step_key"), "custom_step")
    suffix = f"{workflow_key}_{category_key}_"
    test_step = raw_step_key[len(suffix):] if raw_step_key.startswith(suffix) else raw_step_key
    return int(row["id"]), workflow_key, category_key, _slugify(test_step, "custom_step")


def _seed_tools() -> list[dict]:
    return [
        {
            "action_key": "scan_asset_inventory",
            "tool_name": "scan_asset_inventory",
            "display_name": "Varlik Envanteri Tara",
            "workflow_key": "scan",
            "test_category": "network",
            "test_step": "asset_inventory",
            "script_filename": "",
            "script_source": "",
            "tool_type": "python_script",
            "module_path": "",
            "executable_path": "",
            "base_command": "",
            "risk_level": "low",
            "timeout_sec": 300,
            "requires_approval": True,
            "wordlist_path": "",
            "payload_path": "",
            "template_path": "",
            "is_active": True,
        },
        {
            "action_key": "attack_web_login_checks",
            "tool_name": "attack_web_login_checks",
            "display_name": "Web Giris Kontrolleri",
            "workflow_key": "attack",
            "test_category": "web_applications",
            "test_step": "login_checks",
            "script_filename": "",
            "script_source": "",
            "tool_type": "python_script",
            "module_path": "",
            "executable_path": "",
            "base_command": "",
            "risk_level": "medium",
            "timeout_sec": 300,
            "requires_approval": True,
            "wordlist_path": "",
            "payload_path": "",
            "template_path": "",
            "is_active": True,
        },
        {
            "action_key": "attack_api_security_probes",
            "tool_name": "attack_api_security_probes",
            "display_name": "API Guvenlik Problari",
            "workflow_key": "attack",
            "test_category": "web_applications",
            "test_step": "api_security",
            "script_filename": "",
            "script_source": "",
            "tool_type": "python_script",
            "module_path": "",
            "executable_path": "",
            "base_command": "",
            "risk_level": "medium",
            "timeout_sec": 420,
            "requires_approval": True,
            "wordlist_path": "",
            "payload_path": "",
            "template_path": "",
            "is_active": True,
        },
        {
            "action_key": "remediate_hardening_validation",
            "tool_name": "remediate_hardening_validation",
            "display_name": "Hardening Dogrulama",
            "workflow_key": "remediation",
            "test_category": "remediation",
            "test_step": "hardening_validation",
            "script_filename": "",
            "script_source": "",
            "tool_type": "python_script",
            "module_path": "",
            "executable_path": "",
            "base_command": "",
            "risk_level": "low",
            "timeout_sec": 240,
            "requires_approval": True,
            "wordlist_path": "",
            "payload_path": "",
            "template_path": "",
            "is_active": True,
        },
        {
            "action_key": "remediate_config_diff_check",
            "tool_name": "remediate_config_diff_check",
            "display_name": "Konfig Fark Kontrolu",
            "workflow_key": "remediation",
            "test_category": "remediation",
            "test_step": "config_diff",
            "script_filename": "",
            "script_source": "",
            "tool_type": "python_script",
            "module_path": "",
            "executable_path": "",
            "base_command": "",
            "risk_level": "low",
            "timeout_sec": 300,
            "requires_approval": True,
            "wordlist_path": "",
            "payload_path": "",
            "template_path": "",
            "is_active": True,
        },
    ]


def _seed_progress_categories() -> list[dict]:
    return [
        {
            "category_key": "network",
            "display_name": "Network",
            "workflow_key": "scan",
            "description": "Ag ve servis kesif testleri",
            "is_active": True,
        },
        {
            "category_key": "web_applications",
            "display_name": "Web Uygulamalari",
            "workflow_key": "attack",
            "description": "Web uygulama guvenlik dogrulama adimlari",
            "is_active": True,
        },
        {
            "category_key": "remediation",
            "display_name": "Duzenleme",
            "workflow_key": "remediation",
            "description": "Duzeltme ve iyilestirme adimlari",
            "is_active": True,
        },
    ]


def _seed_tool_parameters() -> dict[str, list[dict]]:
    return {
        "scan_asset_inventory": [
            {
                "param_key": "scope_level",
                "label": "Scope Level",
                "param_type": "list",
                "default_value": json.dumps(["internal", "dmz"], ensure_ascii=False),
                "is_required": True,
                "is_editable": True,
                "options_json": json.dumps(["internal", "dmz", "external"], ensure_ascii=False),
                "sort_order": 10,
            },
            {
                "param_key": "max_hosts",
                "label": "Max Host Count",
                "param_type": "string",
                "default_value": "256",
                "is_required": True,
                "is_editable": True,
                "options_json": json.dumps([], ensure_ascii=False),
                "sort_order": 20,
            },
        ],
        "attack_web_login_checks": [
            {
                "param_key": "login_paths",
                "label": "Login Paths",
                "param_type": "json",
                "default_value": json.dumps(["/login", "/auth/login"], ensure_ascii=False),
                "is_required": True,
                "is_editable": True,
                "options_json": json.dumps([], ensure_ascii=False),
                "sort_order": 10,
            },
            {
                "param_key": "max_attempts",
                "label": "Max Attempt Count",
                "param_type": "string",
                "default_value": "5",
                "is_required": True,
                "is_editable": True,
                "options_json": json.dumps([], ensure_ascii=False),
                "sort_order": 20,
            },
        ],
        "attack_api_security_probes": [
            {
                "param_key": "api_endpoints",
                "label": "API Endpoint List",
                "param_type": "list",
                "default_value": json.dumps(["/api/v1/users", "/api/v1/orders"], ensure_ascii=False),
                "is_required": True,
                "is_editable": True,
                "options_json": json.dumps([], ensure_ascii=False),
                "sort_order": 10,
            },
            {
                "param_key": "auth_mode",
                "label": "Auth Mode",
                "param_type": "string",
                "default_value": "bearer",
                "is_required": False,
                "is_editable": True,
                "options_json": json.dumps([], ensure_ascii=False),
                "sort_order": 20,
            },
        ],
        "remediate_hardening_validation": [
            {
                "param_key": "baseline_profile",
                "label": "Baseline Profile",
                "param_type": "string",
                "default_value": "cis_level_1",
                "is_required": True,
                "is_editable": True,
                "options_json": json.dumps(["cis_level_1", "cis_level_2"], ensure_ascii=False),
                "sort_order": 10,
            },
            {
                "param_key": "services_to_check",
                "label": "Services To Check",
                "param_type": "list",
                "default_value": json.dumps(["ssh", "nginx", "mysql"], ensure_ascii=False),
                "is_required": False,
                "is_editable": True,
                "options_json": json.dumps([], ensure_ascii=False),
                "sort_order": 20,
            },
        ],
        "remediate_config_diff_check": [
            {
                "param_key": "source_tag",
                "label": "Source Config Tag",
                "param_type": "string",
                "default_value": "before_fix",
                "is_required": True,
                "is_editable": True,
                "options_json": json.dumps([], ensure_ascii=False),
                "sort_order": 10,
            },
            {
                "param_key": "target_tag",
                "label": "Target Config Tag",
                "param_type": "string",
                "default_value": "after_fix",
                "is_required": True,
                "is_editable": True,
                "options_json": json.dumps([], ensure_ascii=False),
                "sort_order": 20,
            },
        ],
    }


def init_orchestrator_store() -> None:
    with _LOCK:
        init_mysql_schema()
        # Workflow entities (categories/steps) are now fully DB-driven from settings.


def list_progress_categories(active_only: bool = False) -> list[dict]:
    init_orchestrator_store()
    where_clause = "WHERE is_active = 1" if active_only else ""
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, category_key, display_name, workflow_key, description, is_active
                FROM progress_categories
                {where_clause}
                ORDER BY category_key ASC
                """
            )
            rows = cur.fetchall() or []

    return [
        {
            "id": int(row["id"]),
            "category_key": row["category_key"],
            "display_name": row.get("display_name") or row["category_key"],
            "workflow_key": _normalize_workflow_key(row.get("workflow_key")),
            "description": row.get("description") or "",
            "is_active": bool(row.get("is_active", True)),
        }
        for row in rows
    ]


def create_progress_category(payload: dict) -> dict:
    init_orchestrator_store()
    now = _utc_now_iso()
    category_key = _slugify(payload.get("category_key"), "general")
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO progress_categories (
                    category_key, display_name, workflow_key, description,
                    is_active, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    category_key,
                    _normalize_text(payload.get("display_name"), category_key),
                    _normalize_workflow_key(payload.get("workflow_key")),
                    _normalize_text(payload.get("description"), ""),
                    1 if payload.get("is_active", True) else 0,
                    now,
                    now,
                ),
            )
            category_id = int(cur.lastrowid)
            cur.execute(
                """
                SELECT id, category_key, display_name, workflow_key, description, is_active
                FROM progress_categories WHERE id = %s
                """,
                (category_id,),
            )
            row = cur.fetchone()
        conn.commit()

    return {
        "id": int(row["id"]),
        "category_key": row["category_key"],
        "display_name": row.get("display_name") or row["category_key"],
        "workflow_key": _normalize_workflow_key(row.get("workflow_key")),
        "description": row.get("description") or "",
        "is_active": bool(row.get("is_active", True)),
    }


def update_progress_category(category_id: int, payload: dict) -> dict | None:
    init_orchestrator_store()
    mapping = {
        "display_name": ("display_name", lambda v: _normalize_text(v, "Category")),
        "workflow_key": ("workflow_key", _normalize_workflow_key),
        "description": ("description", lambda v: _normalize_text(v, "")),
        "is_active": ("is_active", lambda v: 1 if v else 0),
    }

    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, category_key, workflow_key FROM progress_categories WHERE id = %s", (category_id,))
            exists = cur.fetchone()
            if not exists:
                return None

            fields: list[str] = []
            values: list = []
            for key, (field_name, transform) in mapping.items():
                if key in payload and payload[key] is not None:
                    fields.append(f"{field_name} = %s")
                    values.append(transform(payload[key]))

            if fields:
                fields.append("updated_at = %s")
                values.append(_utc_now_iso())
                values.append(category_id)
                cur.execute(f"UPDATE progress_categories SET {', '.join(fields)} WHERE id = %s", tuple(values))

            cur.execute(
                """
                SELECT id, category_key, display_name, workflow_key, description, is_active
                FROM progress_categories WHERE id = %s
                """,
                (category_id,),
            )
            row = cur.fetchone()
        conn.commit()

    return {
        "id": int(row["id"]),
        "category_key": row["category_key"],
        "display_name": row.get("display_name") or row["category_key"],
        "workflow_key": _normalize_workflow_key(row.get("workflow_key")),
        "description": row.get("description") or "",
        "is_active": bool(row.get("is_active", True)),
    }


def delete_progress_category(category_id: int) -> bool:
    init_orchestrator_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, category_key FROM progress_categories WHERE id = %s", (category_id,))
            row = cur.fetchone()
            if not row:
                return False
            category_pk = int(row["id"])

            cur.execute("SELECT COUNT(*) AS count FROM steps WHERE category_id = %s", (category_pk,))
            steps_count = int((cur.fetchone() or {}).get("count") or 0)
            if steps_count > 0:
                raise ValueError("CATEGORY_IN_USE")

            cur.execute("DELETE FROM progress_categories WHERE id = %s", (category_id,))
            deleted = cur.rowcount > 0
        conn.commit()
    return deleted


def _db_step_row_to_dict(row: dict) -> dict:
    return {
        "id": int(row["id"]),
        "step_key": row["step_key"],
        "display_name": row.get("display_name") or row["step_key"],
        "workflow_key": _normalize_workflow_key(row.get("workflow_key")),
        "category_id": int(row["category_id"]),
        "category_key": _normalize_text(row.get("category_key"), "general").lower(),
        "description": row.get("description") or "",
        "is_active": bool(row.get("is_active", True)),
    }


def list_steps(*, active_only: bool = False, workflow_key: str | None = None, category_key: str | None = None) -> list[dict]:
    init_orchestrator_store()
    filters: list[str] = []
    values: list = []

    if active_only:
        filters.append("s.is_active = 1")
    if workflow_key:
        filters.append("s.workflow_key = %s")
        values.append(_normalize_workflow_key(workflow_key))
    if category_key:
        filters.append("pc.category_key = %s")
        values.append(_slugify(category_key, "general"))

    where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT s.id, s.step_key, s.display_name, s.workflow_key,
                       s.category_id, pc.category_key, s.description, s.is_active
                FROM steps s
                JOIN progress_categories pc ON pc.id = s.category_id
                {where_clause}
                ORDER BY s.workflow_key ASC, pc.category_key ASC, s.display_name ASC
                """,
                tuple(values),
            )
            rows = cur.fetchall() or []

    return [_db_step_row_to_dict(row) for row in rows]


def create_step(payload: dict) -> dict:
    init_orchestrator_store()
    now = _utc_now_iso()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            step_id, _, _, _ = _resolve_or_create_step_id(
                cur,
                workflow_key=payload.get("workflow_key") or "scan",
                category_key=payload.get("category_key") or "general",
                step_key=payload.get("step_key") or "custom_step",
                display_name=payload.get("display_name") or "Step",
                description=payload.get("description") or "",
            )

            cur.execute(
                """
                UPDATE steps
                SET display_name = %s,
                    description = %s,
                    is_active = %s,
                    updated_at = %s
                WHERE id = %s
                """,
                (
                    _normalize_text(payload.get("display_name"), "Step"),
                    _normalize_text(payload.get("description"), ""),
                    1 if payload.get("is_active", True) else 0,
                    now,
                    step_id,
                ),
            )

            cur.execute(
                """
                SELECT s.id, s.step_key, s.display_name, s.workflow_key,
                       s.category_id, pc.category_key, s.description, s.is_active
                FROM steps s
                JOIN progress_categories pc ON pc.id = s.category_id
                WHERE s.id = %s
                """,
                (step_id,),
            )
            row = cur.fetchone()
        conn.commit()

    return _db_step_row_to_dict(row)


def update_step(step_id: int, payload: dict) -> dict | None:
    init_orchestrator_store()
    mapping = {
        "display_name": ("display_name", lambda v: _normalize_text(v, "Step")),
        "description": ("description", lambda v: _normalize_text(v, "")),
        "is_active": ("is_active", lambda v: 1 if v else 0),
    }

    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM steps WHERE id = %s", (step_id,))
            exists = cur.fetchone()
            if not exists:
                return None

            fields: list[str] = []
            values: list = []
            for key, (field_name, transform) in mapping.items():
                if key in payload and payload[key] is not None:
                    fields.append(f"{field_name} = %s")
                    values.append(transform(payload[key]))

            if fields:
                fields.append("updated_at = %s")
                values.append(_utc_now_iso())
                values.append(step_id)
                cur.execute(f"UPDATE steps SET {', '.join(fields)} WHERE id = %s", tuple(values))

            cur.execute(
                """
                SELECT s.id, s.step_key, s.display_name, s.workflow_key,
                       s.category_id, pc.category_key, s.description, s.is_active
                FROM steps s
                JOIN progress_categories pc ON pc.id = s.category_id
                WHERE s.id = %s
                """,
                (step_id,),
            )
            row = cur.fetchone()
        conn.commit()

    return _db_step_row_to_dict(row) if row else None


def delete_step(step_id: int) -> bool:
    init_orchestrator_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM steps WHERE id = %s", (step_id,))
            deleted = cur.rowcount > 0
        conn.commit()

    return deleted


def _step_item_row_to_dict(row: dict) -> dict:
    return {
        "id": int(row["id"]),
        "step_id": int(row["step_id"]),
        "item_type": _normalize_text(row.get("item_type"), "task").lower(),
        "item_key": _normalize_text(row.get("item_key"), "item").lower(),
        "display_name": _normalize_text(row.get("display_name"), "Item"),
        "description": _normalize_text(row.get("description"), ""),
        "script_path": _normalize_text(row.get("script_path"), ""),
        "is_active": bool(row.get("is_active", True)),
    }


def _step_item_param_row_to_dict(row: dict) -> dict:
    return {
        "id": int(row["id"]),
        "item_id": int(row["item_id"]),
        "param_key": _normalize_text(row.get("param_key"), "param").lower(),
        "label": _normalize_text(row.get("label"), "Parametre"),
        "param_type": _normalize_text(row.get("param_type"), "string").lower(),
        "default_value": _normalize_text(row.get("default_value"), ""),
        "description": _normalize_text(row.get("description"), ""),
        "options_json": _safe_loads(row.get("options_json"), []),
        "is_required": bool(row.get("is_required")),
        "sort_order": int(row.get("sort_order") or 100),
    }


def _normalize_step_item_type(value: str | None) -> str:
    normalized = _normalize_text(value, "task").lower()
    return "script" if normalized == "script" else "task"


def _workflow_script_folder(workflow_key: str | None) -> str:
    normalized = _normalize_workflow_key(workflow_key)
    mapping = {
        "scan": "test",
        "attack": "atak",
        "remediation": "duzenleme",
    }
    return mapping.get(normalized, "test")


def _step_item_script_path(step: dict, item_id: int, original_name: str) -> Path:
    safe_name = Path(_normalize_text(original_name, "script.py")).name
    suffix = Path(safe_name).suffix or ".py"
    filename = f"script_{int(item_id)}_{int(datetime.now(timezone.utc).timestamp())}{suffix}"
    folder = _STEP_ITEM_SCRIPT_ROOT / _workflow_script_folder(step.get("workflow_key"))
    folder.mkdir(parents=True, exist_ok=True)
    return folder / filename


def list_step_items(step_id: int, *, active_only: bool = False) -> list[dict]:
    init_orchestrator_store()
    where_clause = "AND is_active = 1" if active_only else ""
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, step_id, item_type, item_key, display_name,
                       description, script_path, is_active
                FROM step_items
                WHERE step_id = %s
                {where_clause}
                ORDER BY item_type ASC, display_name ASC, id ASC
                """,
                (int(step_id),),
            )
            rows = cur.fetchall() or []
    return [_step_item_row_to_dict(row) for row in rows]


def create_step_item(step_id: int, payload: dict) -> dict:
    init_orchestrator_store()
    now = _utc_now_iso()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM steps WHERE id = %s", (int(step_id),))
            exists = cur.fetchone()
            if not exists:
                raise ValueError("STEP_NOT_FOUND")

            cur.execute(
                """
                INSERT INTO step_items (
                    step_id, item_type, item_key, display_name,
                    description, script_path, is_active, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    int(step_id),
                    _normalize_step_item_type(payload.get("item_type")),
                    _slugify(payload.get("item_key") or payload.get("display_name"), "item"),
                    _normalize_text(payload.get("display_name"), "Item"),
                    _normalize_text(payload.get("description"), ""),
                    "",
                    1 if payload.get("is_active", True) else 0,
                    now,
                    now,
                ),
            )
            created_id = int(cur.lastrowid)
            cur.execute(
                """
                SELECT id, step_id, item_type, item_key, display_name,
                       description, script_path, is_active
                FROM step_items
                WHERE id = %s
                """,
                (created_id,),
            )
            row = cur.fetchone()
        conn.commit()
    return _step_item_row_to_dict(row)


def update_step_item(item_id: int, payload: dict) -> dict | None:
    init_orchestrator_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, step_id, item_type, item_key, display_name,
                       description, script_path, is_active
                FROM step_items
                WHERE id = %s
                """,
                (int(item_id),),
            )
            exists = cur.fetchone()
            if not exists:
                return None

            mapping = {
                "item_type": ("item_type", lambda v: _normalize_step_item_type(v)),
                "item_key": ("item_key", lambda v: _slugify(v, "item")),
                "display_name": ("display_name", lambda v: _normalize_text(v, "Item")),
                "description": ("description", lambda v: _normalize_text(v, "")),
                "is_active": ("is_active", lambda v: 1 if v else 0),
            }
            fields: list[str] = []
            values: list = []
            for key, (field_name, transform) in mapping.items():
                if key in payload and payload[key] is not None:
                    fields.append(f"{field_name} = %s")
                    values.append(transform(payload[key]))

            if ("display_name" in payload and payload.get("display_name") is not None) and ("item_key" not in payload):
                fields.append("item_key = %s")
                values.append(_slugify(payload.get("display_name"), "item"))

            if fields:
                fields.append("updated_at = %s")
                values.append(_utc_now_iso())
                values.append(int(item_id))
                cur.execute(f"UPDATE step_items SET {', '.join(fields)} WHERE id = %s", tuple(values))

            cur.execute(
                """
                SELECT id, step_id, item_type, item_key, display_name,
                       description, script_path, is_active
                FROM step_items
                WHERE id = %s
                """,
                (int(item_id),),
            )
            row = cur.fetchone()
        conn.commit()
    return _step_item_row_to_dict(row) if row else None


def delete_step_item(item_id: int) -> bool:
    init_orchestrator_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT script_path FROM step_items WHERE id = %s", (int(item_id),))
            row = cur.fetchone() or {}
            script_path = _normalize_text(row.get("script_path"), "")
            cur.execute("DELETE FROM step_items WHERE id = %s", (int(item_id),))
            deleted = cur.rowcount > 0
        conn.commit()

    if deleted and script_path:
        try:
            Path(script_path).unlink(missing_ok=True)
        except Exception:
            pass
    return deleted


def upload_step_item_script(item_id: int, *, filename: str, content: bytes) -> dict:
    init_orchestrator_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT si.id, si.step_id, si.item_type, si.item_key, si.script_path,
                       s.step_key, s.workflow_key, pc.category_key
                FROM step_items si
                JOIN steps s ON s.id = si.step_id
                JOIN progress_categories pc ON pc.id = s.category_id
                WHERE si.id = %s
                LIMIT 1
                """,
                (int(item_id),),
            )
            row = cur.fetchone()
            if not row:
                raise ValueError("STEP_ITEM_NOT_FOUND")

            if _normalize_step_item_type(row.get("item_type")) != "script":
                raise ValueError("ITEM_NOT_SCRIPT")

            old_path = _normalize_text(row.get("script_path"), "")
            target_path = _step_item_script_path(row, int(row.get("id") or item_id), filename)
            source_text = bytes(content).decode("utf-8", errors="replace")
            normalized_source = _ensure_step_script_template(source_text)
            target_path.write_text(normalized_source, encoding="utf-8")

            cur.execute(
                """
                UPDATE step_items
                SET script_path = %s,
                    updated_at = %s
                WHERE id = %s
                """,
                (str(target_path), _utc_now_iso(), int(item_id)),
            )
            cur.execute(
                """
                SELECT id, step_id, item_type, item_key, display_name,
                       description, script_path, is_active
                FROM step_items
                WHERE id = %s
                """,
                (int(item_id),),
            )
            item_row = cur.fetchone()
        conn.commit()

    if old_path and old_path != str(target_path):
        try:
            Path(old_path).unlink(missing_ok=True)
        except Exception:
            pass
    return _step_item_row_to_dict(item_row)


def get_step_item_script_content(item_id: int) -> dict:
    init_orchestrator_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT si.id, si.step_id, si.item_type, si.item_key, si.display_name,
                       si.description, si.script_path, si.is_active
                FROM step_items si
                WHERE si.id = %s
                LIMIT 1
                """,
                (int(item_id),),
            )
            row = cur.fetchone()
            if not row:
                raise ValueError("STEP_ITEM_NOT_FOUND")

            if _normalize_step_item_type(row.get("item_type")) != "script":
                raise ValueError("ITEM_NOT_SCRIPT")

    item = _step_item_row_to_dict(row)
    script_path = _normalize_text(row.get("script_path"), "")
    script_source = ""
    filename = ""

    if script_path:
        path_obj = Path(script_path)
        filename = path_obj.name
        if path_obj.exists():
            script_source = path_obj.read_text(encoding="utf-8", errors="replace")

    return {
        "item": item,
        "script_filename": filename,
        "script_source": script_source,
    }


def save_step_item_script_content(item_id: int, script_source: str) -> dict:
    init_orchestrator_store()
    text_value = _ensure_step_script_template(script_source or "")

    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT si.id, si.step_id, si.item_type, si.item_key, si.script_path,
                       s.step_key, s.workflow_key, pc.category_key
                FROM step_items si
                JOIN steps s ON s.id = si.step_id
                JOIN progress_categories pc ON pc.id = s.category_id
                WHERE si.id = %s
                LIMIT 1
                """,
                (int(item_id),),
            )
            row = cur.fetchone()
            if not row:
                raise ValueError("STEP_ITEM_NOT_FOUND")

            if _normalize_step_item_type(row.get("item_type")) != "script":
                raise ValueError("ITEM_NOT_SCRIPT")

            script_path = _normalize_text(row.get("script_path"), "")
            target_path: Path
            if script_path:
                target_path = Path(script_path)
                target_path.parent.mkdir(parents=True, exist_ok=True)
            else:
                target_path = _step_item_script_path(
                    row,
                    int(row.get("id") or item_id),
                    "script.py",
                )

            target_path.write_text(text_value, encoding="utf-8")

            cur.execute(
                """
                UPDATE step_items
                SET script_path = %s,
                    updated_at = %s
                WHERE id = %s
                """,
                (str(target_path), _utc_now_iso(), int(item_id)),
            )
        conn.commit()

    return get_step_item_script_content(item_id)


def list_step_item_parameters(item_id: int) -> list[dict]:
    init_orchestrator_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, item_id, param_key, label, param_type,
                      default_value, description, options_json, is_required, sort_order
                FROM step_item_parameters
                WHERE item_id = %s
                ORDER BY sort_order ASC, id ASC
                """,
                (int(item_id),),
            )
            rows = cur.fetchall() or []
    return [_step_item_param_row_to_dict(row) for row in rows]


def create_step_item_parameter(item_id: int, payload: dict) -> dict:
    init_orchestrator_store()
    now = _utc_now_iso()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM step_items WHERE id = %s", (int(item_id),))
            item = cur.fetchone()
            if not item:
                raise ValueError("STEP_ITEM_NOT_FOUND")

            cur.execute(
                """
                INSERT INTO step_item_parameters (
                    item_id, param_key, label, param_type,
                    default_value, description, options_json, is_required, sort_order,
                    created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    int(item_id),
                    _slugify(payload.get("param_key"), "param"),
                    _normalize_text(payload.get("label"), "Parametre"),
                    _normalize_text(payload.get("param_type"), "string").lower(),
                    _normalize_text(payload.get("default_value"), ""),
                    _normalize_text(payload.get("description"), ""),
                    json.dumps(payload.get("options_json", []), ensure_ascii=False),
                    1 if payload.get("is_required") else 0,
                    int(payload.get("sort_order") or 100),
                    now,
                    now,
                ),
            )
            created_id = int(cur.lastrowid)
            cur.execute(
                """
                SELECT id, item_id, param_key, label, param_type,
                      default_value, description, options_json, is_required, sort_order
                FROM step_item_parameters
                WHERE id = %s
                """,
                (created_id,),
            )
            row = cur.fetchone()
        conn.commit()
    return _step_item_param_row_to_dict(row)


def update_step_item_parameter(param_id: int, payload: dict) -> dict | None:
    init_orchestrator_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, item_id, param_key, label, param_type,
                      default_value, description, options_json, is_required, sort_order
                FROM step_item_parameters
                WHERE id = %s
                """,
                (int(param_id),),
            )
            exists = cur.fetchone()
            if not exists:
                return None

            mapping = {
                "label": ("label", lambda v: _normalize_text(v, "Parametre")),
                "param_type": ("param_type", lambda v: _normalize_text(v, "string").lower()),
                "default_value": ("default_value", lambda v: _normalize_text(v, "")),
                "description": ("description", lambda v: _normalize_text(v, "")),
                "options_json": ("options_json", lambda v: json.dumps(v if isinstance(v, (dict, list)) else [], ensure_ascii=False)),
                "is_required": ("is_required", lambda v: 1 if v else 0),
                "sort_order": ("sort_order", lambda v: int(v)),
            }
            fields: list[str] = []
            values: list = []
            for key, (field_name, transform) in mapping.items():
                if key in payload and payload[key] is not None:
                    fields.append(f"{field_name} = %s")
                    values.append(transform(payload[key]))

            if fields:
                fields.append("updated_at = %s")
                values.append(_utc_now_iso())
                values.append(int(param_id))
                cur.execute(f"UPDATE step_item_parameters SET {', '.join(fields)} WHERE id = %s", tuple(values))

            cur.execute(
                """
                SELECT id, item_id, param_key, label, param_type,
                      default_value, description, options_json, is_required, sort_order
                FROM step_item_parameters
                WHERE id = %s
                """,
                (int(param_id),),
            )
            row = cur.fetchone()
        conn.commit()
    return _step_item_param_row_to_dict(row) if row else None


def delete_step_item_parameter(param_id: int) -> bool:
    init_orchestrator_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM step_item_parameters WHERE id = %s", (int(param_id),))
            deleted = cur.rowcount > 0
        conn.commit()
    return deleted


def replace_step_item_parameters(item_id: int, rows: list[dict]) -> list[dict]:
    init_orchestrator_store()
    now = _utc_now_iso()
    normalized_rows = rows if isinstance(rows, list) else []

    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM step_items WHERE id = %s", (int(item_id),))
            exists = cur.fetchone()
            if not exists:
                raise ValueError("STEP_ITEM_NOT_FOUND")

            cur.execute("DELETE FROM step_item_parameters WHERE item_id = %s", (int(item_id),))

            for index, item in enumerate(normalized_rows):
                key = _slugify(item.get("key") or item.get("param_key"), "param")
                label = _normalize_text(item.get("label"), key)
                param_type = _normalize_text(item.get("type") or item.get("param_type"), "string").lower()
                default_value = item.get("default", item.get("default_value", ""))
                if isinstance(default_value, (dict, list)):
                    default_value = json.dumps(default_value, ensure_ascii=False)
                default_value = _normalize_text(str(default_value), "")
                description = _normalize_text(item.get("description"), "")
                options_value = item.get("options_json", item.get("options", []))
                if not isinstance(options_value, (list, dict)):
                    options_value = []
                sort_order = item.get("sort_order")
                try:
                    sort_order = int(sort_order)
                except Exception:
                    sort_order = index * 10

                cur.execute(
                    """
                    INSERT INTO step_item_parameters (
                        item_id, param_key, label, param_type,
                        default_value, description, options_json, is_required, sort_order,
                        created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        int(item_id),
                        key,
                        label,
                        param_type,
                        default_value,
                        description,
                        json.dumps(options_value, ensure_ascii=False),
                        1 if item.get("required") or item.get("is_required") else 0,
                        sort_order,
                        now,
                        now,
                    ),
                )
        conn.commit()

    return list_step_item_parameters(item_id)


def list_workflow_steps(active_only: bool = True) -> list[dict]:
    db_steps = list_steps(active_only=active_only)

    role_map = {
        "scan": "test",
        "attack": "attack",
        "remediation": "remediation",
    }

    items: list[dict] = []
    for row in db_steps:
        workflow_key = _normalize_workflow_key(row.get("workflow_key"))
        items.append(
            {
                "id": int(row["id"]),
                "step_key": row["step_key"],
                "step_name": row.get("display_name") or row["step_key"],
                "workflow_key": workflow_key,
                "category_key": row.get("category_key") or "general",
                "description": row.get("description", ""),
                "sort_order": int(row["id"]),
                "role_required": role_map.get(workflow_key, "test"),
                "ai_prompt_hint": row.get("description", ""),
                "is_active": bool(row.get("is_active", True)),
            }
        )

    return items


def get_workflow_step(step_key: str) -> dict | None:
    key = (step_key or "").strip().lower()
    if not key:
        return None

    for item in list_workflow_steps(active_only=False):
        if (item.get("step_key") or "").strip().lower() == key:
            return dict(item)
    return None


def _tool_row_to_dict(row: dict, include_script_source: bool = False) -> dict:
    item = {
        "id": int(row["id"]),
        "step_id": int(row["step_id"]) if row.get("step_id") is not None else None,
        "step_key": _normalize_text(row.get("step_key"), _normalize_text(row.get("test_step"), "custom_step")).lower(),
        "step_display_name": _normalize_text(row.get("step_display_name"), _normalize_text(row.get("display_name"), "Step")),
        "action_key": row["action_key"],
        "tool_name": row["tool_name"],
        "display_name": row["display_name"],
        "workflow_key": _normalize_workflow_key(row.get("workflow_key")),
        "test_category": _normalize_text(row.get("test_category"), "general").lower(),
        "script_filename": _normalize_text(row.get("script_filename"), ""),
        "has_script": bool((row.get("script_source") or "").strip()) or bool((row.get("script_filename") or "").strip()),
        "tool_type": row.get("tool_type", "scanner"),
        "module_path": row.get("module_path", ""),
        "executable_path": row.get("executable_path", ""),
        "base_command": row.get("base_command", ""),
        "risk_level": _normalize_risk(row.get("risk_level")),
        "timeout_sec": int(row.get("timeout_sec") or 300),
        "requires_approval": bool(row.get("requires_approval")),
        "wordlist_path": row.get("wordlist_path", ""),
        "payload_path": row.get("payload_path", ""),
        "template_path": row.get("template_path", ""),
        "is_active": bool(row.get("is_active", True)),
    }

    if include_script_source:
        item["script_source"] = row.get("script_source") or ""

    return item


def update_tool(tool_id: int, payload: dict) -> dict | None:
    init_orchestrator_store()

    mapping = {
        "action_key": ("action_key", lambda v: v.strip().lower()),
        "tool_name": ("tool_name", lambda v: v.strip().lower()),
        "display_name": ("display_name", lambda v: v.strip()),
        "script_filename": ("script_filename", lambda v: _normalize_text(v, "")),
        "tool_type": ("tool_type", lambda v: v.strip().lower()),
        "module_path": ("module_path", lambda v: v.strip()),
        "executable_path": ("executable_path", lambda v: v.strip()),
        "base_command": ("base_command", lambda v: v.strip()),
        "risk_level": ("risk_level", _normalize_risk),
        "timeout_sec": ("timeout_sec", lambda v: int(v)),
        "requires_approval": ("requires_approval", lambda v: 1 if v else 0),
        "wordlist_path": ("wordlist_path", lambda v: v.strip()),
        "payload_path": ("payload_path", lambda v: v.strip()),
        "template_path": ("template_path", lambda v: v.strip()),
        "is_active": ("is_active", lambda v: 1 if v else 0),
    }

    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, action_key, workflow_key, test_category, test_step, display_name, step_id FROM tools WHERE id = %s", (tool_id,))
            exists = cur.fetchone()
            if not exists:
                return None

            new_action_key = (payload.get("action_key") or exists.get("action_key") or "").strip().lower()
            if new_action_key:
                cur.execute(
                    "SELECT id FROM tools WHERE action_key = %s AND id <> %s LIMIT 1",
                    (new_action_key, tool_id),
                )
                conflict = cur.fetchone()
                if conflict:
                    raise ValueError("ACTION_KEY_CONFLICT")

            fields: list[str] = []
            values: list = []
            for key, (field_name, transform) in mapping.items():
                if key in payload and payload[key] is not None:
                    fields.append(f"{field_name} = %s")
                    values.append(transform(payload[key]))

            if fields:
                fields.append("updated_at = %s")
                values.append(_utc_now_iso())
                values.append(tool_id)
                cur.execute(f"UPDATE tools SET {', '.join(fields)} WHERE id = %s", tuple(values))

            explicit_step_id = payload.get("step_id")
            if explicit_step_id:
                step_context = _load_step_context(cur, int(explicit_step_id))
                if not step_context:
                    raise ValueError("STEP_NOT_FOUND")
                step_id, normalized_workflow, normalized_category, normalized_step = step_context
            else:
                desired_workflow = _normalize_workflow_key(payload.get("workflow_key") or exists.get("workflow_key"))
                desired_category = _normalize_text(payload.get("test_category"), exists.get("test_category") or "general").lower()
                desired_step_key = _normalize_text(payload.get("step_key"), payload.get("test_step") or exists.get("test_step") or "custom_step").lower()
                desired_step_display_name = _normalize_text(
                    payload.get("step_display_name"),
                    payload.get("display_name") or exists.get("display_name") or desired_step_key,
                )

                step_id, normalized_workflow, normalized_category, normalized_step = _resolve_or_create_step_id(
                    cur,
                    workflow_key=desired_workflow,
                    category_key=desired_category,
                    step_key=desired_step_key,
                    display_name=desired_step_display_name,
                    description=payload.get("step_description") or "",
                )

            cur.execute(
                """
                UPDATE tools
                SET step_id = %s,
                    workflow_key = %s,
                    test_category = %s,
                    test_step = %s,
                    updated_at = %s
                WHERE id = %s
                """,
                (step_id, normalized_workflow, normalized_category, normalized_step, _utc_now_iso(), tool_id),
            )

            cur.execute(
                """
                SELECT t.id, t.step_id, s.step_key, s.display_name AS step_display_name,
                       t.action_key, t.tool_name, t.display_name, t.tool_type, t.module_path,
                       COALESCE(s.workflow_key, t.workflow_key) AS workflow_key,
                       COALESCE(pc.category_key, t.test_category) AS test_category,
                       t.test_step AS test_step,
                       t.script_filename, t.script_source,
                       t.executable_path, t.base_command, t.risk_level, t.timeout_sec,
                       t.requires_approval, t.wordlist_path, t.payload_path, t.template_path,
                       t.is_active
                FROM tools t
                LEFT JOIN steps s ON s.id = t.step_id
                LEFT JOIN progress_categories pc ON pc.id = s.category_id
                WHERE t.id = %s
                """,
                (tool_id,),
            )
            row = cur.fetchone()

            if row:
                old_workflow = _normalize_workflow_key(exists.get("workflow_key"))
                old_category = _normalize_text(exists.get("test_category"), "general").lower()
                old_action = _normalize_text(exists.get("action_key"), "tool").lower()

                new_workflow = _normalize_workflow_key(row.get("workflow_key"))
                new_category = _normalize_text(row.get("test_category"), "general").lower()
                new_action = _normalize_text(row.get("action_key"), "tool").lower()

                if old_workflow != new_workflow or old_category != new_category or old_action != new_action:
                    _relocate_tool_scripts(
                        tool_id=tool_id,
                        workflow_key=new_workflow,
                        category_key=new_category,
                        action_key=new_action,
                    )
        conn.commit()

    return _tool_row_to_dict(row) if row else None


def list_tool_parameters(tool_id: int) -> list[dict]:
    init_orchestrator_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, tool_id, param_key, label, param_type, default_value,
                       is_required, is_editable, options_json, sort_order
                FROM tool_parameters
                WHERE tool_id = %s
                ORDER BY sort_order ASC, id ASC
                """,
                (tool_id,),
            )
            rows = cur.fetchall() or []

    return [_param_row_to_dict(row) for row in rows]


def create_tool_parameter(tool_id: int, payload: dict) -> dict:
    init_orchestrator_store()
    now = _utc_now_iso()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO tool_parameters (
                    tool_id, param_key, label, param_type, default_value,
                    is_required, is_editable, options_json, sort_order,
                    created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    tool_id,
                    payload["param_key"].strip(),
                    payload["label"].strip(),
                    payload.get("param_type", "string").strip().lower(),
                    payload.get("default_value", ""),
                    1 if payload.get("is_required") else 0,
                    1 if payload.get("is_editable", True) else 0,
                    json.dumps(payload.get("options_json", {}), ensure_ascii=False),
                    int(payload.get("sort_order") or 100),
                    now,
                    now,
                ),
            )
            created_id = int(cur.lastrowid)
            cur.execute(
                """
                SELECT id, tool_id, param_key, label, param_type, default_value,
                       is_required, is_editable, options_json, sort_order
                FROM tool_parameters WHERE id = %s
                """,
                (created_id,),
            )
            row = cur.fetchone()
        conn.commit()

    return _param_row_to_dict(row)


def update_tool_parameter(parameter_id: int, payload: dict) -> dict | None:
    init_orchestrator_store()

    mapping = {
        "label": ("label", lambda v: v.strip()),
        "param_type": ("param_type", lambda v: v.strip().lower()),
        "default_value": ("default_value", lambda v: v),
        "is_required": ("is_required", lambda v: 1 if v else 0),
        "is_editable": ("is_editable", lambda v: 1 if v else 0),
        "options_json": ("options_json", lambda v: json.dumps(v, ensure_ascii=False)),
        "sort_order": ("sort_order", lambda v: int(v)),
    }

    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM tool_parameters WHERE id = %s", (parameter_id,))
            exists = cur.fetchone()
            if not exists:
                return None

            fields: list[str] = []
            values: list = []
            for key, (field_name, transform) in mapping.items():
                if key in payload and payload[key] is not None:
                    fields.append(f"{field_name} = %s")
                    values.append(transform(payload[key]))

            if fields:
                fields.append("updated_at = %s")
                values.append(_utc_now_iso())
                values.append(parameter_id)
                cur.execute(f"UPDATE tool_parameters SET {', '.join(fields)} WHERE id = %s", tuple(values))

            cur.execute(
                """
                SELECT id, tool_id, param_key, label, param_type, default_value,
                       is_required, is_editable, options_json, sort_order
                FROM tool_parameters WHERE id = %s
                """,
                (parameter_id,),
            )
            row = cur.fetchone()
        conn.commit()

    return _param_row_to_dict(row) if row else None


def get_tool_with_parameters(action_key: str) -> dict | None:
    tool = get_tool_by_action(action_key)
    if not tool:
        return None

    tool["parameters"] = list_tool_parameters(int(tool["id"]))
    tool["scripts"] = list_tool_scripts(int(tool["id"]))
    return tool


def get_tool_script(tool_id: int) -> dict | None:
    init_orchestrator_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, action_key, display_name, test_category, test_step,
                       script_filename, script_source
                FROM tools
                WHERE id = %s
                LIMIT 1
                """,
                (tool_id,),
            )
            row = cur.fetchone()

    if not row:
        return None

    return {
        "tool_id": int(row["id"]),
        "action_key": row["action_key"],
        "display_name": row["display_name"],
        "test_category": _normalize_text(row.get("test_category"), "general").lower(),
        "test_step": _normalize_text(row.get("test_step"), "custom_step").lower(),
        "script_filename": _normalize_text(row.get("script_filename"), ""),
        "script_source": row.get("script_source") or _default_script_source(row.get("test_category"), row.get("test_step")),
    }


def list_tool_scripts(tool_id: int) -> list[dict]:
    init_orchestrator_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, tool_id, script_name, filename, file_path, sort_order, is_active
                FROM tool_scripts
                WHERE tool_id = %s
                ORDER BY sort_order ASC, id ASC
                """,
                (tool_id,),
            )
            rows = cur.fetchall() or []

    return [_script_row_to_dict(row) for row in rows]


def create_tool_script(tool_id: int, payload: dict) -> dict:
    init_orchestrator_store()
    now = _utc_now_iso()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM tools WHERE id = %s", (tool_id,))
            exists = cur.fetchone()
            if not exists:
                raise ValueError("TOOL_NOT_FOUND")

            cur.execute(
                """
                SELECT action_key, workflow_key, test_category
                FROM tools
                WHERE id = %s
                LIMIT 1
                """,
                (tool_id,),
            )
            tool_row = cur.fetchone()
            if not tool_row:
                raise ValueError("TOOL_NOT_FOUND")

            sequence = _next_script_sequence(cur, tool_id)
            sort_order = int(payload.get("sort_order") or sequence)
            content = payload.get("content") or b""
            if not isinstance(content, (bytes, bytearray)) or not bytes(content).strip():
                raise ValueError("SCRIPT_CONTENT_REQUIRED")

            filename, file_path = _write_script_file(
                workflow_key=tool_row.get("workflow_key") or "scan",
                category_key=tool_row.get("test_category") or "general",
                action_key=tool_row.get("action_key") or "tool",
                sequence=sequence,
                content=bytes(content),
            )

            cur.execute(
                """
                INSERT INTO tool_scripts (
                    tool_id, script_name, filename, file_path, script_source,
                    sort_order, is_active, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, '', %s, %s, %s, %s)
                """,
                (
                    tool_id,
                    _normalize_text(payload.get("script_name"), f"script_{sort_order}"),
                    filename,
                    file_path,
                    sort_order,
                    1 if payload.get("is_active", True) else 0,
                    now,
                    now,
                ),
            )
            script_id = int(cur.lastrowid)
            cur.execute(
                """
                SELECT id, tool_id, script_name, filename, file_path, sort_order, is_active
                FROM tool_scripts
                WHERE id = %s
                """,
                (script_id,),
            )
            row = cur.fetchone()
        conn.commit()

    return _script_row_to_dict(row)


def update_tool_script_item(script_id: int, payload: dict) -> dict | None:
    init_orchestrator_store()
    mapping = {
        "script_name": ("script_name", lambda v: _normalize_text(v, "script")),
        "sort_order": ("sort_order", lambda v: int(v)),
        "is_active": ("is_active", lambda v: 1 if v else 0),
    }

    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM tool_scripts WHERE id = %s", (script_id,))
            exists = cur.fetchone()
            if not exists:
                return None

            fields: list[str] = []
            values: list = []
            for key, (field_name, transform) in mapping.items():
                if key in payload and payload[key] is not None:
                    fields.append(f"{field_name} = %s")
                    values.append(transform(payload[key]))

            if fields:
                fields.append("updated_at = %s")
                values.append(_utc_now_iso())
                values.append(script_id)
                cur.execute(f"UPDATE tool_scripts SET {', '.join(fields)} WHERE id = %s", tuple(values))

            if "content" in payload and payload.get("content") is not None:
                content = payload.get("content")
                if not isinstance(content, (bytes, bytearray)) or not bytes(content).strip():
                    raise ValueError("SCRIPT_CONTENT_REQUIRED")

                cur.execute(
                    """
                    SELECT ts.tool_id, ts.sort_order, ts.file_path,
                           t.action_key, t.workflow_key, t.test_category
                    FROM tool_scripts ts
                    JOIN tools t ON t.id = ts.tool_id
                    WHERE ts.id = %s
                    LIMIT 1
                    """,
                    (script_id,),
                )
                script_row = cur.fetchone()
                if script_row:
                    filename, new_path = _replace_script_file(
                        existing_file_path=script_row.get("file_path"),
                        workflow_key=script_row.get("workflow_key") or "scan",
                        category_key=script_row.get("test_category") or "general",
                        action_key=script_row.get("action_key") or "tool",
                        sequence=_extract_script_sequence(script_row.get("file_path"), 1),
                        content=bytes(content),
                    )
                    cur.execute(
                        """
                        UPDATE tool_scripts
                        SET filename = %s,
                            file_path = %s,
                            updated_at = %s
                        WHERE id = %s
                        """,
                        (filename, new_path, _utc_now_iso(), script_id),
                    )

            cur.execute(
                """
                SELECT ts.file_path, ts.sort_order, t.action_key, t.workflow_key, t.test_category
                FROM tool_scripts ts
                JOIN tools t ON t.id = ts.tool_id
                WHERE ts.id = %s
                LIMIT 1
                """,
                (script_id,),
            )
            normalize_row = cur.fetchone()
            if normalize_row:
                current_path = Path(normalize_row.get("file_path") or "")
                expected_filename = _build_script_filename(
                    normalize_row.get("action_key") or "tool",
                    _extract_script_sequence(current_path.name if current_path.name else "", 1),
                )
                expected_dir = _tool_script_dir(
                    normalize_row.get("workflow_key") or "scan",
                    normalize_row.get("test_category") or "general",
                    normalize_row.get("action_key") or "tool",
                )
                expected_dir.mkdir(parents=True, exist_ok=True)
                expected_path = expected_dir / expected_filename
                if current_path.exists() and current_path != expected_path:
                    if expected_path.exists():
                        raise ValueError("SCRIPT_NAME_CONFLICT")
                    shutil.move(str(current_path), str(expected_path))

                cur.execute(
                    """
                    UPDATE tool_scripts
                    SET filename = %s,
                        file_path = %s,
                        updated_at = %s
                    WHERE id = %s
                    """,
                    (expected_filename, str(expected_path), _utc_now_iso(), script_id),
                )

            cur.execute(
                """
                SELECT id, tool_id, script_name, filename, file_path, sort_order, is_active
                FROM tool_scripts
                WHERE id = %s
                """,
                (script_id,),
            )
            row = cur.fetchone()
        conn.commit()

    return _script_row_to_dict(row) if row else None


def delete_tool_script_item(script_id: int) -> bool:
    init_orchestrator_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT file_path FROM tool_scripts WHERE id = %s", (script_id,))
            row = cur.fetchone()
            cur.execute("DELETE FROM tool_scripts WHERE id = %s", (script_id,))
            deleted = cur.rowcount > 0
        conn.commit()

    if deleted and row:
        file_path = Path(row.get("file_path") or "")
        if file_path.exists():
            file_path.unlink(missing_ok=True)
    return deleted


def get_tool_script_content(script_id: int) -> dict | None:
    init_orchestrator_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, tool_id, script_name, filename, file_path
                FROM tool_scripts
                WHERE id = %s
                LIMIT 1
                """,
                (script_id,),
            )
            row = cur.fetchone()

    if not row:
        return None

    file_path = Path(row.get("file_path") or "")
    if not file_path.exists() or not file_path.is_file():
        raise ValueError("SCRIPT_FILE_NOT_FOUND")

    return {
        "id": int(row["id"]),
        "tool_id": int(row["tool_id"]),
        "script_name": _normalize_text(row.get("script_name"), "script"),
        "filename": _normalize_text(row.get("filename"), ""),
        "file_path": str(file_path),
        "content": file_path.read_text(encoding="utf-8"),
    }


def update_tool_script(tool_id: int, *, script_filename: str | None, script_source: str) -> dict | None:
    init_orchestrator_store()
    now = _utc_now_iso()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, test_category, test_step FROM tools WHERE id = %s", (tool_id,))
            row = cur.fetchone()
            if not row:
                return None

            source_to_save = (script_source or "").strip() or _default_script_source(row.get("test_category"), row.get("test_step"))
            filename_to_save = _normalize_text(script_filename, "")
            cur.execute(
                """
                UPDATE tools
                SET script_filename = %s,
                    script_source = %s,
                    updated_at = %s
                WHERE id = %s
                """,
                (filename_to_save, source_to_save, now, tool_id),
            )
        conn.commit()

    return get_tool_script(tool_id)


def delete_tool(tool_id: int) -> bool:
    init_orchestrator_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM tools WHERE id = %s", (tool_id,))
            deleted = cur.rowcount > 0
        conn.commit()
    return deleted


def create_tool_run(
    *,
    action_key: str,
    tool_id: int | None,
    requested_by: int | None,
    target: str,
    reason: str,
    resolved_command: str,
    params: dict,
    risk_level: str,
    approval_required: bool,
    approved: bool,
    status: str,
    output: dict,
) -> int:
    init_orchestrator_store()
    now = _utc_now_iso()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO tool_runs (
                    action_key, tool_id, requested_by, target, reason,
                    resolved_command, params_json, risk_level,
                    approval_required, approved, status, output_json,
                    started_at, finished_at, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    (action_key or "").strip().lower(),
                    tool_id,
                    requested_by,
                    target.strip(),
                    reason.strip(),
                    resolved_command,
                    json.dumps(params or {}, ensure_ascii=False),
                    _normalize_risk(risk_level),
                    1 if approval_required else 0,
                    1 if approved else 0,
                    status.strip().lower(),
                    json.dumps(output or {}, ensure_ascii=False),
                    now,
                    now,
                    now,
                ),
            )
            run_id = int(cur.lastrowid)
        conn.commit()
    return run_id


def create_validation_action(
    *,
    step_id: int | None = None,
    step_key: str,
    step_name: str,
    action_key: str,
    target: str,
    reason: str,
    parameters: dict,
    created_by: int | None,
    tool_run_id: int | None,
    evidence: dict,
    ai_analysis: dict,
    status: str,
) -> int:
    init_orchestrator_store()
    now = _utc_now_iso()

    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SHOW COLUMNS FROM validation_actions LIKE 'step_id'")
            has_step_id = bool(cur.fetchone())

            columns = [
                "step_key",
                "step_name",
                "action_key",
                "target",
                "reason",
                "parameters_json",
                "tool_run_id",
                "evidence_json",
                "ai_analysis_json",
                "status",
                "created_by",
                "created_at",
                "updated_at",
            ]
            values = [
                (step_key or "scan").strip().lower(),
                (step_name or "Tarama").strip(),
                (action_key or "").strip().lower(),
                target.strip(),
                reason.strip(),
                json.dumps(parameters or {}, ensure_ascii=False),
                tool_run_id,
                json.dumps(evidence or {}, ensure_ascii=False),
                json.dumps(ai_analysis or {}, ensure_ascii=False),
                status.strip().lower(),
                created_by,
                now,
                now,
            ]

            if has_step_id:
                if step_id is None or int(step_id) <= 0:
                    raise ValueError("STEP_ID_REQUIRED")
                columns.insert(0, "step_id")
                values.insert(0, int(step_id))

            placeholders = ", ".join(["%s"] * len(columns))
            columns_sql = ", ".join(columns)
            cur.execute(
                f"INSERT INTO validation_actions ({columns_sql}) VALUES ({placeholders})",
                tuple(values),
            )
            action_id = int(cur.lastrowid)
        conn.commit()

    return action_id


def list_validation_actions(target: str | None = None) -> list[dict]:
    init_orchestrator_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            if target:
                cur.execute(
                    """
                    SELECT va.id, va.step_key, va.step_name, va.action_key,
                           va.target, va.reason, va.parameters_json, va.tool_run_id,
                           va.evidence_json, va.ai_analysis_json, va.status,
                           va.created_by, va.created_at, va.updated_at
                    FROM validation_actions va
                    WHERE va.target = %s
                    ORDER BY va.id DESC
                    """,
                    (target,),
                )
            else:
                cur.execute(
                    """
                    SELECT va.id, va.step_key, va.step_name, va.action_key,
                           va.target, va.reason, va.parameters_json, va.tool_run_id,
                           va.evidence_json, va.ai_analysis_json, va.status,
                           va.created_by, va.created_at, va.updated_at
                    FROM validation_actions va
                    ORDER BY va.id DESC
                    """
                )
            rows = cur.fetchall() or []

    items: list[dict] = []
    for row in rows:
        items.append(
            {
                "id": int(row["id"]),
                "step_id": None,
                "step_key": row["step_key"],
                "step_name": row["step_name"],
                "action_key": row["action_key"],
                "target": row["target"],
                "reason": row["reason"],
                "parameters": _safe_loads(row.get("parameters_json"), {}),
                "tool_run_id": row.get("tool_run_id"),
                "evidence": _safe_loads(row.get("evidence_json"), {}),
                "ai_analysis": _safe_loads(row.get("ai_analysis_json"), {}),
                "status": row.get("status", "unknown"),
                "created_by": row.get("created_by"),
                "created_at": row.get("created_at"),
                "updated_at": row.get("updated_at"),
            }
        )

    return items
