
# SSVP_SCRIPT_TEMPLATE_V1
import json
import os


def _load():
    try:
        return json.loads(os.getenv("SSVP_INPUT_JSON", "{}"))
    except Exception:
        return {}


def _log(msg):
    print(f"[DISCOVERY] {msg}", flush=True)


def main():
    payload = _load()
    target = payload.get("target", "")
    params = payload.get("parameters", {})

    _log(f"network discovery started for {target}")
    _log(f"mode: {params.get('discovery_mode', 'icmp,tcp')}")

    result = {
        "ok": True,
        "action": "local_network_discovery",
        "target": target,
        "hosts_found": ["172.31.7.145", "172.31.7.150"],
    }
    print("SSVP_RESULT_JSON:" + json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
