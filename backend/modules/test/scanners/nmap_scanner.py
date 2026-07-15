import os
import subprocess
import time
from pathlib import Path

from lxml import etree

from backend.i18n import t
from backend.modules.test.target_utils import split_targets, validate_target_tokens
from backend.services.job_store import add_log
from backend.services.settings_store import get_app_settings
from backend.utils.binary_resolver import resolve_binary


SCAN_DIR = Path("scans")
SCAN_DIR.mkdir(exist_ok=True)

USE_FAKE_NMAP_RESPONSE = False


FAKE_NMAP_PORTS = [
    {
        "port": "22",
        "protocol": "tcp",
        "state": "open",
        "service": "ssh",
        "product": "OpenSSH",
        "version": "9.6p1 Ubuntu 3ubuntu13.16",
    },
    {
        "port": "80",
        "protocol": "tcp",
        "state": "open",
        "service": "http",
        "product": "",
        "version": "",
    },
    {
        "port": "443",
        "protocol": "tcp",
        "state": "open",
        "service": "https",
        "product": "",
        "version": "",
    },
    {
        "port": "3000",
        "protocol": "tcp",
        "state": "open",
        "service": "ppp",
        "product": "",
        "version": "",
    },
    {
        "port": "8000",
        "protocol": "tcp",
        "state": "open",
        "service": "http-alt",
        "product": "uvicorn",
        "version": "",
    },
]


def _build_fake_ports(target_tokens: list[str]) -> list[dict]:
    ports: list[dict] = []
    targets = target_tokens or ["unknown"]
    for host in targets:
        for item in FAKE_NMAP_PORTS:
            ports.append(
                {
                    "host": host,
                    "port": item["port"],
                    "protocol": item["protocol"],
                    "state": item["state"],
                    "service": item["service"],
                    "product": item["product"],
                    "version": item["version"],
                }
            )

    return ports


def _build_fake_hosts(target_tokens: list[str]) -> list[dict]:
    hosts: list[dict] = []
    targets = target_tokens or ["unknown"]
    for host in targets:
        hosts.append(
            {
                "host": host,
                "hostname": "-",
                "status": "up",
                "os": "unknown",
                "os_accuracy": "-",
                "open_ports": len(FAKE_NMAP_PORTS),
            }
        )

    return hosts


def _extract_host_address(host_node) -> str:
    for address in host_node.findall("address"):
        if address.get("addr"):
            if address.get("addrtype") == "ipv4":
                return address.get("addr")

    for address in host_node.findall("address"):
        if address.get("addr"):
            return address.get("addr")

    return "unknown"


def _extract_host_metadata(host_node) -> dict:
    host_address = _extract_host_address(host_node)

    hostname = "-"
    hostnames_node = host_node.find("hostnames")
    if hostnames_node is not None:
        first_hostname = hostnames_node.find("hostname")
        if first_hostname is not None and first_hostname.get("name"):
            hostname = first_hostname.get("name")

    status_value = "unknown"
    status_node = host_node.find("status")
    if status_node is not None and status_node.get("state"):
        status_value = status_node.get("state")

    os_name = "unknown"
    os_accuracy = "-"
    os_node = host_node.find("os")
    if os_node is not None:
        os_match = os_node.find("osmatch")
        if os_match is not None:
            os_name = os_match.get("name") or "unknown"
            os_accuracy = os_match.get("accuracy") or "-"

    open_ports = 0
    for port in host_node.xpath(".//port"):
        state = port.find("state")
        if state is not None and state.get("state") == "open":
            open_ports += 1

    return {
        "host": host_address,
        "hostname": hostname,
        "status": status_value,
        "os": os_name,
        "os_accuracy": os_accuracy,
        "open_ports": open_ports,
    }


NMAP_FLAG_PARAMS = {
    "service-version": "-sV",
    "default-scripts": "-sC",
    "os-detection": "-O",
    "aggressive-scan": "-A",
    "syn-scan": "-sS",
    "udp-scan": "-sU",
    "ping-skip": "-Pn",
    "dns-skip": "-n",
    "open-only": "--open",
    "packet-reason": "--reason",
    "traceroute": "--traceroute",
}


