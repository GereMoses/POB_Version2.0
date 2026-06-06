"""
Create Access Control Tables Migration
BioTime 9.5 Compatible Access Control with POB Extensions
"""

from sqlalchemy import create_engine, text
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

# Get database URL from environment or use default
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://pob_user:pob_password@localhost:5432/pob_system")

def create_access_control_tables():
    """Create all Access Control tables for BioTime 9.5 compatibility"""
    
    engine = create_engine(DATABASE_URL)
    
    # SQL statements for creating Access Control tables
    sql_statements = [
        # Time Zone Table
        """
        CREATE TABLE IF NOT EXISTS acc_timezone (
            id SERIAL PRIMARY KEY,
            timezone_name VARCHAR(50) NOT NULL UNIQUE,
            sun_time1 VARCHAR(11),
            sun_time2 VARCHAR(11),
            sun_time3 VARCHAR(11),
            mon_time1 VARCHAR(11),
            mon_time2 VARCHAR(11),
            mon_time3 VARCHAR(11),
            tue_time1 VARCHAR(11),
            tue_time2 VARCHAR(11),
            tue_time3 VARCHAR(11),
            wed_time1 VARCHAR(11),
            wed_time2 VARCHAR(11),
            wed_time3 VARCHAR(11),
            thu_time1 VARCHAR(11),
            thu_time2 VARCHAR(11),
            thu_time3 VARCHAR(11),
            fri_time1 VARCHAR(11),
            fri_time2 VARCHAR(11),
            fri_time3 VARCHAR(11),
            sat_time1 VARCHAR(11),
            sat_time2 VARCHAR(11),
            sat_time3 VARCHAR(11),
            hol1_time1 VARCHAR(11),
            hol1_time2 VARCHAR(11),
            hol1_time3 VARCHAR(11),
            hol2_time1 VARCHAR(11),
            hol2_time2 VARCHAR(11),
            hol2_time3 VARCHAR(11),
            hol3_time1 VARCHAR(11),
            hol3_time2 VARCHAR(11),
            hol3_time3 VARCHAR(11),
            emergency_override BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        
        # Access Level Table
        """
        CREATE TABLE IF NOT EXISTS acc_level (
            id SERIAL PRIMARY KEY,
            level_name VARCHAR(50) NOT NULL UNIQUE,
            description TEXT,
            mustering_only BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        
        # Access Level Door M2M Table
        """
        CREATE TABLE IF NOT EXISTS acc_level_door (
            id SERIAL PRIMARY KEY,
            level_id INTEGER NOT NULL REFERENCES acc_level(id) ON DELETE CASCADE,
            door_id INTEGER NOT NULL REFERENCES acc_door(id) ON DELETE CASCADE,
            timezone_id INTEGER NOT NULL REFERENCES acc_timezone(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(level_id, door_id, timezone_id)
        );
        """,
        
        # Access Control Door Table
        """
        CREATE TABLE IF NOT EXISTS acc_door (
            id SERIAL PRIMARY KEY,
            terminal_sn VARCHAR(20) NOT NULL UNIQUE REFERENCES iclock_terminal(sn),
            door_name VARCHAR(50) NOT NULL,
            relay_time INTEGER DEFAULT 5,
            door_sensor_type SMALLINT DEFAULT 0,
            alarm_delay INTEGER DEFAULT 30,
            open_duration INTEGER DEFAULT 15,
            anti_passback SMALLINT DEFAULT 0,
            first_card_open BOOLEAN DEFAULT FALSE,
            interlock_group INTEGER DEFAULT 0,
            emergency_action SMALLINT DEFAULT 0,
            mustering_mode BOOLEAN DEFAULT FALSE,
            fire_linkage BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        
        # Access Control User Authorization Table (if not exists)
        """
        CREATE TABLE IF NOT EXISTS acc_userauthorize (
            emp_id INTEGER NOT NULL REFERENCES personnel_employee(id) ON DELETE CASCADE,
            level_id INTEGER NOT NULL REFERENCES acc_level(id) ON DELETE CASCADE,
            start_time TIME,
            end_time TIME,
            valid_days VARCHAR(20),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            PRIMARY KEY (emp_id, level_id)
        );
        """,
        
        # Access Control Events Table
        """
        CREATE TABLE IF NOT EXISTS acc_event (
            id BIGSERIAL PRIMARY KEY,
            event_time TIMESTAMP WITH TIME ZONE NOT NULL,
            terminal_sn VARCHAR(20) NOT NULL,
            door_id INTEGER REFERENCES acc_door(id),
            emp_code VARCHAR(20),
            emp_name VARCHAR(50),
            event_type SMALLINT NOT NULL,
            verify_type SMALLINT,
            in_out SMALLINT,
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        
        # Interlock Group Table
        """
        CREATE TABLE IF NOT EXISTS acc_interlock_group (
            id SERIAL PRIMARY KEY,
            group_name VARCHAR(50) NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        
        # Interlock Door M2M Table
        """
        CREATE TABLE IF NOT EXISTS acc_interlock_door (
            id SERIAL PRIMARY KEY,
            group_id INTEGER NOT NULL REFERENCES acc_interlock_group(id) ON DELETE CASCADE,
            door_id INTEGER NOT NULL REFERENCES acc_door(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(group_id, door_id)
        );
        """,
        
        # Linkage Table
        """
        CREATE TABLE IF NOT EXISTS acc_linkage (
            id SERIAL PRIMARY KEY,
            terminal_sn VARCHAR(20) NOT NULL,
            input_type SMALLINT,
            output_action SMALLINT,
            output_door_id INTEGER REFERENCES acc_door(id),
            output_terminal_sn VARCHAR(20),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        
        # Anti-passback Tracking Table
        """
        CREATE TABLE IF NOT EXISTS acc_antipassback (
            id BIGSERIAL PRIMARY KEY,
            emp_code VARCHAR(20) NOT NULL,
            door_id INTEGER NOT NULL REFERENCES acc_door(id) ON DELETE CASCADE,
            last_event_time TIMESTAMP WITH TIME ZONE NOT NULL,
            last_event_type SMALLINT NOT NULL,
            last_terminal_sn VARCHAR(20) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        
        # First Card Open Tracking Table
        """
        CREATE TABLE IF NOT EXISTS acc_first_card (
            id BIGSERIAL PRIMARY KEY,
            door_id INTEGER NOT NULL REFERENCES acc_door(id) ON DELETE CASCADE,
            timezone_id INTEGER NOT NULL REFERENCES acc_timezone(id) ON DELETE CASCADE,
            first_card_time TIMESTAMP WITH TIME ZONE NOT NULL,
            emp_code VARCHAR(20) NOT NULL,
            zone_end_time TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """
    ]
    
    # Create indexes for performance
    index_statements = [
        "CREATE INDEX IF NOT EXISTS idx_acc_event_event_time ON acc_event(event_time);",
        "CREATE INDEX IF NOT EXISTS idx_acc_event_terminal_sn ON acc_event(terminal_sn);",
        "CREATE INDEX IF NOT EXISTS idx_acc_event_emp_code ON acc_event(emp_code);",
        "CREATE INDEX IF NOT EXISTS idx_acc_event_door_id ON acc_event(door_id);",
        "CREATE INDEX IF NOT EXISTS idx_acc_event_event_type ON acc_event(event_type);",
        "CREATE INDEX IF NOT EXISTS idx_acc_door_terminal_sn ON acc_door(terminal_sn);",
        "CREATE INDEX IF NOT EXISTS idx_acc_antipassback_emp_code ON acc_antipassback(emp_code);",
        "CREATE INDEX IF NOT EXISTS idx_acc_antipassback_door_id ON acc_antipassback(door_id);",
        "CREATE INDEX IF NOT EXISTS idx_acc_userauthorize_emp_id ON acc_userauthorize(emp_id);",
        "CREATE INDEX IF NOT EXISTS idx_acc_userauthorize_level_id ON acc_userauthorize(level_id);"
    ]
    
    try:
        with engine.connect() as connection:
            # Create tables
            for sql in sql_statements:
                connection.execute(text(sql))
                print(f"✅ Created table: {sql.split()[2] if len(sql.split()) > 2 else 'Unknown'}")
            
            # Create indexes
            for sql in index_statements:
                connection.execute(text(sql))
                print(f"✅ Created index: {sql.split()[3] if len(sql.split()) > 3 else 'Unknown'}")
            
            connection.commit()
            print("\n🎉 All Access Control tables created successfully!")
            
    except Exception as e:
        print(f"❌ Error creating Access Control tables: {e}")
        raise

def insert_default_data():
    """Insert default Access Control data"""
    
    engine = create_engine(DATABASE_URL)
    
    default_data = [
        # Default Time Zone (24/7 Access)
        """
        INSERT INTO acc_timezone (timezone_name, mon_time1, tue_time1, wed_time1, thu_time1, fri_time1, sat_time1, sun_time1) 
        VALUES ('24/7 Access', '00:00-23:59', '00:00-23:59', '00:00-23:59', '00:00-23:59', '00:00-23:59', '00:00-23:59', '00:00-23:59')
        ON CONFLICT (timezone_name) DO NOTHING;
        """,
        
        # Business Hours Time Zone
        """
        INSERT INTO acc_timezone (timezone_name, mon_time1, tue_time1, wed_time1, thu_time1, fri_time1) 
        VALUES ('Business Hours', '09:00-17:00', '09:00-17:00', '09:00-17:00', '09:00-17:00', '09:00-17:00')
        ON CONFLICT (timezone_name) DO NOTHING;
        """,
        
        # Default Access Level
        """
        INSERT INTO acc_level (level_name, description) 
        VALUES ('Default Level', 'Default access level for all personnel')
        ON CONFLICT (level_name) DO NOTHING;
        """,
        
        # Staff Access Level
        """
        INSERT INTO acc_level (level_name, description) 
        VALUES ('Staff', 'Standard staff access level')
        ON CONFLICT (level_name) DO NOTHING;
        """,
        
        # Admin Access Level
        """
        INSERT INTO acc_level (level_name, description) 
        VALUES ('Admin', 'Administrator access level')
        ON CONFLICT (level_name) DO NOTHING;
        """
    ]
    
    try:
        with engine.connect() as connection:
            for sql in default_data:
                connection.execute(text(sql))
            
            connection.commit()
            print("✅ Default Access Control data inserted successfully!")
            
    except Exception as e:
        print(f"❌ Error inserting default data: {e}")
        raise

if __name__ == "__main__":
    print("🚀 Creating Access Control tables for BioTime 9.5 compatibility...")
    create_access_control_tables()
    print("\n📊 Inserting default data...")
    insert_default_data()
    print("\n🎯 Access Control database setup completed!")
