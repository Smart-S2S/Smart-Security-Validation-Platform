# SSVP_SCRIPT_TEMPLATE_V1
"""Auto-generated SSVP wrapper for the "medusa" tool (attack).

Authorized lab / owned-systems validation only. Runs an allowlisted binary with
a safely built argv (no shell). Every parameter is validated. Reports cleanly if
the tool is not installed. Command construction is driven by the embedded SPEC
so the operation window and the argv stay in sync.
"""
import json
import os
import re
import shutil
import subprocess

TOOL = "medusa"
SPEC = json.loads(r'''{"mode": "argv", "fixed_pre": [], "positionals_first": false, "params": [{"key": "host", "label": "Hedef host", "kind": "opt", "flag": "-h", "setting": "HOST", "default": "", "required": true, "pattern": "host", "choices": [], "must_exist": false}, {"key": "module", "label": "Modül", "kind": "opt", "flag": "-M", "setting": "MODULE", "default": "ssh", "required": true, "pattern": "word", "choices": ["ssh", "ftp", "telnet", "smbnt", "rdp", "mysql", "postgres", "vnc", "http", "web-form"], "must_exist": false}, {"key": "username", "label": "Kullanıcı", "kind": "opt", "flag": "-u", "setting": "USERNAME", "default": "", "required": false, "pattern": "safe", "choices": [], "must_exist": false}, {"key": "userlist", "label": "Kullanıcı listesi", "kind": "opt", "flag": "-U", "setting": "USERLIST", "default": "", "required": false, "pattern": "path", "choices": [], "must_exist": true}, {"key": "password", "label": "Parola", "kind": "opt", "flag": "-p", "setting": "PASSWORD", "default": "", "required": false, "pattern": "safe", "choices": [], "must_exist": false}, {"key": "passlist", "label": "Parola listesi", "kind": "opt", "flag": "-P", "setting": "PASSLIST", "default": "/usr/share/wordlists/rockyou.txt", "required": false, "pattern": "path", "choices": [], "must_exist": true}, {"key": "port", "label": "Port", "kind": "opt", "flag": "-n", "setting": "PORT", "default": "", "required": false, "pattern": "int", "choices": [], "must_exist": false}, {"key": "threads", "label": "Thread (-t)", "kind": "opt", "flag": "-t", "setting": "THREADS", "default": "4", "required": false, "pattern": "int", "choices": [], "must_exist": false}, {"key": "stop_first", "label": "İlk bulunca dur (-f)", "kind": "flag", "flag": "-f", "setting": "STOP_FIRST", "default": "on", "required": false, "pattern": "safe", "choices": [], "must_exist": false}, {"key": "null_same", "label": "Ek deneme (-e)", "kind": "opt", "flag": "-e", "setting": "NULL_SAME", "default": "", "required": false, "pattern": "safe", "choices": ["n", "s", "ns"], "must_exist": false}, {"key": "verbose", "label": "Ayrıntı düzeyi (-v)", "kind": "opt", "flag": "-v", "setting": "VERBOSE", "default": "", "required": false, "pattern": "int", "choices": [], "must_exist": false}, {"key": "banner_suppress", "label": "Banner gizle (-b)", "kind": "flag", "flag": "-b", "setting": "BANNER_SUPPRESS", "default": "", "required": false, "pattern": "safe", "choices": [], "must_exist": false}, {"key": "timeout_sec", "label": "Zaman aşımı (sn)", "kind": "none", "flag": "", "setting": "TIMEOUT_SEC", "default": "180", "required": false, "pattern": "int", "choices": [], "must_exist": false}]}''')

_COMMON_DIRS = (
    "/usr/local/sbin", "/usr/local/bin", "/usr/sbin", "/usr/bin",
    "/sbin", "/bin", "/snap/bin", "/opt/metasploit-framework/bin",
)

