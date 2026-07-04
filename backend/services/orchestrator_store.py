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


def _safe_loads(raw: str | None, fallback):
    if not raw:
        return fallback
    try:
        return json.loads(raw)
    except Exception:
        return fallback


def _seed_workflow_steps() -> list[dict]:
    return [
        {
            "step_key": "validation_plan",
            "step_name": "Validation Plan",
            "description": "Scan bulgularina gore dogrulama aksiyonlarini planla.",
            "sort_order": 10,
            "role_required": "test",
            "ai_prompt_hint": "Servis dogrulama, temel guvenlik kontrolleri, sonraki test onceligi.",
            "is_active": True,
        },
        {
            "step_key": "evidence_risk_analysis",
            "step_name": "Evidence & Risk Analysis",
            "description": "Toplanan evidence uzerinden risk seviyesini netlestir.",
            "sort_order": 20,
            "role_required": "test",
            "ai_prompt_hint": "Evidence siniflandirma, teknik etki, is etkisi, risk skoru.",
            "is_active": True,
        },
        {
            "step_key": "remediation_plan",
            "step_name": "Remediation Plan",
            "description": "Riskleri azaltacak uygulanabilir duzeltme planini olustur.",
            "sort_order": 30,
            "role_required": "remediation",
            "ai_prompt_hint": "Hardening adimlari, konfigurasyon duzeltmeleri, retest kriterleri.",
            "is_active": True,
        },
    ]


def _seed_tools() -> list[dict]:
    return [
        {
            "action_key": "service_detection",
            "tool_name": "nmap",
            "display_name": "Service Detection",
            "tool_type": "scanner",
            "module_path": "backend.modules.test.scanners.nmap_scanner.run_nmap_scan",
            "executable_path": "",
            "base_command": "nmap -sV -sC -T3 -oX <scan_file> <target>",
            "risk_level": "medium",
            "timeout_sec": 600,
            "requires_approval": True,
            "wordlist_path": "",
            "payload_path": "",
            "template_path": "",
            "is_active": True,
        },
        {
            "action_key": "port_discovery_fast",
            "tool_name": "masscan",
            "display_name": "Fast Port Discovery",
            "tool_type": "scanner",
            "module_path": "backend.modules.test.scanners.masscan_scanner.run_masscan_scan",
            "executable_path": "",
            "base_command": "masscan <target> --rate 1000 -p 1-65535 -oL <scan_file>",
            "risk_level": "high",
            "timeout_sec": 600,
            "requires_approval": True,
            "wordlist_path": "",
            "payload_path": "",
            "template_path": "",
            "is_active": True,
        },
        {
            "action_key": "local_network_discovery",
            "tool_name": "netdiscover",
            "display_name": "Local Network Discovery",
            "tool_type": "scanner",
            "module_path": "backend.modules.test.scanners.netdiscover_scanner.run_netdiscover_scan",
            "executable_path": "",
            "base_command": "netdiscover -r <target> -P",
            "risk_level": "medium",
            "timeout_sec": 180,
            "requires_approval": True,
            "wordlist_path": "",
            "payload_path": "",
            "template_path": "",
            "is_active": True,
        },
    ]


def _seed_tool_parameters() -> dict[str, list[dict]]:
    return {
        "service_detection": [
            {
                "param_key": "scan_params",
                "label": "Nmap Parameters",
                "param_type": "list",
                "default_value": json.dumps(["service-version", "default-scripts"], ensure_ascii=False),
                "is_required": True,
                "is_editable": True,
                "options_json": json.dumps(["service-version", "default-scripts", "os-detection", "aggressive-scan"], ensure_ascii=False),
                "sort_order": 10,
            },
            {
                "param_key": "scan_ports",
                "label": "Port List",
                "param_type": "list",
                "default_value": json.dumps(["22", "80", "443"], ensure_ascii=False),
                "is_required": True,
                "is_editable": True,
                "options_json": json.dumps(["22", "80", "443", "all"], ensure_ascii=False),
                "sort_order": 20,
            },
        ],
        "port_discovery_fast": [
            {
                "param_key": "scan_params",
                "label": "Masscan Parameters",
                "param_type": "list",
                "default_value": json.dumps(["rate-1000", "wait-2"], ensure_ascii=False),
                "is_required": True,
                "is_editable": True,
                "options_json": json.dumps(["rate-1000", "rate-5000", "wait-2", "wait-5"], ensure_ascii=False),
                "sort_order": 10,
            },
            {
                "param_key": "scan_ports",
                "label": "Port Range",
                "param_type": "list",
                "default_value": json.dumps(["all"], ensure_ascii=False),
                "is_required": True,
                "is_editable": True,
                "options_json": json.dumps(["all"], ensure_ascii=False),
                "sort_order": 20,
            },
        ],
        "local_network_discovery": [
            {
                "param_key": "scan_params",
                "label": "Netdiscover Parameters",
                "param_type": "list",
                "default_value": json.dumps(["active", "scan-count-5"], ensure_ascii=False),
                "is_required": True,
                "is_editable": True,
                "options_json": json.dumps(["active", "passive", "scan-count-5", "scan-count-10"], ensure_ascii=False),
                "sort_order": 10,
            },
            {
                "param_key": "scan_ports",
                "label": "Port List",
                "param_type": "list",
                "default_value": json.dumps([], ensure_ascii=False),
                "is_required": False,
                "is_editable": True,
                "options_json": json.dumps([], ensure_ascii=False),
                "sort_order": 20,
            },
        ],
    }


