#!/usr/bin/env python3
"""
Add Missing BioTime Tables
This script adds the missing BioTime standard tables to the database
"""

import sys
from sqlalchemy import create_engine, text

# Database connection
DATABASE_URL = "postgresql://pob_user:pob_password@postgres:5432/pob_system"

def add_missing_tables():
    """Add missing BioTime tables"""
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            print("📋 Adding missing BioTime tables...")
            
            # Fingerprint templates table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS fingerprint (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES personnel_employee(id) ON DELETE CASCADE,
                    finger_index INTEGER NOT NULL CHECK (finger_index >= 0 AND finger_index <= 9),
                    template_data BYTEA NOT NULL,
                    template_version INTEGER DEFAULT 1,
                    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
                    template_size INTEGER,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    UNIQUE(user_id, finger_index)
                )
            """))
            print("✅ Created fingerprint table")
            
            # Face recognition templates table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS face (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES personnel_employee(id) ON DELETE CASCADE,
                    template_data BYTEA NOT NULL,
                    template_version INTEGER DEFAULT 1,
                    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
                    template_size INTEGER,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    UNIQUE(user_id)
                )
            """))
            print("✅ Created face table")
            
            # Device mapping table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS devicemap (
                    id SERIAL PRIMARY KEY,
                    device_sn VARCHAR(20) UNIQUE NOT NULL,
                    ip_address VARCHAR(15),
                    port INTEGER DEFAULT 4370,
                    comm_key VARCHAR(20) DEFAULT '0',
                    device_type SMALLINT DEFAULT 0,
                    area_id INTEGER REFERENCES personnel_area(id),
                    last_sync TIMESTAMP WITH TIME ZONE,
                    sync_status SMALLINT DEFAULT 0,
                    status SMALLINT DEFAULT 0,
                    firmware_version VARCHAR(20),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            print("✅ Created devicemap table")
            
            # Holiday calendar table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS holiday (
                    id SERIAL PRIMARY KEY,
                    holiday_name VARCHAR(100) NOT NULL,
                    holiday_date DATE NOT NULL,
                    end_date DATE,
                    is_repeatable BOOLEAN DEFAULT FALSE,
                    repeat_month INTEGER,
                    repeat_day INTEGER,
                    holiday_type SMALLINT DEFAULT 0,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    UNIQUE(holiday_date, holiday_name)
                )
            """))
            print("✅ Created holiday table")
            
            # Overtime rules table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS overtime_rule (
                    id SERIAL PRIMARY KEY,
                    rule_name VARCHAR(100) NOT NULL,
                    rule_type SMALLINT NOT NULL,
                    min_minutes INTEGER NOT NULL,
                    rate FLOAT NOT NULL DEFAULT 1.0,
                    max_hours_per_day FLOAT,
                    max_hours_per_week FLOAT,
                    area_id INTEGER REFERENCES personnel_area(id),
                    department_id INTEGER REFERENCES personnel_department(id),
                    is_active BOOLEAN DEFAULT TRUE,
                    effective_date DATE NOT NULL,
                    expiry_date DATE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            print("✅ Created overtime_rule table")
            
            # Overtime records table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS overtime_record (
                    id BIGSERIAL PRIMARY KEY,
                    emp_code VARCHAR(20) NOT NULL REFERENCES personnel_employee(emp_code),
                    overtime_date DATE NOT NULL,
                    overtime_rule_id INTEGER REFERENCES overtime_rule(id),
                    start_time TIME,
                    end_time TIME,
                    total_minutes INTEGER NOT NULL,
                    rate FLOAT NOT NULL,
                    overtime_amount FLOAT,
                    approved_by INTEGER REFERENCES auth_user(id),
                    approved_time TIMESTAMP WITH TIME ZONE,
                    status SMALLINT DEFAULT 0,
                    notes TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            print("✅ Created overtime_record table")
            
            # Check-in/out raw records table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS checkinout (
                    id BIGSERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES personnel_employee(id),
                    emp_code VARCHAR(20) NOT NULL,
                    check_time TIMESTAMP WITH TIME ZONE NOT NULL,
                    check_type SMALLINT NOT NULL,
                    verify_type SMALLINT,
                    sensor_id VARCHAR(20),
                    terminal_sn VARCHAR(20) REFERENCES iclock_terminal(sn),
                    work_code INTEGER,
                    processed BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            print("✅ Created checkinout table")
            
            # Serial number management table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS sn (
                    id SERIAL PRIMARY KEY,
                    sn VARCHAR(20) UNIQUE NOT NULL,
                    device_type VARCHAR(50),
                    model VARCHAR(50),
                    firmware VARCHAR(20),
                    purchase_date DATE,
                    warranty_expiry DATE,
                    status SMALLINT DEFAULT 0,
                    location VARCHAR(100),
                    notes TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            print("✅ Created sn table")
            
            # Access control group table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS acgroup (
                    id SERIAL PRIMARY KEY,
                    group_name VARCHAR(50) NOT NULL,
                    description TEXT,
                    parent_id INTEGER REFERENCES acgroup(id),
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            print("✅ Created acgroup table")
            
            # Self-service records table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS ssr (
                    id BIGSERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES personnel_employee(id),
                    ssr_type SMALLINT NOT NULL,
                    request_date DATE NOT NULL,
                    start_time TIME,
                    end_time TIME,
                    reason TEXT,
                    status SMALLINT DEFAULT 0,
                    approved_by INTEGER REFERENCES auth_user(id),
                    approved_time TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            print("✅ Created ssr table")
            
            # Create indexes
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fingerprint_user_id ON fingerprint(user_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_face_user_id ON face(user_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_devicemap_sn ON devicemap(device_sn)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_holiday_date ON holiday(holiday_date)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_overtime_rule_type ON overtime_rule(rule_type)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_overtime_record_emp_code ON overtime_record(emp_code)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_overtime_record_date ON overtime_record(overtime_date)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_checkinout_emp_code ON checkinout(emp_code)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_checkinout_time ON checkinout(check_time)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_ssr_user_id ON ssr(user_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_ssr_status ON ssr(status)"))
            print("✅ Created indexes")
            
            trans.commit()
            print("✅ Missing BioTime tables added successfully!")
            
        except Exception as e:
            trans.rollback()
            print(f"❌ Failed to add tables: {e}")
            sys.exit(1)

if __name__ == "__main__":
    add_missing_tables()
