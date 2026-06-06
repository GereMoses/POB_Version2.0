"""
Migration: ADMS BioTime Parity
Adds new columns to iclock_terminal and creates iclock_operlog + iclock_bio_template tables.
Run once: python migrate_adms_parity.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, text
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)

DDL_STEPS = [
    # ── iclock_terminal new columns ─────────────────────────────────────────
    ("ADD pushver",
     "ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS pushver VARCHAR(10) DEFAULT '1.0'"),
    ("ADD user_count",
     "ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS user_count INTEGER DEFAULT 0"),
    ("ADD fp_count",
     "ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS fp_count INTEGER DEFAULT 0"),
    ("ADD face_count",
     "ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS face_count INTEGER DEFAULT 0"),
    ("ADD palm_count",
     "ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS palm_count INTEGER DEFAULT 0"),
    ("ADD att_stamp",
     "ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS att_stamp BIGINT DEFAULT 0"),
    ("ADD op_stamp",
     "ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS op_stamp BIGINT DEFAULT 0"),
    ("ADD heartbeat_interval",
     "ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS heartbeat_interval INTEGER DEFAULT 30"),
    # Widen ip_address to support IPv6
    ("WIDEN ip_address",
     "ALTER TABLE iclock_terminal ALTER COLUMN ip_address TYPE VARCHAR(45)"),
    # state semantics change: 0=pending, 1=approved/online, 2=rejected, 3=offline
    # Existing online devices (state=1) remain approved; offline (state=0) become pending —
    # set all existing state=0 rows to 1 so legacy devices stay active
    ("Migrate existing state=0 to approved",
     "UPDATE iclock_terminal SET state = 1 WHERE state = 0"),

    # ── iclock_operlog ───────────────────────────────────────────────────────
    ("CREATE iclock_operlog", """
        CREATE TABLE IF NOT EXISTS iclock_operlog (
            id          BIGSERIAL PRIMARY KEY,
            terminal_sn VARCHAR(20) NOT NULL REFERENCES iclock_terminal(sn) ON DELETE CASCADE,
            oper_event  SMALLINT    NOT NULL,
            event_time  TIMESTAMPTZ NOT NULL,
            admin_id    VARCHAR(20),
            door_id     INTEGER,
            object_name VARCHAR(100),
            param1      VARCHAR(100),
            param2      VARCHAR(100),
            raw_data    TEXT,
            created_at  TIMESTAMPTZ DEFAULT NOW()
        )
    """),
    ("INDEX iclock_operlog terminal_sn",
     "CREATE INDEX IF NOT EXISTS ix_iclock_operlog_terminal_sn ON iclock_operlog(terminal_sn)"),
    ("INDEX iclock_operlog event_time",
     "CREATE INDEX IF NOT EXISTS ix_iclock_operlog_event_time  ON iclock_operlog(event_time)"),
    ("INDEX iclock_operlog oper_event",
     "CREATE INDEX IF NOT EXISTS ix_iclock_operlog_oper_event  ON iclock_operlog(oper_event)"),

    # ── iclock_bio_template ──────────────────────────────────────────────────
    ("CREATE iclock_bio_template", """
        CREATE TABLE IF NOT EXISTS iclock_bio_template (
            id             BIGSERIAL PRIMARY KEY,
            emp_code       VARCHAR(20)  NOT NULL,
            finger_id      SMALLINT     NOT NULL DEFAULT 0,
            template_size  INTEGER,
            valid          BOOLEAN      DEFAULT TRUE,
            template_data  TEXT,
            source_sn      VARCHAR(20)  REFERENCES iclock_terminal(sn) ON DELETE SET NULL,
            created_at     TIMESTAMPTZ  DEFAULT NOW(),
            updated_at     TIMESTAMPTZ  DEFAULT NOW()
        )
    """),
    ("UNIQUE iclock_bio_template emp+finger",
     "CREATE UNIQUE INDEX IF NOT EXISTS uq_bio_template_emp_finger ON iclock_bio_template(emp_code, finger_id)"),
    ("INDEX iclock_bio_template emp_code",
     "CREATE INDEX IF NOT EXISTS ix_iclock_bio_template_emp ON iclock_bio_template(emp_code)"),
]

def run():
    with engine.begin() as conn:
        for label, sql in DDL_STEPS:
            try:
                conn.execute(text(sql))
                print(f"  ✅  {label}")
            except Exception as e:
                print(f"  ⚠️  {label}: {e}")
    print("\nMigration complete.")

if __name__ == "__main__":
    run()
