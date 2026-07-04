import json
import threading
from copy import deepcopy
from datetime import datetime, timezone

from backend.services.mysql_db import init_mysql_schema, mysql_conn

DEFAULT_SETTINGS = {
    "ai": {
        "ollama_url": "http://localhost:11434/api/chat",
        "model_name": "qwen2.5-coder:7b",
        "timeout_sec": 240,
        "use_fake_response": False,
    },
    "scan": {
        "nmap_timeout_sec": 600,
        "masscan_timeout_sec": 600,
        "netdiscover_timeout_sec": 180,
    },
}


_LOCK = threading.Lock()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _deep_merge(base: dict, updates: dict) -> dict:
    merged = deepcopy(base)
    for key, value in updates.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def init_settings_store() -> None:
    with _LOCK:
        init_mysql_schema()
        with mysql_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM app_settings WHERE id = 1")
                row = cur.fetchone()
                if row:
                    conn.commit()
                    return

                initial = deepcopy(DEFAULT_SETTINGS)
                cur.execute(
                    "INSERT INTO app_settings (id, payload_json, updated_at) VALUES (1, %s, %s)",
                    (json.dumps(initial, ensure_ascii=False), _utc_now_iso()),
                )
            conn.commit()


def _read_settings_unlocked() -> dict:
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT payload_json FROM app_settings WHERE id = 1")
            row = cur.fetchone()
            if not row:
                initial = deepcopy(DEFAULT_SETTINGS)
                cur.execute(
                    "INSERT INTO app_settings (id, payload_json, updated_at) VALUES (1, %s, %s)",
                    (json.dumps(initial, ensure_ascii=False), _utc_now_iso()),
                )
                conn.commit()
                return initial

            try:
                loaded = json.loads(row["payload_json"])
                if not isinstance(loaded, dict):
                    raise ValueError("Invalid settings payload")
                return _deep_merge(DEFAULT_SETTINGS, loaded)
            except Exception:
                return deepcopy(DEFAULT_SETTINGS)


def get_app_settings() -> dict:
    init_settings_store()
    with _LOCK:
        return _read_settings_unlocked()


def update_app_settings(partial_updates: dict) -> dict:
    init_settings_store()
    with _LOCK:
        current = _read_settings_unlocked()
        merged = _deep_merge(current, partial_updates)
        with mysql_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE app_settings SET payload_json = %s, updated_at = %s WHERE id = 1",
                    (json.dumps(merged, ensure_ascii=False), _utc_now_iso()),
                )
            conn.commit()
        return merged
