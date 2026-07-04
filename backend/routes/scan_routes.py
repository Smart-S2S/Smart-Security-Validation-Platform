import uuid
import socket
import subprocess
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, Form
from fastapi.responses import FileResponse, JSONResponse

from backend.auth import require_roles
from backend.i18n import normalize_lang, t
from backend.modules.test.target_utils import split_targets, validate_target_tokens
from backend.services.job_store import create_job, get_job
from backend.services.auth_store import ROLE_TEST
from backend.modules.test.scan_service import run_scan_job
from backend.utils.binary_resolver import resolve_binary


router = APIRouter()
SCAN_DIR = Path("scans").resolve()

PARAM_CONFLICT_RULES = {
    "nmap": {
        "mutex_groups": [
            ["verbose", "very-verbose"],
            ["timing-t2", "timing-t3", "timing-t4", "timing-t5"],
            ["min-rate-1000", "min-rate-5000"],
            ["version-intensity-5", "version-intensity-9"],
        ],
        "hard_conflicts": [
            ["aggressive-scan", "service-version"],
            ["aggressive-scan", "default-scripts"],
            ["aggressive-scan", "os-detection"],
            ["aggressive-scan", "traceroute"],
        ],
    },
    "masscan": {
        "mutex_groups": [
            ["rate-1000", "rate-5000"],
            ["wait-2", "wait-5"],
        ],
        "hard_conflicts": [],
    },
    "netdiscover": {
        "mutex_groups": [
            ["passive", "active"],
            ["scan-count-5", "scan-count-10"],
            ["sleep-1", "sleep-10"],
        ],
        "hard_conflicts": [],
    },
}


def _get_param_conflicts(scan_tool: str, selected_params: list[str], language: str = "tr") -> list[str]:
    rules = PARAM_CONFLICT_RULES.get(scan_tool, {})
    mutex_groups = rules.get("mutex_groups", [])
    hard_conflicts = rules.get("hard_conflicts", [])

    selected_set = set(selected_params)
    issues: list[str] = []

    for group in mutex_groups:
        selected_in_group = [item for item in group if item in selected_set]
        if len(selected_in_group) > 1:
            issues.append(t(language, "scan.route.sameGroupConflict", "Ayni gruptan birden fazla parametre secildi: {params}").replace("{params}", ", ".join(selected_in_group)))

    for left, right in hard_conflicts:
        if left in selected_set and right in selected_set:
            issues.append(t(language, "scan.route.hardConflict", "Birlikte kullanilamaz: {left} + {right}").replace("{left}", left).replace("{right}", right))

    return issues


def _normalize_selected_ports(selected_ports: list[str]) -> tuple[list[str], list[str]]:
    normalized: list[str] = []
    invalid: list[str] = []
    seen = set()

    for item in selected_ports:
        value = item.strip().lower()
        if not value:
            continue

        if value == "all":
            return ["all"], []

        if not value.isdigit():
            invalid.append(item)
            continue

        numeric = int(value)
        if numeric < 1 or numeric > 65535:
            invalid.append(item)
            continue

        port_text = str(numeric)
        if port_text in seen:
            continue

        seen.add(port_text)
        normalized.append(port_text)

    return normalized, invalid


