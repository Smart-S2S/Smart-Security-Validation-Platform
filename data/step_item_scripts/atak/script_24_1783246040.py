# SSVP_SCRIPT_TEMPLATE_V1
import json
import os


def ssvp_input():
    raw = os.getenv("SSVP_INPUT_JSON", "{}")
    try:
        return json.loads(raw)
    except Exception:
        return {}


def ssvp_log(message):
    print(f"[SSVP_LOG] {message}", flush=True)


def ssvp_emit_result(data):
    print("SSVP_RESULT_JSON:" + json.dumps(data, ensure_ascii=False), flush=True)

# SSVP_SCRIPT_TEMPLATE_V2
"""Auto-generated SSVP wrapper for the "msfconsole" tool (attack).

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

TOOL = "msfconsole"
SPEC = json.loads(r'''{"mode": "msf", "fixed_pre": [], "positionals_first": false, "params": [{"key": "module", "label": "Module", "kind": "msf_module", "flag": "", "setting": "MODULE", "default": "", "required": true, "pattern": "module", "choices": [], "must_exist": false}, {"key": "action", "label": "Action", "kind": "none", "flag": "", "setting": "ACTION", "default": "run", "required": false, "pattern": "safe", "choices": ["run", "exploit", "check"], "must_exist": false}, {"key": "rhosts", "label": "RHOSTS", "kind": "msf_set", "flag": "", "setting": "RHOSTS", "default": "", "required": true, "pattern": "range", "choices": [], "must_exist": false}, {"key": "rport", "label": "RPORT", "kind": "msf_set", "flag": "", "setting": "RPORT", "default": "", "required": false, "pattern": "int", "choices": [], "must_exist": false}, {"key": "targeturi", "label": "TARGETURI", "kind": "msf_set", "flag": "", "setting": "TARGETURI", "default": "", "required": false, "pattern": "ident", "choices": [], "must_exist": false}, {"key": "username", "label": "USERNAME", "kind": "msf_set", "flag": "", "setting": "USERNAME", "default": "", "required": false, "pattern": "ident", "choices": [], "must_exist": false}, {"key": "password", "label": "PASSWORD", "kind": "msf_set", "flag": "", "setting": "PASSWORD", "default": "", "required": false, "pattern": "ident", "choices": [], "must_exist": false}, {"key": "payload", "label": "PAYLOAD", "kind": "msf_set", "flag": "", "setting": "PAYLOAD", "default": "", "required": false, "pattern": "module", "choices": [], "must_exist": false}, {"key": "lhost", "label": "LHOST", "kind": "msf_set", "flag": "", "setting": "LHOST", "default": "", "required": false, "pattern": "host", "choices": [], "must_exist": false}, {"key": "lport", "label": "LPORT", "kind": "msf_set", "flag": "", "setting": "LPORT", "default": "", "required": false, "pattern": "int", "choices": [], "must_exist": false}, {"key": "ssl", "label": "SSL", "kind": "msf_set", "flag": "", "setting": "SSL", "default": "", "required": false, "pattern": "safe", "choices": ["true", "false"], "must_exist": false}, {"key": "verbose", "label": "VERBOSE", "kind": "msf_set", "flag": "", "setting": "VERBOSE", "default": "", "required": false, "pattern": "safe", "choices": ["true", "false"], "must_exist": false}, {"key": "srvhost", "label": "SRVHOST", "kind": "msf_set", "flag": "", "setting": "SRVHOST", "default": "", "required": false, "pattern": "host", "choices": [], "must_exist": false}, {"key": "srvport", "label": "SRVPORT", "kind": "msf_set", "flag": "", "setting": "SRVPORT", "default": "", "required": false, "pattern": "int", "choices": [], "must_exist": false}, {"key": "uripath", "label": "URIPATH", "kind": "msf_set", "flag": "", "setting": "URIPATH", "default": "", "required": false, "pattern": "ident", "choices": [], "must_exist": false}, {"key": "threads", "label": "THREADS", "kind": "msf_set", "flag": "", "setting": "THREADS", "default": "", "required": false, "pattern": "int", "choices": [], "must_exist": false}, {"key": "extra_options", "label": "Extra datastore options", "kind": "none", "flag": "", "setting": "EXTRA_OPTIONS", "default": {}, "required": false, "pattern": "safe", "choices": [], "must_exist": false}, {"key": "timeout_sec", "label": "Timeout (s)", "kind": "none", "flag": "", "setting": "TIMEOUT_SEC", "default": "300", "required": false, "pattern": "int", "choices": [], "must_exist": false}]}''')

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
    "msfquery": re.compile(r"^[A-Za-z0-9 _./:+-]{1,120}$"),
}


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


def _validate(value, pattern, label):
    token = str(value or "").strip()
    if not token:
        raise ValueError(label + " is required.")
    pat = _PATTERNS.get(pattern or "safe", _PATTERNS["safe"])
    if not pat.match(token):
        raise ValueError(label + " contains invalid characters.")
    if token.startswith("-"):
        raise ValueError(label + " must not start with '-'.")
    return token


def _is_truthy(value):
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in ("1", "true", "yes", "on", "evet")


def _lower_priority():
    # Run the (potentially heavy) tool at a lower CPU priority so it never starves
    # the single-worker web app that shares this host. Raising niceness is always
    # permitted; best-effort, never fatal.
    try:
        os.nice(10)
    except Exception:
        pass


def _build_msf(binary, params):
    module = str(params.get("module", "") or "").strip()
    if not _PATTERNS["module"].match(module):
        raise ValueError("module is required and must contain only letters/digits/_/ (e.g. auxiliary/scanner/http/http_version).")
    parts = ["use " + module]

    for entry in SPEC["params"]:
        if entry.get("kind") != "msf_set":
            continue
        raw = params.get(entry["key"], entry.get("default", ""))
        val = str(raw if raw is not None else "").strip()
        if not val:
            if entry.get("required"):
                raise ValueError(entry.get("label", entry["key"]) + " is required.")
            continue
        _validate(val, entry.get("pattern", "ident"), entry.get("label", entry["key"]))
        parts.append("set " + entry["setting"] + " " + val)

    extra = params.get("extra_options") or {}
    if isinstance(extra, str) and extra.strip():
        try:
            extra = json.loads(extra)
        except Exception:
            raise ValueError("extra_options must be valid JSON.")
    if isinstance(extra, dict):
        for raw_key, raw_val in extra.items():
            name = str(raw_key or "").strip()
            val = str(raw_val if raw_val is not None else "").strip()
            if not name or not val:
                continue
            if not _PATTERNS["setting"].match(name):
                raise ValueError("extra_options key is invalid: " + name)
            _validate(val, "ident", "extra_options[" + name + "]")
            parts.append("set " + name + " " + val)

    action = str(params.get("action", "run") or "run").strip().lower()
    if action not in ("run", "exploit", "check"):
        action = "run"
    parts += [action, "exit"]
    return [binary, "-q", "-x", "; ".join(parts)]


def build_argv(binary, params, target):
    if SPEC.get("mode") == "msf":
        return _build_msf(binary, params)
    if SPEC.get("mode") == "msf_query":
        return _build_msf_query(binary, params)

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
                raise ValueError(entry.get("label", entry["key"]) + " is required.")
            continue

        choices = entry.get("choices") or []
        if kind == "token":
            # The value is itself an argv token (usually a flag like -sS/-T4).
            # A fixed allowlist is the validation; free-form tokens must look
            # like a single flag.
            if choices:
                if val not in choices:
                    raise ValueError(entry.get("label", entry["key"]) + " invalid choice.")
            elif not _PATTERNS["flag"].match(val):
                raise ValueError(entry.get("label", entry["key"]) + " invalid flag.")
            opts.append(val)
            continue

        if choices and val not in choices:
            raise ValueError(entry.get("label", entry["key"]) + " invalid choice.")
        _validate(val, entry.get("pattern", "safe"), entry.get("label", entry["key"]))
        if entry.get("must_exist") and not os.path.isfile(val):
            raise ValueError(entry.get("label", entry["key"]) + " file not found: " + val)

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
        _log(TOOL + " is not installed on this server.")
        _emit({
            "ok": False, "tool": TOOL, "tool_installed": False,
            "error": TOOL + " is not installed. You can install it from Settings > Pentest Tools.",
        })
        return

    try:
        argv = build_argv(binary, params, target)
    except ValueError as exc:
        _emit({"ok": False, "tool": TOOL, "tool_installed": True, "error": str(exc)})
        return

    # Metasploit needs headroom: msfconsole cold-starts (~20 s) before the module
    # even runs, so msf-mode operations default to a longer timeout.
    _def_to = 300 if str(SPEC.get("mode", "")).startswith("msf") else 180
    try:
        timeout = int(params.get("timeout_sec", _def_to) or _def_to)
    except Exception:
        timeout = _def_to
    timeout = max(10, min(timeout, 3600))

    _log("running: " + " ".join(argv))
    try:
        completed = subprocess.run(
            argv, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, timeout=timeout, preexec_fn=_lower_priority,
        )
    except subprocess.TimeoutExpired as exc:
        # Keep the partial output on timeout: a long scan that got cut off still
        # yields usable findings (open ports, URLs) for the next step.
        partial = (exc.output or "") if isinstance(exc.output, str) else ""
        plines = [ln for ln in partial.splitlines() if ln.strip()]
        for line in plines:
            print(line, flush=True)
        result = {
            "ok": False, "tool": TOOL, "tool_installed": True,
            "error": "timeout (" + str(timeout) + "s)", "command": " ".join(argv),
            "timed_out": True, "line_count": len(plines), "output_tail": plines[-80:],
        }
        if str(SPEC.get("mode", "")).startswith("msf"):
            _apply_msf_summary(result, partial)
        _emit(result)
        return
    except Exception as exc:
        _emit({"ok": False, "tool": TOOL, "tool_installed": True, "error": str(exc)})
        return

    output = completed.stdout or ""
    lines = [ln for ln in output.splitlines() if ln.strip()]
    for line in lines:
        print(line, flush=True)

    result = {
        "ok": completed.returncode == 0,
        "tool": TOOL,
        "tool_installed": True,
        "exit_code": completed.returncode,
        "target": target,
        "command": " ".join(argv),
        "line_count": len(lines),
        "output_tail": lines[-80:],
    }
    if str(SPEC.get("mode", "")).startswith("msf"):
        _apply_msf_summary(result, output)
    _emit(result)


def _apply_msf_summary(result, output):
    """Structured signals for the AI: msfconsole exits 0 even on failure, so
    surface the meaningful markers (session opened, [+] hits, vuln verdict)."""
    low = output.lower()
    plus = [ln.strip() for ln in output.splitlines() if ln.strip().startswith("[+]")]
    session = ("meterpreter session" in low) or ("command shell session" in low) or ("session " in low and "opened" in low)
    vulnerable = any(w in low for w in ("is vulnerable", "appears to be vulnerable", "target is vulnerable", "the target appears"))
    if plus:
        result["msf_success_lines"] = plus[:20]
    result["msf_session_opened"] = bool(session)
    result["msf_vulnerable"] = bool(vulnerable)
    # A search/info query with output is a success even though nothing "ran".
    if str(SPEC.get("mode", "")) == "msf_query" and result.get("line_count", 0) > 0:
        result["ok"] = True


if __name__ == "__main__":
    main()
