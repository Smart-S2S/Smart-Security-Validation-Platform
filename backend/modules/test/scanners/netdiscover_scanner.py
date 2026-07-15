import os
import re
import subprocess

from backend.i18n import t
from backend.modules.test.target_utils import split_targets, validate_target_tokens
from backend.services.job_store import add_log
from backend.services.settings_store import get_app_settings
from backend.utils.binary_resolver import resolve_binary


def _parse_netdiscover_output(text: str) -> list[dict]:
    hosts: list[dict] = []
    host_re = re.compile(r"^\s*(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9A-Fa-f:]{17})\s+\d+\s+\d+\s+(.+?)\s*$")

    for line in text.splitlines():
        match = host_re.match(line)
        if not match:
            continue

        ip, mac, vendor = match.groups()
        hosts.append(
            {
                "host": ip,
                "hostname": f"{vendor} ({mac})",
                "status": "up",
                "os": "unknown",
                "os_accuracy": "-",
                "open_ports": 0,
            }
        )

    dedup: dict[str, dict] = {}
    for item in hosts:
        dedup[item["host"]] = item

    return list(dedup.values())


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


def _build_command_for_target(command_prefix: list[str], target_token: str, selected_params: list[str]) -> list[str]:
    command = list(command_prefix)
    passive_mode = "passive" in selected_params

    if passive_mode:
        command.append("-p")
    else:
        command.extend(["-r", target_token])

    if "scan-count-10" in selected_params:
        command.extend(["-c", "10"])
    elif "scan-count-5" in selected_params:
        command.extend(["-c", "5"])
    elif passive_mode:
        # Passive mode can wait indefinitely; keep it bounded by default.
        command.extend(["-c", "5"])

    if "sleep-10" in selected_params:
        command.extend(["-s", "10"])
    elif "sleep-1" in selected_params:
        command.extend(["-s", "1"])

    if "ignore-home" in selected_params:
        command.append("-n")
    if "enable-file" in selected_params:
        command.append("-L")
    if "show-count" in selected_params:
        command.append("-N")

    command.append("-P")

    return command


def run_netdiscover_scan(
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
    timeout_sec = int(get_app_settings().get("scan", {}).get("netdiscover_timeout_sec") or 180)

    if target_validation_error:
        return {"error": target_validation_error}

    netdiscover_binary = resolve_binary("netdiscover")
    if not netdiscover_binary:
        return {"error": t(language, "netdiscover.error.notInstalled", "netdiscover kurulu degil veya PATH icinde bulunamadi.")}

    sudo_binary = resolve_binary("sudo")

    discovered_hosts: dict[str, dict] = {}

    add_log(job_id, t(language, "netdiscover.running", "netdiscover taramasi calistiriliyor..."))

    try:
        for token in target_tokens:
            command = _build_command_for_target([netdiscover_binary], token, selected_params)

            completed = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=timeout_sec,
                preexec_fn=lambda: os.nice(10),
            )

            if completed.returncode != 0 and _looks_like_permission_error(completed.stderr, completed.stdout) and sudo_binary:
                # Some netdiscover builds require euid==0 and ignore capabilities.
                sudo_command = _build_command_for_target([sudo_binary, "-n", netdiscover_binary], token, selected_params)
                completed = subprocess.run(
                    sudo_command,
                    capture_output=True,
                    text=True,
                    timeout=timeout_sec,
                    preexec_fn=lambda: os.nice(10),
                )

            if completed.returncode != 0:
                if _looks_like_permission_error(completed.stderr, completed.stdout):
                    return {
                        "error": t(language, "netdiscover.error.permission", "netdiscover icin root yetkisi (veya CAP_NET_RAW/CAP_NET_ADMIN) gerekir."),
                        "stderr": completed.stderr,
                        "stdout": completed.stdout,
                    }
                return {
                    "error": t(language, "netdiscover.error.generic", "netdiscover hata verdi."),
                    "stderr": completed.stderr,
                    "stdout": completed.stdout,
                }

            parsed = _parse_netdiscover_output(completed.stdout)

            for item in parsed:
                discovered_hosts[item["host"]] = item

        hosts = list(discovered_hosts.values())

        add_log(job_id, t(language, "netdiscover.hosts.found", "{count} host bulundu.").replace("{count}", str(len(hosts))))

        return {
            "target": ", ".join(target_tokens),
            "xml_file": "netdiscover://stdout",
            "ports": [],
            "hosts": hosts,
        }

    except FileNotFoundError:
        return {"error": t(language, "netdiscover.error.notInstalled", "netdiscover kurulu degil veya PATH icinde bulunamadi.")}
    except subprocess.TimeoutExpired:
        if "passive" in selected_params:
            return {
                "target": ", ".join(target_tokens),
                "xml_file": "netdiscover://stdout",
                "ports": [],
                "hosts": [],
                "warning": t(language, "netdiscover.warning.passiveNoTraffic", "Pasif modda zaman asimi: ARP trafigi gozlenmedigi icin host bulunamadi."),
            }
        return {"error": t(language, "netdiscover.error.timeout", "netdiscover taramasi zaman asimina ugradi.")}
    except Exception as exc:
        return {"error": t(language, "netdiscover.error.exception", "Hata olustu: {message}").replace("{message}", str(exc))}