def _parse_ipv4_addrs() -> list[dict]:
    try:
        ip_binary = resolve_binary("ip")
        if not ip_binary:
            return []

        completed = subprocess.run(
            [ip_binary, "-o", "-4", "addr", "show", "scope", "global"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        if completed.returncode != 0:
            return []

        rows = []
        for line in completed.stdout.splitlines():
            parts = line.split()
            # Example: 2: eth0    inet 192.168.1.20/24 brd ...
            if len(parts) < 4:
                continue
            iface = parts[1]
            cidr = parts[3]
            ip_only = cidr.split("/")[0]
            rows.append({
                "interface": iface,
                "ip": ip_only,
                "cidr": cidr,
            })

        return rows
    except Exception:
        return []


def _default_gateway() -> str:
    try:
        ip_binary = resolve_binary("ip")
        if not ip_binary:
            return "-"

        completed = subprocess.run(
            [ip_binary, "route", "show", "default"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        if completed.returncode != 0:
            return "-"

        # Example: default via 192.168.1.1 dev eth0
        parts = completed.stdout.strip().split()
        if "via" in parts:
            via_index = parts.index("via")
            if via_index + 1 < len(parts):
                return parts[via_index + 1]
        return "-"
    except Exception:
        return "-"


@router.get("/network-summary")
def network_summary(current_user: dict = Depends(require_roles(ROLE_TEST))):
    del current_user
    host = socket.gethostname()
    ipv4_rows = _parse_ipv4_addrs()

    return JSONResponse({
        "hostname": host,
        "gateway": _default_gateway(),
        "interfaces": ipv4_rows,
    })


@router.post("/scan")
def scan(
    background_tasks: BackgroundTasks,
    target: str = Form(...),
    scan_tool: str = Form(...),
    scan_params: str = Form(""),
    scan_ports: str = Form(""),
    language: str = Form("tr"),
    current_user: dict = Depends(require_roles(ROLE_TEST)),
):
    del current_user
    allowed_tools = {"nmap", "masscan", "netdiscover"}
    selected_tool = scan_tool.strip().lower()
    selected_language = normalize_lang(language)

    if selected_tool not in allowed_tools:
        return JSONResponse({"error": t(selected_language, "scan.route.invalidTool", "Geçersiz tarama aracı seçildi.")}, status_code=400)

    selected_params = [item.strip() for item in scan_params.split(",") if item.strip()]
    raw_selected_ports = [item.strip() for item in scan_ports.split(",") if item.strip()]
    selected_ports, invalid_ports = _normalize_selected_ports(raw_selected_ports)
    target_tokens = split_targets(target)
    target_validation_error = validate_target_tokens(target_tokens, selected_language)

    if invalid_ports:
        return JSONResponse({"error": t(selected_language, "scan.route.invalidPorts", "Gecersiz port degeri"), "details": invalid_ports}, status_code=400)

    if target_validation_error:
        return JSONResponse({"error": target_validation_error}, status_code=400)

    conflict_issues = _get_param_conflicts(selected_tool, selected_params, selected_language)
    if conflict_issues:
        return JSONResponse({"error": t(selected_language, "scan.route.paramConflict", "Parametre cakismasi"), "details": conflict_issues}, status_code=400)

    job_id = str(uuid.uuid4())

    create_job(
        job_id,
        target,
        scan_tool=selected_tool,
        scan_params=selected_params,
        scan_ports=selected_ports,
        language=selected_language,
    )
    background_tasks.add_task(run_scan_job, job_id, target, selected_tool, selected_params, selected_ports, selected_language)

    return JSONResponse({
        "job_id": job_id,
        "status": "queued",
        "language": selected_language,
    })


@router.get("/status/{job_id}")
def status(job_id: str, current_user: dict = Depends(require_roles(ROLE_TEST))):
    del current_user
    job = get_job(job_id)

    if not job:
        return JSONResponse({"error": t(None, "scan.route.jobNotFound", "Job bulunamadı")}, status_code=404)

    return job


@router.get("/download-scan-file")
def download_scan_file(file_name: str, language: str = "tr", current_user: dict = Depends(require_roles(ROLE_TEST))):
    del current_user
    safe_name = Path(file_name).name
    file_path = (SCAN_DIR / safe_name).resolve()

    if file_path.parent != SCAN_DIR or not file_path.exists() or not file_path.is_file():
        return JSONResponse({"error": t(language, "scan.route.fileNotFound", "Dosya bulunamadı")}, status_code=404)

    return FileResponse(
        path=str(file_path),
        filename=safe_name,
        media_type="application/octet-stream",
    )
