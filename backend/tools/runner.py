import json

from backend.i18n import t
from backend.modules.test.scanners.masscan_scanner import run_masscan_scan
from backend.modules.test.scanners.netdiscover_scanner import run_netdiscover_scan
from backend.modules.test.scanners.nmap_scanner import run_nmap_scan
from backend.services.orchestrator_store import create_tool_run, get_tool_with_parameters
from backend.tools.models import ActionIntent


def _run_action(tool_name: str, target: str, params: dict, language: str) -> dict:
    scan_params = list(params.get("scan_params") or [])
    scan_ports = list(params.get("scan_ports") or [])

    if tool_name == "nmap":
        return run_nmap_scan(target=target, scan_params=scan_params, scan_ports=scan_ports, language=language)
    if tool_name == "masscan":
        return run_masscan_scan(target=target, scan_params=scan_params, scan_ports=scan_ports, language=language)
    if tool_name == "netdiscover":
        return run_netdiscover_scan(target=target, scan_params=scan_params, scan_ports=scan_ports, language=language)

    return {"error": t(language, "scan.job.unsupportedTool", "Desteklenmeyen tarama aracı.")}


def _merge_params_from_registry(tool_entry: dict, user_params: dict) -> dict:
    merged: dict = {}
    provided = user_params or {}

    for param in tool_entry.get("parameters") or []:
        key = param.get("param_key")
        param_type = param.get("param_type") or "string"
        default_raw = param.get("default_value", "")

        default_value = default_raw
        if param_type in {"list", "json", "object"}:
            try:
                default_value = json.loads(default_raw) if default_raw else ([] if param_type == "list" else {})
            except Exception:
                default_value = [] if param_type == "list" else {}

        merged[key] = provided.get(key, default_value)

    for key, value in provided.items():
        if key not in merged:
            merged[key] = value

    return merged


def execute_action_intent(
    *,
    intent: ActionIntent,
    approved: bool,
    requested_by: int | None = None,
    language: str = "tr",
) -> dict:
    action_key = intent.action.strip().lower()
    target = intent.target.strip()
    reason = intent.reason.strip()

    tool_entry = get_tool_with_parameters(action_key)
    if not tool_entry or not tool_entry.get("is_active"):
        result = {
            "ok": False,
            "status": "tool_not_found",
            "action": action_key,
            "target": target,
            "approval_required": False,
            "risk_level": "low",
            "tool_name": "-",
            "output": {"error": t(language, "scan.route.invalidTool", "Geçersiz tarama aracı seçildi.")},
        }
        run_id = create_tool_run(
            action_key=action_key,
            tool_id=None,
            requested_by=requested_by,
            target=target,
            reason=reason,
            resolved_command="",
            params=intent.parameters,
            risk_level="low",
            approval_required=False,
            approved=False,
            status="tool_not_found",
            output=result,
        )
        result["run_id"] = run_id
        return result

    approval_required = bool(tool_entry.get("requires_approval"))
    risk_level = tool_entry.get("risk_level", "low")

    if approval_required and not approved:
        pending = {
            "ok": False,
            "status": "approval_required",
            "action": action_key,
            "target": target,
            "approval_required": True,
            "risk_level": risk_level,
            "tool_name": tool_entry.get("tool_name", "-"),
            "output": {
                "error": t(language, "validation.approvalRequired", "Bu action icin kullanici onayi gerekli"),
                "message": "Execution requires explicit user approval.",
            },
        }
        run_id = create_tool_run(
            action_key=action_key,
            tool_id=int(tool_entry["id"]),
            requested_by=requested_by,
            target=target,
            reason=reason,
            resolved_command=tool_entry.get("base_command", ""),
            params=intent.parameters,
            risk_level=risk_level,
            approval_required=True,
            approved=False,
            status="approval_required",
            output=pending,
        )
        pending["run_id"] = run_id
        return pending

    merged_params = _merge_params_from_registry(tool_entry, intent.parameters)
    action_output = _run_action(tool_entry.get("tool_name", ""), target, merged_params, language)

    status = "completed"
    ok = True
    if action_output.get("error"):
        status = "failed"
        ok = False

    result = {
        "ok": ok,
        "status": status,
        "action": action_key,
        "target": target,
        "approval_required": approval_required,
        "risk_level": risk_level,
        "tool_name": tool_entry.get("tool_name", "-"),
        "output": action_output,
        "applied_parameters": merged_params,
    }

    run_id = create_tool_run(
        action_key=action_key,
        tool_id=int(tool_entry["id"]),
        requested_by=requested_by,
        target=target,
        reason=reason,
        resolved_command=tool_entry.get("base_command", ""),
        params=merged_params,
        risk_level=risk_level,
        approval_required=approval_required,
        approved=approved,
        status=status,
        output=result,
    )
    result["run_id"] = run_id
    return result
