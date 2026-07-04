from backend.i18n import t
from backend.modules.test.scanners.masscan_scanner import run_masscan_scan
from backend.modules.test.scanners.netdiscover_scanner import run_netdiscover_scan
from backend.modules.test.scanners.nmap_scanner import run_nmap_scan
from backend.services.tool_registry_store import create_tool_execution_audit, get_tool_action
from backend.tools.models import ActionIntent


_SUPPORTED_ACTION_MAP = {
    "service_detection": "nmap",
    "port_discovery_fast": "masscan",
    "local_network_discovery": "netdiscover",
}


def _merge_params(default_params: dict, user_params: dict) -> dict:
    merged = dict(default_params or {})
    for key, value in (user_params or {}).items():
        merged[key] = value
    return merged


def _run_action(action_key: str, target: str, params: dict, language: str) -> dict:
    scan_params = list(params.get("scan_params") or [])
    scan_ports = list(params.get("scan_ports") or [])

    if action_key == "service_detection":
        return run_nmap_scan(
            target=target,
            scan_params=scan_params,
            scan_ports=scan_ports,
            language=language,
        )

    if action_key == "port_discovery_fast":
        return run_masscan_scan(
            target=target,
            scan_params=scan_params,
            scan_ports=scan_ports,
            language=language,
        )

    if action_key == "local_network_discovery":
        return run_netdiscover_scan(
            target=target,
            scan_params=scan_params,
            scan_ports=scan_ports,
            language=language,
        )

    return {
        "error": t(language, "scan.job.unsupportedTool", "Desteklenmeyen tarama aracı."),
    }


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

    tool_entry = get_tool_action(action_key)
    if not tool_entry or not tool_entry.get("is_active"):
        return {
            "ok": False,
            "status": "tool_not_found",
            "action": action_key,
            "target": target,
            "approval_required": False,
            "risk_level": "low",
            "tool_name": "-",
            "output": {
                "error": t(language, "scan.route.invalidTool", "Geçersiz tarama aracı seçildi."),
            },
        }

    approval_required = bool(tool_entry.get("requires_approval"))
    risk_level = tool_entry.get("risk_level", "low")

    if approval_required and not approved:
        pending_result = {
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
        create_tool_execution_audit(
            action_key=action_key,
            requested_by=requested_by,
            target=target,
            reason=reason,
            params=intent.parameters,
            risk_level=risk_level,
            approval_required=True,
            approved=False,
            status="approval_required",
            result=pending_result,
        )
        return pending_result

    merged_params = _merge_params(tool_entry.get("default_params", {}), intent.parameters)
    action_output = _run_action(action_key, target, merged_params, language)

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

    create_tool_execution_audit(
        action_key=action_key,
        requested_by=requested_by,
        target=target,
        reason=reason,
        params=merged_params,
        risk_level=risk_level,
        approval_required=approval_required,
        approved=approved,
        status=status,
        result=result,
    )

    return result
