"""Findings extraction + semantic parameter seeding (AI semi-auto data flow).

The AI Orchestrator's tool wrappers emit mostly raw text (``output_tail``), so a
port discovered by nmap is not, by key name, the ``RPORT`` a Metasploit module
needs. This module bridges that gap:

* ``extract_findings(target)`` walks every prior operation's result for a target
  and pulls out the facts that matter for the next step — open ports, services
  and versions, discovered URLs, credentials, CVEs and Metasploit signals —
  from both structured result fields and the raw tool output.
* ``seed_params_from_findings(schema, params, findings)`` writes those facts into
  the *semantically* right (still-empty) parameters of the next operation, by
  key class (port/host/url/user/pass) rather than exact name.
* ``findings_summary(findings)`` is the compact block handed to the LLM so it can
  analyse concrete discovered data and choose the genuinely-needed next action.

Authorized-lab / owned-systems use only. Regex-based, no shell, no AI here.
"""

from __future__ import annotations

import re

from backend.services.orchestrator_store import list_validation_actions


# Raw-output patterns (work across nmap / masscan / dirb / ffuf / hydra / msf).
_PORT_RE = re.compile(r"(?m)^\s*(\d{1,5})/(tcp|udp)\s+open\s+([A-Za-z0-9._+?/-]+)?[ \t]*(.*)$")
_MASSCAN_RE = re.compile(r"(?i)discovered open port (\d{1,5})/(tcp|udp)")
_URL_RE = re.compile(r"https?://[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+")
_CVE_RE = re.compile(r"(?i)\bCVE-\d{4}-\d{3,7}\b")
_HYDRA_CRED = re.compile(r"(?i)\blogin:\s*([^\s]{1,64})\s+password:\s*([^\s]{1,128})")
_VULN_MARK = re.compile(r"(?i)\b(vulnerable|is vulnerable|appears vulnerable|exploit(?:ed)? successful)\b")

_WEB_PORTS = (80, 443, 8080, 8000, 8443, 8888, 3000, 5000, 8081, 8008, 9000)

# Parameter key classes for semantic seeding.
_SINGLE_PORT_KEYS = {"port", "rport", "target_port", "dport", "lport_target", "service_port"}
_LIST_PORT_KEYS = {"ports", "rports", "port_list", "scan_ports"}
_USER_KEYS = {"username", "user", "login", "user_name", "userid"}
_PASS_KEYS = {"password", "pass", "passwd", "pwd"}
_URL_KEYS = {"url", "base_url", "target_url"}
_URIPATH_KEYS = {"targeturi", "target_uri", "uri", "path", "login_endpoint", "login_path", "endpoint"}


def _as_lines(result: dict) -> list[str]:
    lines: list[str] = []
    tail = result.get("output_tail")
    if isinstance(tail, list):
        lines += [str(x) for x in tail]
    out = result.get("output")
    if isinstance(out, str):
        lines += out.splitlines()
    elif isinstance(out, list):
        lines += [str(x) for x in out]
    return lines


def _add_port(services: dict, port: int, name: str = "", info: str = "") -> None:
    if not (0 < port < 65536):
        return
    entry = services.setdefault(port, {"port": port, "name": "", "info": ""})
    if name and not entry["name"]:
        entry["name"] = name.strip()
    if info and not entry["info"]:
        entry["info"] = info.strip()[:120]


