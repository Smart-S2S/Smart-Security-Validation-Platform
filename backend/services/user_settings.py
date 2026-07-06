"""Per-user settings: AI model config + progression (workflow) mode.

AI settings and the progression mode used to be global (one `app_settings` row).
They are now per-user: each operator chooses their own provider (local Ollama vs
cloud), their own model/credentials, and whether the operation window is manual
or AI-driven. The global `app_settings` values still serve as the default that a
user's settings fall back to (so an admin can set a sensible baseline).

Storage is a single JSON blob in `users.settings_json`, shaped like:
    {"ai": {...}, "workflow": {"mode": "manual|ai"}}
"""

from __future__ import annotations

import json
import threading
from copy import deepcopy

from backend.services.mysql_db import mysql_conn
from backend.services.settings_store import (
    DEFAULT_SETTINGS,
    _deep_merge,
)


# Reentrant: the write helpers hold _LOCK and then call get_user_settings ->
# _ensure_column, which also takes _LOCK. A plain Lock would self-deadlock.
_LOCK = threading.RLock()
_COLUMN_READY = False


def _ensure_column() -> None:
    """Add users.settings_json on first use (idempotent, no destructive migration)."""
    global _COLUMN_READY
    if _COLUMN_READY:
        return
    with _LOCK:
        if _COLUMN_READY:
            return
        with mysql_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT COUNT(*) AS c FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'users'
                      AND COLUMN_NAME = 'settings_json'
                    """
                )
                row = cur.fetchone()
                if not row or not row.get("c"):
                    cur.execute("ALTER TABLE users ADD COLUMN settings_json TEXT NULL")
            conn.commit()
        _COLUMN_READY = True


def get_user_settings(user_id: int) -> dict:
    _ensure_column()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT settings_json FROM users WHERE id = %s", (int(user_id),))
            row = cur.fetchone()
    raw = row.get("settings_json") if row else None
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_user_settings(user_id: int, settings: dict) -> None:
    _ensure_column()
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET settings_json = %s WHERE id = %s",
                (json.dumps(settings, ensure_ascii=False), int(user_id)),
            )
        conn.commit()


# --------------------------------------------------------------------------- #
# Resolution (effective values used at runtime)
# --------------------------------------------------------------------------- #
def resolve_user_ai(user: dict) -> dict:
    """Effective AI settings for a user: the install-time defaults (local Ollama)
    overlaid with the user's own overrides. The global app_settings row is NOT
    used as the baseline — a fresh/uncustomized user always starts from the
    defined local-AI default."""
    base = deepcopy(DEFAULT_SETTINGS.get("ai") or {})
    user_ai = (get_user_settings(int(user["id"])).get("ai") or {})
    return _deep_merge(base, user_ai)


def resolve_user_workflow_mode(user: dict) -> str:
    us = get_user_settings(int(user["id"]))
    mode = str((us.get("workflow") or {}).get("mode") or "").strip().lower()
    if mode in ("manual", "ai"):
        return mode
    # Uncustomized users fall back to the install default (manual), not the
    # global app_settings row.
    default_mode = str((DEFAULT_SETTINGS.get("workflow") or {}).get("mode") or "manual").strip().lower()
    return default_mode if default_mode in ("manual", "ai") else "manual"


# --------------------------------------------------------------------------- #
# Updates
# --------------------------------------------------------------------------- #
# Only these AI keys can be set per user (mirrors DEFAULT_SETTINGS["ai"]).
_ALLOWED_AI_KEYS = set(DEFAULT_SETTINGS.get("ai", {}).keys())


def update_user_ai(user_id: int, partial: dict) -> dict:
    """Merge a partial AI update into the user's settings. An empty
    ``cloud_api_key`` preserves the previously stored one (so re-saving the form
    without re-typing the key does not wipe it)."""
    with _LOCK:
        settings = get_user_settings(user_id)
        ai = dict(settings.get("ai") or {})
        for key, value in (partial or {}).items():
            if key not in _ALLOWED_AI_KEYS:
                continue
            if key == "cloud_api_key" and (value is None or value == ""):
                continue  # keep existing key
            ai[key] = value
        settings["ai"] = ai
        _save_user_settings(user_id, settings)
    return ai


def set_user_workflow_mode(user_id: int, mode: str) -> dict:
    mode = str(mode or "manual").strip().lower()
    if mode not in ("manual", "ai"):
        mode = "manual"
    with _LOCK:
        settings = get_user_settings(user_id)
        workflow = dict(settings.get("workflow") or {})
        workflow["mode"] = mode
        settings["workflow"] = workflow
        _save_user_settings(user_id, settings)
    return workflow
