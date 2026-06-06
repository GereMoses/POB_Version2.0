"""complete_schema_baseline

Revision ID: 0001_complete_schema
Revises:
Create Date: 2026-06-06

Complete POB database schema — 232 tables.
This is the single authoritative migration.  On a fresh server:

    alembic upgrade head

Generates the entire database from scratch.  No other scripts are needed.
All CREATE statements use IF NOT EXISTS so the migration is safe to re-run.
"""
from typing import Sequence, Union
from pathlib import Path

from alembic import op
from sqlalchemy import text

revision: str = "0001_complete_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# DDL lives in schema_ddl.sql in the same directory — keeps this file readable
# and lets the SQL be reviewed / diffed independently.
_DDL_FILE = Path(__file__).parent / "schema_ddl.sql"


def upgrade() -> None:
    conn = op.get_bind()
    raw_sql = _DDL_FILE.read_text()

    # Split on statement boundaries and execute each one individually so a
    # single failure is isolated and the exact failing statement is visible.
    import re
    statements = re.split(r';\s*\n', raw_sql)
    for stmt in statements:
        stmt = stmt.strip()
        if not stmt or stmt.startswith("--"):
            continue
        conn.execute(text(stmt))


def downgrade() -> None:
    # Drop all user tables in one shot using CASCADE.
    # alembic_version is preserved so Alembic can track state after downgrade.
    op.execute(text("""
        DO $$ DECLARE r RECORD; BEGIN
            FOR r IN (
                SELECT tablename FROM pg_tables
                WHERE schemaname = 'public'
                  AND tablename <> 'alembic_version'
            ) LOOP
                EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
            END LOOP;
        END $$;
    """))