def extract_findings(target: str) -> dict:
    """Structured facts discovered for ``target`` across all prior operations."""
    services: dict = {}
    hosts: set = set()
    urls: list = []
    creds: list = []
    cves: set = set()
    vulnerable = False
    msf_session = False

    try:
        actions = list_validation_actions(target=target)
    except Exception:
        actions = []

    # Oldest-first so newer facts can refine earlier ones.
    for action in reversed(actions or []):
        evidence = action.get("evidence") if isinstance(action.get("evidence"), dict) else {}
        result = evidence.get("result") if isinstance(evidence.get("result"), dict) else {}
        if not isinstance(result, dict):
            continue

        # 1) Structured ports (from the scan_service / any wrapper that emits them).
        struct_ports = result.get("ports")
        if isinstance(struct_ports, list):
            for p in struct_ports:
                if not isinstance(p, dict):
                    continue
                try:
                    port = int(p.get("port"))
                except (TypeError, ValueError):
                    continue
                if str(p.get("state", "open")).lower() not in ("", "open"):
                    continue
                info = " ".join(str(p.get(k, "")) for k in ("product", "version")).strip()
                _add_port(services, port, str(p.get("service", "")), info)
                if p.get("host"):
                    hosts.add(str(p["host"]).strip())

        # 2) Metasploit signals (from _apply_msf_summary).
        if result.get("msf_vulnerable"):
            vulnerable = True
        if result.get("msf_session_opened"):
            msf_session = True

        # 3) Raw output text.
        blob = "\n".join(_as_lines(result))
        if blob:
            for m in _PORT_RE.finditer(blob):
                _add_port(services, int(m.group(1)), m.group(3) or "", m.group(4) or "")
            for m in _MASSCAN_RE.finditer(blob):
                _add_port(services, int(m.group(1)))
            for u in _URL_RE.findall(blob):
                u = u.rstrip(").,;'\"")
                if u not in urls and len(urls) < 100:
                    urls.append(u)
            for m in _HYDRA_CRED.finditer(blob):
                cred = {"username": m.group(1), "password": m.group(2)}
                if cred not in creds:
                    creds.append(cred)
            for c in _CVE_RE.findall(blob):
                cves.add(c.upper())
            if _VULN_MARK.search(blob):
                vulnerable = True

    if str(target or "").strip():
        hosts.add(str(target).strip())

    open_ports = sorted(services.keys())
    web_ports = [p for p in open_ports if p in _WEB_PORTS]
    return {
        "target": str(target or "").strip(),
        "hosts": sorted(hosts),
        "open_ports": open_ports,
        "web_ports": web_ports,
        "services": [services[p] for p in open_ports],
        "urls": urls,
        "creds": creds,
        "cves": sorted(cves),
        "vulnerable": bool(vulnerable),
        "msf_session": bool(msf_session),
    }


def _is_empty(value) -> bool:
    return value in (None, "", [], {})


def seed_params_from_findings(schema: list[dict], params: dict, findings: dict, *, skip_port: bool = False) -> dict:
    """Fill still-empty params from findings by key class (semantic, not by name).

    Only touches keys nothing else populated, so operator/AI values always win.
    ``skip_port`` is set for Metasploit ops: msf modules carry their own correct
    RPORT default, so filling it from a scan would override the right value.
    """
    if not findings:
        return params
    open_ports = findings.get("open_ports") or []
    web_ports = findings.get("web_ports") or []
    urls = findings.get("urls") or []
    creds = findings.get("creds") or []
    # A web-oriented op (has a url/uri param) should prefer a web port.
    schema_keys = {str(f.get("key") or "").strip().lower() for f in schema}
    web_oriented = bool(schema_keys & (_URL_KEYS | _URIPATH_KEYS))
    port_choice = (web_ports[0] if (web_oriented and web_ports) else (open_ports[0] if open_ports else None))
    first_path = ""
    if urls:
        from urllib.parse import urlsplit
        try:
            first_path = urlsplit(urls[0]).path or ""
        except Exception:
            first_path = ""

    for field in schema:
        key = str(field.get("key") or "").strip()
        low = key.lower()
        if not key or not _is_empty(params.get(key)):
            continue
        if low in _SINGLE_PORT_KEYS and port_choice is not None and not skip_port:
            params[key] = str(port_choice)
        elif low in _LIST_PORT_KEYS and open_ports and not skip_port:
            params[key] = ",".join(str(p) for p in open_ports)
        elif low in _USER_KEYS and creds:
            params[key] = creds[0].get("username", "")
        elif low in _PASS_KEYS and creds:
            params[key] = creds[0].get("password", "")
        elif low in _URL_KEYS and urls:
            params[key] = urls[0]
        elif low in _URIPATH_KEYS and first_path:
            params[key] = first_path
    return params


def findings_summary(findings: dict) -> dict:
    """Compact, LLM-facing view of the findings (bounded sizes)."""
    if not findings:
        return {}
    services = findings.get("services") or []
    return {
        "open_ports": findings.get("open_ports") or [],
        "web_ports": findings.get("web_ports") or [],
        "services": [
            {"port": s["port"], "name": s.get("name", ""), "info": s.get("info", "")}
            for s in services[:15]
        ],
        "urls": (findings.get("urls") or [])[:15],
        "credentials": (findings.get("creds") or [])[:10],
        "cves": (findings.get("cves") or [])[:15],
        "vulnerable": bool(findings.get("vulnerable")),
        "msf_session": bool(findings.get("msf_session")),
    }
