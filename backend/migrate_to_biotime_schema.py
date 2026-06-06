#!/usr/bin/env python3
"""
BioTime 9.5 Schema Migration Script
Migrates existing POB system to BioTime 9.5 compatible schema
Preserves all existing data while adding new BioTime-standard tables
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from sqlalchemy import create_engine, text, MetaData, Table, Column, Integer, String, DateTime, Date, Boolean, SmallInteger, ForeignKey, BigInteger, Text, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone
import uuid

# Database connection
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://pob_user:pob_password@localhost:5432/pob_system")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def migrate_to_biotime_schema():
    """Migrate database to BioTime 9.5 schema"""
    print("🚀 Starting BioTime 9.5 schema migration...")
    
    with engine.connect() as conn:
        # Start transaction
        trans = conn.begin()
        
        try:
            # 1. Create BioTime standard tables
            create_biotime_tables(conn)
            
            # 2. Migrate existing data to new tables
            migrate_existing_data(conn)
            
            # 3. Create new extension tables
            create_extension_tables(conn)
            
            # 4. Add indexes and constraints
            create_indexes_constraints(conn)
            
            # Commit transaction
            trans.commit()
            print("✅ BioTime 9.5 schema migration completed successfully")
            
        except Exception as e:
            # Rollback on error
            trans.rollback()
            print(f"❌ Migration failed: {e}")
            raise

def create_biotime_tables(conn):
    """Create BioTime 9.5 standard tables"""
    print("📋 Creating BioTime standard tables...")
    
    # Personnel Department table (BioTime standard) - Create first (no dependencies)
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS personnel_department (
            id SERIAL PRIMARY KEY,
            dept_code VARCHAR(20),
            dept_name VARCHAR(50) NOT NULL,
            parent_id INTEGER REFERENCES personnel_department(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    # Personnel Area table (BioTime standard) - Create second (no dependencies)
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS personnel_area (
            id SERIAL PRIMARY KEY,
            area_code VARCHAR(20),
            area_name VARCHAR(50) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    # Personnel Employee table (BioTime standard) - Create third (references dept and area)
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS personnel_employee (
            id SERIAL PRIMARY KEY,
            emp_code VARCHAR(20) UNIQUE NOT NULL,
            first_name VARCHAR(20),
            last_name VARCHAR(25) NOT NULL,
            dept_id INTEGER REFERENCES personnel_department(id),
            area_id INTEGER REFERENCES personnel_area(id),
            position_id INTEGER,
            hire_date DATE,
            birthday DATE,
            sex CHAR(1),
            photo VARCHAR(255),
            card_no VARCHAR(20),
            pwd VARCHAR(20),
            status SMALLINT DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    # iClock Terminal table (BioTime standard)
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS iclock_terminal (
            id SERIAL PRIMARY KEY,
            sn VARCHAR(20) UNIQUE NOT NULL,
            alias VARCHAR(50),
            ip_address VARCHAR(15),
            area_id INTEGER REFERENCES personnel_area(id),
            last_activity TIMESTAMP WITH TIME ZONE,
            state SMALLINT DEFAULT 0,
            comm_key VARCHAR(20),
            fw_ver VARCHAR(20),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    # Auth User (BioTime standard) - Create before tables that reference it
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS auth_user (
            id SERIAL PRIMARY KEY,
            username VARCHAR(150) UNIQUE NOT NULL,
            password VARCHAR(128) NOT NULL,
            email VARCHAR(100),
            first_name VARCHAR(50),
            last_name VARCHAR(50),
            is_superuser BOOLEAN DEFAULT FALSE,
            is_active BOOLEAN DEFAULT TRUE,
            last_login TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    # Auth Role (BioTime standard)
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS auth_role (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) UNIQUE NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    # Auth Permission (BioTime standard)
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS auth_permission (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) UNIQUE NOT NULL,
            codename VARCHAR(50) UNIQUE NOT NULL,
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    # Attendance Timetable (BioTime standard)
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS att_timetable (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            late_grace_minutes INTEGER DEFAULT 0,
            early_exit_minutes INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    # Attendance Shift (BioTime standard)
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS att_shift (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) NOT NULL,
            timetable_id INTEGER REFERENCES att_timetable(id),
            days_of_week VARCHAR(20), -- comma-separated days: 1,2,3,4,5
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    # Access Control Level (BioTime standard)
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS acc_level (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) NOT NULL,
            description TEXT,
            time_zone VARCHAR(50) DEFAULT 'UTC',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    # iClock Transaction table (BioTime standard) - References iclock_terminal
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS iclock_transaction (
            id BIGSERIAL PRIMARY KEY,
            emp_code VARCHAR(20) NOT NULL,
            punch_time TIMESTAMP WITH TIME ZONE NOT NULL,
            punch_state SMALLINT,
            verify_type SMALLINT,
            work_code INTEGER,
            terminal_sn VARCHAR(20) REFERENCES iclock_terminal(sn),
            area_alias VARCHAR(50),
            upload_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    # Attendance Schedule (BioTime standard) - References att_shift
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS att_schedule (
            id SERIAL PRIMARY KEY,
            emp_code VARCHAR(20) NOT NULL,
            shift_id INTEGER REFERENCES att_shift(id),
            start_date DATE NOT NULL,
            end_date DATE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    # Attendance Leave (BioTime standard)
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS att_leave (
            id SERIAL PRIMARY KEY,
            emp_code VARCHAR(20) NOT NULL,
            leave_type VARCHAR(20) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            days_count FLOAT DEFAULT 0,
            status SMALLINT DEFAULT 0, -- 0=pending,1=approved,2=rejected
            approved_by VARCHAR(20),
            approved_time TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    # Access User Authorization (BioTime standard) - References acc_level
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS acc_userauthorize (
            id SERIAL PRIMARY KEY,
            emp_code VARCHAR(20) NOT NULL,
            acc_level_id INTEGER REFERENCES acc_level(id),
            start_time TIME,
            end_time TIME,
            valid_days VARCHAR(20), -- comma-separated days
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    # Access Door (BioTime standard) - References iclock_terminal and acc_level
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS acc_door (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) NOT NULL,
            terminal_sn VARCHAR(20) REFERENCES iclock_terminal(sn),
            acc_level_id INTEGER REFERENCES acc_level(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    # Base Operation Log (BioTime standard) - References auth_user
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS base_operationlog (
            id BIGSERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES auth_user(id),
            action VARCHAR(50) NOT NULL,
            table_name VARCHAR(50),
            record_id INTEGER,
            old_values TEXT,
            new_values TEXT,
            ip_address VARCHAR(45),
            user_agent TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    print("✅ BioTime standard tables created")

def create_extension_tables(conn):
    """Create extension tables for Mustering, Emergency, Onboarding"""
    print("🔧 Creating extension tables...")
    
    # Mustering Zone table - Create first (no dependencies)
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS mustering_zone (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) NOT NULL,
            capacity INTEGER,
            evac_point VARCHAR(100),
            zone_type SMALLINT DEFAULT 0, -- 0=normal,1=emergency,2=safe
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    # Mustering Event table - References mustering_zone and auth_user
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS mustering_event (
            id BIGSERIAL PRIMARY KEY,
            zone_id INTEGER REFERENCES mustering_zone(id) NOT NULL,
            event_type SMALLINT NOT NULL, -- 0=drill,1=emergency,2=lockdown
            start_time TIMESTAMP WITH TIME ZONE NOT NULL,
            end_time TIMESTAMP WITH TIME ZONE,
            status SMALLINT DEFAULT 0, -- 0=active,1=completed,2=cancelled
            initiated_by INTEGER REFERENCES auth_user(id),
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    # Mustering Log table - References mustering_event and iclock_terminal
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS mustering_log (
            id BIGSERIAL PRIMARY KEY,
            event_id BIGINT REFERENCES mustering_event(id) NOT NULL,
            emp_code VARCHAR(20) NOT NULL,
            check_time TIMESTAMP WITH TIME ZONE NOT NULL,
            device_sn VARCHAR(20) REFERENCES iclock_terminal(sn),
            status SMALLINT DEFAULT 0, -- 0=missing,1=safe,2=injured
            location VARCHAR(100),
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    # Onboarding Task table - References personnel_employee and auth_user
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS onboarding_task (
            id SERIAL PRIMARY KEY,
            emp_id INTEGER REFERENCES personnel_employee(id) NOT NULL,
            task_name VARCHAR(100) NOT NULL,
            doc_path VARCHAR(255),
            status SMALLINT DEFAULT 0, -- 0=pending,1=in_progress,2=completed,3=rejected
            due_date DATE,
            approved_by INTEGER REFERENCES auth_user(id),
            approved_time TIMESTAMP WITH TIME ZONE,
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    # Emergency Device table - References iclock_terminal and mustering_zone
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS emergency_device (
            id SERIAL PRIMARY KEY,
            terminal_sn VARCHAR(20) REFERENCES iclock_terminal(sn),
            device_type SMALLINT DEFAULT 0, -- 0=reader,1=siren,2=strobe,3=alarm
            zone_id INTEGER REFERENCES mustering_zone(id),
            status SMALLINT DEFAULT 0, -- 0=inactive,1=active,2=error
            last_heartbeat TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    
    print("✅ Extension tables created")

def migrate_existing_data(conn):
    """Migrate existing data to new BioTime tables"""
    print("📦 Migrating existing data...")
    
    # Check if old personnel table exists and migrate
    try:
        result = conn.execute(text("""
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_name = 'personnel'
        """))
        if result.fetchone()[0] > 0:
            # Migrate personnel data to personnel_employee
            conn.execute(text("""
                INSERT INTO personnel_employee (emp_code, first_name, last_name, dept_id, hire_date, birthday, sex, photo, status)
                SELECT 
                    COALESCE(id::text, 'EMP' || id::text) as emp_code,
                    SUBSTRING(full_name FROM 1 FOR POSITION(' ' IN full_name) - 1) as first_name,
                    SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1) as last_name,
                    department_id as dept_id,
                    hire_date,
                    date_of_birth as birthday,
                    gender as sex,
                    photo_url as photo,
                    CASE WHEN is_active THEN 0 ELSE 1 END as status
                FROM personnel
                WHERE id IS NOT NULL
                ON CONFLICT (emp_code) DO NOTHING
            """))
            print("✅ Personnel data migrated")
    except Exception as e:
        print(f"⚠️ Personnel migration skipped: {e}")
    
    # Migrate departments
    try:
        result = conn.execute(text("""
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_name = 'departments'
        """))
        if result.fetchone()[0] > 0:
            conn.execute(text("""
                INSERT INTO personnel_department (dept_code, dept_name)
                SELECT 
                    COALESCE(code, 'DEPT' || id::text) as dept_code,
                    name as dept_name
                FROM departments
                ON CONFLICT (dept_code) DO NOTHING
            """))
            print("✅ Department data migrated")
    except Exception as e:
        print(f"⚠️ Department migration skipped: {e}")
    
    # Migrate devices to iclock_terminal
    try:
        result = conn.execute(text("""
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_name = 'devices'
        """))
        if result.fetchone()[0] > 0:
            conn.execute(text("""
                INSERT INTO iclock_terminal (sn, alias, ip_address, state, comm_key)
                SELECT 
                    COALESCE(serial_number, 'DEV' || id::text) as sn,
                    name as alias,
                    ip_address,
                    CASE WHEN is_active THEN 1 ELSE 0 END as state,
                    COALESCE(communication_key, '0') as comm_key
                FROM devices
                ON CONFLICT (sn) DO NOTHING
            """))
            print("✅ Device data migrated")
    except Exception as e:
        print(f"⚠️ Device migration skipped: {e}")

def create_indexes_constraints(conn):
    """Create indexes and constraints for performance"""
    print("🔍 Creating indexes and constraints...")
    
    # Personnel indexes
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_personnel_emp_code ON personnel_employee(emp_code)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_personnel_dept_id ON personnel_employee(dept_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_personnel_status ON personnel_employee(status)"))
    
    # Transaction indexes
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_transaction_emp_code ON iclock_transaction(emp_code)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_transaction_punch_time ON iclock_transaction(punch_time)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_transaction_terminal_sn ON iclock_transaction(terminal_sn)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_transaction_upload_time ON iclock_transaction(upload_time)"))
    
    # Terminal indexes
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_terminal_sn ON iclock_terminal(sn)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_terminal_ip ON iclock_terminal(ip_address)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_terminal_state ON iclock_terminal(state)"))
    
    # Mustering indexes
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_mustering_event_zone ON mustering_event(zone_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_mustering_event_status ON mustering_event(status)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_mustering_log_event ON mustering_log(event_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_mustering_log_emp ON mustering_log(emp_code)"))
    
    # Auth indexes
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_auth_user_username ON auth_user(username)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_auth_user_active ON auth_user(is_active)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_operation_log_user ON base_operationlog(user_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_operation_log_action ON base_operationlog(action)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_operation_log_created ON base_operationlog(created_at)"))
    
    print("✅ Indexes and constraints created")

def create_default_admin():
    """Create default admin user if none exists"""
    print("👤 Creating default admin user...")
    
    with engine.connect() as conn:
        trans = conn.begin()
        
        try:
            # Check if admin exists
            result = conn.execute(text("SELECT COUNT(*) FROM auth_user WHERE username = 'admin'"))
            if result.fetchone()[0] == 0:
                # Create admin user (password: admin123 - should be changed on first login)
                import bcrypt
                password_hash = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                
                conn.execute(text("""
                    INSERT INTO auth_user (username, password, email, first_name, last_name, is_superuser, is_active)
                    VALUES ('admin', :password, 'admin@pob-system.com', 'System', 'Administrator', TRUE, TRUE)
                """), {"password": password_hash})
                
                print("✅ Default admin user created (username: admin, password: admin123)")
            else:
                print("ℹ️ Admin user already exists")
                
            trans.commit()
            
        except Exception as e:
            trans.rollback()
            print(f"❌ Failed to create admin user: {e}")

if __name__ == "__main__":
    try:
        migrate_to_biotime_schema()
        create_default_admin()
        print("\n🎉 BioTime 9.5 migration completed successfully!")
        print("📝 Next steps:")
        print("   1. Update backend models to use new tables")
        print("   2. Update API endpoints to match BioTime patterns")
        print("   3. Update frontend to use new API structure")
        print("   4. Test all functionality")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        sys.exit(1)
