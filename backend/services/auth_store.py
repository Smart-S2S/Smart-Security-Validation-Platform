import base64
import hashlib
import hmac
import os
import secrets
import threading
from datetime import datetime, timedelta, timezone

from backend.services.mysql_db import init_mysql_schema, mysql_conn


ROLE_USER_MANAGEMENT = "user_management"
ROLE_TEST = "test"
ROLE_ATTACK = "attack"
ROLE_REMEDIATION = "remediation"

VALID_ROLES = {
    ROLE_USER_MANAGEMENT,
    ROLE_TEST,
    ROLE_ATTACK,
    ROLE_REMEDIATION,
}

DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "admin"

_LOCK = threading.Lock()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _to_iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _from_iso(value: str) -> datetime:
    return datetime.fromisoformat(value)


def _hash_password(password: str, salt: bytes | None = None) -> str:
    real_salt = salt or os.urandom(16)
    iterations = 210_000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), real_salt, iterations)
    return "pbkdf2_sha256${}${}${}".format(
        iterations,
        base64.urlsafe_b64encode(real_salt).decode("utf-8"),
        base64.urlsafe_b64encode(digest).decode("utf-8"),
    )


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt_b64, digest_b64 = stored_hash.split("$", maxsplit=3)
        if algorithm != "pbkdf2_sha256":
            return False

        iterations = int(iterations_text)
        salt = base64.urlsafe_b64decode(salt_b64.encode("utf-8"))
        expected = base64.urlsafe_b64decode(digest_b64.encode("utf-8"))
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def _roles_for_user(conn, user_id: int) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT role FROM user_roles WHERE user_id = %s ORDER BY role",
            (user_id,),
        )
        rows = cur.fetchall()
    return [row["role"] for row in rows]


def _admin_count_conn(conn) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS count FROM users WHERE is_admin = 1")
        row = cur.fetchone()
    return int(row["count"] if row else 0)


def _row_to_user(conn, row: dict) -> dict:
    user_id = int(row["id"])
    return {
        "id": user_id,
        "username": row["username"],
        "full_name": row.get("full_name") or "",
        "job_title": row.get("job_title") or "",
        "phone": row.get("phone") or "",
        "ui_theme": row.get("ui_theme") or "dark",
        "ui_language": row.get("ui_language") or "tr",
        "is_admin": bool(row.get("is_admin")),
        "must_change_password": bool(row.get("must_change_password")),
        "is_active": bool(row.get("is_active", 1)),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
        "roles": _roles_for_user(conn, user_id),
    }


def _get_user_by_id_conn(conn, user_id: int) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, username, full_name, job_title, phone, ui_theme, ui_language,
                   is_admin, must_change_password, is_active, created_at, updated_at
            FROM users WHERE id = %s
            """,
            (user_id,),
        )
        row = cur.fetchone()
    return _row_to_user(conn, row) if row else None


def _seed_default_admin_if_needed(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM users WHERE username = %s", (DEFAULT_ADMIN_USERNAME,))
        existing = cur.fetchone()
        if existing:
            return

        now = _to_iso(_utc_now())
        password_hash = _hash_password(DEFAULT_ADMIN_PASSWORD)
        cur.execute(
            """
            INSERT INTO users
                (username, password_hash, full_name, job_title, phone, ui_theme, ui_language,
                 is_admin, must_change_password, is_active, created_at, updated_at)
            VALUES
                (%s, %s, '', '', '', 'dark', 'tr', 1, 1, 1, %s, %s)
            """,
            (DEFAULT_ADMIN_USERNAME, password_hash, now, now),
        )
        admin_id = int(cur.lastrowid)
        cur.executemany(
            "INSERT INTO user_roles (user_id, role) VALUES (%s, %s)",
            [(admin_id, role) for role in sorted(VALID_ROLES)],
        )


def init_auth_store() -> None:
    with _LOCK:
        init_mysql_schema()
        with mysql_conn() as conn:
            _seed_default_admin_if_needed(conn)
            conn.commit()


def list_users() -> list[dict]:
    with _LOCK:
        with mysql_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, username, full_name, job_title, phone, ui_theme, ui_language,
                           is_admin, must_change_password, is_active, created_at, updated_at
                    FROM users
                    ORDER BY username
                    """
                )
                rows = cur.fetchall()
            return [_row_to_user(conn, row) for row in rows]


