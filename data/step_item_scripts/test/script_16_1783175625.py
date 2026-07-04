
# SSVP_SCRIPT_TEMPLATE_V1
import json
import os
import time


def _load():
    try:
        return json.loads(os.getenv("SSVP_INPUT_JSON", "{}"))
    except Exception:
        return {}


def _log(msg):
    print(f"[FAST_PORT] {msg}", flush=True)


def main():
    payload = _load()
    target = payload.get("target", "")
    params = payload.get("parameters", {})
    ports = params.get("scan_ports", ["all"])

    _log(f"target range: {target}")
    _log(f"port profile: {ports}")
    _log("fast probe wave #1")
    time.sleep(0.1)
    _log("fast probe wave #2")
    time.sleep(0.1)

    open_ports = ["22", "80", "443", "3306"]
    result = {
        "ok": True,
        "action": "port_discovery_fast",
        "target": target,
        "open_ports": open_ports,
        "requested_ports": ports,
    }
    print("SSVP_RESULT_JSON:" + json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
