"""
Migration: Create report module tables.

Creates:
  - rpt_template
  - rpt_schedule
  - rpt_export_log
  - rpt_user_preset
  - rpt_favorite
"""

import os
import sys
import logging

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", "backend", ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set in environment / .env")

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)


def run():
    engine = create_engine(DATABASE_URL)

    with engine.begin() as conn:
        log.info("Creating rpt_template …")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS rpt_template (
                id SERIAL PRIMARY KEY,
                template_name VARCHAR(100) NOT NULL,
                module VARCHAR(50) NOT NULL,
                report_code VARCHAR(100) NOT NULL,
                filters JSONB,
                columns JSONB,
                group_by VARCHAR(50),
                chart_type VARCHAR(20) DEFAULT 'none',
                is_system BOOLEAN DEFAULT FALSE,
                created_by INTEGER REFERENCES auth_user(id),
                is_public BOOLEAN DEFAULT FALSE,
                description TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rpt_template_module_code ON rpt_template (module, report_code)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rpt_template_created_by  ON rpt_template (created_by)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rpt_template_is_public   ON rpt_template (is_public)"))

        log.info("Creating rpt_schedule …")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS rpt_schedule (
                id SERIAL PRIMARY KEY,
                template_id INTEGER NOT NULL REFERENCES rpt_template(id) ON DELETE CASCADE,
                schedule_name VARCHAR(100) NOT NULL,
                cron VARCHAR(50) NOT NULL,
                format VARCHAR(10) DEFAULT 'pdf',
                recipients JSONB,
                last_run TIMESTAMP,
                next_run TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE,
                created_by INTEGER REFERENCES auth_user(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rpt_schedule_next_run ON rpt_schedule (next_run, is_active)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rpt_schedule_template ON rpt_schedule (template_id)"))

        log.info("Creating rpt_export_log …")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS rpt_export_log (
                id SERIAL PRIMARY KEY,
                template_id INTEGER REFERENCES rpt_template(id),
                user_id INTEGER REFERENCES auth_user(id),
                export_time TIMESTAMP DEFAULT NOW(),
                format VARCHAR(10),
                filters JSONB,
                row_count INTEGER,
                file_path VARCHAR(255),
                file_size INTEGER,
                ip_address VARCHAR(45),
                status VARCHAR(20) DEFAULT 'completed',
                error_message TEXT,
                task_id VARCHAR(100)
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rpt_export_log_export_time ON rpt_export_log (export_time)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rpt_export_log_user_id     ON rpt_export_log (user_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rpt_export_log_template_id ON rpt_export_log (template_id)"))

        log.info("Creating rpt_user_preset …")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS rpt_user_preset (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES auth_user(id),
                template_id INTEGER REFERENCES rpt_template(id),
                preset_name VARCHAR(100) NOT NULL,
                preset_type VARCHAR(20) NOT NULL,
                filters JSONB,
                columns JSONB,
                is_default BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rpt_user_preset_user_id     ON rpt_user_preset (user_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rpt_user_preset_template_id ON rpt_user_preset (template_id)"))

        log.info("Creating rpt_favorite …")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS rpt_favorite (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES auth_user(id),
                template_id INTEGER NOT NULL REFERENCES rpt_template(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE (user_id, template_id)
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rpt_favorite_user_id     ON rpt_favorite (user_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rpt_favorite_template_id ON rpt_favorite (template_id)"))

    log.info("Report tables created successfully.")


if __name__ == "__main__":
    run()