def get_user_by_username(username: str) -> dict | None:
    with _LOCK:
        with mysql_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, username, full_name, job_title, phone, ui_theme, ui_language,
                           is_admin, must_change_password, is_active, created_at, updated_at,
                           password_hash
                    FROM users
                    WHERE username = %s
                    """,
                    (username,),
                )
                row = cur.fetchone()
            if not row:
                return None

            user = _row_to_user(conn, row)
            user["password_hash"] = row["password_hash"]
            return user


def get_user_by_id(user_id: int) -> dict | None:
    with _LOCK:
        with mysql_conn() as conn:
            return _get_user_by_id_conn(conn, user_id)


def authenticate(username: str, password: str) -> dict | None:
    user = get_user_by_username(username)
    if not user:
        return None
    if not user.get("is_active", True):
        return None
    if not verify_password(password, user["password_hash"]):
        return None
    user.pop("password_hash", None)
    return user


def create_session(user_id: int, ttl_hours: int = 12) -> str:
    token = secrets.token_urlsafe(48)
    now = _utc_now()
    expires = now + timedelta(hours=ttl_hours)

    with _LOCK:
        with mysql_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (%s, %s, %s, %s)",
                    (token, user_id, _to_iso(now), _to_iso(expires)),
                )
                cur.execute(
                    "DELETE FROM sessions WHERE expires_at < %s",
                    (_to_iso(now),),
                )
            conn.commit()
            return token


def delete_session(token: str) -> None:
    with _LOCK:
        with mysql_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM sessions WHERE token = %s", (token,))
            conn.commit()


def get_user_by_session(token: str) -> dict | None:
    with _LOCK:
        with mysql_conn() as conn:
            now = _utc_now()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT u.id, u.username, u.full_name, u.job_title, u.phone, u.ui_theme,
                           u.ui_language, u.is_admin, u.must_change_password, u.is_active,
                           u.created_at, u.updated_at, s.expires_at
                    FROM sessions s
                    JOIN users u ON u.id = s.user_id
                    WHERE s.token = %s
                    """,
                    (token,),
                )
                row = cur.fetchone()

                if not row:
                    return None

                if _from_iso(row["expires_at"]) < now:
                    cur.execute("DELETE FROM sessions WHERE token = %s", (token,))
                    conn.commit()
                    return None

                if not bool(row.get("is_active", 1)):
                    return None

            return _row_to_user(conn, row)


def admin_count() -> int:
    with _LOCK:
        with mysql_conn() as conn:
            return _admin_count_conn(conn)


def create_user(
    username: str,
    password: str,
    full_name: str = "",
    job_title: str = "",
    phone: str = "",
    is_admin: bool = False,
    roles: list[str] | None = None,
    must_change_password: bool = True,
) -> dict:
    clean_roles = sorted({role for role in (roles or []) if role in VALID_ROLES})
    if is_admin:
        clean_roles = sorted(VALID_ROLES)

    now = _to_iso(_utc_now())
    with _LOCK:
        with mysql_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM users WHERE username = %s", (username,))
                existing = cur.fetchone()
                if existing:
                    raise ValueError("USERNAME_ALREADY_EXISTS")

                cur.execute(
                    """
                    INSERT INTO users
                        (username, password_hash, full_name, job_title, phone, ui_theme,
                         ui_language, is_admin, must_change_password, is_active, created_at, updated_at)
                    VALUES
                        (%s, %s, %s, %s, %s, 'dark', 'tr', %s, %s, 1, %s, %s)
                    """,
                    (
                        username,
                        _hash_password(password),
                        full_name.strip(),
                        job_title.strip(),
                        phone.strip(),
                        1 if is_admin else 0,
                        1 if must_change_password else 0,
                        now,
                        now,
                    ),
                )
                user_id = int(cur.lastrowid)

                if clean_roles:
                    cur.executemany(
                        "INSERT INTO user_roles (user_id, role) VALUES (%s, %s)",
                        [(user_id, role) for role in clean_roles],
                    )

            conn.commit()
            created = _get_user_by_id_conn(conn, user_id)
            if not created:
                raise RuntimeError("USER_CREATE_FAILED")
            return created


