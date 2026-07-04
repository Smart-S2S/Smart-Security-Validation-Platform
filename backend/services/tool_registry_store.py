import json
import threading
from datetime import datetime, timezone

from backend.services.mysql_db import init_mysql_schema, mysql_conn


_LOCK = threading.Lock()
_VALID_RISK = {"low", "medium", "high", "critical"}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_risk(value: str | None) -> str:
    normalized = (value or "low").strip().lower()
    if normalized not in _VALID_RISK:
        return "low"
    return normalized


def _safe_json_loads(value: str | None, fallback):
    if not value:
        return fallback
    try:
        parsed = json.loads(value)
        return parsed
    except Exception:
        return fallback


def _seed_items() -> list[dict]:
    return [
        {
            "action_key": "service_detection",
            "display_name": "Service Detection",
            "tool_name": "nmap",
            "module_path": "backend.modules.test.scanners.nmap_scanner.run_nmap_scan",
            "command_template": "nmap -sV -sC -T3 -oX <scan_file> <target>",
            "default_params": {
                "scan_params": ["service-version", "default-scripts"],
                "scan_ports": ["22", "80", "443"],
            },
            "risk_level": "medium",
            "requires_approval": True,
            "is_active": True,
        },
        {
            "action_key": "port_discovery_fast",
            "display_name": "Fast Port Discovery",
            "tool_name": "masscan",
            "module_path": "backend.modules.test.scanners.masscan_scanner.run_masscan_scan",
            "command_template": "masscan <target> --rate 1000 -p 1-65535 -oL <scan_file>",
            "default_params": {
                "scan_params": ["rate-1000", "wait-2"],
                "scan_ports": ["all"],
            },
            "risk_level": "high",
            "requires_approval": True,
            "is_active": True,
        },
        {
            "action_key": "local_network_discovery",
            "display_name": "Local Network Discovery",
            "tool_name": "netdiscover",
            "module_path": "backend.modules.test.scanners.netdiscover_scanner.run_netdiscover_scan",
            "command_template": "netdiscover -r <target> -P",
            "default_params": {
                "scan_params": ["active", "scan-count-5"],
                "scan_ports": [],
            },
            "risk_level": "medium",
            "requires_approval": True,
            "is_active": True,
        },
    ]


def init_tool_registry_store() -> None:
    with _LOCK:
        init_mysql_schema()
        seed_data = _seed_items()

        with mysql_conn() as conn:
            with conn.cursor() as cur:
                for item in seed_data:
                    now = _utc_now_iso()
                    cur.execute(
                        """
                        INSERT INTO tool_registry (
                            action_key,
                            display_name,
                            tool_name,
                            module_path,
                            command_template,
                            default_params_json,
                            risk_level,
                            requires_approval,
                            is_active,
                            created_at,
                            updated_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON DUPLICATE KEY UPDATE
                            display_name = VALUES(display_name),
                            tool_name = VALUES(tool_name),
                            module_path = VALUES(module_path),
                            command_template = VALUES(command_template),
                            default_params_json = VALUES(default_params_json),
                            risk_level = VALUES(risk_level),
                            requires_approval = VALUES(requires_approval),
                            is_active = VALUES(is_active),
                            updated_at = VALUES(updated_at)
                        """,
                        (
                            item["action_key"],
                            item["display_name"],
                            item["tool_name"],
                            item["module_path"],
                            item["command_template"],
                            json.dumps(item.get("default_params", {}), ensure_ascii=False),
                            _normalize_risk(item.get("risk_level")),
                            1 if item.get("requires_approval") else 0,
                            1 if item.get("is_active", True) else 0,
                            now,
                            now,
                        ),
                    )
            conn.commit()


def _row_to_item(row: dict) -> dict:
    return {
        "id": row["id"],
        "action_key": row["action_key"],
        "display_name": row.get("display_name", row["action_key"]),
        "tool_name": row["tool_name"],
        "module_path": row.get("module_path", ""),
        "command_template": row.get("command_template", ""),
        "default_params": _safe_json_loads(row.get("default_params_json"), {}),
        "risk_level": _normalize_risk(row.get("risk_level")),
        "requires_approval": bool(row.get("requires_approval")),
        "is_active": bool(row.get("is_active", True)),
    }


def list_tool_actions(active_only: bool = True) -> list[dict]:
    init_tool_registry_store()
    where_clause = "WHERE is_active = 1" if active_only else ""

    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, action_key, display_name, tool_name, module_path, command_template,
                       default_params_json, risk_level, requires_approval, is_active
                FROM tool_registry
                {where_clause}
                ORDER BY action_key ASC
                """
            )
            rows = cur.fetchall() or []

    return [_row_to_item(row) for row in rows]


def get_tool_action(action_key: str) -> dict | None:
    init_tool_registry_store()
    key = (action_key or "").strip().lower()
    if not key:
        return None

    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, action_key, display_name, tool_name, module_path, command_template,
                       default_params_json, risk_level, requires_approval, is_active
                FROM tool_registry
                WHERE action_key = %s
                LIMIT 1
                """,
                (key,),
            )
            row = cur.fetchone()

    return _row_to_item(row) if row else None


def create_tool_execution_audit(
    *,
    action_key: str,
    requested_by: int | None,
    target: str,
    reason: str,
    params: dict,
    risk_level: str,
    approval_required: bool,
    approved: bool,
    status: str,
    result: dict,
) -> int:
    init_tool_registry_store()

    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO tool_execution_audit (
                    action_key,
                    requested_by,
                    target,
                    reason,
                    params_json,
                    risk_level,
                    approval_required,
                    approved,
                    status,
                    result_json,
                    created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    (action_key or "").strip().lower(),
                    requested_by,
                    target.strip(),
                    reason.strip(),
                    json.dumps(params or {}, ensure_ascii=False),
                    _normalize_risk(risk_level),
                    1 if approval_required else 0,
                    1 if approved else 0,
                    status.strip(),
                    json.dumps(result or {}, ensure_ascii=False),
                    _utc_now_iso(),
                ),
            )
            created_id = int(cur.lastrowid)
        conn.commit()

    return created_id