def run_nmap_scan(
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

    if USE_FAKE_NMAP_RESPONSE:
        fake_ports = _build_fake_ports(target_tokens)
        fake_hosts = _build_fake_hosts(target_tokens)
        add_log(job_id, t(language, "nmap.fake.lab", "Lab modu: sahte Nmap sonucu uretiliyor..."))
        if selected_params:
            add_log(job_id, t(language, "nmap.params", "Nmap parametreleri: {params}").replace("{params}", ", ".join(selected_params)))
        if selected_ports:
            add_log(job_id, t(language, "nmap.ports.selected", "Nmap port secimi: {ports}").replace("{ports}", ", ".join(selected_ports)))
        add_log(job_id, t(language, "nmap.ports.found", "{count} port sonucu bulundu.").replace("{count}", str(len(fake_ports))))
        return {
            "target": ", ".join(target_tokens),
            "xml_file": "mock://nmap_fake.xml",
            "ports": fake_ports,
            "hosts": fake_hosts,
        }

    timestamp = int(time.time())
    output_file = SCAN_DIR / f"nmap_{timestamp}.xml"
    timeout_sec = int(get_app_settings().get("scan", {}).get("nmap_timeout_sec") or 600)

    nmap_binary = resolve_binary("nmap")
    if not nmap_binary:
        error_message = t(language, "nmap.error.notInstalled", "Nmap kurulu degil veya PATH icinde bulunamadi.")
        add_log(job_id, error_message)
        return {"error": error_message}

    command = [nmap_binary]

    for key, flag in NMAP_FLAG_PARAMS.items():
        if key in selected_params:
            command.append(flag)

    # Keep one timing profile; fastest selected profile takes precedence.
    if "timing-t5" in selected_params:
        command.append("-T5")
    elif "timing-t4" in selected_params:
        command.append("-T4")
    elif "timing-t3" in selected_params:
        command.append("-T3")
    elif "timing-t2" in selected_params:
        command.append("-T2")
    else:
        command.append("-T3")

    # Verbosity is exclusive: -vv overrides -v.
    if "very-verbose" in selected_params:
        command.append("-vv")
    elif "verbose" in selected_params:
        command.append("-v")

    # Keep one min-rate option; higher one takes precedence.
    if "min-rate-5000" in selected_params:
        command.extend(["--min-rate", "5000"])
    elif "min-rate-1000" in selected_params:
        command.extend(["--min-rate", "1000"])

    if "version-intensity-9" in selected_params:
        command.extend(["--version-intensity", "9"])
    elif "version-intensity-5" in selected_params:
        command.extend(["--version-intensity", "5"])

    if "all" in selected_ports:
        command.append("-p-")
        add_log(job_id, t(language, "nmap.ports.all", "Nmap port listesi: all (1-65535)"))
    else:
        valid_ports = [port for port in selected_ports if port.isdigit() and 1 <= int(port) <= 65535]
        if valid_ports:
            command.extend(["-p", ",".join(valid_ports)])
            add_log(job_id, t(language, "nmap.ports.list", "Nmap port listesi: {ports}").replace("{ports}", ",".join(valid_ports)))

    if selected_params:
        add_log(job_id, t(language, "nmap.params.list", "Nmap parametre listesi: {params}").replace("{params}", ",".join(selected_params)))

    command.extend([
        "-oX",
        str(output_file),
    ])

    command.extend(target_tokens)

    add_log(job_id, t(language, "nmap.running", "Nmap taramasi calistiriliyor..."))

    # nmap only auto-detects privilege via euid==0. The binary is granted
    # cap_net_raw/cap_net_admin (see deploy), so NMAP_PRIVILEGED=1 tells nmap to
    # use them — enabling -O/-sS/-sU/-A without running the server as root.
    scan_env = os.environ.copy()
    scan_env["NMAP_PRIVILEGED"] = "1"

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            env=scan_env,
            # Lower CPU priority so a heavy scan never starves the web app.
            preexec_fn=lambda: os.nice(10),
        )

        # nmap can exit non-zero yet still write a valid XML (e.g. some hosts down,
        # a script error on one host). Prefer the parsed XML whenever it is present
        # and parseable, so a partial-but-useful result is not thrown away.
        add_log(job_id, t(language, "nmap.parsing", "Nmap XML ciktisi parse ediliyor..."))
        parsed = None
        if output_file.exists():
            try:
                parsed = parse_nmap_xml(output_file)
            except Exception:
                parsed = None

        if parsed is not None and (parsed["ports"] or parsed["hosts"]):
            add_log(job_id, t(language, "nmap.ports.found", "{count} port sonucu bulundu.").replace("{count}", str(len(parsed["ports"]))))
            return {
                "target": ", ".join(target_tokens),
                "xml_file": str(output_file),
                "ports": parsed["ports"],
                "hosts": parsed["hosts"],
            }

        if completed.returncode != 0:
            add_log(job_id, t(language, "nmap.error.generic", "Nmap hata verdi."))
            return {
                "error": t(language, "nmap.error.generic", "Nmap hata verdi."),
                "stderr": completed.stderr,
                "stdout": completed.stdout,
            }

        # Ran cleanly but found nothing.
        add_log(job_id, t(language, "nmap.ports.found", "{count} port sonucu bulundu.").replace("{count}", "0"))
        return {
            "target": ", ".join(target_tokens),
            "xml_file": str(output_file),
            "ports": parsed["ports"] if parsed else [],
            "hosts": parsed["hosts"] if parsed else [],
        }

    except subprocess.TimeoutExpired:
        add_log(job_id, t(language, "nmap.error.timeout", "Tarama zaman asimina ugradi."))
        return {"error": t(language, "nmap.error.timeout", "Tarama zaman asimina ugradi.")}

    except FileNotFoundError:
        error_message = t(language, "nmap.error.notInstalled", "Nmap kurulu degil veya PATH icinde bulunamadi.")
        add_log(job_id, error_message)
        return {"error": error_message}

    except Exception as exc:
        add_log(job_id, t(language, "nmap.error.exception", "Hata olustu: {message}").replace("{message}", str(exc)))
        return {"error": t(language, "nmap.error.exception", "Hata olustu: {message}").replace("{message}", str(exc))}


def parse_nmap_xml(xml_path: Path) -> dict:
    tree = etree.parse(str(xml_path))
    ports = []
    hosts = []

    for host in tree.xpath("//host"):
        host_info = _extract_host_metadata(host)
        host_address = host_info["host"]
        hosts.append(host_info)
        for port in host.xpath(".//port"):
            state = port.find("state")
            service = port.find("service")

            ports.append(
                {
                    "host": host_address,
                    "port": port.get("portid"),
                    "protocol": port.get("protocol"),
                    "state": state.get("state") if state is not None else "unknown",
                    "service": service.get("name") if service is not None else "unknown",
                    "product": service.get("product") if service is not None and service.get("product") else "",
                    "version": service.get("version") if service is not None and service.get("version") else "",
                }
            )

    return {
        "ports": ports,
        "hosts": hosts,
    }
