"""File-based MySQL credential store.

The app used to read MySQL credentials only from environment variables, which
made runtime password rotation impossible (env is fixed for the life of the
process, and a change would not survive a restart). This module adds a small
JSON credential file so an admin can rotate the DB password from the UI and have
it take effect immediately AND persist across restarts — without editing systemd
units or re-deploying.

Resolution precedence (lowest → highest):
    built-in defaults  <  environment variables  <  credential file

The file wins on purpose: once written it is the source of truth, so a rotated
password is not silently overridden by a stale value baked into the environment.

Security: the file holds a plaintext DB password (unavoidable — the app must be
able to authenticate to MySQL). It is created 0600 (owner read/write only) and
lives under ``data/`` which the installer owns as the app user.
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
from pathlib import Path


DEFAULT_MYSQL_HOST = "127.0.0.1"
DEFAULT_MYSQL_PORT = 3306
DEFAULT_MYSQL_USER = "ssvp"
DEFAULT_MYSQL_PASSWORD = "ssvp123"
DEFAULT_MYSQL_DATABASE = "ssvp"

_LOCK = threading.Lock()

# Only these keys are persisted / read back.
_KEYS = ("host", "port", "user", "password", "database")


def config_path() -> Path:
    """Where the credential file lives (override with SSVP_DB_CONFIG)."""
    override = os.getenv("SSVP_DB_CONFIG")
    if override:
        return Path(override).expanduser()
    # backend/services/db_credentials.py -> repo root
    return Path(__file__).resolve().parents[2] / "data" / "db_config.json"


def _defaults() -> dict:
    return {
        "host": DEFAULT_MYSQL_HOST,
        "port": DEFAULT_MYSQL_PORT,
        "user": DEFAULT_MYSQL_USER,
        "password": DEFAULT_MYSQL_PASSWORD,
        "database": DEFAULT_MYSQL_DATABASE,
    }


def _from_env() -> dict:
    cfg: dict = {}
    if os.getenv("MYSQL_HOST") is not None:
        cfg["host"] = os.getenv("MYSQL_HOST")
    if os.getenv("MYSQL_PORT") is not None:
        try:
            cfg["port"] = int(os.getenv("MYSQL_PORT"))
        except (TypeError, ValueError):
            pass
    if os.getenv("MYSQL_USER") is not None:
        cfg["user"] = os.getenv("MYSQL_USER")
    if os.getenv("MYSQL_PASSWORD") is not None:
        cfg["password"] = os.getenv("MYSQL_PASSWORD")
    if os.getenv("MYSQL_DATABASE") is not None:
        cfg["database"] = os.getenv("MYSQL_DATABASE")
    return cfg


def _from_file() -> dict:
    path = config_path()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except Exception:
        return {}
    if not isinstance(raw, dict):
        return {}
    cfg: dict = {}
    for key in _KEYS:
        if key in raw and raw[key] not in (None, ""):
            cfg[key] = raw[key]
    if "port" in cfg:
        try:
            cfg["port"] = int(cfg["port"])
        except (TypeError, ValueError):
            cfg.pop("port", None)
    return cfg


def load_credentials() -> dict:
    """Effective DB credentials: defaults < env < file."""
    cfg = _defaults()
    cfg.update(_from_env())
    cfg.update(_from_file())
    return cfg


def write_credentials(config: dict) -> Path:
    """Persist the credential file atomically with 0600 perms.

    Only the known keys are written; unknown keys are ignored.
    """
    path = config_path()
    payload = {}
    current = load_credentials()
    for key in _KEYS:
        payload[key] = config.get(key, current.get(key))
    payload["port"] = int(payload["port"])

    with _LOCK:
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_name = tempfile.mkstemp(dir=str(path.parent), prefix=".db_config.", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(payload, fh, indent=2, ensure_ascii=False)
            os.chmod(tmp_name, 0o600)
            os.replace(tmp_name, path)
        finally:
            try:
                if os.path.exists(tmp_name):
                    os.unlink(tmp_name)
            except OSError:
                pass
    return path


def update_password(new_password: str) -> Path:
    """Persist a new DB password (keeps all other fields), and update the live
    process environment so any code that still reads MYSQL_PASSWORD stays in
    sync until the next restart."""
    cfg = load_credentials()
    cfg["password"] = new_password
    path = write_credentials(cfg)
    os.environ["MYSQL_PASSWORD"] = new_password
    return path
