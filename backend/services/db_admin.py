"""Admin database operations: safe password rotation + backups.

Password rotation is done so the running app never loses its DB connection:
we change the password on MySQL, verify a brand-new connection works with the
new password, and only THEN persist it to the credential file. If verification
fails we roll the MySQL password back to the old value (over the still-open
original session) and leave the file untouched — so the service keeps running on
the old password. This satisfies "no service interruption": both the DB and the
file must confirm the change, otherwise we keep the old password.

Backups are plain ``mysqldump`` dumps written under ``data/backups``. The DB
password is passed via the ``MYSQL_PWD`` environment variable (never on argv, so
it does not leak into the process list), and mysqldump is invoked with a fixed
argv list (no shell).
"""

from __future__ import annotations

import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import pymysql

from backend.services import db_credentials


_BACKUP_DIR = Path(__file__).resolve().parents[2] / "data" / "backups"
_NAME_RE = re.compile(r"^ssvp_backup_\d{8}_\d{6}\.sql$")

MIN_PASSWORD_LEN = 8
MAX_PASSWORD_LEN = 128


# --------------------------------------------------------------------------- #
# Status
# --------------------------------------------------------------------------- #
def db_status() -> dict:
    creds = db_credentials.load_credentials()
    connected = False
    server_version = ""
    error = ""
    try:
        conn = pymysql.connect(
            host=creds["host"], port=int(creds["port"]), user=creds["user"],
            password=creds["password"], database=creds["database"], connect_timeout=5,
        )
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT VERSION()")
                row = cur.fetchone()
                server_version = str(row[0]) if row else ""
            connected = True
        finally:
            conn.close()
    except Exception as exc:  # noqa: BLE001
        error = f"{type(exc).__name__}: {str(exc)[:200]}"
    return {
        "host": creds["host"],
        "port": int(creds["port"]),
        "user": creds["user"],
        "database": creds["database"],
        "password_set": bool(creds["password"]),
        "connected": connected,
        "server_version": server_version,
        "config_path": str(db_credentials.config_path()),
        "error": error,
    }


# --------------------------------------------------------------------------- #
# Password rotation
# --------------------------------------------------------------------------- #
def validate_new_password(new_password: str) -> str | None:
    """Return an error message if invalid, else None."""
    if not isinstance(new_password, str):
        return "Parola metni gecersiz."
    if len(new_password) < MIN_PASSWORD_LEN:
        return f"Parola en az {MIN_PASSWORD_LEN} karakter olmali."
    if len(new_password) > MAX_PASSWORD_LEN:
        return f"Parola en fazla {MAX_PASSWORD_LEN} karakter olabilir."
    # Reject control chars / whitespace-only; everything else is fine because the
    # value is always sent to MySQL as a properly escaped parameter (no shell).
    if any(ord(ch) < 32 for ch in new_password):
        return "Parola kontrol karakteri iceremez."
    if new_password.strip() != new_password:
        return "Parola bosluk ile baslayip bitemez."
    return None


def _alter_current_password(cur, password: str) -> None:
    # USER() is the exact account this session authenticated as, so this works
    # even for a user privileged only on its own schema (no global grants).
    cur.execute("ALTER USER USER() IDENTIFIED BY %s", (password,))


def _best_effort_alter_all(cur, user: str, password: str) -> None:
    """If we happen to have the privilege, keep the localhost/127.0.0.1/% copies
    of the account in sync too. Ignored silently when not permitted."""
    for host in ("localhost", "127.0.0.1", "%"):
        try:
            cur.execute("ALTER USER %s@%s IDENTIFIED BY %s", (user, host, password))
        except Exception:  # noqa: BLE001
            pass


def _verify_connection(creds: dict, password: str) -> bool:
    try:
        conn = pymysql.connect(
            host=creds["host"], port=int(creds["port"]), user=creds["user"],
            password=password, database=creds["database"], connect_timeout=5,
        )
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        finally:
            conn.close()
        return True
    except Exception:  # noqa: BLE001
        return False


