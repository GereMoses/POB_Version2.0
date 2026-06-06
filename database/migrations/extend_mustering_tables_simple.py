"""
Extend Mustering Tables for POB v2.0
Simple SQL-based migration
"""

import psycopg2
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

def get_connection():
    """Get database connection"""
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'pob_production'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', 'postgres')
    )

def extend_mustering_tables():
    """Extend existing mustering tables with complete schema"""
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Extend mustering_zone table
        print("Extending mustering_zone table...")
        cursor.execute("""
            ALTER TABLE mustering_zone 
            ADD COLUMN IF NOT EXISTS capacity INTEGER,
            ADD COLUMN IF NOT EXISTS evac_point VARCHAR(100),
            ADD COLUMN IF NOT EXISTS evac_gps VARCHAR(50),
            ADD COLUMN IF NOT EXISTS zone_type SMALLINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES personnel_area(id),
            ADD COLUMN IF NOT EXISTS primary_reader_sn VARCHAR(20) REFERENCES iclock_terminal(sn),
            ADD COLUMN IF NOT EXISTS secondary_reader_sn VARCHAR(20) REFERENCES iclock_terminal(sn);
        """)
        
        # Extend mustering_event table
        print("Extending mustering_event table...")
        cursor.execute("""
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
        """)
        
        # Extend mustering_log table
        print("Extending mustering_log table...")
        cursor.execute("""
            ALTER TABLE mustering_log 
            ADD COLUMN IF NOT EXISTS emp_name VARCHAR(50),
            ADD COLUMN IF NOT EXISTS dept_name VARCHAR(50),
            ADD COLUMN IF NOT EXISTS device_alias VARCHAR(50),
            ADD COLUMN IF NOT EXISTS status SMALLINT DEFAULT 1,
            ADD COLUMN IF NOT EXISTS gps VARCHAR(50),
            ADD COLUMN IF NOT EXISTS photo VARCHAR(255);
        """)
        
        # Add unique constraint for mustering_log
        try:
            cursor.execute("""
                ALTER TABLE mustering_log 
                ADD CONSTRAINT unique_event_emp UNIQUE(event_id, emp_code);
            """)
        except psycopg2.Error as e:
            if "already exists" not in str(e):
                print(f"Note: Could not add unique constraint: {e}")
        
        # Create additional mustering tables
        
        # mustering_drill_schedule table
        print("Creating mustering_drill_schedule table...")
        cursor.execute("""
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
        """)
        
        # mustering_template table
        print("Creating mustering_template table...")
        cursor.execute("""
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
        """)
        
        # mustering_expected table
        print("Creating mustering_expected table...")
        cursor.execute("""
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
        """)
        
        # Create indexes for performance
        print("Creating indexes...")
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_mustering_log_event_status ON mustering_log(event_id, status);
            CREATE INDEX IF NOT EXISTS idx_mustering_event_status_start ON mustering_event(status, start_time);
            CREATE INDEX IF NOT EXISTS idx_mustering_expected_event ON mustering_expected(event_id);
            CREATE INDEX IF NOT EXISTS idx_mustering_drill_schedule_time ON mustering_drill_schedule(scheduled_time);
        """)
        
        # Update existing zone_type enum values
        print("Updating zone_type values...")
        cursor.execute("""
            UPDATE mustering_zone 
            SET zone_type = 0 
            WHERE zone_type IS NULL;
        """)
        
        # Create sample data for testing
        print("Creating sample mustering zone...")
        cursor.execute("""
            INSERT INTO mustering_zone (name, capacity, evac_point, evac_gps, zone_type, area_id)
            VALUES ('Muster A', 200, 'Main Assembly Point - North Side', '6.5244,3.3792', 0, 1)
            ON CONFLICT DO NOTHING;
        """)
        
        conn.commit()
        print("✅ Mustering tables extended successfully!")
        
    except Exception as e:
        print(f"❌ Error extending mustering tables: {e}")
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    extend_mustering_tables()
