"""
Migration: Create all missing tables for POB v2.0
Handles zones, devices, personnel, pob_status, and zone assignments.
Run inside container: python run_migration.py
"""
import os
import sys
sys.path.insert(0, '/app')

from sqlalchemy import create_engine, text, inspect
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://pob_user:pob_password@postgres:5432/pob_system")
engine = create_engine(DATABASE_URL)


def table_exists(conn, table_name):
    result = conn.execute(text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name=:t)"
    ), {"t": table_name})
    return result.scalar()


def column_exists(conn, table_name, column_name):
    result = conn.execute(text(
        "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name=:t AND column_name=:c)"
    ), {"t": table_name, "c": column_name})
    return result.scalar()


MIGRATIONS = [
    # ── 1. users (needed by personnel + zone_personnel_assignments) ──────────
    ("users", """
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            full_name VARCHAR(200),
            hashed_password VARCHAR(255) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
            is_verified BOOLEAN NOT NULL DEFAULT FALSE,
            phone VARCHAR(20),
            avatar VARCHAR(500),
            last_login TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """),

    # ── 2. departments ───────────────────────────────────────────────────────
    ("departments", """
        CREATE TABLE IF NOT EXISTS departments (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            code VARCHAR(20) UNIQUE NOT NULL,
            description TEXT,
            parent_id INTEGER REFERENCES departments(id),
            manager_id INTEGER,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """),

    # ── 3. roles ─────────────────────────────────────────────────────────────
    ("roles", """
        CREATE TABLE IF NOT EXISTS roles (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            code VARCHAR(50) UNIQUE NOT NULL,
            description TEXT,
            level INTEGER DEFAULT 1,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """),

    # ── 4. zones ─────────────────────────────────────────────────────────────
    ("zones", """
        CREATE TABLE IF NOT EXISTS zones (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            code VARCHAR(20) UNIQUE NOT NULL,
            zone_type VARCHAR(30) NOT NULL DEFAULT 'WORK_AREA',
            description TEXT,
            status VARCHAR(20) DEFAULT 'active',
            state VARCHAR(100),
            address TEXT,
            latitude VARCHAR(20),
            longitude VARCHAR(20),
            max_capacity INTEGER,
            current_occupancy INTEGER DEFAULT 0,
            current_personnel_count INTEGER DEFAULT 0,
            hazard_level VARCHAR(20) DEFAULT 'LOW',
            safety_level VARCHAR(20) DEFAULT 'NORMAL',
            access_level VARCHAR(20) DEFAULT 'RESTRICTED',
            device_count INTEGER DEFAULT 0,
            zone_manager_id INTEGER,
            contact_person VARCHAR(255),
            contact_phone VARCHAR(20),
            zkteco_sync_enabled BOOLEAN DEFAULT TRUE,
            last_sync_at TIMESTAMP WITH TIME ZONE,
            -- Floor plan support (file upload + URL)
            floor_plan_url VARCHAR(500),
            floor_plan_file_path VARCHAR(500),
            floor_plan_filename VARCHAR(255),
            floor_plan_uploaded_at TIMESTAMP WITH TIME ZONE,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """),

    # ── 5. devices ────────────────────────────────────────────────────────────
    ("devices", """
        CREATE TABLE IF NOT EXISTS devices (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            serial_number VARCHAR(50) UNIQUE NOT NULL,
            device_type VARCHAR(50) DEFAULT 'FINGERPRINT',
            model VARCHAR(100),
            firmware_version VARCHAR(50),
            ip_address VARCHAR(45),
            port INTEGER DEFAULT 4370,
            location VARCHAR(255),
            zone_id INTEGER REFERENCES zones(id),
            status VARCHAR(20) DEFAULT 'OFFLINE',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            last_heartbeat TIMESTAMP WITH TIME ZONE,
            last_sync TIMESTAMP WITH TIME ZONE,
            connection_mode VARCHAR(20) DEFAULT 'ADMS',
            adms_url VARCHAR(500),
            user_count INTEGER DEFAULT 0,
            fp_count INTEGER DEFAULT 0,
            face_count INTEGER DEFAULT 0,
            log_count INTEGER DEFAULT 0,
            manufacturer VARCHAR(100) DEFAULT 'ZKTeco',
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """),

    # ── 6. personnel ─────────────────────────────────────────────────────────
    ("personnel", """
        CREATE TABLE IF NOT EXISTS personnel (
            id SERIAL PRIMARY KEY,
            emp_code VARCHAR(20) UNIQUE NOT NULL,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            full_name VARCHAR(200),
            email VARCHAR(255),
            phone VARCHAR(20),
            user_id INTEGER REFERENCES users(id),
            department_id INTEGER REFERENCES departments(id),
            position VARCHAR(100),
            primary_role_id INTEGER REFERENCES roles(id),
            current_zone_id INTEGER REFERENCES zones(id),
            status VARCHAR(20) DEFAULT 'ONSHORE',
            employment_type VARCHAR(30) DEFAULT 'EMPLOYEE',
            hire_date DATE,
            photo_url VARCHAR(500),
            nationality VARCHAR(100),
            id_number VARCHAR(50),
            passport_number VARCHAR(50),
            emergency_contact_name VARCHAR(200),
            emergency_contact_phone VARCHAR(20),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            is_pob BOOLEAN NOT NULL DEFAULT FALSE,
            pob_location VARCHAR(100),
            pob_since TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """),

    # ── 7. pob_status ────────────────────────────────────────────────────────
    ("pob_status", """
        CREATE TABLE IF NOT EXISTS pob_status (
            id SERIAL PRIMARY KEY,
            personnel_id INTEGER REFERENCES personnel(id),
            personnel_count INTEGER NOT NULL DEFAULT 0,
            status VARCHAR(20) NOT NULL DEFAULT 'ONSHORE',
            location VARCHAR(100),
            last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            notes TEXT
        );
    """),

    # ── 8. zone_personnel_assignments ────────────────────────────────────────
    ("zone_personnel_assignments", """
        CREATE TABLE IF NOT EXISTS zone_personnel_assignments (
            id SERIAL PRIMARY KEY,
            zone_id INTEGER NOT NULL REFERENCES zones(id),
            personnel_id INTEGER NOT NULL REFERENCES personnel(id),
            role VARCHAR(100),
            access_level VARCHAR(20) DEFAULT 'STANDARD',
            is_primary_zone BOOLEAN DEFAULT FALSE,
            assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            unassigned_at TIMESTAMP WITH TIME ZONE,
            is_permanent BOOLEAN DEFAULT FALSE,
            access_times JSONB,
            device_access JSONB,
            safety_briefing_completed BOOLEAN DEFAULT FALSE,
            safety_briefing_date TIMESTAMP WITH TIME ZONE,
            certifications_verified BOOLEAN DEFAULT FALSE,
            status VARCHAR(20) DEFAULT 'ACTIVE',
            approved_by INTEGER REFERENCES users(id),
            approved_at TIMESTAMP WITH TIME ZONE,
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """),

    # ── 9. zone_reader_assignments ───────────────────────────────────────────
    ("zone_reader_assignments", """
        CREATE TABLE IF NOT EXISTS zone_reader_assignments (
            id SERIAL PRIMARY KEY,
            zone_id INTEGER NOT NULL REFERENCES zones(id),
            reader_id INTEGER NOT NULL REFERENCES devices(id),
            assignment_type VARCHAR(50) DEFAULT 'PERMANENT',
            status VARCHAR(20) DEFAULT 'active',
            is_primary BOOLEAN DEFAULT FALSE,
            assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            unassigned_at TIMESTAMP WITH TIME ZONE,
            expires_at TIMESTAMP WITH TIME ZONE,
            access_level VARCHAR(20) DEFAULT 'STANDARD',
            access_schedule JSONB,
            reader_config JSONB,
            last_heartbeat TIMESTAMP WITH TIME ZONE,
            last_activity TIMESTAMP WITH TIME ZONE,
            error_count INTEGER DEFAULT 0,
            notes TEXT,
            assigned_by VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """),

    # ── 10. zone_personnel_tracking (real-time, per clock-in event) ──────────
    ("zone_personnel_tracking", """
        CREATE TABLE IF NOT EXISTS zone_personnel_tracking (
            id SERIAL PRIMARY KEY,
            zone_id INTEGER NOT NULL REFERENCES zones(id),
            personnel_id INTEGER REFERENCES personnel(id),
            emp_code VARCHAR(20) NOT NULL,
            device_sn VARCHAR(50) NOT NULL,
            event_type VARCHAR(20) DEFAULT 'CLOCK_IN',  -- CLOCK_IN, CLOCK_OUT
            punch_time TIMESTAMP WITH TIME ZONE NOT NULL,
            previous_zone_id INTEGER REFERENCES zones(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_zpt_zone_id ON zone_personnel_tracking(zone_id);
        CREATE INDEX IF NOT EXISTS idx_zpt_emp_code ON zone_personnel_tracking(emp_code);
        CREATE INDEX IF NOT EXISTS idx_zpt_punch_time ON zone_personnel_tracking(punch_time);
    """),
]

