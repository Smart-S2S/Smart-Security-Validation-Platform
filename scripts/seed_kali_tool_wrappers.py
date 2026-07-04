"""Seed executable Kali-tool wrapper scripts into the SSVP catalog.

Each wrapper is a normal SSVP step-item script (item_type=script) so the AI
orchestrator can pick it and fill its parameters. The wrappers run an
ALLOWLISTED external binary with a safely-built argv (never shell=True), stream
its output, and emit an SSVP_RESULT_JSON summary. A tool that is not installed
on the host reports ``tool_installed: false`` instead of crashing, so the flow
stays stable even when the operator has not installed that tool yet.

This is authorized-lab validation plumbing: it runs the operator's own tools
against authorized targets. It ships no exploit payloads — module/args are
operator/AI supplied and validated.

Run:  ./venv/bin/python -m scripts.seed_kali_tool_wrappers
"""

from __future__ import annotations

import re

from backend.services.orchestrator_store import (
    create_progress_category,
    create_step,
    create_step_item,
    list_progress_categories,
    list_step_items,
    list_steps,
    save_step_item_script_content,
)


def _slug(value: str, fallback: str = "item") -> str:
    token = re.sub(r"[^a-z0-9_]+", "_", (value or "").strip().lower()).strip("_")
    return token or fallback


# --- Shared wrapper source ---------------------------------------------------
# {TOOL}, {STAGE_LABEL} and {ARGV_BUILDER} are substituted per tool. The builder
# body receives `binary`, `params` (dict) and `target` (str) and must return an
# argv list; it may raise ValueError(msg) for invalid input.
_WRAPPER_TEMPLATE = '''# SSVP_SCRIPT_TEMPLATE_V1
"""Auto-generated SSVP wrapper for the "{TOOL}" tool ({STAGE_LABEL}).

Authorized lab / owned-systems validation only. Runs an allowlisted binary with
a safely built argv (no shell). Reports cleanly if the tool is not installed.
"""
import json
import os
import re
import shutil
import subprocess

TOOL = "{TOOL}"
_COMMON_DIRS = (
    "/usr/local/sbin", "/usr/local/bin", "/usr/sbin", "/usr/bin",
    "/sbin", "/bin", "/snap/bin", "/opt/metasploit-framework/bin",
)
_SAFE_TARGET = re.compile(r"^[A-Za-z0-9_.:/?=&%~+-]+$")


def _load():
    try:
        return json.loads(os.getenv("SSVP_INPUT_JSON", "{{}}"))
    except Exception:
        return {{}}


def _log(msg):
    print("[{TOOL_UPPER}] " + str(msg), flush=True)


def _emit(result):
    print("SSVP_RESULT_JSON:" + json.dumps(result, ensure_ascii=False), flush=True)


def _resolve(name):
    found = shutil.which(name)
    if found:
        return found
    for directory in _COMMON_DIRS:
        candidate = os.path.join(directory, name)
        if os.path.isfile(candidate):
            return candidate
    return None


def _require_safe(value, label):
    token = str(value or "").strip()
    if not token:
        raise ValueError(label + " zorunlu.")
    if not _SAFE_TARGET.match(token):
        raise ValueError(label + " gecersiz karakter iceriyor.")
    return token


def build_argv(binary, params, target):
{ARGV_BUILDER}


def main():
    payload = _load()
    target = str(payload.get("target", "")).strip()
    params = payload.get("parameters", {{}}) or {{}}

    binary = _resolve(TOOL)
    if not binary:
        _log(TOOL + " bu sunucuda kurulu degil.")
        _emit({{
            "ok": False, "tool": TOOL, "tool_installed": False,
            "error": TOOL + " kurulu degil. Yetkili lab sunucusuna kurun (apt install " + TOOL + ").",
        }})
        return

    try:
        argv = build_argv(binary, params, target)
    except ValueError as exc:
        _emit({{"ok": False, "tool": TOOL, "tool_installed": True, "error": str(exc)}})
        return

    try:
        timeout = int(params.get("timeout_sec", 180) or 180)
    except Exception:
        timeout = 180
    timeout = max(10, min(timeout, 1800))

    _log("calistiriliyor: " + " ".join(argv))
    try:
        completed = subprocess.run(
            argv, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        partial = (exc.output or "") if isinstance(exc.output, str) else ""
        for line in partial.splitlines():
            print(line, flush=True)
        _emit({{"ok": False, "tool": TOOL, "tool_installed": True, "error": "timeout (" + str(timeout) + "s)"}})
        return
    except Exception as exc:
        _emit({{"ok": False, "tool": TOOL, "tool_installed": True, "error": str(exc)}})
        return

    output = completed.stdout or ""
    lines = [ln for ln in output.splitlines() if ln.strip()]
    for line in lines:
        print(line, flush=True)

    _emit({{
        "ok": completed.returncode == 0,
        "tool": TOOL,
        "tool_installed": True,
        "exit_code": completed.returncode,
        "target": target,
        "command": " ".join(argv),
        "line_count": len(lines),
        "output_tail": lines[-60:],
    }})


if __name__ == "__main__":
    main()
'''


