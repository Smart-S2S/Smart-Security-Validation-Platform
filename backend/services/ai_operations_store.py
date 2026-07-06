"""Independent catalog for the AI Orchestrator (YZO).

The AI Orchestrator has its OWN operation catalog, fully separated from the
manual 3-way (scan/attack/remediation) flow's ``progress_categories → steps →
step_items`` tables. Its operations are derived from the pentest tool specs
(``pentest_tool_specs.iter_operations``) — one operation per tool — regardless
of whether the tool binary is currently installed on the host. This keeps the AI
catalog stable and lets the model reason over a clean, purpose-built table:

    ai_operations         one row per tool operation (stage, hints, script path)
    ai_operation_params   the rich parameter schema for each operation

Tables self-initialize (like ``pentest_tools``), so no change to the shared
schema bootstrap is required.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from backend.services.mysql_db import init_mysql_schema, mysql_conn
from backend.services.pentest_tool_specs import iter_operations
from backend.utils.binary_resolver import resolve_binary


_WRAPPER_DIR = Path(__file__).resolve().parents[2] / "data" / "ai_operations"

# scan is the entry stage; attack/remediation gate on the matching role.
STAGE_ROLE = {"scan": "test", "attack": "attack", "remediation": "remediation"}
STAGE_ORDER = {"scan": 0, "attack": 1, "remediation": 2}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_loads(raw, fallback):
    if raw in (None, ""):
        return fallback
    if isinstance(raw, (list, dict)):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return fallback


def init_ai_operations_store() -> None:
    init_mysql_schema()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS ai_operations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tool_key VARCHAR(64) NOT NULL DEFAULT '',
                    operation_key VARCHAR(120) NOT NULL UNIQUE,
                    stage VARCHAR(32) NOT NULL DEFAULT 'scan',
                    display_name VARCHAR(200) NOT NULL DEFAULT '',
                    description TEXT,
                    when_to_use TEXT,
                    script_path VARCHAR(255) NOT NULL DEFAULT '',
                    requires_tool TINYINT(1) NOT NULL DEFAULT 1,
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    sort_order INT NOT NULL DEFAULT 100,
                    created_at VARCHAR(64) NOT NULL DEFAULT '',
                    updated_at VARCHAR(64) NOT NULL DEFAULT ''
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS ai_operation_params (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    operation_id INT NOT NULL,
                    param_key VARCHAR(120) NOT NULL DEFAULT '',
                    label VARCHAR(200) NOT NULL DEFAULT '',
                    param_type VARCHAR(32) NOT NULL DEFAULT 'string',
                    default_value TEXT,
                    description TEXT,
                    options_json TEXT,
                    is_required TINYINT(1) NOT NULL DEFAULT 0,
                    sort_order INT NOT NULL DEFAULT 100,
                    created_at VARCHAR(64) NOT NULL DEFAULT '',
                    updated_at VARCHAR(64) NOT NULL DEFAULT '',
                    INDEX idx_ai_op_param_op (operation_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            # AI-orchestrator operations record into the shared validation_actions
            # history (so prefill + orchestration history keep working) but have no
            # manual step. Relax step_id to NULL once so those rows can omit it.
            # There is no FK on step_id, so this is a safe, backward-compatible widen.
            cur.execute("SHOW COLUMNS FROM validation_actions LIKE 'step_id'")
            col = cur.fetchone()
            if col and str(col.get("Null", "")).upper() == "NO":
                cur.execute("ALTER TABLE validation_actions MODIFY step_id INT NULL")
        conn.commit()


def _write_wrapper(operation_key: str, source: str) -> str:
    _WRAPPER_DIR.mkdir(parents=True, exist_ok=True)
    path = _WRAPPER_DIR / f"{operation_key}.py"
    path.write_text(source, encoding="utf-8")
    return str(path)


def _upsert_operation(cur, op: dict, script_path: str, sort_order: int) -> int:
    now = _utc_now()
    cur.execute(
        """
        INSERT INTO ai_operations (
            tool_key, operation_key, stage, display_name, description, when_to_use,
            script_path, requires_tool, is_active, sort_order, created_at, updated_at
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,1,%s,%s,%s)
        ON DUPLICATE KEY UPDATE
            tool_key=VALUES(tool_key), stage=VALUES(stage), display_name=VALUES(display_name),
            description=VALUES(description), when_to_use=VALUES(when_to_use),
            script_path=VALUES(script_path), requires_tool=VALUES(requires_tool),
            sort_order=VALUES(sort_order), updated_at=VALUES(updated_at)
        """,
        (
            op["tool_key"], op["operation_key"], op["stage"], op["display_name"],
            op.get("description", ""), op.get("when_to_use", ""), script_path,
            1 if op.get("requires_tool", True) else 0, sort_order, now, now,
        ),
    )
    cur.execute("SELECT id FROM ai_operations WHERE operation_key = %s", (op["operation_key"],))
    return int(cur.fetchone()["id"])


def _replace_params(cur, operation_id: int, params: list[dict]) -> None:
    now = _utc_now()
    cur.execute("DELETE FROM ai_operation_params WHERE operation_id = %s", (operation_id,))
    for index, param in enumerate(params):
        default_value = param.get("default", "")
        if isinstance(default_value, (list, dict)):
            default_value = json.dumps(default_value, ensure_ascii=False)
        options = param.get("options_json", [])
        if not isinstance(options, (list, dict)):
            options = []
        try:
            sort_order = int(param.get("sort_order"))
        except Exception:
            sort_order = index * 10
        cur.execute(
            """
            INSERT INTO ai_operation_params (
                operation_id, param_key, label, param_type, default_value, description,
                options_json, is_required, sort_order, created_at, updated_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                operation_id,
                str(param.get("key") or "").strip().lower(),
                str(param.get("label") or param.get("key") or "Parametre"),
                str(param.get("type") or "string").strip().lower(),
                "" if default_value is None else str(default_value),
                str(param.get("description") or ""),
                json.dumps(options, ensure_ascii=False),
                1 if param.get("required") else 0,
                sort_order,
                now,
                now,
            ),
        )


