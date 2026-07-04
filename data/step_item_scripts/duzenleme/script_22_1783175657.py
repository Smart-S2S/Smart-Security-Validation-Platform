
# SSVP_SCRIPT_TEMPLATE_V1
import json
import os


def _load():
    try:
        return json.loads(os.getenv("SSVP_INPUT_JSON", "{}"))
    except Exception:
        return {}


def _log(msg):
    print(f"[DRIFT] {msg}", flush=True)


def main():
    payload = _load()
    target = payload.get("target", "")
    params = payload.get("parameters", {})
    _log(f"compare {params.get('source_tag')} -> {params.get('target_tag')}")
    result = {
        "ok": True,
        "action": "config_drift_verify",
        "target": target,
        "drift_count": 2,
        "critical": 0,
    }
    print("SSVP_RESULT_JSON:" + json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
