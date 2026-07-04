import json
import threading
from datetime import datetime, timezone

from backend.services.mysql_db import init_mysql_schema, mysql_conn
_LOCK = threading.Lock()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_offer_store() -> None:
    with _LOCK:
        init_mysql_schema()
        with mysql_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) AS count FROM offers")
                row = cur.fetchone()
                if int(row["count"] if row else 0) > 0:
                    conn.commit()
                    return
            conn.commit()


def create_offer(
    name: str,
    email: str,
    company: str,
    phone: str,
    message: str,
    language: str,
) -> dict:
    now = _utc_now_iso()
    init_offer_store()
    with _LOCK:
        with mysql_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO offers
                        (name, email, company, phone, message, language, status, created_at, updated_at)
                    VALUES
                        (%s, %s, %s, %s, %s, %s, 'new', %s, %s)
                    """,
                    (name, email, company, phone, message, language, now, now),
                )
                offer_id = int(cur.lastrowid)

                cur.execute(
                    """
                    SELECT id, name, email, company, phone, message, language, status, created_at, updated_at
                    FROM offers
                    WHERE id = %s
                    """,
                    (offer_id,),
                )
                row = cur.fetchone()
            conn.commit()
            return row or {}


def list_offers() -> list[dict]:
    init_offer_store()
    with _LOCK:
        with mysql_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, name, email, company, phone, message, language, status, created_at, updated_at
                    FROM offers
                    ORDER BY id DESC
                    """
                )
                rows = cur.fetchall()
            return rows


def update_offer_status(offer_id: int, status: str) -> dict | None:
    init_offer_store()
    with _LOCK:
        with mysql_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE offers SET status = %s, updated_at = %s WHERE id = %s",
                    (status, _utc_now_iso(), offer_id),
                )
                if cur.rowcount <= 0:
                    conn.commit()
                    return None

                cur.execute(
                    """
                    SELECT id, name, email, company, phone, message, language, status, created_at, updated_at
                    FROM offers
                    WHERE id = %s
                    """,
                    (offer_id,),
                )
                row = cur.fetchone()
            conn.commit()
            return row