# ---------------------------------------------------------------------------
# AI-native operations: no CLI tool behind them — they run in-process and drive
# the LLM directly. Their script_path is a sentinel ("ai-native://...") that the
# execution route recognises to branch away from the subprocess wrapper path.
# These live ONLY in the YZO (AI) catalog and never in the manual 3YM flow.
# ---------------------------------------------------------------------------
AI_NATIVE_SCHEME = "ai-native://"

AI_NATIVE_OPERATIONS = [
    {
        "tool_key": "ai-osint",
        "operation_key": "ai_osint_recon",
        "stage": "scan",
        "display_name": "AI OSINT — Web Intelligence Gathering",
        "description": (
            "AI-driven OSINT: crawls the target website (and its sub-pages) and extracts "
            "data valuable for intrusion and intelligence such as names, usernames, emails, phones, home/work addresses, employee info, "
            "social media and exposed passwords/keys. "
            "Use only on authorized targets."
        ),
        "when_to_use": (
            "When the target is a website/organization, to gather personal/corporate data "
            "for the attack surface and intelligence. If content discovery was already done "
            "with dirb/ffuf/gobuster, it auto-includes the found sub-paths and scans deeper."
        ),
        "sentinel": AI_NATIVE_SCHEME + "osint_recon",
        "params": [
            {"key": "target_url", "label": "Target URL", "type": "url", "default": "",
             "required": False, "description": "Site to run OSINT on (e.g. https://org.com). Auto-fills from target if empty. Not required if a 'Pages to scan list' is provided.",
             "options_json": [], "sort_order": 10},
            {"key": "include_subpages", "label": "Scan sub-pages", "type": "boolean", "default": "on",
             "required": False, "description": "Also scans the page's links and previous dirb/ffuf/gobuster findings.",
             "options_json": [], "sort_order": 20},
            {"key": "max_pages", "label": "Max page count", "type": "number", "default": "1000",
             "required": False, "description": "Maximum number of pages to scan (1-2000). Excluded ones do not count toward this.",
             "options_json": [], "sort_order": 30},
            {"key": "extra_paths", "label": "Extra paths", "type": "string", "default": "",
             "required": False, "description": "Paths to add manually (comma-separated): /admin, /about, /team …",
             "options_json": [], "sort_order": 500},
            {"key": "focus", "label": "Focus", "type": "string", "default": "",
             "required": False, "description": "Optional: what to prioritize (e.g. 'emails and phones, employees').",
             "options_json": [], "sort_order": 510},
            {"key": "scan_list", "label": "Pages to scan list (XML/TXT file)", "type": "upload", "default": "",
             "required": False, "description": "Upload a file (.xml/.txt). If provided, ONLY these URLs are scanned (target not required, other scan parameters are ignored).",
             "options_json": [], "sort_order": 900},
            {"key": "exclude_list", "label": "Pages to exclude (XML/TXT file)", "type": "upload", "default": "",
             "required": False, "description": "Upload a file (.xml/.txt). These URLs/paths are not scanned and are not deducted from the max page count.",
             "options_json": [], "sort_order": 910},
        ],
    },
]