# --- Per-tool argv builders (bodies of build_argv) ---------------------------
# Each must return an argv list; indentation is 4 spaces (function body).
TOOLS = [
    {
        "tool": "nikto",
        "item_key": "nikto_web_scan",
        "display_name": "Nikto Web Zafiyet Taramasi",
        "description": "Nikto ile yetkili web sunucusu zafiyet/enum taramasi (attack asamasi).",
        "stage": "attack",
        "stage_label": "attack",
        "argv": (
            "    url = _require_safe(params.get('target_url', target), 'target_url')\n"
            "    port = str(params.get('port', '') or '').strip()\n"
            "    argv = [binary, '-h', url, '-ask', 'no', '-maxtime', '120']\n"
            "    if port:\n"
            "        if not port.isdigit():\n"
            "            raise ValueError('port sayisal olmali.')\n"
            "        argv += ['-p', port]\n"
            "    return argv\n"
        ),
    },
    {
        "tool": "dirb",
        "item_key": "dirb_content_discovery",
        "display_name": "Dirb Dizin Kesfi",
        "description": "Dirb ile yetkili web hedefinde dizin/dosya kesfi (scan asamasi).",
        "stage": "scan",
        "stage_label": "scan",
        "argv": (
            "    base_url = _require_safe(params.get('base_url', target), 'base_url')\n"
            "    wordlist = str(params.get('wordlist', '') or '').strip()\n"
            "    argv = [binary, base_url]\n"
            "    if wordlist:\n"
            "        if not os.path.isfile(wordlist):\n"
            "            raise ValueError('wordlist bulunamadi: ' + wordlist)\n"
            "        argv.append(wordlist)\n"
            "    argv += ['-S', '-r']\n"
            "    return argv\n"
        ),
    },
    {
        "tool": "gobuster",
        "item_key": "gobuster_dir_scan",
        "display_name": "Gobuster Dizin Taramasi",
        "description": "Gobuster dir modu ile yetkili web hedefinde dizin kesfi (scan asamasi).",
        "stage": "scan",
        "stage_label": "scan",
        "argv": (
            "    url = _require_safe(params.get('url', target), 'url')\n"
            "    wordlist = str(params.get('wordlist', '/usr/share/wordlists/dirb/common.txt') or '').strip()\n"
            "    if not os.path.isfile(wordlist):\n"
            "        raise ValueError('wordlist bulunamadi: ' + wordlist)\n"
            "    threads = str(params.get('threads', '20') or '20').strip()\n"
            "    if not threads.isdigit():\n"
            "        raise ValueError('threads sayisal olmali.')\n"
            "    return [binary, 'dir', '-u', url, '-w', wordlist, '-t', threads, '-q']\n"
        ),
    },
    {
        "tool": "whatweb",
        "item_key": "whatweb_fingerprint",
        "display_name": "WhatWeb Teknoloji Fingerprint",
        "description": "WhatWeb ile yetkili web hedefinin teknoloji parmak izi (scan asamasi).",
        "stage": "scan",
        "stage_label": "scan",
        "argv": (
            "    url = _require_safe(params.get('target_url', target), 'target_url')\n"
            "    aggression = str(params.get('aggression', '1') or '1').strip()\n"
            "    if aggression not in ('1', '2', '3', '4'):\n"
            "        aggression = '1'\n"
            "    return [binary, '-a', aggression, url]\n"
        ),
    },
    {
        "tool": "nmap",
        "item_key": "nmap_vuln_scan",
        "display_name": "Nmap NSE Zafiyet Taramasi",
        "description": "Nmap servis surumu + NSE script taramasi (scan asamasi).",
        "stage": "scan",
        "stage_label": "scan",
        "argv": (
            "    host = _require_safe(params.get('target_host', target), 'target_host')\n"
            "    ports = str(params.get('ports', '1-1024') or '1-1024').strip()\n"
            "    if not re.match(r'^[0-9,\\-]+$', ports):\n"
            "        raise ValueError('ports gecersiz.')\n"
            "    nse = str(params.get('nse_scripts', 'vuln') or 'vuln').strip()\n"
            "    if not re.match(r'^[A-Za-z0-9_,\\-*]+$', nse):\n"
            "        raise ValueError('nse_scripts gecersiz.')\n"
            "    return [binary, '-sV', '--script', nse, '-p', ports, host]\n"
        ),
    },
    {
        "tool": "msfconsole",
        "item_key": "msf_module_run",
        "display_name": "Metasploit Modul Calistir",
        "description": "Yetkili lab hedefinde operatorun belirledigi bir Metasploit modulunu calistirir (attack asamasi). Modul ve hedef operator/AI tarafindan verilir.",
        "stage": "attack",
        "stage_label": "attack",
        "argv": (
            "    module = str(params.get('module', '') or '').strip()\n"
            "    if not re.match(r'^[A-Za-z0-9_/]+$', module or ''):\n"
            "        raise ValueError('module zorunlu ve sadece harf/rakam/_/ icermeli (or: auxiliary/scanner/http/http_version).')\n"
            "    rhosts = _require_safe(params.get('rhosts', target), 'rhosts')\n"
            "    parts = ['use ' + module, 'set RHOSTS ' + rhosts]\n"
            "    # Literal keys below so the parameter auto-detector exposes them as inputs.\n"
            "    optionals = [\n"
            "        ('RPORT', params.get('rport', '')),\n"
            "        ('LHOST', params.get('lhost', '')),\n"
            "        ('LPORT', params.get('lport', '')),\n"
            "        ('PAYLOAD', params.get('payload', '')),\n"
            "    ]\n"
            "    for setg, raw in optionals:\n"
            "        val = str(raw or '').strip()\n"
            "        if val:\n"
            "            if not re.match(r'^[A-Za-z0-9_./:-]+$', val):\n"
            "                raise ValueError(setg + ' gecersiz karakter iceriyor.')\n"
            "            parts.append('set ' + setg + ' ' + val)\n"
            "    parts += ['run', 'exit']\n"
            "    return [binary, '-q', '-x', '; '.join(parts)]\n"
        ),
    },
]