def init_orchestrator_store() -> None:
    with _LOCK:
        init_mysql_schema()
        now = _utc_now_iso()
        with mysql_conn() as conn:
            with conn.cursor() as cur:
                for step in _seed_workflow_steps():
                    cur.execute(
                        """
                        INSERT INTO workflow_steps (
                            step_key, step_name, description, sort_order, role_required,
                            ai_prompt_hint, is_active, created_at, updated_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON DUPLICATE KEY UPDATE
                            step_name = VALUES(step_name),
                            description = VALUES(description),
                            sort_order = VALUES(sort_order),
                            role_required = VALUES(role_required),
                            ai_prompt_hint = VALUES(ai_prompt_hint),
                            is_active = VALUES(is_active),
                            updated_at = VALUES(updated_at)
                        """,
                        (
                            step["step_key"],
                            step["step_name"],
                            step["description"],
                            step["sort_order"],
                            step["role_required"],
                            step["ai_prompt_hint"],
                            1 if step.get("is_active", True) else 0,
                            now,
                            now,
                        ),
                    )

                for tool in _seed_tools():
                    cur.execute(
                        """
                        INSERT INTO tools (
                            action_key, tool_name, display_name, tool_type, module_path,
                            executable_path, base_command, risk_level, timeout_sec,
                            requires_approval, wordlist_path, payload_path, template_path,
                            is_active, created_at, updated_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON DUPLICATE KEY UPDATE
                            tool_name = VALUES(tool_name),
                            display_name = VALUES(display_name),
                            tool_type = VALUES(tool_type),
                            module_path = VALUES(module_path),
                            executable_path = VALUES(executable_path),
                            base_command = VALUES(base_command),
                            risk_level = VALUES(risk_level),
                            timeout_sec = VALUES(timeout_sec),
                            requires_approval = VALUES(requires_approval),
                            wordlist_path = VALUES(wordlist_path),
                            payload_path = VALUES(payload_path),
                            template_path = VALUES(template_path),
                            is_active = VALUES(is_active),
                            updated_at = VALUES(updated_at)
                        """,
                        (
                            tool["action_key"],
                            tool["tool_name"],
                            tool["display_name"],
                            tool["tool_type"],
                            tool["module_path"],
                            tool["executable_path"],
                            tool["base_command"],
                            _normalize_risk(tool.get("risk_level")),
                            int(tool.get("timeout_sec") or 300),
                            1 if tool.get("requires_approval") else 0,
                            tool.get("wordlist_path", ""),
                            tool.get("payload_path", ""),
                            tool.get("template_path", ""),
                            1 if tool.get("is_active", True) else 0,
                            now,
                            now,
                        ),
                    )

                parameters_seed = _seed_tool_parameters()
                for action_key, rows in parameters_seed.items():
                    cur.execute("SELECT id FROM tools WHERE action_key = %s LIMIT 1", (action_key,))
                    tool_row = cur.fetchone()
                    if not tool_row:
                        continue
                    tool_id = int(tool_row["id"])

                    for row in rows:
                        cur.execute(
                            """
                            SELECT id FROM tool_parameters
                            WHERE tool_id = %s AND param_key = %s
                            LIMIT 1
                            """,
                            (tool_id, row["param_key"]),
                        )
                        exists = cur.fetchone()
                        if exists:
                            continue

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
                                row["param_key"],
                                row["label"],
                                row["param_type"],
                                row["default_value"],
                                1 if row.get("is_required") else 0,
                                1 if row.get("is_editable", True) else 0,
                                row["options_json"],
                                row["sort_order"],
                                now,
                                now,
                            ),
                        )

            conn.commit()


