"""
Simple Device Database Migration Script
Extends iclock_terminal for BioTime 9.5 compatibility
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

def run_device_migration():
    """Run device database migration"""
    
    # Create engine
    engine = create_engine(settings.DATABASE_URL)
    Session = sessionmaker(bind=engine)
    db = Session()
    
    try:
        logger.info("🚀 Starting Device database migration...")
        
        # Extend iclock_terminal table
        logger.info("Extending iclock_terminal table...")
        db.execute(text("""
            -- Extend iclock_terminal for BioTime + POB
            ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS device_name varchar(50);
            ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS device_model varchar(50);
            ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS fw_version varchar(20);
            ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS user_count int DEFAULT 0;
            ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS fp_count int DEFAULT 0;
            ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS face_count int DEFAULT 0;
            ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS palm_count int DEFAULT 0;
            ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS log_count int DEFAULT 0;
            ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS device_type smallint DEFAULT 0;
            ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS zone_id int;
            ALTER TABLE iclock_terminal ADD COLUMN IF NOT EXISTS is_auto_reg boolean DEFAULT false;
        """))
        
        # Create iclock_devcmd table
        logger.info("Creating iclock_devcmd table...")
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS iclock_devcmd (
                id bigserial PRIMARY KEY,
                sn varchar(20) NOT NULL,
                cmd_content text NOT NULL,
                cmd_commit_time timestamp DEFAULT now(),
                cmd_trans_time timestamp,
                cmd_return_time timestamp,
                cmd_return varchar(1024),
                status smallint DEFAULT 0
            );
            
            CREATE INDEX IF NOT EXISTS idx_iclock_devcmd_sn ON iclock_devcmd(sn);
            CREATE INDEX IF NOT EXISTS idx_iclock_devcmd_status ON iclock_devcmd(status);
            CREATE INDEX IF NOT EXISTS idx_iclock_devcmd_sn_status ON iclock_devcmd(sn, status);
            CREATE INDEX IF NOT EXISTS idx_iclock_devcmd_commit_time ON iclock_devcmd(cmd_commit_time);
        """))
        
        # Create emergency_device table
        logger.info("Creating emergency_device table...")
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS emergency_device (
                id serial PRIMARY KEY,
                terminal_sn varchar(20) NOT NULL,
                device_type smallint NOT NULL,
                zone_id int,
                status smallint DEFAULT 0,
                last_heartbeat timestamp,
                created_at timestamp DEFAULT now(),
                updated_at timestamp DEFAULT now(),
                UNIQUE(terminal_sn)
            );
            
            CREATE INDEX IF NOT EXISTS idx_emergency_device_sn ON emergency_device(terminal_sn);
            CREATE INDEX IF NOT EXISTS idx_emergency_device_type ON emergency_device(device_type);
            CREATE INDEX IF NOT EXISTS idx_emergency_device_status ON emergency_device(status);
        """))
        
        # Create device types reference tables
        logger.info("Creating device types reference tables...")
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS device_types (
                id smallint PRIMARY KEY,
                name varchar(50) NOT NULL,
                description text,
                is_emergency boolean DEFAULT false,
                created_at timestamp DEFAULT now()
            );
            
            INSERT INTO device_types (id, name, description, is_emergency) VALUES
            (0, 'Attendance', 'Standard attendance tracking device', false),
            (1, 'Access Control', 'Access control terminal', false),
            (2, 'Mustering', 'Mustering station device', false),
            (3, 'Emergency', 'Emergency device (siren/strobe/lock)', true)
            ON CONFLICT (id) DO NOTHING;
            
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
        """))
        
        db.commit()
        
        logger.info("✅ Device database migration completed successfully!")
        logger.info("📊 Tables created/updated:")
        logger.info("   - iclock_terminal (extended)")
        logger.info("   - iclock_devcmd (created)")
        logger.info("   - emergency_device (created)")
        logger.info("   - device_types (created)")
        logger.info("   - emergency_device_types (created)")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    try:
        success = run_device_migration()
        if success:
            print("\n🎉 Device module is now ready for ZKTeco device integration!")
        else:
            print("\n❌ Migration failed. Check logs for details.")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ Migration error: {e}")
        sys.exit(1)
