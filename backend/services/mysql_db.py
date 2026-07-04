import os
from contextlib import contextmanager

import pymysql
from pymysql.cursors import DictCursor


DEFAULT_MYSQL_HOST = "127.0.0.1"
DEFAULT_MYSQL_PORT = 3306
DEFAULT_MYSQL_USER = "ssvp"
DEFAULT_MYSQL_PASSWORD = "ssvp123"
DEFAULT_MYSQL_DATABASE = "ssvp"


def _mysql_config() -> dict:
    return {
        "host": os.getenv("MYSQL_HOST", DEFAULT_MYSQL_HOST),
        "port": int(os.getenv("MYSQL_PORT", str(DEFAULT_MYSQL_PORT))),
        "user": os.getenv("MYSQL_USER", DEFAULT_MYSQL_USER),
        "password": os.getenv("MYSQL_PASSWORD", DEFAULT_MYSQL_PASSWORD),
        "database": os.getenv("MYSQL_DATABASE", DEFAULT_MYSQL_DATABASE),
        "charset": "utf8mb4",
        "cursorclass": DictCursor,
        "autocommit": False,
    }


def get_connection() -> pymysql.connections.Connection:
    return pymysql.connect(**_mysql_config())


@contextmanager
def mysql_conn():
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


def init_mysql_schema() -> None:
    with mysql_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(64) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    full_name VARCHAR(120) NOT NULL DEFAULT '',
                    job_title VARCHAR(120) NOT NULL DEFAULT '',
                    phone VARCHAR(40) NOT NULL DEFAULT '',
                    ui_theme VARCHAR(16) NOT NULL DEFAULT 'dark',
                    ui_language VARCHAR(8) NOT NULL DEFAULT 'tr',
                    is_admin TINYINT(1) NOT NULL DEFAULT 0,
                    must_change_password TINYINT(1) NOT NULL DEFAULT 0,
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    created_at VARCHAR(64) NOT NULL,
                    updated_at VARCHAR(64) NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS user_roles (
                    user_id INT NOT NULL,
                    role VARCHAR(64) NOT NULL,
                    PRIMARY KEY (user_id, role),
                    CONSTRAINT fk_user_roles_user
                        FOREIGN KEY (user_id) REFERENCES users(id)
                        ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    token VARCHAR(255) NOT NULL PRIMARY KEY,
                    user_id INT NOT NULL,
                    created_at VARCHAR(64) NOT NULL,
                    expires_at VARCHAR(64) NOT NULL,
                    CONSTRAINT fk_sessions_user
                        FOREIGN KEY (user_id) REFERENCES users(id)
                        ON DELETE CASCADE,
                    INDEX idx_sessions_user_id (user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS app_settings (
                    id INT NOT NULL PRIMARY KEY,
                    payload_json LONGTEXT NOT NULL,
                    updated_at VARCHAR(64) NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS offers (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(120) NOT NULL,
                    email VARCHAR(160) NOT NULL,
                    company VARCHAR(160) NOT NULL DEFAULT '',
                    phone VARCHAR(60) NOT NULL DEFAULT '',
                    message TEXT NOT NULL,
                    language VARCHAR(8) NOT NULL DEFAULT 'tr',
                    status VARCHAR(32) NOT NULL DEFAULT 'new',
                    created_at VARCHAR(64) NOT NULL,
                    updated_at VARCHAR(64) NOT NULL,
                    INDEX idx_offers_status (status),
                    INDEX idx_offers_created_at (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
        conn.commit()