def change_db_password(new_password: str) -> dict:
    """Rotate the DB password with verify-then-persist and rollback on failure."""
    err = validate_new_password(new_password)
    if err:
        return {"ok": False, "message": err}

    creds = db_credentials.load_credentials()
    old_password = creds["password"]
    if new_password == old_password:
        return {"ok": False, "message": "Yeni parola eskisiyle ayni."}

    # Keep this session open through verification so we can roll back over it.
    try:
        conn = pymysql.connect(
            host=creds["host"], port=int(creds["port"]), user=creds["user"],
            password=old_password, database=creds["database"], connect_timeout=5,
        )
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "message": f"Mevcut parola ile baglanilamadi: {type(exc).__name__}"}

    try:
        with conn.cursor() as cur:
            _alter_current_password(cur, new_password)
            _best_effort_alter_all(cur, creds["user"], new_password)
            try:
                cur.execute("FLUSH PRIVILEGES")
            except Exception:  # noqa: BLE001
                pass
        conn.commit()

        # Verify BOTH conditions before persisting: a fresh connection with the
        # new password must succeed.
        if not _verify_connection(creds, new_password):
            _rollback(conn, creds["user"], old_password)
            return {"ok": False, "message": "Yeni parola dogrulanamadi; eski parola korundu."}

        # DB confirmed. Now persist to the file; if the file write fails, roll the
        # DB back so DB and file never disagree.
        try:
            db_credentials.update_password(new_password)
        except Exception as exc:  # noqa: BLE001
            _rollback(conn, creds["user"], old_password)
            return {"ok": False, "message": f"Parola dosyaya yazilamadi; eski parola korundu: {type(exc).__name__}"}

        return {"ok": True, "message": "Veritabani parolasi guncellendi. Hizmet kesintisi olmadan gecerli."}
    except Exception as exc:  # noqa: BLE001
        _rollback(conn, creds["user"], old_password)
        return {"ok": False, "message": f"Parola degistirilemedi; eski parola korundu: {type(exc).__name__}: {str(exc)[:160]}"}
    finally:
        try:
            conn.close()
        except Exception:  # noqa: BLE001
            pass


def _rollback(conn, user: str, old_password: str) -> None:
    try:
        with conn.cursor() as cur:
            _alter_current_password(cur, old_password)
            _best_effort_alter_all(cur, user, old_password)
            try:
                cur.execute("FLUSH PRIVILEGES")
            except Exception:  # noqa: BLE001
                pass
        conn.commit()
    except Exception:  # noqa: BLE001
        pass


# --------------------------------------------------------------------------- #
# Backups
# --------------------------------------------------------------------------- #
def _resolve_mysqldump() -> str | None:
    import shutil
    return shutil.which("mysqldump")


def create_backup() -> dict:
    dump = _resolve_mysqldump()
    if not dump:
        return {"ok": False, "message": "mysqldump bulunamadi (mysql-client kurulu degil)."}

    creds = db_credentials.load_credentials()
    _BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    name = f"ssvp_backup_{stamp}.sql"
    out_path = _BACKUP_DIR / name

    argv = [
        dump,
        "--host", str(creds["host"]),
        "--port", str(int(creds["port"])),
        "--user", str(creds["user"]),
        "--single-transaction",
        "--routines",
        "--triggers",
        "--databases", str(creds["database"]),
    ]
    env = os.environ.copy()
    env["MYSQL_PWD"] = str(creds["password"])  # keeps password off the argv/ps list

    try:
        with open(out_path, "w", encoding="utf-8") as fh:
            proc = subprocess.run(argv, stdout=fh, stderr=subprocess.PIPE, env=env, timeout=600)
    except subprocess.TimeoutExpired:
        out_path.unlink(missing_ok=True)
        return {"ok": False, "message": "Yedekleme zaman asimina ugradi."}
    except Exception as exc:  # noqa: BLE001
        out_path.unlink(missing_ok=True)
        return {"ok": False, "message": f"Yedekleme hatasi: {type(exc).__name__}"}

    if proc.returncode != 0:
        out_path.unlink(missing_ok=True)
        msg = (proc.stderr or b"").decode("utf-8", "replace").strip()[:200]
        return {"ok": False, "message": f"mysqldump basarisiz: {msg}"}

    os.chmod(out_path, 0o600)
    return {"ok": True, "message": "Yedek olusturuldu.", "backup": _describe(out_path)}


def _describe(path: Path) -> dict:
    stat = path.stat()
    return {
        "name": path.name,
        "size": stat.st_size,
        "created_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
    }


def list_backups() -> list[dict]:
    if not _BACKUP_DIR.exists():
        return []
    items = [
        _describe(p)
        for p in _BACKUP_DIR.iterdir()
        if p.is_file() and _NAME_RE.match(p.name)
    ]
    return sorted(items, key=lambda x: x["name"], reverse=True)


def backup_path(name: str) -> Path | None:
    """Path-traversal-safe resolution of a backup file by name."""
    safe = os.path.basename(str(name or ""))
    if not _NAME_RE.match(safe):
        return None
    path = (_BACKUP_DIR / safe).resolve()
    try:
        path.relative_to(_BACKUP_DIR.resolve())
    except ValueError:
        return None
    return path if path.is_file() else None


def delete_backup(name: str) -> dict:
    path = backup_path(name)
    if not path:
        return {"ok": False, "message": "Yedek bulunamadi."}
    try:
        path.unlink()
        return {"ok": True, "message": "Yedek silindi."}
    except OSError as exc:
        return {"ok": False, "message": f"Silinemedi: {type(exc).__name__}"}