# Columns to add if tables exist but are missing new columns
COLUMN_ADDITIONS = [
    # Add floor plan columns to zones if already created without them
    ("zones", "floor_plan_url", "ALTER TABLE zones ADD COLUMN IF NOT EXISTS floor_plan_url VARCHAR(500);"),
    ("zones", "floor_plan_file_path", "ALTER TABLE zones ADD COLUMN IF NOT EXISTS floor_plan_file_path VARCHAR(500);"),
    ("zones", "floor_plan_filename", "ALTER TABLE zones ADD COLUMN IF NOT EXISTS floor_plan_filename VARCHAR(255);"),
    ("zones", "floor_plan_uploaded_at", "ALTER TABLE zones ADD COLUMN IF NOT EXISTS floor_plan_uploaded_at TIMESTAMP WITH TIME ZONE;"),
]


def run():
    with engine.connect() as conn:
        for table_name, sql in MIGRATIONS:
            if not table_exists(conn, table_name):
                logger.info(f"Creating table: {table_name}")
                for stmt in sql.strip().split(';'):
                    stmt = stmt.strip()
                    if stmt:
                        conn.execute(text(stmt))
                conn.commit()
                logger.info(f"  ✅ {table_name} created")
            else:
                logger.info(f"  ⏭  {table_name} already exists")

        for table_name, col_name, sql in COLUMN_ADDITIONS:
            if table_exists(conn, table_name) and not column_exists(conn, table_name, col_name):
                logger.info(f"Adding column {col_name} to {table_name}")
                conn.execute(text(sql))
                conn.commit()
                logger.info(f"  ✅ column added")

    logger.info("Migration complete.")


if __name__ == "__main__":
    run()