def _tool_row_to_dict(row: dict) -> dict:
    return {
        "id": int(row["id"]),
        "action_key": row["action_key"],
        "tool_name": row["tool_name"],
        "display_name": row["display_name"],
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


def _step_row_to_dict(row: dict) -> dict:
    return {
        "id": int(row["id"]),
        "step_key": row["step_key"],
        "step_name": row["step_name"],
        "description": row.get("description", ""),
        "sort_order": int(row.get("sort_order") or 100),
        "role_required": row.get("role_required", "test"),
        "ai_prompt_hint": row.get("ai_prompt_hint", ""),
        "is_active": bool(row.get("is_active", True)),
    }


def _param_row_to_dict(row: dict) -> dict:
    return {
        "id": int(row["id"]),
        "tool_id": int(row["tool_id"]),
        "param_key": row["param_key"],
        "label": row["label"],
        "param_type": row.get("param_type", "string"),
        "default_value": row.get("default_value", ""),
        "is_required": bool(row.get("is_required")),
        "is_editable": bool(row.get("is_editable", True)),
        "options": _safe_loads(row.get("options_json"), {}),
        "sort_order": int(row.get("sort_order") or 100),
    }


def list_workflow_steps(active_only: bool = True) -> list[dict]:
    init_orchestrator_store()
    where_clause = "WHERE is_active = 1" if active_only else ""
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, step_key, step_name, description, sort_order,
                       role_required, ai_prompt_hint, is_active
                FROM workflow_steps
                {where_clause}
                ORDER BY sort_order ASC, id ASC
                """
            )
            rows = cur.fetchall() or []
    return [_step_row_to_dict(row) for row in rows]


def get_workflow_step(step_key: str) -> dict | None:
    init_orchestrator_store()
    key = (step_key or "").strip().lower()
    if not key:
        return None

    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, step_key, step_name, description, sort_order,
                       role_required, ai_prompt_hint, is_active
                FROM workflow_steps
                WHERE step_key = %s
                LIMIT 1
                """,
                (key,),
            )
            row = cur.fetchone()

    return _step_row_to_dict(row) if row else None


def create_workflow_step(payload: dict) -> dict:
    init_orchestrator_store()
    now = _utc_now_iso()

    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO workflow_steps (
                    step_key, step_name, description, sort_order,
                    role_required, ai_prompt_hint, is_active,
                    created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    payload["step_key"].strip().lower(),
                    payload["step_name"].strip(),
                    payload.get("description", "").strip(),
                    int(payload.get("sort_order") or 100),
                    payload.get("role_required", "test").strip().lower(),
                    payload.get("ai_prompt_hint", "").strip(),
                    1 if payload.get("is_active", True) else 0,
                    now,
                    now,
                ),
            )
            created_id = int(cur.lastrowid)

            cur.execute(
                """
                SELECT id, step_key, step_name, description, sort_order,
                       role_required, ai_prompt_hint, is_active
                FROM workflow_steps
                WHERE id = %s
                """,
                (created_id,),
            )
            row = cur.fetchone()
        conn.commit()

    return _step_row_to_dict(row)


def update_workflow_step(step_id: int, payload: dict) -> dict | None:
    init_orchestrator_store()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM workflow_steps WHERE id = %s", (step_id,))
            existing = cur.fetchone()
            if not existing:
                return None

            fields: list[str] = []
            values: list = []
            mapping = {
                "step_name": ("step_name", lambda v: v.strip()),
                "description": ("description", lambda v: v.strip()),
                "sort_order": ("sort_order", lambda v: int(v)),
                "role_required": ("role_required", lambda v: v.strip().lower()),
                "ai_prompt_hint": ("ai_prompt_hint", lambda v: v.strip()),
                "is_active": ("is_active", lambda v: 1 if v else 0),
            }

            for key, (field_name, transform) in mapping.items():
                if key in payload and payload[key] is not None:
                    fields.append(f"{field_name} = %s")
                    values.append(transform(payload[key]))

            if not fields:
                cur.execute(
                    """
                    SELECT id, step_key, step_name, description, sort_order,
                           role_required, ai_prompt_hint, is_active
                    FROM workflow_steps WHERE id = %s
                    """,
                    (step_id,),
                )
                row = cur.fetchone()
                return _step_row_to_dict(row) if row else None

            fields.append("updated_at = %s")
            values.append(_utc_now_iso())
            values.append(step_id)

            cur.execute(
                f"UPDATE workflow_steps SET {', '.join(fields)} WHERE id = %s",
                tuple(values),
            )

            cur.execute(
                """
                SELECT id, step_key, step_name, description, sort_order,
                       role_required, ai_prompt_hint, is_active
                FROM workflow_steps WHERE id = %s
                """,
                (step_id,),
            )
            row = cur.fetchone()
        conn.commit()

    return _step_row_to_dict(row) if row else None