def seed_ai_native_operations() -> dict:
    """Upsert AI-native operations (idempotent) into the YZO catalog."""
    init_ai_operations_store()
    seeded = 0
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            for op in AI_NATIVE_OPERATIONS:
                sort_order = STAGE_ORDER.get(op["stage"], 9) * 1000 + 900 + seeded
                op_row = {
                    "tool_key": op["tool_key"],
                    "operation_key": op["operation_key"],
                    "stage": op["stage"],
                    "display_name": op["display_name"],
                    "description": op.get("description", ""),
                    "when_to_use": op.get("when_to_use", ""),
                    "requires_tool": False,
                }
                operation_id = _upsert_operation(cur, op_row, op["sentinel"], sort_order)
                _replace_params(cur, operation_id, op["params"])
                seeded += 1
        conn.commit()
    return {"seeded": seeded}


def seed_operations() -> dict:
    """(Re)generate every tool operation into the AI catalog + wrapper files.

    Idempotent: upserts operations by ``operation_key`` and fully replaces their
    parameter rows, so re-running after a spec change refreshes everything.
    """
    init_ai_operations_store()
    seeded = 0
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            for op in iter_operations():
                script_path = _write_wrapper(op["operation_key"], op["wrapper_source"])
                sort_order = STAGE_ORDER.get(op["stage"], 9) * 1000 + seeded
                operation_id = _upsert_operation(cur, op, script_path, sort_order)
                _replace_params(cur, operation_id, op["params"])
                seeded += 1
        conn.commit()
    return {"seeded": seeded}


def _param_row_to_dict(row: dict) -> dict:
    return {
        "id": int(row["id"]),
        "operation_id": int(row["operation_id"]),
        "param_key": str(row.get("param_key") or "").strip().lower(),
        "label": str(row.get("label") or "Parametre"),
        "param_type": str(row.get("param_type") or "string").strip().lower(),
        "default_value": row.get("default_value") if row.get("default_value") is not None else "",
        "description": str(row.get("description") or ""),
        "options_json": _safe_loads(row.get("options_json"), []),
        "is_required": bool(row.get("is_required")),
        "sort_order": int(row.get("sort_order") or 100),
    }


def _op_row_to_dict(row: dict, params: list[dict]) -> dict:
    tool_key = str(row.get("tool_key") or "")
    return {
        "id": int(row["id"]),
        "tool_key": tool_key,
        "operation_key": str(row.get("operation_key") or ""),
        "stage": str(row.get("stage") or "scan"),
        "display_name": str(row.get("display_name") or ""),
        "description": str(row.get("description") or ""),
        "when_to_use": str(row.get("when_to_use") or ""),
        "script_path": str(row.get("script_path") or ""),
        "requires_tool": bool(row.get("requires_tool", 1)),
        "installed": bool(resolve_binary(tool_key)) if tool_key else False,
        "is_active": bool(row.get("is_active", 1)),
        "sort_order": int(row.get("sort_order") or 100),
        "parameters": params,
    }


def _params_by_operation(cur, operation_ids: list[int]) -> dict:
    if not operation_ids:
        return {}
    placeholders = ",".join(["%s"] * len(operation_ids))
    cur.execute(
        f"""
        SELECT id, operation_id, param_key, label, param_type, default_value,
               description, options_json, is_required, sort_order
        FROM ai_operation_params
        WHERE operation_id IN ({placeholders})
        ORDER BY sort_order ASC, id ASC
        """,
        tuple(operation_ids),
    )
    grouped: dict = {}
    for row in cur.fetchall() or []:
        grouped.setdefault(int(row["operation_id"]), []).append(_param_row_to_dict(row))
    return grouped


