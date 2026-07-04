import re
import subprocess
import time
from pathlib import Path

from backend.i18n import t
from backend.modules.test.target_utils import split_targets, validate_target_tokens
from backend.services.job_store import add_log
from backend.services.settings_store import get_app_settings
from backend.utils.binary_resolver import resolve_binary


SCAN_DIR = Path("scans")
SCAN_DIR.mkdir(exist_ok=True)


def _looks_like_permission_error(stderr_text: str, stdout_text: str) -> bool:
    combined = f"{stderr_text}\n{stdout_text}".lower()
    signals = (
        "permission denied",
        "need to sudo",
        "must be root",
        "run as root",
        "operation not permitted",
        "cap_net_raw",
        "cap_net_admin",
    )
    return any(signal in combined for signal in signals)


MASSCAN_FLAG_PARAMS = {
    "banners": ["--banners"],
    "ping-scan": ["--ping"],
    "randomize-hosts": ["--randomize-hosts"],
    "exclude-arp": ["--exclude", "255.255.255.255"],
    "source-port-40000": ["--source-port", "40000"],
}


def _parse_masscan_list_output(file_path: Path) -> list[dict]:
    ports: list[dict] = []
    if not file_path.exists():
        return ports

    line_re = re.compile(r"^open\s+(\w+)\s+(\d+)\s+([^\s]+)")

    for line in file_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        match = line_re.match(line.strip())
        if not match:
            continue

        protocol, port, host = match.groups()
        ports.append(
            {
                "host": host,
                "port": port,
                "protocol": protocol,
                "state": "open",
                "service": "unknown",
                "product": "",
                "version": "",
            }
        )

    return ports


def _build_hosts_summary(ports: list[dict]) -> list[dict]:
    by_host: dict[str, int] = {}
    for item in ports:
        host = item.get("host") or "unknown"
        by_host[host] = by_host.get(host, 0) + 1

    return [
        {
            "host": host,
            "hostname": "-",
            "status": "up",
            "os": "unknown",
            "os_accuracy": "-",
            "open_ports": count,
        }
        for host, count in by_host.items()
    ]


def run_masscan_scan(
    target: str,
    job_id: str | None = None,
    scan_params: list[str] | None = None,
    scan_ports: list[str] | None = None,
    language: str = "tr",
) -> dict:
    safe_target = target.strip()
    target_tokens = [item for item in split_targets(safe_target) if item]
    target_validation_error = validate_target_tokens(target_tokens, language)
    selected_params = scan_params or []
    selected_ports = scan_ports or []

    if target_validation_error:
        return {"error": target_validation_error}

    timestamp = int(time.time())
    output_file = SCAN_DIR / f"masscan_{timestamp}.list"
    timeout_sec = int(get_app_settings().get("scan", {}).get("masscan_timeout_sec") or 600)

    masscan_binary = resolve_binary("masscan")
    if not masscan_binary:
        return {"error": t(language, "masscan.error.notInstalled", "Masscan kurulu degil veya PATH icinde bulunamadi.")}

    command = [masscan_binary]

    command.extend(target_tokens)

    if "all" in selected_ports:
        command.extend(["-p", "1-65535"])
    else:
        valid_ports = [port for port in selected_ports if port.isdigit() and 1 <= int(port) <= 65535]
        if valid_ports:
            command.extend(["-p", ",".join(valid_ports)])

    if "rate-5000" in selected_params:
        command.extend(["--rate", "5000"])
    elif "rate-1000" in selected_params:
        command.extend(["--rate", "1000"])
    else:
        command.extend(["--rate", "1000"])

    if "wait-5" in selected_params:
        command.extend(["--wait", "5"])
    elif "wait-2" in selected_params:
        command.extend(["--wait", "2"])

    for key, args in MASSCAN_FLAG_PARAMS.items():
        if key in selected_params:
            command.extend(args)

    # `--router-mac` requires a MAC address value; skip when not provided by UI.
    if "router-mac" in selected_params:
        add_log(job_id, t(language, "masscan.warn.routerMac", "router-mac parametresi MAC degeri gerektirdigi icin atlandi."))

    command.extend(["-oL", str(output_file)])

    add_log(job_id, t(language, "masscan.running", "Masscan taramasi calistiriliyor..."))

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout_sec,
        )

        if completed.returncode != 0:
            if _looks_like_permission_error(completed.stderr, completed.stdout):
                return {
                    "error": t(language, "masscan.error.permission", "Masscan icin root yetkisi (veya CAP_NET_RAW/CAP_NET_ADMIN) gerekir."),
                    "stderr": completed.stderr,
                    "stdout": completed.stdout,
                }
            return {
                "error": t(language, "masscan.error.generic", "Masscan hata verdi."),
                "stderr": completed.stderr,
                "stdout": completed.stdout,
            }

        ports = _parse_masscan_list_output(output_file)
        hosts = _build_hosts_summary(ports)

        add_log(job_id, t(language, "masscan.ports.found", "{count} port sonucu bulundu.").replace("{count}", str(len(ports))))

        return {
            "target": ", ".join(target_tokens),
            "xml_file": str(output_file),
            "ports": ports,
            "hosts": hosts,
        }

    except FileNotFoundError:
        return {"error": t(language, "masscan.error.notInstalled", "Masscan kurulu degil veya PATH icinde bulunamadi.")}
    except subprocess.TimeoutExpired:
        return {"error": t(language, "masscan.error.timeout", "Masscan taramasi zaman asimina ugradi.")}
    except Exception as exc:
        return {"error": t(language, "masscan.error.exception", "Hata olustu: {message}").replace("{message}", str(exc))}