def list_tools(active_only: bool = False) -> list[dict]:
    init_orchestrator_store()
    where_clause = "WHERE is_active = 1" if active_only else ""

    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, action_key, tool_name, display_name, tool_type, module_path,
                       executable_path, base_command, risk_level, timeout_sec,
                       requires_approval, wordlist_path, payload_path, template_path,
                       is_active
                FROM tools
                {where_clause}
                ORDER BY action_key ASC
                """
            )
            rows = cur.fetchall() or []

    return [_tool_row_to_dict(row) for row in rows]


def get_tool_by_action(action_key: str) -> dict | None:
    init_orchestrator_store()
    key = (action_key or "").strip().lower()
    if not key:
        return None

    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, action_key, tool_name, display_name, tool_type, module_path,
                       executable_path, base_command, risk_level, timeout_sec,
                       requires_approval, wordlist_path, payload_path, template_path,
                       is_active
                FROM tools
                WHERE action_key = %s
                LIMIT 1
                """,
                (key,),
            )
            row = cur.fetchone()

    return _tool_row_to_dict(row) if row else None


def create_tool(payload: dict) -> dict:
    init_orchestrator_store()
    now = _utc_now_iso()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO tools (
                    action_key, tool_name, display_name, tool_type, module_path,
                    executable_path, base_command, risk_level, timeout_sec,
                    requires_approval, wordlist_path, payload_path, template_path,
                    is_active, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    payload["action_key"].strip().lower(),
                    payload["tool_name"].strip().lower(),
                    payload["display_name"].strip(),
                    payload.get("tool_type", "scanner").strip().lower(),
                    payload.get("module_path", "").strip(),
                    payload.get("executable_path", "").strip(),
                    payload.get("base_command", "").strip(),
                    _normalize_risk(payload.get("risk_level")),
                    int(payload.get("timeout_sec") or 300),
                    1 if payload.get("requires_approval", True) else 0,
                    payload.get("wordlist_path", "").strip(),
                    payload.get("payload_path", "").strip(),
                    payload.get("template_path", "").strip(),
                    1 if payload.get("is_active", True) else 0,
                    now,
                    now,
                ),
            )
            created_id = int(cur.lastrowid)
            cur.execute(
                """
                SELECT id, action_key, tool_name, display_name, tool_type, module_path,
                       executable_path, base_command, risk_level, timeout_sec,
                       requires_approval, wordlist_path, payload_path, template_path,
                       is_active
                FROM tools WHERE id = %s
                """,
                (created_id,),
            )
            row = cur.fetchone()
        conn.commit()

    return _tool_row_to_dict(row)


def update_tool(tool_id: int, payload: dict) -> dict | None:
    init_orchestrator_store()

    mapping = {
        "tool_name": ("tool_name", lambda v: v.strip().lower()),
        "display_name": ("display_name", lambda v: v.strip()),
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
            cur.execute("SELECT id FROM tools WHERE id = %s", (tool_id,))
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
                values.append(tool_id)
                cur.execute(f"UPDATE tools SET {', '.join(fields)} WHERE id = %s", tuple(values))

            cur.execute(
                """
                SELECT id, action_key, tool_name, display_name, tool_type, module_path,
                       executable_path, base_command, risk_level, timeout_sec,
                       requires_approval, wordlist_path, payload_path, template_path,
                       is_active
                FROM tools WHERE id = %s
                """,
                (tool_id,),
            )
            row = cur.fetchone()
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
    return tool


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
    step_id: int,
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
            cur.execute(
                """
                INSERT INTO validation_actions (
                    step_id, action_key, target, reason, parameters_json,
                    tool_run_id, evidence_json, ai_analysis_json, status,
                    created_by, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    step_id,
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
                ),
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
                    SELECT va.id, va.step_id, ws.step_key, ws.step_name, va.action_key,
                           va.target, va.reason, va.parameters_json, va.tool_run_id,
                           va.evidence_json, va.ai_analysis_json, va.status,
                           va.created_by, va.created_at, va.updated_at
                    FROM validation_actions va
                    JOIN workflow_steps ws ON ws.id = va.step_id
                    WHERE va.target = %s
                    ORDER BY va.id DESC
                    """,
                    (target,),
                )
            else:
                cur.execute(
                    """
                    SELECT va.id, va.step_id, ws.step_key, ws.step_name, va.action_key,
                           va.target, va.reason, va.parameters_json, va.tool_run_id,
                           va.evidence_json, va.ai_analysis_json, va.status,
                           va.created_by, va.created_at, va.updated_at
                    FROM validation_actions va
                    JOIN workflow_steps ws ON ws.id = va.step_id
                    ORDER BY va.id DESC
                    """
                )
            rows = cur.fetchall() or []

    items: list[dict] = []
    for row in rows:
        items.append(
            {
                "id": int(row["id"]),
                "step_id": int(row["step_id"]),
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