def list_operations(stage: str | None = None, tool_key: str | None = None, active_only: bool = True) -> list[dict]:
    init_ai_operations_store()
    clauses: list[str] = []
    args: list = []
    if active_only:
        clauses.append("is_active = 1")
    if stage:
        clauses.append("stage = %s")
        args.append(str(stage).strip().lower())
    if tool_key:
        clauses.append("tool_key = %s")
        args.append(str(tool_key).strip())
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""

    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, tool_key, operation_key, stage, display_name, description,
                       when_to_use, script_path, requires_tool, is_active, sort_order
                FROM ai_operations
                {where}
                ORDER BY sort_order ASC, id ASC
                """,
                tuple(args),
            )
            rows = cur.fetchall() or []
            params = _params_by_operation(cur, [int(r["id"]) for r in rows])
    return [_op_row_to_dict(row, params.get(int(row["id"]), [])) for row in rows]


def count_operations() -> int:
    init_ai_operations_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS c FROM ai_operations")
            row = cur.fetchone()
    return int(row["c"]) if row else 0


def ensure_seeded() -> dict:
    """Seed the AI catalog on first run so fresh installs are never empty."""
    if count_operations() > 0:
        return {"seeded": 0, "skipped": True}
    return seed_operations()


def count_operations_by_stage(stage: str) -> int:
    init_ai_operations_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS c FROM ai_operations WHERE stage = %s", (stage,))
            row = cur.fetchone()
    return int(row["c"]) if row else 0


def ensure_stage_seeded(stage: str) -> dict:
    """Ensure the AI catalog contains operations for a given stage.

    Existing installs seeded before a stage (e.g. 'remediation') was added won't
    have those ops — running the idempotent full seed backfills them without
    disturbing existing rows (upsert by operation_key)."""
    if count_operations_by_stage(stage) > 0:
        return {"seeded": 0, "skipped": True}
    return seed_operations()


def deactivate_manual_kali_catalog() -> dict:
    """Move the AI tools OUT of the manual 3-way flow.

    The earlier tool-wrapper seed registered Kali tools as manual ``step_items``
    under ``kali_tools_scan``/``kali_tools_attack`` categories. Now that the AI
    Orchestrator owns them in its independent catalog, deactivate those manual
    entries so the manual flow shows only the operator's own Panel content. This
    is a reversible ``is_active=0`` toggle (no data is deleted).
    """
    init_ai_operations_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            # The old seed's steps end with "_kali_tools" (display "Kali Araclari").
            cur.execute(
                "SELECT id FROM steps WHERE (step_key LIKE %s OR display_name = %s) AND is_active = 1",
                ("%kali_tools", "Kali Araclari"),
            )
            step_ids = [int(r["id"]) for r in (cur.fetchall() or [])]
            if step_ids:
                step_ph = ",".join(["%s"] * len(step_ids))
                cur.execute(f"UPDATE step_items SET is_active = 0 WHERE step_id IN ({step_ph})", tuple(step_ids))
                cur.execute(f"UPDATE steps SET is_active = 0 WHERE id IN ({step_ph})", tuple(step_ids))
            # Also retire the now-orphan Kali categories from the old seed.
            cur.execute(
                "UPDATE progress_categories SET is_active = 0 "
                "WHERE category_key IN ('kali_tools_scan', 'kali_tools_attack') AND is_active = 1"
            )
        conn.commit()
    return {"deactivated_steps": len(step_ids)}


def get_operation_by_key(operation_key: str) -> dict | None:
    init_ai_operations_store()
    key = str(operation_key or "").strip().lower()
    if not key:
        return None
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, tool_key, operation_key, stage, display_name, description,
                       when_to_use, script_path, requires_tool, is_active, sort_order
                FROM ai_operations
                WHERE operation_key = %s
                LIMIT 1
                """,
                (key,),
            )
            row = cur.fetchone()
            if not row:
                return None
            params = _params_by_operation(cur, [int(row["id"])])
    return _op_row_to_dict(row, params.get(int(row["id"]), []))