def update_user(
    user_id: int,
    username: str | None = None,
    full_name: str | None = None,
    job_title: str | None = None,
    phone: str | None = None,
    ui_theme: str | None = None,
    ui_language: str | None = None,
    is_admin: bool | None = None,
    is_active: bool | None = None,
    roles: list[str] | None = None,
) -> dict | None:
    now = _to_iso(_utc_now())
    clean_roles = None
    if roles is not None:
        clean_roles = sorted({role for role in roles if role in VALID_ROLES})

    with _LOCK:
        with mysql_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, username, full_name, job_title, phone, ui_theme, ui_language, is_admin FROM users WHERE id = %s",
                    (user_id,),
                )
                current = cur.fetchone()
                if not current:
                    return None

                if username is not None and username != current["username"]:
                    cur.execute(
                        "SELECT id FROM users WHERE username = %s AND id != %s",
                        (username, user_id),
                    )
                    existing = cur.fetchone()
                    if existing:
                        raise ValueError("USERNAME_ALREADY_EXISTS")

                next_admin = bool(current["is_admin"]) if is_admin is None else bool(is_admin)
                if bool(current["is_admin"]) and not next_admin and _admin_count_conn(conn) <= 1:
                    raise ValueError("LAST_ADMIN")

                values = {
                    "username": current["username"] if username is None else username,
                    "full_name": current["full_name"] if full_name is None else full_name.strip(),
                    "job_title": current["job_title"] if job_title is None else job_title.strip(),
                    "phone": current["phone"] if phone is None else phone.strip(),
                    "ui_theme": current["ui_theme"] if ui_theme is None else ui_theme,
                    "ui_language": current["ui_language"] if ui_language is None else ui_language,
                    "is_admin": 1 if next_admin else 0,
                    "is_active": None if is_active is None else (1 if is_active else 0),
                }

                if values["is_active"] is None:
                    cur.execute(
                        """
                        UPDATE users
                        SET username = %s, full_name = %s, job_title = %s, phone = %s,
                            ui_theme = %s, ui_language = %s, is_admin = %s, updated_at = %s
                        WHERE id = %s
                        """,
                        (
                            values["username"],
                            values["full_name"],
                            values["job_title"],
                            values["phone"],
                            values["ui_theme"],
                            values["ui_language"],
                            values["is_admin"],
                            now,
                            user_id,
                        ),
                    )
                else:
                    cur.execute(
                        """
                        UPDATE users
                        SET username = %s, full_name = %s, job_title = %s, phone = %s,
                            ui_theme = %s, ui_language = %s, is_admin = %s, is_active = %s,
                            updated_at = %s
                        WHERE id = %s
                        """,
                        (
                            values["username"],
                            values["full_name"],
                            values["job_title"],
                            values["phone"],
                            values["ui_theme"],
                            values["ui_language"],
                            values["is_admin"],
                            values["is_active"],
                            now,
                            user_id,
                        ),
                    )

                if clean_roles is not None:
                    if next_admin:
                        clean_roles = sorted(VALID_ROLES)
                    cur.execute("DELETE FROM user_roles WHERE user_id = %s", (user_id,))
                    if clean_roles:
                        cur.executemany(
                            "INSERT INTO user_roles (user_id, role) VALUES (%s, %s)",
                            [(user_id, role) for role in clean_roles],
                        )

            conn.commit()
            return _get_user_by_id_conn(conn, user_id)


def delete_user(user_id: int) -> bool:
    with _LOCK:
        with mysql_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT is_admin FROM users WHERE id = %s", (user_id,))
                row = cur.fetchone()
                if not row:
                    return False

                if bool(row["is_admin"]) and _admin_count_conn(conn) <= 1:
                    raise ValueError("LAST_ADMIN")

                cur.execute("DELETE FROM sessions WHERE user_id = %s", (user_id,))
                cur.execute("DELETE FROM user_roles WHERE user_id = %s", (user_id,))
                cur.execute("DELETE FROM users WHERE id = %s", (user_id,))

            conn.commit()
            return True


def set_user_password(
    user_id: int,
    new_password: str,
    must_change_password: bool,
    keep_session_token: str | None = None,
) -> dict | None:
    with _LOCK:
        with mysql_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM users WHERE id = %s", (user_id,))
                row = cur.fetchone()
                if not row:
                    return None

                now = _to_iso(_utc_now())
                cur.execute(
                    "UPDATE users SET password_hash = %s, must_change_password = %s, updated_at = %s WHERE id = %s",
                    (_hash_password(new_password), 1 if must_change_password else 0, now, user_id),
                )
                if keep_session_token:
                    cur.execute(
                        "DELETE FROM sessions WHERE user_id = %s AND token != %s",
                        (user_id, keep_session_token),
                    )
                else:
                    cur.execute("DELETE FROM sessions WHERE user_id = %s", (user_id,))

            conn.commit()
            return _get_user_by_id_conn(conn, user_id)