def _ensure_category(stage: str) -> dict:
    key = _slug("kali_tools_" + stage, "kali_tools")
    existing = {row["category_key"]: row for row in list_progress_categories(active_only=False)}
    if key in existing:
        return existing[key]
    return create_progress_category({
        "category_key": key,
        "display_name": "Kali Araclari (" + stage + ")",
        "workflow_key": stage,
        "description": "AI destekli mod icin yetkili Kali arac wrapperlari.",
        "is_active": True,
    })


def _ensure_step(stage: str, category_id: int) -> dict:
    step_key = _slug(stage + "_kali_tools", "kali_step")
    existing = {row["step_key"]: row for row in list_steps(active_only=False)}
    if step_key in existing:
        return existing[step_key]
    return create_step({
        "step_key": step_key,
        "display_name": "Kali Araclari",
        "workflow_key": stage,
        "category_id": int(category_id),
        "description": "Yetkili Kali arac wrapperlari (" + stage + ").",
        "is_active": True,
    })


def main() -> None:
    created, skipped = 0, 0
    steps_by_stage: dict = {}

    for spec in TOOLS:
        stage = spec["stage"]
        if stage not in steps_by_stage:
            category = _ensure_category(stage)
            step = _ensure_step(stage, int(category["id"]))
            steps_by_stage[stage] = step
        step = steps_by_stage[stage]

        existing_keys = {row["item_key"] for row in list_step_items(int(step["id"]), active_only=False)}
        if spec["item_key"] in existing_keys:
            print(f"skip (exists): {spec['item_key']}")
            skipped += 1
            continue

        item = create_step_item(int(step["id"]), {
            "item_type": "script",
            "item_key": spec["item_key"],
            "display_name": spec["display_name"],
            "description": spec["description"],
            "is_active": True,
        })
        source = _WRAPPER_TEMPLATE.format(
            TOOL=spec["tool"],
            TOOL_UPPER=spec["tool"].upper(),
            STAGE_LABEL=spec["stage_label"],
            ARGV_BUILDER=spec["argv"].rstrip("\n"),
        )
        save_step_item_script_content(int(item["id"]), source)
        print(f"created: {spec['item_key']} (item {item['id']}, tool {spec['tool']})")
        created += 1

    print(f"\nDone. created={created} skipped={skipped}")


if __name__ == "__main__":
    main()