# Validation patterns. argv is always a list (never shell), so these guard
# against argument-injection and, for msfconsole, against breaking out of the
# "; "-joined -x command string.
_PATTERNS = {
    "safe": re.compile(r"^[A-Za-z0-9_.:/?=&%~+@,\[\]-]+$"),
    "host": re.compile(r"^[A-Za-z0-9_.:-]+$"),
    "range": re.compile(r"^[A-Za-z0-9_.:/-]+$"),
    "url": re.compile(r"^[A-Za-z0-9_.:/?=&%~+@#!,;-]+$"),
    "ports": re.compile(r"^[0-9,\-]+$"),
    "nse": re.compile(r"^[A-Za-z0-9_,\-*.]+$"),
    "ident": re.compile(r"^[A-Za-z0-9_./:@-]+$"),
    "module": re.compile(r"^[A-Za-z0-9_/]+$"),
    "setting": re.compile(r"^[A-Za-z0-9_]+$"),
    "word": re.compile(r"^[A-Za-z0-9_.\-]+$"),
    "flag": re.compile(r"^-{0,2}[A-Za-z0-9][A-Za-z0-9._-]*$"),
    "int": re.compile(r"^[0-9]+$"),
    "path": re.compile(r"^[A-Za-z0-9_./\ -]+$"),
    "text": re.compile(r"^[^;&|`$<>\n\r]+$"),
}


def _load():
    try:
        return json.loads(os.getenv("SSVP_INPUT_JSON", "{}"))
    except Exception:
        return {}


def _log(msg):
    print("[MEDUSA] " + str(msg), flush=True)


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


def _validate(value, pattern, label):
    token = str(value or "").strip()
    if not token:
        raise ValueError(label + " zorunlu.")
    pat = _PATTERNS.get(pattern or "safe", _PATTERNS["safe"])
    if not pat.match(token):
        raise ValueError(label + " gecersiz karakter iceriyor.")
    if token.startswith("-"):
        raise ValueError(label + " '-' ile baslayamaz.")
    return token


def _is_truthy(value):
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in ("1", "true", "yes", "on", "evet")



def build_argv(binary, params, target):
    if SPEC.get("mode") == "msf":
        return _build_msf(binary, params)

    prefix = [binary] + list(SPEC.get("fixed_pre", []))
    opts = []
    positionals = []
    for entry in SPEC["params"]:
        kind = entry.get("kind", "opt")
        if kind in ("none", "ignore"):
            continue
        raw = params.get(entry["key"], entry.get("default", ""))

        if kind == "flag":
            if _is_truthy(raw):
                opts.append(entry["flag"])
            continue

        val = str(raw if raw is not None else "").strip()
        if not val:
            if entry.get("required"):
                raise ValueError(entry.get("label", entry["key"]) + " zorunlu.")
            continue

        choices = entry.get("choices") or []
        if kind == "token":
            # The value is itself an argv token (usually a flag like -sS/-T4).
            # A fixed allowlist is the validation; free-form tokens must look
            # like a single flag.
            if choices:
                if val not in choices:
                    raise ValueError(entry.get("label", entry["key"]) + " gecersiz secim.")
            elif not _PATTERNS["flag"].match(val):
                raise ValueError(entry.get("label", entry["key"]) + " gecersiz bayrak.")
            opts.append(val)
            continue

        if choices and val not in choices:
            raise ValueError(entry.get("label", entry["key"]) + " gecersiz secim.")
        _validate(val, entry.get("pattern", "safe"), entry.get("label", entry["key"]))
        if entry.get("must_exist") and not os.path.isfile(val):
            raise ValueError(entry.get("label", entry["key"]) + " dosyasi bulunamadi: " + val)

        if kind == "positional":
            positionals.append(val)
        elif kind == "opt_eq":
            opts.append(entry["flag"] + val)
        else:  # "opt"
            opts += [entry["flag"], val]

    # Most CLIs want `tool [options] positionals`; dirb wants the URL/wordlist
    # first. This makes parameter list order irrelevant to argv correctness, so
    # new options can be added anywhere in a tool's spec without breaking it.
    if SPEC.get("positionals_first"):
        return prefix + positionals + opts
    return prefix + opts + positionals


def main():
    payload = _load()
    target = str(payload.get("target", "")).strip()
    params = payload.get("parameters", {}) or {}

    binary = _resolve(TOOL)
    if not binary:
        _log(TOOL + " bu sunucuda kurulu degil.")
        _emit({
            "ok": False, "tool": TOOL, "tool_installed": False,
            "error": TOOL + " kurulu degil. Ayarlar > Pentest Araclari'ndan kurabilirsiniz.",
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
    timeout = max(10, min(timeout, 3600))

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
        _emit({"ok": False, "tool": TOOL, "tool_installed": True, "error": "timeout (" + str(timeout) + "s)", "command": " ".join(argv)})
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
        "output_tail": lines[-80:],
    })


if __name__ == "__main__":
    main()
