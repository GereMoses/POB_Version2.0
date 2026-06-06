"""
Extend iclock_terminal table for BioTime 9.5 compatibility and POB emergency features
Migration script for Device module enhancement
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.database import DATABASE_URL
import logging

logger = logging.getLogger(__name__)

def extend_iclock_terminal():
    """Extend iclock_terminal table with BioTime 9.5 compatible fields"""
    
    # Create engine and session
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    db = Session()
    
    try:
        # Extend iclock_terminal table
        migration_sql = """
        -- Extend iclock_terminal for BioTime + POB
        ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS device_name varchar(50);
        ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS device_model varchar(50);
        ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS fw_version varchar(20);
        ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS user_count int DEFAULT 0;
        ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS fp_count int DEFAULT 0;
        ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS face_count int DEFAULT 0;
        ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS palm_count int DEFAULT 0;
        ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS log_count int DEFAULT 0;
        ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS device_type smallint DEFAULT 0; -- 0=Attendance,1=Access,2=Mustering,3=Emergency
        ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS zone_id int REFERENCES mustering_zone(id);
        ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS is_auto_reg boolean DEFAULT false;
        
        -- Add indexes for performance
        CREATE INDEX IF NOT EXISTS idx_iclock_terminal_sn ON iclock_terminal(sn);
        CREATE INDEX IF NOT EXISTS idx_iclock_terminal_device_type ON iclock_terminal(device_type);
        CREATE INDEX IF NOT EXISTS idx_iclock_terminal_zone_id ON iclock_terminal(zone_id);
        CREATE INDEX IF NOT EXISTS idx_iclock_terminal_last_activity ON iclock_terminal(last_activity);
        CREATE INDEX IF NOT EXISTS idx_iclock_terminal_state ON iclock_terminal(state);
        """
        
        logger.info("Extending iclock_terminal table...")
        db.execute(text(migration_sql))
        db.commit()
        logger.info("✅ iclock_terminal table extended successfully")
        
    except Exception as e:
        logger.error(f"Error extending iclock_terminal: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def create_iclock_devcmd_table():
    """Create iclock_devcmd table for command queue management"""
    
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    db = Session()
    
    try:
        # Create iclock_devcmd table
        create_table_sql = """
        -- Command queue - BioTime uses this
        CREATE TABLE IF NOT EXISTS iclock_devcmd (
            id bigserial PRIMARY KEY,
            sn varchar(20) NOT NULL,
            cmd_content text NOT NULL, -- REBOOT, DATA UPDATE USERINFO...
            cmd_commit_time timestamp DEFAULT now(),
            cmd_trans_time timestamp,
            cmd_return_time timestamp,
            cmd_return varchar(1024), -- Device response
            status smallint DEFAULT 0 -- 0=pending,1=sent,2=success,3=fail
        );
        
        -- Add indexes for command queue performance
        CREATE INDEX IF NOT EXISTS idx_iclock_devcmd_sn ON iclock_devcmd(sn);
        CREATE INDEX IF NOT EXISTS idx_iclock_devcmd_status ON iclock_devcmd(status);
        CREATE INDEX IF NOT EXISTS idx_iclock_devcmd_sn_status ON iclock_devcmd(sn, status);
        CREATE INDEX IF NOT EXISTS idx_iclock_devcmd_commit_time ON iclock_devcmd(cmd_commit_time);
        CREATE INDEX IF NOT EXISTS idx_iclock_devcmd_trans_time ON iclock_devcmd(cmd_trans_time);
        """
        
        logger.info("Creating iclock_devcmd table...")
        db.execute(text(create_table_sql))
        db.commit()
        logger.info("✅ iclock_devcmd table created successfully")
        
    except Exception as e:
        logger.error(f"Error creating iclock_devcmd table: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def create_emergency_device_table():
    """Create emergency_device table for siren/strobe/lock devices"""
    
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    db = Session()
    
    try:
        # Create emergency_device table
        create_table_sql = """
        -- Emergency device details
        CREATE TABLE IF NOT EXISTS emergency_device (
            id serial PRIMARY KEY,
            terminal_sn varchar(20) NOT NULL,
            device_type smallint NOT NULL, -- 1=Siren,2=Strobe,3=Lock,4=Speaker
            zone_id int REFERENCES mustering_zone(id),
            status smallint DEFAULT 0, -- 0=off,1=on
            last_heartbeat timestamp,
            created_at timestamp DEFAULT now(),
            updated_at timestamp DEFAULT now(),
            UNIQUE(terminal_sn)
        );
        
        -- Add indexes for emergency device performance
        CREATE INDEX IF NOT EXISTS idx_emergency_device_sn ON emergency_device(terminal_sn);
        CREATE INDEX IF NOT EXISTS idx_emergency_device_type ON emergency_device(device_type);
        CREATE INDEX IF NOT EXISTS idx_emergency_device_zone_id ON emergency_device(zone_id);
        CREATE INDEX IF NOT EXISTS idx_emergency_device_status ON emergency_device(status);
        CREATE INDEX IF NOT EXISTS idx_emergency_device_heartbeat ON emergency_device(last_heartbeat);
        """
        
        logger.info("Creating emergency_device table...")
        db.execute(text(create_table_sql))
        db.commit()
        logger.info("✅ emergency_device table created successfully")
        
    except Exception as e:
        logger.error(f"Error creating emergency_device table: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def create_device_types_enum():
    """Create device types enum for reference"""
    
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    db = Session()
    
    try:
        # Create device types reference table
        create_enum_sql = """
        -- Device types reference
        CREATE TABLE IF NOT EXISTS device_types (
            id smallint PRIMARY KEY,
            name varchar(50) NOT NULL,
            description text,
            is_emergency boolean DEFAULT false,
            created_at timestamp DEFAULT now()
        );
        
        -- Insert default device types
        INSERT INTO device_types (id, name, description, is_emergency) VALUES
        (0, 'Attendance', 'Standard attendance tracking device', false),
        (1, 'Access Control', 'Access control terminal', false),
        (2, 'Mustering', 'Mustering station device', false),
        (3, 'Emergency', 'Emergency device (siren/strobe/lock)', true)
        ON CONFLICT (id) DO NOTHING;
        
        -- Emergency device sub-types
        CREATE TABLE IF NOT EXISTS emergency_device_types (
            id smallint PRIMARY KEY,
            name varchar(50) NOT NULL,
            description text,
            created_at timestamp DEFAULT now()
        );
        
        INSERT INTO emergency_device_types (id, name, description) VALUES
        (1, 'Siren', 'Emergency siren/alarm device'),
        (2, 'Strobe', 'Emergency strobe light device'),
        (3, 'Lock', 'Emergency door lock device'),
        (4, 'Speaker', 'Emergency announcement speaker')
        ON CONFLICT (id) DO NOTHING;
        """
        
        logger.info("Creating device types reference tables...")
        db.execute(text(create_enum_sql))
        db.commit()
        logger.info("✅ Device types reference tables created successfully")
        
    except Exception as e:
        logger.error(f"Error creating device types: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def verify_iclock_tables_exist():
    """Verify that required iclock tables exist"""
    
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    db = Session()
    
    try:
        # Check if iclock tables exist
        check_sql = """
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('iclock_terminal', 'iclock_transaction')
        """
        
        result = db.execute(text(check_sql)).fetchall()
        existing_tables = [row[0] for row in result]
        
        required_tables = ['iclock_terminal', 'iclock_transaction']
        missing_tables = [table for table in required_tables if table not in existing_tables]
        
        if missing_tables:
            logger.error(f"Missing required iclock tables: {missing_tables}")
            logger.error("Please ensure BioTime database schema is properly initialized")
            return False
        
        logger.info(f"✅ Required iclock tables exist: {existing_tables}")
        return True
        
    except Exception as e:
        logger.error(f"Error verifying iclock tables: {e}")
        return False
    finally:
        db.close()

def run_migration():
    """Run the complete migration for Device module"""
    
    logger.info("🚀 Starting Device module database migration...")
    
    # Step 1: Verify base tables exist
    if not verify_iclock_tables_exist():
        raise Exception("Required iclock tables not found. Please run BioTime schema setup first.")
    
    # Step 2: Extend iclock_terminal
    extend_iclock_terminal()
    
    # Step 3: Create iclock_devcmd table
    create_iclock_devcmd_table()
    
    # Step 4: Create emergency_device table
    create_emergency_device_table()
    
    # Step 5: Create device types reference
    create_device_types_enum()
    
    logger.info("🎉 Device module database migration completed successfully!")
    logger.info("✅ Tables extended/created:")
    logger.info("   - iclock_terminal (extended)")
    logger.info("   - iclock_devcmd (created)")
    logger.info("   - emergency_device (created)")
    logger.info("   - device_types (created)")
    logger.info("   - emergency_device_types (created)")

if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    try:
        run_migration()
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)
