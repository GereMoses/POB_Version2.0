"""
Database Migration: Create Emergency Management Tables
Creates comprehensive emergency system tables for POB v2.0
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

from sqlalchemy import create_engine, text
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_emergency_tables():
    """Create all emergency management tables"""
    
    # Database connection
    # Use environment variable or default to PostgreSQL
    database_url = os.getenv('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/pob_production')
    engine = create_engine(database_url)
    
    # SQL statements for creating emergency tables
    create_statements = [
        # Core emergency tables
        """
        CREATE TABLE IF NOT EXISTS emergency_event (
            id BIGSERIAL PRIMARY KEY,
            event_type SMALLINT NOT NULL,
            status SMALLINT DEFAULT 0,
            scope SMALLINT DEFAULT 0,
            zone_ids INTEGER[],
            door_ids INTEGER[],
            start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            end_time TIMESTAMP WITH TIME ZONE,
            initiated_by INTEGER REFERENCES auth_user(id),
            initiated_type SMALLINT DEFAULT 0,
            trigger_source VARCHAR(100),
            reason TEXT,
            actions JSONB,
            mustering_event_id BIGINT REFERENCES mustering_event(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        
        """
        CREATE INDEX IF NOT EXISTS idx_emergency_event_status_start_time ON emergency_event(status, start_time);
        """,
        
        """
        CREATE INDEX IF NOT EXISTS idx_emergency_event_event_type ON emergency_event(event_type);
        """,
        
        """
        CREATE TABLE IF NOT EXISTS emergency_device (
            id SERIAL PRIMARY KEY,
            terminal_sn VARCHAR(20) UNIQUE NOT NULL REFERENCES iclock_terminal(sn),
            device_type SMALLINT NOT NULL,
            zone_id INTEGER REFERENCES mustering_zone(id),
            status SMALLINT DEFAULT 0,
            last_heartbeat TIMESTAMP WITH TIME ZONE,
            test_schedule VARCHAR(50),
            location_description VARCHAR(200),
            installation_date DATE,
            maintenance_due DATE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        
        """
        CREATE INDEX IF NOT EXISTS idx_emergency_device_terminal_sn ON emergency_device(terminal_sn);
        """,
        
        """
        CREATE INDEX IF NOT EXISTS idx_emergency_device_status ON emergency_device(status);
        """,
        
        """
        CREATE TABLE IF NOT EXISTS emergency_template (
            id SERIAL PRIMARY KEY,
            template_name VARCHAR(100) NOT NULL,
            event_type SMALLINT NOT NULL,
            description TEXT,
            actions JSONB NOT NULL,
            notify_channels JSONB,
            auto_mustering BOOLEAN DEFAULT TRUE,
            auto_mustering_zone_id INTEGER REFERENCES mustering_zone(id),
            is_active BOOLEAN DEFAULT TRUE,
            is_default BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        
        """
        CREATE TABLE IF NOT EXISTS emergency_notification (
            id BIGSERIAL PRIMARY KEY,
            emergency_event_id BIGINT NOT NULL REFERENCES emergency_event(id),
            channel SMALLINT NOT NULL,
            recipient_type SMALLINT,
            recipient_id INTEGER,
            recipient_addr VARCHAR(255),
            message TEXT,
            status SMALLINT DEFAULT 0,
            sent_time TIMESTAMP WITH TIME ZONE,
            delivered_time TIMESTAMP WITH TIME ZONE,
            error_msg TEXT,
            template_vars JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        
        """
        CREATE INDEX IF NOT EXISTS idx_emergency_notification_event_id_status ON emergency_notification(emergency_event_id, status);
        """,
        
        """
        CREATE TABLE IF NOT EXISTS emergency_plan (
            id SERIAL PRIMARY KEY,
            plan_name VARCHAR(100) NOT NULL,
            event_type SMALLINT,
            zone_id INTEGER REFERENCES mustering_zone(id),
            steps TEXT,
            pdf_path VARCHAR(255),
            contacts JSONB,
            is_active BOOLEAN DEFAULT TRUE,
            last_reviewed DATE,
            next_review DATE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        
        """
        CREATE TABLE IF NOT EXISTS emergency_panic_log (
            id BIGSERIAL PRIMARY KEY,
            terminal_sn VARCHAR(20),
            panic_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            panic_type SMALLINT,
            emp_code VARCHAR(20),
            location VARCHAR(100),
            emergency_event_id BIGINT REFERENCES emergency_event(id),
            reason TEXT,
            resolved_by INTEGER REFERENCES auth_user(id),
            resolved_time TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        
        # Transport logistics tables
        """
        CREATE TABLE IF NOT EXISTS transport (
            id SERIAL PRIMARY KEY,
            type SMALLINT NOT NULL,
            identifier VARCHAR(50) NOT NULL UNIQUE,
            registration_number VARCHAR(50),
            operator VARCHAR(100),
            capacity INTEGER DEFAULT 12,
            current_pob INTEGER DEFAULT 0,
            status SMALLINT DEFAULT 0,
            base_location VARCHAR(100),
            current_location VARCHAR(100),
            fuel_capacity FLOAT,
            current_fuel FLOAT,
            flight_hours FLOAT DEFAULT 0,
            max_altitude INTEGER,
            max_speed FLOAT,
            cost_per_hour FLOAT,
            utilization_rate FLOAT,
            performance_rating FLOAT,
            is_available BOOLEAN DEFAULT TRUE,
            is_maintenance_mode BOOLEAN DEFAULT FALSE,
            is_inspection_due BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        
        """
        CREATE INDEX IF NOT EXISTS idx_transport_status ON transport(status);
        """,
        
        """
        CREATE INDEX IF NOT EXISTS idx_transport_type ON transport(type);
        """,
        
        """
        CREATE TABLE IF NOT EXISTS transport_maintenance (
            id SERIAL PRIMARY KEY,
            transport_id INTEGER NOT NULL REFERENCES transport(id),
            maintenance_type SMALLINT NOT NULL,
            description TEXT NOT NULL,
            scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
            completed_date TIMESTAMP WITH TIME ZONE,
            status VARCHAR(20) DEFAULT 'SCHEDULED',
            technician VARCHAR(100),
            cost FLOAT,
            parts_used JSONB,
            next_maintenance TIMESTAMP WITH TIME ZONE,
            maintenance_hours FLOAT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        
        """
        CREATE TABLE IF NOT EXISTS flight_log (
            id SERIAL PRIMARY KEY,
            transport_id INTEGER NOT NULL REFERENCES transport(id),
            flight_date TIMESTAMP WITH TIME ZONE NOT NULL,
            departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
            arrival_time TIMESTAMP WITH TIME ZONE,
            departure_location VARCHAR(100) NOT NULL,
            arrival_location VARCHAR(100) NOT NULL,
            flight_duration FLOAT NOT NULL,
            distance FLOAT NOT NULL,
            fuel_consumed FLOAT,
            weather_conditions VARCHAR(100),
            pilot_name VARCHAR(100),
            co_pilot_name VARCHAR(100),
            flight_route VARCHAR(200),
            passengers_count INTEGER DEFAULT 0,
            cargo_weight FLOAT,
            incidents TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        
        """
        CREATE INDEX IF NOT EXISTS idx_flight_log_transport_id ON flight_log(transport_id);
        """,
        
        """
        CREATE INDEX IF NOT EXISTS idx_flight_log_flight_date ON flight_log(flight_date);
        """,
        
        """
        CREATE TABLE IF NOT EXISTS transport_crew (
            id SERIAL PRIMARY KEY,
            transport_id INTEGER NOT NULL REFERENCES transport(id),
            personnel_id INTEGER NOT NULL REFERENCES personnel_employee(id),
            role VARCHAR(50) NOT NULL,
            start_date TIMESTAMP WITH TIME ZONE NOT NULL,
            end_date TIMESTAMP WITH TIME ZONE,
            status VARCHAR(20) DEFAULT 'ACTIVE',
            certification_number VARCHAR(50),
            certification_expiry DATE,
            medical_expiry DATE,
            experience_hours FLOAT,
            flight_hours FLOAT,
            last_flight_date TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        
        """
        CREATE TABLE IF NOT EXISTS transport_schedule (
            id SERIAL PRIMARY KEY,
            transport_id INTEGER NOT NULL REFERENCES transport(id),
            schedule_type VARCHAR(20) NOT NULL,
            departure_location VARCHAR(100) NOT NULL,
            arrival_location VARCHAR(100) NOT NULL,
            departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
            arrival_time TIMESTAMP WITH TIME ZONE,
            frequency VARCHAR(20),
            end_date TIMESTAMP WITH TIME ZONE,
            status VARCHAR(20) DEFAULT 'SCHEDULED',
            priority VARCHAR(20) DEFAULT 'NORMAL',
            passenger_manifest JSONB,
            cargo_manifest JSONB,
            estimated_cost FLOAT,
            actual_cost FLOAT,
            weather_requirements VARCHAR(100),
            special_requirements TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        
        """
        CREATE TABLE IF NOT EXISTS transport_inventory (
            id SERIAL PRIMARY KEY,
            transport_id INTEGER NOT NULL REFERENCES transport(id),
            item_name VARCHAR(100) NOT NULL,
            item_type VARCHAR(50) NOT NULL,
            item_description TEXT,
            quantity INTEGER DEFAULT 1,
            unit_of_measure VARCHAR(20) DEFAULT 'EACH',
            location_on_transport VARCHAR(50),
            expiry_date DATE,
            last_inspected TIMESTAMP WITH TIME ZONE,
            condition_status VARCHAR(20) DEFAULT 'GOOD',
            replacement_cost FLOAT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        
        """
        CREATE INDEX IF NOT EXISTS idx_transport_inventory_transport_id ON transport_inventory(transport_id);
        """,
        
        """
        CREATE INDEX IF NOT EXISTS idx_transport_inventory_expiry_date ON transport_inventory(expiry_date);
        """
    ]
    
    try:
        with engine.connect() as conn:
            # Execute all create statements
            for statement in create_statements:
                logger.info(f"Executing: {statement[:100]}...")
                conn.execute(text(statement))
            
            # Create updated_at trigger function
            trigger_function = """
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql';
            """
            
            conn.execute(text(trigger_function))
            logger.info("Created/updated updated_at trigger function")
            
            # Create triggers for tables with updated_at columns
            trigger_tables = [
                'emergency_event',
                'emergency_device', 
                'emergency_template',
                'emergency_notification',
                'emergency_plan',
                'transport',
                'transport_maintenance',
                'flight_log',
                'transport_crew',
                'transport_schedule',
                'transport_inventory'
            ]
            
            for table in trigger_tables:
                trigger_sql = f"""
                DROP TRIGGER IF EXISTS update_{table}_updated_at ON {table};
                CREATE TRIGGER update_{table}_updated_at 
                    BEFORE UPDATE ON {table} 
                    FOR EACH ROW 
                    EXECUTE FUNCTION update_updated_at_column();
                """
                conn.execute(text(trigger_sql))
                logger.info(f"Created updated_at trigger for {table}")
            
            conn.commit()
            logger.info("All emergency tables created successfully!")
            
    except Exception as e:
        logger.error(f"Error creating emergency tables: {str(e)}")
        raise

def insert_default_data():
    """Insert default emergency templates and data"""
    
    engine = create_engine(settings.DATABASE_URL)
    
    default_data = [
        # Default emergency templates
        """
        INSERT INTO emergency_template (template_name, event_type, description, actions, notify_channels, is_default) 
        VALUES 
        ('Global Lockdown', 0, 'Complete facility lockdown', 
         '[{"type": "lockdown", "doors": "all"}]',
         '{"sms": true, "email": true, "siren": true}',
         true),
        ('Fire Emergency', 1, 'Fire alarm and evacuation',
         '[{"type": "unlock_fire_exits"}, {"type": "lock_danger_zones"}, {"type": "siren_on"}, {"type": "start_mustering", "zone_id": 1}]',
         '{"sms": true, "email": true, "pa": true, "siren": true}',
         true),
        ('Gas Leak', 2, 'Gas leak response',
         '[{"type": "lockdown", "doors": "all"}, {"type": "siren_on"}, {"type": "start_mustering", "zone_id": 1}]',
         '{"sms": true, "email": true, "siren": true}',
         false),
        ('Intruder Alert', 3, 'Security intruder response',
         '[{"type": "lockdown", "doors": "all"}, {"type": "siren_on"}]',
         '{"sms": true, "email": true}',
         false),
        ('Medical Emergency', 4, 'Medical emergency response',
         '[{"type": "unlock_medical_areas"}]',
         '{"sms": true, "email": true}',
         false),
        ('All Clear', 5, 'All clear signal',
         '[{"type": "siren_off"}, {"type": "unlock_all"}, {"type": "end_mustering"}]',
         '{"sms": true, "email": true, "pa": true}',
         true)
        ON CONFLICT DO NOTHING;
        """,
        
        # Default emergency plan
        """
        INSERT INTO emergency_plan (plan_name, event_type, steps, contacts, is_active) 
        VALUES 
        ('General Emergency Response', 0, 
         '# Emergency Response Steps\n\n1. Assess the situation\n2. Initiate appropriate emergency protocol\n3. Notify emergency response team\n4. Evacuate if necessary\n5. Account for all personnel\n6. Report status to command center',
         '[{"name": "Fire Department", "phone": "999"}, {"name": "Medical Emergency", "phone": "998"}, {"name": "Security", "phone": "911"}]',
         true)
        ON CONFLICT DO NOTHING;
        """,
        
        # Sample transport data
        """
        INSERT INTO transport (type, identifier, registration_number, operator, capacity, status, base_location, cost_per_hour) 
        VALUES 
        (0, 'H-001', 'N123AB', 'Offshore Helicopter Services', 12, 0, 'Onshore Base', 450.0),
        (0, 'H-002', 'N456CD', 'Rotors Aviation', 8, 0, 'Onshore Base', 380.0),
        (1, 'V-001', 'V-SEA-001', 'Marine Logistics', 50, 0, 'Port Facility', 200.0),
        (2, 'VAN-001', 'ABC-123', 'Ground Transport', 15, 0, 'Onshore Base', 50.0)
        ON CONFLICT DO NOTHING;
        """,
        
        # Sample emergency devices
        """
        INSERT INTO emergency_device (terminal_sn, device_type, zone_id, status, location_description) 
        SELECT sn, 1, 1, 0, 'Main Siren - Zone 1' FROM iclock_terminal LIMIT 1
        ON CONFLICT DO NOTHING;
        """
    ]
    
    try:
        with engine.connect() as conn:
            for statement in default_data:
                logger.info(f"Inserting default data: {statement[:100]}...")
                conn.execute(text(statement))
            
            conn.commit()
            logger.info("Default emergency data inserted successfully!")
            
    except Exception as e:
        logger.warning(f"Warning inserting default data (may already exist): {str(e)}")

if __name__ == "__main__":
    logger.info("Starting emergency tables migration...")
    create_emergency_tables()
    insert_default_data()
    logger.info("Emergency tables migration completed!")
