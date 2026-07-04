import os
from contextlib import contextmanager
from datetime import datetime, timezone

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
    now_iso = datetime.now(timezone.utc).isoformat()
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
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tool_registry (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    action_key VARCHAR(120) NOT NULL UNIQUE,
                    display_name VARCHAR(160) NOT NULL,
                    tool_name VARCHAR(120) NOT NULL,
                    module_path VARCHAR(255) NOT NULL DEFAULT '',
                    command_template TEXT NOT NULL,
                    default_params_json LONGTEXT NOT NULL,
                    risk_level VARCHAR(16) NOT NULL DEFAULT 'low',
                    requires_approval TINYINT(1) NOT NULL DEFAULT 0,
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    created_at VARCHAR(64) NOT NULL,
                    updated_at VARCHAR(64) NOT NULL,
                    INDEX idx_tool_registry_active (is_active),
                    INDEX idx_tool_registry_risk (risk_level)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tool_execution_audit (
                    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    action_key VARCHAR(120) NOT NULL,
                    requested_by INT NULL,
                    target VARCHAR(255) NOT NULL,
                    reason TEXT NOT NULL,
                    params_json LONGTEXT NOT NULL,
                    risk_level VARCHAR(16) NOT NULL DEFAULT 'low',
                    approval_required TINYINT(1) NOT NULL DEFAULT 0,
                    approved TINYINT(1) NOT NULL DEFAULT 0,
                    status VARCHAR(32) NOT NULL,
                    result_json LONGTEXT NOT NULL,
                    created_at VARCHAR(64) NOT NULL,
                    INDEX idx_tool_execution_action (action_key),
                    INDEX idx_tool_execution_status (status),
                    INDEX idx_tool_execution_created (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS progress_categories (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    category_key VARCHAR(120) NOT NULL UNIQUE,
                    display_name VARCHAR(160) NOT NULL,
                    workflow_key VARCHAR(32) NOT NULL DEFAULT 'scan',
                    description TEXT NOT NULL,
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    created_at VARCHAR(64) NOT NULL,
                    updated_at VARCHAR(64) NOT NULL,
                    INDEX idx_progress_categories_workflow (workflow_key),
                    INDEX idx_progress_categories_active (is_active)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS steps (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    step_key VARCHAR(160) NOT NULL UNIQUE,
                    display_name VARCHAR(160) NOT NULL,
                    workflow_key VARCHAR(32) NOT NULL DEFAULT 'scan',
                    category_id INT NOT NULL,
                    description TEXT NOT NULL,
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    created_at VARCHAR(64) NOT NULL,
                    updated_at VARCHAR(64) NOT NULL,
                    INDEX idx_steps_workflow (workflow_key),
                    INDEX idx_steps_category (category_id),
                    INDEX idx_steps_active (is_active),
                    CONSTRAINT fk_steps_category
                        FOREIGN KEY (category_id) REFERENCES progress_categories(id)
                        ON DELETE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS step_items (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    step_id INT NOT NULL,
                    item_type VARCHAR(16) NOT NULL,
                    item_key VARCHAR(120) NOT NULL,
                    display_name VARCHAR(160) NOT NULL,
                    description TEXT NOT NULL,
                    script_path VARCHAR(500) NOT NULL DEFAULT '',
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    created_at VARCHAR(64) NOT NULL,
                    updated_at VARCHAR(64) NOT NULL,
                    UNIQUE KEY uq_step_items_step_key (step_id, item_key),
                    INDEX idx_step_items_step (step_id),
                    INDEX idx_step_items_type (item_type),
                    INDEX idx_step_items_active (is_active),
                    CONSTRAINT fk_step_items_step
                        FOREIGN KEY (step_id) REFERENCES steps(id)
                        ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS step_item_parameters (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    item_id INT NOT NULL,
                    param_key VARCHAR(120) NOT NULL,
                    label VARCHAR(160) NOT NULL,
                    param_type VARCHAR(32) NOT NULL DEFAULT 'string',
                    default_value TEXT NOT NULL,
                    description TEXT NOT NULL,
                    options_json LONGTEXT NOT NULL,
                    is_required TINYINT(1) NOT NULL DEFAULT 0,
                    sort_order INT NOT NULL DEFAULT 100,
                    created_at VARCHAR(64) NOT NULL,
                    updated_at VARCHAR(64) NOT NULL,
                    UNIQUE KEY uq_step_item_param (item_id, param_key),
                    INDEX idx_step_item_params_sort (item_id, sort_order),
                    CONSTRAINT fk_step_item_parameters_item
                        FOREIGN KEY (item_id) REFERENCES step_items(id)
                        ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tools (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    step_id INT NULL,
                    action_key VARCHAR(120) NOT NULL UNIQUE,
                    tool_name VARCHAR(120) NOT NULL,
                    display_name VARCHAR(160) NOT NULL,
                    workflow_key VARCHAR(32) NOT NULL DEFAULT 'scan',
                    test_category VARCHAR(120) NOT NULL DEFAULT 'general',
                    test_step VARCHAR(160) NOT NULL DEFAULT 'custom_step',
                    script_filename VARCHAR(255) NOT NULL DEFAULT '',
                    script_source LONGTEXT NOT NULL,
                    tool_type VARCHAR(64) NOT NULL DEFAULT 'scanner',
                    module_path VARCHAR(255) NOT NULL DEFAULT '',
                    executable_path VARCHAR(255) NOT NULL DEFAULT '',
                    base_command TEXT NOT NULL,
                    risk_level VARCHAR(16) NOT NULL DEFAULT 'low',
                    timeout_sec INT NOT NULL DEFAULT 300,
                    requires_approval TINYINT(1) NOT NULL DEFAULT 1,
                    wordlist_path VARCHAR(255) NOT NULL DEFAULT '',
                    payload_path VARCHAR(255) NOT NULL DEFAULT '',
                    template_path VARCHAR(255) NOT NULL DEFAULT '',
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    created_at VARCHAR(64) NOT NULL,
                    updated_at VARCHAR(64) NOT NULL,
                    INDEX idx_tools_active (is_active),
                    INDEX idx_tools_risk (risk_level),
                    INDEX idx_tools_workflow (workflow_key),
                    INDEX idx_tools_step_id (step_id),
                    CONSTRAINT fk_tools_step
                        FOREIGN KEY (step_id) REFERENCES steps(id)
                        ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tool_parameters (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    tool_id INT NOT NULL,
                    param_key VARCHAR(120) NOT NULL,
                    label VARCHAR(160) NOT NULL,
                    param_type VARCHAR(32) NOT NULL DEFAULT 'string',
                    default_value TEXT NOT NULL,
                    is_required TINYINT(1) NOT NULL DEFAULT 0,
                    is_editable TINYINT(1) NOT NULL DEFAULT 1,
                    options_json LONGTEXT NOT NULL,
                    sort_order INT NOT NULL DEFAULT 100,
                    created_at VARCHAR(64) NOT NULL,
                    updated_at VARCHAR(64) NOT NULL,
                    UNIQUE KEY uq_tool_param (tool_id, param_key),
                    INDEX idx_tool_params_sort (tool_id, sort_order),
                    CONSTRAINT fk_tool_parameters_tool
                        FOREIGN KEY (tool_id) REFERENCES tools(id)
                        ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tool_scripts (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    tool_id INT NOT NULL,
                    script_name VARCHAR(160) NOT NULL,
                    filename VARCHAR(255) NOT NULL DEFAULT '',
                    file_path VARCHAR(400) NOT NULL DEFAULT '',
                    script_source LONGTEXT NOT NULL,
                    sort_order INT NOT NULL DEFAULT 100,
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    created_at VARCHAR(64) NOT NULL,
                    updated_at VARCHAR(64) NOT NULL,
                    INDEX idx_tool_scripts_tool_sort (tool_id, sort_order),
                    CONSTRAINT fk_tool_scripts_tool
                        FOREIGN KEY (tool_id) REFERENCES tools(id)
                        ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tool_runs (
                    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    action_key VARCHAR(120) NOT NULL,
                    tool_id INT NULL,
                    requested_by INT NULL,
                    target VARCHAR(255) NOT NULL,
                    reason TEXT NOT NULL,
                    resolved_command TEXT NOT NULL,
                    params_json LONGTEXT NOT NULL,
                    risk_level VARCHAR(16) NOT NULL DEFAULT 'low',
                    approval_required TINYINT(1) NOT NULL DEFAULT 0,
                    approved TINYINT(1) NOT NULL DEFAULT 0,
                    status VARCHAR(32) NOT NULL,
                    output_json LONGTEXT NOT NULL,
                    started_at VARCHAR(64) NOT NULL,
                    finished_at VARCHAR(64) NOT NULL,
                    created_at VARCHAR(64) NOT NULL,
                    INDEX idx_tool_runs_action (action_key),
                    INDEX idx_tool_runs_status (status),
                    INDEX idx_tool_runs_created (created_at),
                    CONSTRAINT fk_tool_runs_tool
                        FOREIGN KEY (tool_id) REFERENCES tools(id)
                        ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS validation_actions (
                    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    step_key VARCHAR(32) NOT NULL,
                    step_name VARCHAR(140) NOT NULL,
                    action_key VARCHAR(120) NOT NULL,
                    target VARCHAR(255) NOT NULL,
                    reason TEXT NOT NULL,
                    parameters_json LONGTEXT NOT NULL,
                    tool_run_id BIGINT NULL,
                    evidence_json LONGTEXT NOT NULL,
                    ai_analysis_json LONGTEXT NOT NULL,
                    status VARCHAR(32) NOT NULL DEFAULT 'planned',
                    created_by INT NULL,
                    created_at VARCHAR(64) NOT NULL,
                    updated_at VARCHAR(64) NOT NULL,
                    INDEX idx_validation_actions_step_key (step_key),
                    INDEX idx_validation_actions_target (target),
                    INDEX idx_validation_actions_status (status),
                    INDEX idx_validation_actions_created (created_at),
                    CONSTRAINT fk_validation_actions_run
                        FOREIGN KEY (tool_run_id) REFERENCES tool_runs(id)
                        ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )

            # Backward-compatible migrations for existing installations.
            cur.execute("SHOW COLUMNS FROM tools LIKE 'workflow_key'")
            if not cur.fetchone():
                cur.execute("ALTER TABLE tools ADD COLUMN workflow_key VARCHAR(32) NOT NULL DEFAULT 'scan'")

            cur.execute("SHOW COLUMNS FROM tools LIKE 'test_category'")
            if not cur.fetchone():
                cur.execute("ALTER TABLE tools ADD COLUMN test_category VARCHAR(120) NOT NULL DEFAULT 'general'")

            cur.execute("SHOW COLUMNS FROM tools LIKE 'test_step'")
            if not cur.fetchone():
                cur.execute("ALTER TABLE tools ADD COLUMN test_step VARCHAR(160) NOT NULL DEFAULT 'custom_step'")

            cur.execute("SHOW COLUMNS FROM tools LIKE 'script_filename'")
            if not cur.fetchone():
                cur.execute("ALTER TABLE tools ADD COLUMN script_filename VARCHAR(255) NOT NULL DEFAULT ''")

            cur.execute("SHOW COLUMNS FROM tools LIKE 'script_source'")
            if not cur.fetchone():
                cur.execute("ALTER TABLE tools ADD COLUMN script_source LONGTEXT NOT NULL")

            cur.execute("SHOW TABLES LIKE 'tool_scripts'")
            if not cur.fetchone():
                cur.execute(
                    """
                    CREATE TABLE tool_scripts (
                        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                        tool_id INT NOT NULL,
                        script_name VARCHAR(160) NOT NULL,
                        filename VARCHAR(255) NOT NULL DEFAULT '',
                        file_path VARCHAR(400) NOT NULL DEFAULT '',
                        script_source LONGTEXT NOT NULL,
                        sort_order INT NOT NULL DEFAULT 100,
                        is_active TINYINT(1) NOT NULL DEFAULT 1,
                        created_at VARCHAR(64) NOT NULL,
                        updated_at VARCHAR(64) NOT NULL,
                        INDEX idx_tool_scripts_tool_sort (tool_id, sort_order),
                        CONSTRAINT fk_tool_scripts_tool
                            FOREIGN KEY (tool_id) REFERENCES tools(id)
                            ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )

            cur.execute("SHOW TABLES LIKE 'progress_categories'")
            if not cur.fetchone():
                cur.execute(
                    """
                    CREATE TABLE progress_categories (
                        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                        category_key VARCHAR(120) NOT NULL UNIQUE,
                        display_name VARCHAR(160) NOT NULL,
                        workflow_key VARCHAR(32) NOT NULL DEFAULT 'scan',
                        description TEXT NOT NULL,
                        is_active TINYINT(1) NOT NULL DEFAULT 1,
                        created_at VARCHAR(64) NOT NULL,
                        updated_at VARCHAR(64) NOT NULL,
                        INDEX idx_progress_categories_workflow (workflow_key),
                        INDEX idx_progress_categories_active (is_active)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )

            cur.execute("SHOW TABLES LIKE 'steps'")
            if not cur.fetchone():
                cur.execute(
                    """
                    CREATE TABLE steps (
                        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                        step_key VARCHAR(160) NOT NULL UNIQUE,
                        display_name VARCHAR(160) NOT NULL,
                        workflow_key VARCHAR(32) NOT NULL DEFAULT 'scan',
                        category_id INT NOT NULL,
                        description TEXT NOT NULL,
                        is_active TINYINT(1) NOT NULL DEFAULT 1,
                        created_at VARCHAR(64) NOT NULL,
                        updated_at VARCHAR(64) NOT NULL,
                        INDEX idx_steps_workflow (workflow_key),
                        INDEX idx_steps_category (category_id),
                        INDEX idx_steps_active (is_active),
                        CONSTRAINT fk_steps_category
                            FOREIGN KEY (category_id) REFERENCES progress_categories(id)
                            ON DELETE RESTRICT
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )

            cur.execute("SHOW COLUMNS FROM tools LIKE 'step_id'")
            if not cur.fetchone():
                cur.execute("ALTER TABLE tools ADD COLUMN step_id INT NULL")

            cur.execute("SHOW INDEX FROM tools WHERE Key_name = 'idx_tools_step_id'")
            if not cur.fetchone():
                cur.execute("ALTER TABLE tools ADD INDEX idx_tools_step_id (step_id)")

            cur.execute(
                """
                INSERT INTO progress_categories (
                    category_key, display_name, workflow_key, description, is_active, created_at, updated_at
                )
                SELECT DISTINCT
                    LOWER(TRIM(COALESCE(t.test_category, 'general'))) AS category_key,
                    LOWER(TRIM(COALESCE(t.test_category, 'general'))) AS display_name,
                    LOWER(TRIM(COALESCE(t.workflow_key, 'scan'))) AS workflow_key,
                    '' AS description,
                    1 AS is_active,
                    %s AS created_at,
                    %s AS updated_at
                FROM tools t
                LEFT JOIN progress_categories pc
                    ON pc.category_key = LOWER(TRIM(COALESCE(t.test_category, 'general')))
                WHERE pc.id IS NULL
                """,
                (now_iso, now_iso),
            )

            cur.execute(
                """
                INSERT INTO steps (
                    step_key, display_name, workflow_key, category_id,
                    description, is_active, created_at, updated_at
                )
                SELECT DISTINCT
                    LOWER(CONCAT(
                        TRIM(COALESCE(t.workflow_key, 'scan')),
                        '_',
                        TRIM(COALESCE(t.test_category, 'general')),
                        '_',
                        TRIM(COALESCE(t.test_step, 'custom_step'))
                    )) AS step_key,
                    TRIM(COALESCE(t.test_step, 'custom_step')) AS display_name,
                    LOWER(TRIM(COALESCE(t.workflow_key, 'scan'))) AS workflow_key,
                    pc.id AS category_id,
                    '' AS description,
                    1 AS is_active,
                    %s AS created_at,
                    %s AS updated_at
                FROM tools t
                JOIN progress_categories pc
                    ON pc.category_key = LOWER(TRIM(COALESCE(t.test_category, 'general')))
                LEFT JOIN steps s
                    ON s.step_key = LOWER(CONCAT(
                        TRIM(COALESCE(t.workflow_key, 'scan')),
                        '_',
                        TRIM(COALESCE(t.test_category, 'general')),
                        '_',
                        TRIM(COALESCE(t.test_step, 'custom_step'))
                    ))
                WHERE s.id IS NULL
                  AND t.step_id IS NULL
                """,
                (now_iso, now_iso),
            )

            cur.execute(
                """
                UPDATE tools t
                JOIN steps s
                    ON s.step_key = LOWER(CONCAT(
                        TRIM(COALESCE(t.workflow_key, 'scan')),
                        '_',
                        TRIM(COALESCE(t.test_category, 'general')),
                        '_',
                        TRIM(COALESCE(t.test_step, 'custom_step'))
                    ))
                SET t.step_id = s.id
                WHERE t.step_id IS NULL
                """
            )

            cur.execute(
                """
                SELECT CONSTRAINT_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'tools'
                  AND COLUMN_NAME = 'step_id'
                  AND REFERENCED_TABLE_NAME = 'steps'
                LIMIT 1
                """
            )
            step_fk = cur.fetchone()
            if not step_fk:
                cur.execute(
                    """
                    ALTER TABLE tools
                    ADD CONSTRAINT fk_tools_step
                    FOREIGN KEY (step_id) REFERENCES steps(id)
                    ON DELETE SET NULL
                    """
                )

            cur.execute("SHOW COLUMNS FROM tool_scripts LIKE 'file_path'")
            if not cur.fetchone():
                cur.execute("ALTER TABLE tool_scripts ADD COLUMN file_path VARCHAR(400) NOT NULL DEFAULT ''")

            cur.execute("SHOW COLUMNS FROM step_item_parameters LIKE 'description'")
            if not cur.fetchone():
                cur.execute("ALTER TABLE step_item_parameters ADD COLUMN description TEXT NULL")

            cur.execute("SHOW COLUMNS FROM step_item_parameters LIKE 'options_json'")
            if not cur.fetchone():
                cur.execute("ALTER TABLE step_item_parameters ADD COLUMN options_json LONGTEXT NULL")

            cur.execute(
                """
                UPDATE step_item_parameters
                SET description = ''
                WHERE description IS NULL
                """
            )
            cur.execute(
                """
                UPDATE step_item_parameters
                SET options_json = '[]'
                WHERE options_json IS NULL OR TRIM(options_json) = ''
                """
            )

            cur.execute("SHOW INDEX FROM tools WHERE Key_name = 'idx_tools_workflow'")
            if not cur.fetchone():
                cur.execute("ALTER TABLE tools ADD INDEX idx_tools_workflow (workflow_key)")

            cur.execute("SHOW COLUMNS FROM validation_actions LIKE 'step_key'")
            if not cur.fetchone():
                cur.execute("ALTER TABLE validation_actions ADD COLUMN step_key VARCHAR(32) NOT NULL DEFAULT 'scan'")

            cur.execute("SHOW COLUMNS FROM validation_actions LIKE 'step_name'")
            if not cur.fetchone():
                cur.execute("ALTER TABLE validation_actions ADD COLUMN step_name VARCHAR(140) NOT NULL DEFAULT 'Tarama'")

            cur.execute("SHOW INDEX FROM validation_actions WHERE Key_name = 'idx_validation_actions_step_key'")
            if not cur.fetchone():
                cur.execute("ALTER TABLE validation_actions ADD INDEX idx_validation_actions_step_key (step_key)")

            cur.execute(
                """
                SELECT CONSTRAINT_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'validation_actions'
                  AND REFERENCED_TABLE_NAME = 'workflow_steps'
                LIMIT 1
                """
            )
            fk_row = cur.fetchone()
            if fk_row and fk_row.get("CONSTRAINT_NAME"):
                cur.execute(f"ALTER TABLE validation_actions DROP FOREIGN KEY {fk_row['CONSTRAINT_NAME']}")

            cur.execute("DROP TABLE IF EXISTS workflow_steps")
            # Command/task subsystem was removed. Keep related tables dropped.
            cur.execute("DROP TABLE IF EXISTS tool_parameters")
            cur.execute("DROP TABLE IF EXISTS tool_scripts")
            cur.execute("DROP TABLE IF EXISTS tool_execution_audit")
            cur.execute("DROP TABLE IF EXISTS tool_registry")
            cur.execute("DROP TABLE IF EXISTS tool_runs")
            cur.execute("DROP TABLE IF EXISTS tools")
        conn.commit()
