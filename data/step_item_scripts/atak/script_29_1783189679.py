# SSVP_SCRIPT_TEMPLATE_V1
"""Auto-generated SSVP wrapper for the "msfconsole" tool (attack).

Authorized lab / owned-systems validation only. Runs an allowlisted binary with
a safely built argv (no shell). Reports cleanly if the tool is not installed.
"""
import json
import os
import re
import shutil
import subprocess

TOOL = "msfconsole"
_COMMON_DIRS = (
    "/usr/local/sbin", "/usr/local/bin", "/usr/sbin", "/usr/bin",
    "/sbin", "/bin", "/snap/bin", "/opt/metasploit-framework/bin",
)
_SAFE_TARGET = re.compile(r"^[A-Za-z0-9_.:/?=&%~+-]+$")


def _load():
    try:
        return json.loads(os.getenv("SSVP_INPUT_JSON", "{}"))
    except Exception:
        return {}


def _log(msg):
    print("[MSFCONSOLE] " + str(msg), flush=True)


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
    module = str(params.get('module', '') or '').strip()
    if not re.match(r'^[A-Za-z0-9_/]+$', module or ''):
        raise ValueError('module zorunlu ve sadece harf/rakam/_/ icermeli (or: auxiliary/scanner/http/http_version).')
    rhosts = _require_safe(params.get('rhosts', target), 'rhosts')
    parts = ['use ' + module, 'set RHOSTS ' + rhosts]
    # Literal keys below so the parameter auto-detector exposes them as inputs.
    optionals = [
        ('RPORT', params.get('rport', '')),
        ('LHOST', params.get('lhost', '')),
        ('LPORT', params.get('lport', '')),
        ('PAYLOAD', params.get('payload', '')),
    ]
    for setg, raw in optionals:
        val = str(raw or '').strip()
        if val:
            if not re.match(r'^[A-Za-z0-9_./:-]+$', val):
                raise ValueError(setg + ' gecersiz karakter iceriyor.')
            parts.append('set ' + setg + ' ' + val)
    parts += ['run', 'exit']
    return [binary, '-q', '-x', '; '.join(parts)]


def main():
    payload = _load()
    target = str(payload.get("target", "")).strip()
    params = payload.get("parameters", {}) or {}

    binary = _resolve(TOOL)
    if not binary:
        _log(TOOL + " bu sunucuda kurulu degil.")
        _emit({
            "ok": False, "tool": TOOL, "tool_installed": False,
            "error": TOOL + " kurulu degil. Yetkili lab sunucusuna kurun (apt install " + TOOL + ").",
        })
        return

    try:
        argv = build_argv(binary, params, target)
    except ValueError as exc:
        _emit({"ok": False, "tool": TOOL, "tool_installed": True, "error": str(exc)})
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
        _emit({"ok": False, "tool": TOOL, "tool_installed": True, "error": "timeout (" + str(timeout) + "s)"})
        return
    except Exception as exc:
        _emit({"ok": False, "tool": TOOL, "tool_installed": True, "error": str(exc)})
        return

    output = completed.stdout or ""
    lines = [ln for ln in output.splitlines() if ln.strip()]
    for line in lines:
        print(line, flush=True)

    _emit({
        "ok": completed.returncode == 0,
        "tool": TOOL,
        "tool_installed": True,
        "exit_code": completed.returncode,
        "target": target,
        "command": " ".join(argv),
        "line_count": len(lines),
        "output_tail": lines[-60:],
    })


if __name__ == "__main__":
    main()
