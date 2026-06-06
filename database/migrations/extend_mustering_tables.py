"""
Extend Mustering Tables for POB v2.0
Complete mustering system implementation with all required fields
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import sys
import os

# Add backend path
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.core.database import get_database_url, Base
from app.models.biotime_models import (
    MusteringZone, MusteringEvent, MusteringLog, IClockTerminal, 
    PersonnelEmployee, AuthUser, Area
)

def extend_mustering_tables():
    """Extend existing mustering tables with complete schema"""
    
    engine = create_engine(get_database_url())
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Extend mustering_zone table
        print("Extending mustering_zone table...")
        db.execute(text("""
            ALTER TABLE mustering_zone 
            ADD COLUMN IF NOT EXISTS capacity INTEGER,
            ADD COLUMN IF NOT EXISTS evac_point VARCHAR(100),
            ADD COLUMN IF NOT EXISTS evac_gps VARCHAR(50),
            ADD COLUMN IF NOT EXISTS zone_type SMALLINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES personnel_area(id),
            ADD COLUMN IF NOT EXISTS primary_reader_sn VARCHAR(20) REFERENCES iclock_terminal(sn),
            ADD COLUMN IF NOT EXISTS secondary_reader_sn VARCHAR(20) REFERENCES iclock_terminal(sn);
        """))
        
        # Extend mustering_event table
        print("Extending mustering_event table...")
        db.execute(text("""
            ALTER TABLE mustering_event 
            ADD COLUMN IF NOT EXISTS status SMALLINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS initiated_by INTEGER REFERENCES auth_user(id),
            ADD COLUMN IF NOT EXISTS initiated_type SMALLINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS total_expected INTEGER,
            ADD COLUMN IF NOT EXISTS total_safe INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS total_missing INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS total_injured INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS notify_sms BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS notify_email BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS notify_whatsapp BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS notify_siren BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS notes TEXT;
        """))
        
        # Extend mustering_log table
        print("Extending mustering_log table...")
        db.execute(text("""
            ALTER TABLE mustering_log 
            ADD COLUMN IF NOT EXISTS emp_name VARCHAR(50),
            ADD COLUMN IF NOT EXISTS dept_name VARCHAR(50),
            ADD COLUMN IF NOT EXISTS device_alias VARCHAR(50),
            ADD COLUMN IF NOT EXISTS status SMALLINT DEFAULT 1,
            ADD COLUMN IF NOT EXISTS gps VARCHAR(50),
            ADD COLUMN IF NOT EXISTS photo VARCHAR(255),
            ADD CONSTRAINT IF NOT EXISTS unique_event_emp UNIQUE(event_id, emp_code);
        """))
        
        # Create additional mustering tables
        
        # mustering_drill_schedule table
        print("Creating mustering_drill_schedule table...")
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS mustering_drill_schedule (
                id SERIAL PRIMARY KEY,
                zone_id INTEGER NOT NULL REFERENCES mustering_zone(id),
                event_type SMALLINT NOT NULL,
                scheduled_time TIMESTAMP NOT NULL,
                participant_type SMALLINT DEFAULT 0,
                participant_id INTEGER,
                template_id INTEGER REFERENCES mustering_template(id),
                auto_start BOOLEAN DEFAULT TRUE,
                created_by INTEGER REFERENCES auth_user(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """))
        
        # mustering_template table
        print("Creating mustering_template table...")
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS mustering_template (
                id SERIAL PRIMARY KEY,
                template_name VARCHAR(100) NOT NULL,
                event_type SMALLINT,
                notify_sms BOOLEAN,
                notify_email BOOLEAN,
                notify_users TEXT,
                actions JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """))
        
        # mustering_expected table
        print("Creating mustering_expected table...")
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS mustering_expected (
                id BIGSERIAL PRIMARY KEY,
                event_id BIGINT NOT NULL REFERENCES mustering_event(id),
                emp_code VARCHAR(20) NOT NULL,
                emp_name VARCHAR(50),
                dept_id INTEGER,
                shift_id INTEGER,
                last_punch_time TIMESTAMP,
                last_punch_area VARCHAR(50),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """))
        
        # Create indexes for performance
        print("Creating indexes...")
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_mustering_log_event_status ON mustering_log(event_id, status);
            CREATE INDEX IF NOT EXISTS idx_mustering_event_status_start ON mustering_event(status, start_time);
            CREATE INDEX IF NOT EXISTS idx_mustering_expected_event ON mustering_expected(event_id);
            CREATE INDEX IF NOT EXISTS idx_mustering_drill_schedule_time ON mustering_drill_schedule(scheduled_time);
        """))
        
        # Update existing zone_type enum values
        print("Updating zone_type values...")
        db.execute(text("""
            UPDATE mustering_zone 
            SET zone_type = 0 
            WHERE zone_type IS NULL;
        """))
        
        # Update existing event_type values to match new enum
        print("Updating event_type values...")
        db.execute(text("""
            UPDATE mustering_event 
            SET event_type = CASE 
                WHEN event_type = 0 THEN 1  -- drill -> real
                WHEN event_type = 1 THEN 0  -- emergency -> drill
                WHEN event_type = 2 THEN 2  -- lockdown -> fire
                ELSE event_type
            END;
        """))
        
        db.commit()
        print("✅ Mustering tables extended successfully!")
        
        # Create sample data for testing
        print("Creating sample mustering zone...")
        sample_zone = MusteringZone(
            name="Muster A",
            capacity=200,
            evac_point="Main Assembly Point - North Side",
            evac_gps="6.5244,3.3792",
            zone_type=0,  # Assembly
            area_id=1  # Assuming area 1 exists
        )
        db.add(sample_zone)
        db.commit()
        
        print("✅ Sample mustering zone created!")
        
    except Exception as e:
        print(f"❌ Error extending mustering tables: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    extend_mustering_tables()
