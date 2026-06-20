"""Add security columns: totp_mfa on auth_user, personnel_documents table.

Revision ID: 0002_security_columns
Revises: cd3f44af38f9
Create Date: 2026-06-09
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_security_columns"
down_revision = "0001_complete_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── MFA columns on auth_user ──────────────────────────────────────────────
    op.execute("""
        ALTER TABLE auth_user
            ADD COLUMN IF NOT EXISTS totp_secret  TEXT,
            ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE
    """)

    # ── personnel_documents — permanent table (was created dynamically before) ─
    op.execute("""
        CREATE TABLE IF NOT EXISTS personnel_documents (
            id            SERIAL PRIMARY KEY,
            personnel_id  INTEGER NOT NULL,
            filename      TEXT    NOT NULL,
            original_name TEXT    NOT NULL,
            file_size     BIGINT,
            content_type  TEXT,
            category      TEXT    DEFAULT 'other',
            title         TEXT,
            expiry_date   DATE,
            notes         TEXT,
            uploaded_by   INTEGER,
            created_at    TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_pdoc_personnel_id
            ON personnel_documents(personnel_id)
    """)

    # ── Ensure base_operationlog has the columns the audit trail writes to ─────
    op.execute("""
        ALTER TABLE base_operationlog
            ADD COLUMN IF NOT EXISTS ip_addr   TEXT,
            ADD COLUMN IF NOT EXISTS remark    TEXT
    """)

    # ── Drill max duration (auto-end safety net) ──────────────────────────────
    op.execute("""
        ALTER TABLE mustering_event
            ADD COLUMN IF NOT EXISTS max_duration_minutes INTEGER NOT NULL DEFAULT 0
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE auth_user DROP COLUMN IF EXISTS totp_secret")
    op.execute("ALTER TABLE auth_user DROP COLUMN IF EXISTS totp_enabled")
    op.execute("DROP TABLE IF EXISTS personnel_documents")
    op.execute("ALTER TABLE base_operationlog DROP COLUMN IF EXISTS ip_addr")
    op.execute("ALTER TABLE base_operationlog DROP COLUMN IF EXISTS remark")
