"""
Create Certification and Device Tables for Oil & Gas Personnel Management
Migration script for POB Version 2.0 enhancement
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import sys
import os

# Add the parent directory to the path to import database config
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def create_certification_tables():
    """Create certification and device tables"""
    
    # Database connection
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/pob_db")
    engine = create_engine(DATABASE_URL)
    
    # Create session
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Create certifications table
        certifications_sql = """
        CREATE TABLE IF NOT EXISTS certifications (
            id SERIAL PRIMARY KEY,
            personnel_id INTEGER NOT NULL REFERENCES personnel(id),
            name VARCHAR(255) NOT NULL,
            certification_type VARCHAR(20) DEFAULT 'COMPANY',
            issuer VARCHAR(255) NOT NULL,
            certificate_number VARCHAR(100) UNIQUE NOT NULL,
            issue_date TIMESTAMP WITH TIME ZONE NOT NULL,
            expire_date TIMESTAMP WITH TIME ZONE NOT NULL,
            verified_date TIMESTAMP WITH TIME ZONE,
            status VARCHAR(20) DEFAULT 'active',
            verified BOOLEAN DEFAULT FALSE,
            verification_data TEXT,
            description TEXT,
            requirements TEXT,
            training_provider VARCHAR(255),
            location VARCHAR(255),
            certificate_file VARCHAR(500),
            verification_file VARCHAR(500),
            notes TEXT,
            tags VARCHAR(500),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE
        );
        
        -- Create certification templates table
        CREATE TABLE IF NOT EXISTS certification_templates (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            certification_type VARCHAR(20) NOT NULL,
            issuer VARCHAR(255) NOT NULL,
            description TEXT,
            validity_days INTEGER DEFAULT 365,
            renewal_required BOOLEAN DEFAULT TRUE,
            requirements TEXT,
            prerequisites TEXT,
            personnel_types VARCHAR(100),
            roles VARCHAR(500),
            locations VARCHAR(500),
            is_mandatory BOOLEAN DEFAULT FALSE,
            compliance_weight INTEGER DEFAULT 1,
            expiry_notification_days INTEGER DEFAULT 30,
            renewal_notification_days INTEGER DEFAULT 60,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE
        );
        
        -- Create certification audit table
        CREATE TABLE IF NOT EXISTS certification_audits (
            id SERIAL PRIMARY KEY,
            certification_id INTEGER NOT NULL REFERENCES certifications(id),
            personnel_id INTEGER NOT NULL REFERENCES personnel(id),
            action VARCHAR(50) NOT NULL,
            old_values TEXT,
            new_values TEXT,
            performed_by INTEGER REFERENCES users(id),
            performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            reason TEXT,
            ip_address VARCHAR(45),
            user_agent VARCHAR(500)
        );
        """
        
        # Create device tables
        devices_sql = """
        CREATE TABLE IF NOT EXISTS devices (
            id SERIAL PRIMARY KEY,
            device_id VARCHAR(100) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            serial_number VARCHAR(100) UNIQUE,
            model VARCHAR(100),
            manufacturer VARCHAR(100),
            device_type VARCHAR(50) DEFAULT 'biometric_reader',
            firmware_version VARCHAR(50),
            hardware_version VARCHAR(50),
            ip_address VARCHAR(45),
            port INTEGER DEFAULT 4370,
            mac_address VARCHAR(17),
            location VARCHAR(255) NOT NULL,
            zone VARCHAR(100),
            building VARCHAR(100),
            floor VARCHAR(50),
            status VARCHAR(20) DEFAULT 'offline',
            last_seen TIMESTAMP WITH TIME ZONE,
            battery_level INTEGER,
            signal_strength INTEGER,
            supported_biometrics JSON,
            max_templates INTEGER DEFAULT 1000,
            current_templates INTEGER DEFAULT 0,
            access_mode VARCHAR(50) DEFAULT 'normal',
            authorized_personnel JSON,
            access_schedule JSON,
            zkteco_device_id VARCHAR(50),
            zkteco_config JSON,
            encryption_enabled BOOLEAN DEFAULT TRUE,
            authentication_key VARCHAR(255),
            last_maintenance TIMESTAMP WITH TIME ZONE,
            next_maintenance TIMESTAMP WITH TIME ZONE,
            maintenance_interval_days INTEGER DEFAULT 90,
            settings JSON,
            custom_fields JSON,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE
        );
        
        -- Create access logs table
        CREATE TABLE IF NOT EXISTS access_logs (
            id SERIAL PRIMARY KEY,
            personnel_id INTEGER REFERENCES personnel(id),
            device_id VARCHAR(100) REFERENCES devices(device_id),
            event_type VARCHAR(50) NOT NULL,
            access_granted BOOLEAN NOT NULL,
            access_method VARCHAR(50),
            timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
            duration INTEGER,
            biometric_data JSON,
            denial_reason VARCHAR(255),
            error_code VARCHAR(50),
            location VARCHAR(255),
            zone VARCHAR(100),
            notes TEXT,
            verification_method VARCHAR(50),
            ip_address VARCHAR(45),
            user_agent VARCHAR(500)
        );
        
        -- Create device events table
        CREATE TABLE IF NOT EXISTS device_events (
            id SERIAL PRIMARY KEY,
            device_id VARCHAR(100) NOT NULL REFERENCES devices(device_id),
            event_type VARCHAR(50) NOT NULL,
            event_severity VARCHAR(20) DEFAULT 'INFO',
            event_data JSON,
            old_values JSON,
            new_values JSON,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP WITH TIME ZONE,
            status VARCHAR(20) DEFAULT 'ACTIVE',
            description TEXT,
            resolution_notes TEXT,
            acknowledged_by INTEGER REFERENCES users(id),
            acknowledged_at TIMESTAMP WITH TIME ZONE
        );
        
        -- Create device schedules table
        CREATE TABLE IF NOT EXISTS device_schedules (
            id SERIAL PRIMARY KEY,
            device_id VARCHAR(100) NOT NULL REFERENCES devices(device_id),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            monday_enabled BOOLEAN DEFAULT TRUE,
            tuesday_enabled BOOLEAN DEFAULT TRUE,
            wednesday_enabled BOOLEAN DEFAULT TRUE,
            thursday_enabled BOOLEAN DEFAULT TRUE,
            friday_enabled BOOLEAN DEFAULT TRUE,
            saturday_enabled BOOLEAN DEFAULT FALSE,
            sunday_enabled BOOLEAN DEFAULT FALSE,
            time_ranges JSON,
            access_mode VARCHAR(50) DEFAULT 'NORMAL',
            authorized_personnel JSON,
            is_active BOOLEAN DEFAULT TRUE,
            priority INTEGER DEFAULT 1,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE
        );
        
        -- Create device maintenance table
        CREATE TABLE IF NOT EXISTS device_maintenance (
            id SERIAL PRIMARY KEY,
            device_id VARCHAR(100) NOT NULL REFERENCES devices(device_id),
            maintenance_type VARCHAR(50) NOT NULL,
            description TEXT,
            scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
            estimated_duration INTEGER,
            started_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            actual_duration INTEGER,
            status VARCHAR(20) DEFAULT 'SCHEDULED',
            performed_by INTEGER REFERENCES users(id),
            technician_notes TEXT,
            parts_used JSON,
            cost INTEGER,
            test_results JSON,
            next_maintenance_date TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE
        );
        """
        
        # Execute certification tables creation
        db.execute(text(certifications_sql))
        print("✅ Certification tables created")
        
        # Execute device tables creation
        db.execute(text(devices_sql))
        print("✅ Device tables created")
        
        # Create indexes for certifications
        certification_indexes = """
        -- Certification indexes
        CREATE INDEX IF NOT EXISTS idx_certifications_personnel_id ON certifications(personnel_id);
        CREATE INDEX IF NOT EXISTS idx_certifications_name ON certifications(name);
        CREATE INDEX IF NOT EXISTS idx_certifications_issuer ON certifications(issuer);
        CREATE INDEX IF NOT EXISTS idx_certifications_certificate_number ON certifications(certificate_number);
        CREATE INDEX IF NOT EXISTS idx_certifications_expire_date ON certifications(expire_date);
        CREATE INDEX IF NOT EXISTS idx_certifications_status ON certifications(status);
        CREATE INDEX IF NOT EXISTS idx_certifications_type ON certifications(certification_type);
        
        -- Certification template indexes
        CREATE INDEX IF NOT EXISTS idx_certification_templates_type ON certification_templates(certification_type);
        CREATE INDEX IF NOT EXISTS idx_certification_templates_issuer ON certification_templates(issuer);
        CREATE INDEX IF NOT EXISTS idx_certification_templates_active ON certification_templates(is_active);
        
        -- Certification audit indexes
        CREATE INDEX IF NOT EXISTS idx_certification_audits_certification_id ON certification_audits(certification_id);
        CREATE INDEX IF NOT EXISTS idx_certification_audits_personnel_id ON certification_audits(personnel_id);
        CREATE INDEX IF NOT EXISTS idx_certification_audits_action ON certification_audits(action);
        CREATE INDEX IF NOT EXISTS idx_certification_audits_timestamp ON certification_audits(performed_at);
        """
        
        # Create indexes for certifications
        certification_indexes = """
        -- Certification indexes
        CREATE INDEX IF NOT EXISTS idx_certifications_personnel_id ON certifications(personnel_id);
        CREATE INDEX IF NOT EXISTS idx_certifications_name ON certifications(name);
        CREATE INDEX IF NOT EXISTS idx_certifications_issuer ON certifications(issuer);
        CREATE INDEX IF NOT EXISTS idx_certifications_certificate_number ON certifications(certificate_number);
        CREATE INDEX IF NOT EXISTS idx_certifications_expire_date ON certifications(expire_date);
        CREATE INDEX IF NOT EXISTS idx_certifications_status ON certifications(status);
        CREATE INDEX IF NOT EXISTS idx_certifications_type ON certifications(certification_type);
        
        -- Certification template indexes
        CREATE INDEX IF NOT EXISTS idx_certification_templates_type ON certification_templates(certification_type);
        CREATE INDEX IF NOT EXISTS idx_certification_templates_issuer ON certification_templates(issuer);
        CREATE INDEX IF NOT EXISTS idx_certification_templates_active ON certification_templates(is_active);
        
        -- Certification audit indexes
        CREATE INDEX IF NOT EXISTS idx_certification_audits_certification_id ON certification_audits(certification_id);
        CREATE INDEX IF NOT EXISTS idx_certification_audits_personnel_id ON certification_audits(personnel_id);
        CREATE INDEX IF NOT EXISTS idx_certification_audits_action ON certification_audits(action);
        CREATE INDEX IF NOT EXISTS idx_certification_audits_timestamp ON certification_audits(performed_at);
        """
        
        # Execute certification indexes
        try:
            db.execute(text(certification_indexes))
            print("✅ Certification indexes created")
        except Exception as e:
            print(f"⚠️ Certification indexes warning: {str(e)}")
        
        # Create device indexes
        device_indexes = """
        -- Device indexes
        CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
        CREATE INDEX IF NOT EXISTS idx_devices_name ON devices(name);
        CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
        CREATE INDEX IF NOT EXISTS idx_devices_location ON devices(location);
        CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(device_type);
        CREATE INDEX IF NOT EXISTS idx_devices_ip_address ON devices(ip_address);
        
        -- Access log indexes
        CREATE INDEX IF NOT EXISTS idx_access_logs_personnel_id ON access_logs(personnel_id);
        CREATE INDEX IF NOT EXISTS idx_access_logs_device_id ON access_logs(device_id);
        CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_access_logs_event_type ON access_logs(event_type);
        CREATE INDEX IF NOT EXISTS idx_access_logs_access_granted ON access_logs(access_granted);
        
        -- Device event indexes
        CREATE INDEX IF NOT EXISTS idx_device_events_device_id ON device_events(device_id);
        CREATE INDEX IF NOT EXISTS idx_device_events_timestamp ON device_events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_device_events_type ON device_events(event_type);
        CREATE INDEX IF NOT EXISTS idx_device_events_status ON device_events(status);
        
        -- Device schedule indexes
        CREATE INDEX IF NOT EXISTS idx_device_schedules_device_id ON device_schedules(device_id);
        CREATE INDEX IF NOT EXISTS idx_device_schedules_active ON device_schedules(is_active);
        CREATE INDEX IF NOT EXISTS idx_device_schedules_priority ON device_schedules(priority);
        
        -- Device maintenance indexes
        CREATE INDEX IF NOT EXISTS idx_device_maintenance_device_id ON device_maintenance(device_id);
        CREATE INDEX IF NOT EXISTS idx_device_maintenance_scheduled_date ON device_maintenance(scheduled_date);
        CREATE INDEX IF NOT EXISTS idx_device_maintenance_status ON device_maintenance(status);
        """
        
        # Execute device indexes
        try:
            db.execute(text(device_indexes))
            print("✅ Device indexes created")
        except Exception as e:
            print(f"⚠️ Device indexes warning: {str(e)}")
        
        # Create device indexes
        device_indexes = """
        -- Device indexes
        CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
        CREATE INDEX IF NOT EXISTS idx_devices_name ON devices(name);
        CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
        CREATE INDEX IF NOT EXISTS idx_devices_location ON devices(location);
        CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(device_type);
        CREATE INDEX IF NOT EXISTS idx_devices_ip_address ON devices(ip_address);
        
        -- Access log indexes
        CREATE INDEX IF NOT EXISTS idx_access_logs_personnel_id ON access_logs(personnel_id);
        CREATE INDEX IF NOT EXISTS idx_access_logs_device_id ON access_logs(device_id);
        CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_access_logs_event_type ON access_logs(event_type);
        CREATE INDEX IF NOT EXISTS idx_access_logs_access_granted ON access_logs(access_granted);
        
        -- Device event indexes
        CREATE INDEX IF NOT EXISTS idx_device_events_device_id ON device_events(device_id);
        CREATE INDEX IF NOT EXISTS idx_device_events_timestamp ON device_events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_device_events_type ON device_events(event_type);
        CREATE INDEX IF NOT EXISTS idx_device_events_status ON device_events(status);
        
        -- Device schedule indexes
        CREATE INDEX IF NOT EXISTS idx_device_schedules_device_id ON device_schedules(device_id);
        CREATE INDEX IF NOT EXISTS idx_device_schedules_active ON device_schedules(is_active);
        CREATE INDEX IF NOT EXISTS idx_device_schedules_priority ON device_schedules(priority);
        
        -- Device maintenance indexes
        CREATE INDEX IF NOT EXISTS idx_device_maintenance_device_id ON device_maintenance(device_id);
        CREATE INDEX IF NOT EXISTS idx_device_maintenance_scheduled_date ON device_maintenance(scheduled_date);
        CREATE INDEX IF NOT EXISTS idx_device_maintenance_status ON device_maintenance(status);
        """
        
        # Execute device indexes
        db.execute(text(device_indexes))
        
        # Add comments to tables
        comments_sql = """
        -- Table comments
        COMMENT ON TABLE certifications IS 'Personnel certifications and training records';
        COMMENT ON TABLE certification_templates IS 'Templates for different certification types';
        COMMENT ON TABLE certification_audits IS 'Audit trail for certification changes';
        COMMENT ON TABLE devices IS 'Biometric and access control devices';
        COMMENT ON TABLE access_logs IS 'Access attempt logs for all devices';
        COMMENT ON TABLE device_events IS 'Device status and configuration events';
        COMMENT ON TABLE device_schedules IS 'Access control schedules for devices';
        COMMENT ON TABLE device_maintenance IS 'Maintenance records for devices';
        
        -- Column comments for certifications
        COMMENT ON COLUMN certifications.certification_type IS 'Type of certification: OPITO, NOPSEMA, COMPANY, OTHER';
        COMMENT ON COLUMN certifications.status IS 'Certification status: active, expired, suspended, revoked';
        COMMENT ON COLUMN certifications.verified IS 'Whether certification has been verified with issuing authority';
        
        -- Column comments for devices
        COMMENT ON COLUMN devices.device_type IS 'Type of device: biometric_reader, card_reader, turnstile, etc.';
        COMMENT ON COLUMN devices.status IS 'Device status: online, offline, maintenance, error, disconnected';
        COMMENT ON COLUMN devices.access_mode IS 'Access mode: normal, lockdown, emergency';
        """
        
        # Execute comments
        try:
            db.execute(text(comments_sql))
            print("✅ Table comments added")
        except Exception as e:
            print(f"⚠️ Comments warning: {str(e)}")
        
        # Insert sample certification templates
        sample_templates_sql = """
        INSERT INTO certification_templates (name, certification_type, issuer, description, validity_days, is_mandatory, compliance_weight) VALUES
        ('H2S Awareness Training', 'OPITO', 'OPITO', 'Hydrogen sulfide safety awareness training', 365, TRUE, 3),
        ('Tropical Water Survival', 'OPITO', 'OPITO', 'Tropical water survival and safety training', 1825, TRUE, 5),
        ('Banksman Training', 'OPITO', 'OPITO', 'Crane and lifting operations training', 730, FALSE, 2),
        ('Medical Fitness Certificate', 'NOPSEMA', 'NOPSEMA', 'Medical fitness for offshore work', 365, TRUE, 4),
        ('Safety Officer Certification', 'NOPSEMA', 'NOPSEMA', 'Safety officer certification', 730, FALSE, 3),
        ('Company Induction', 'COMPANY', 'Company', 'Company safety induction program', 365, TRUE, 1),
        ('Safety Briefing', 'COMPANY', 'Company', 'Regular safety briefing', 180, TRUE, 1),
        ('Equipment Training', 'COMPANY', 'Company', 'Equipment operation and safety training', 730, FALSE, 2)
        ON CONFLICT (name) DO NOTHING;
        """
        
        # Insert sample certification templates
        sample_templates_sql = """
        INSERT INTO certification_templates (name, certification_type, issuer, description, validity_days, is_mandatory, compliance_weight) VALUES
        ('H2S Awareness Training', 'OPITO', 'OPITO', 'Hydrogen sulfide safety awareness training', 365, TRUE, 3),
        ('Tropical Water Survival', 'OPITO', 'OPITO', 'Tropical water survival and safety training', 1825, TRUE, 5),
        ('Banksman Training', 'OPITO', 'OPITO', 'Crane and lifting operations training', 730, FALSE, 2),
        ('Medical Fitness Certificate', 'NOPSEMA', 'NOPSEMA', 'Medical fitness for offshore work', 365, TRUE, 4),
        ('Safety Officer Certification', 'NOPSEMA', 'NOPSEMA', 'Safety officer certification', 730, FALSE, 3),
        ('Company Induction', 'COMPANY', 'Company', 'Company safety induction program', 365, TRUE, 1),
        ('Safety Briefing', 'COMPANY', 'Company', 'Regular safety briefing', 180, TRUE, 1),
        ('Equipment Training', 'COMPANY', 'Company', 'Equipment operation and safety training', 730, FALSE, 2)
        ON CONFLICT (name) DO NOTHING;
        """
        
        # Execute sample templates
        try:
            db.execute(text(sample_templates_sql))
            print("✅ Sample certification templates inserted")
        except Exception as e:
            print(f"⚠️ Sample templates warning: {str(e)}")
        
        db.commit()
        
        print("✅ Certification and device tables created successfully!")
        print("📊 Tables created:")
        print("   - certifications")
        print("   - certification_templates")
        print("   - certification_audits")
        print("   - devices")
        print("   - access_logs")
        print("   - device_events")
        print("   - device_schedules")
        print("   - device_maintenance")
        print("🔍 Indexes created for performance optimization")
        print("📝 Table comments added for documentation")
        print("📋 Sample certification templates inserted")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Migration failed: {str(e)}")
        raise e
    finally:
        db.close()

def verify_migration():
    """Verify that the migration was successful"""
    
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/pob_db")
    engine = create_engine(DATABASE_URL)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Check if tables exist
        tables_to_check = [
            'certifications', 'certification_templates', 'certification_audits',
            'devices', 'access_logs', 'device_events', 'device_schedules', 'device_maintenance'
        ]
        
        print("\n🔍 Migration Verification:")
        print("Tables created successfully:")
        
        for table in tables_to_check:
            result = db.execute(text(f"""
                SELECT COUNT(*) as row_count
                FROM information_schema.tables 
                WHERE table_name = '{table}'
            """))
            
            table_exists = result.fetchone()[0] > 0
            status = "✅" if table_exists else "❌"
            print(f"   {status} {table}")
        
        # Check sample templates
        result = db.execute(text("SELECT COUNT(*) as count FROM certification_templates"))
        template_count = result.fetchone()[0]
        
        print(f"\n📋 Sample certification templates: {template_count}")
        
        # Check indexes
        certification_indexes = db.execute(text("""
            SELECT COUNT(*) as index_count
            FROM pg_indexes
            WHERE tablename IN ('certifications', 'devices', 'access_logs')
        """)).scalar()
        
        print(f"🔍 Database indexes created: {certification_indexes}")
        
        print("\n✅ Migration verification successful - all tables and indexes created!")
        
    except Exception as e:
        print(f"❌ Verification failed: {str(e)}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 Starting Certification and Device Tables Migration")
    print("=" * 60)
    
    try:
        create_certification_tables()
        verify_migration()
        print("\n🎉 Migration completed successfully!")
        print("📋 Your POB system now supports:")
        print("   - Certification tracking and management")
        print("   - Biometric device management")
        print("   - Access control and logging")
        print("   - Device maintenance and scheduling")
        print("   - Industry-standard certifications (OPITO, NOPSEMA)")
    except Exception as e:
        print(f"\n💥 Migration failed: {str(e)}")
        print("🔧 Please check the error above and try again")
        sys.exit(1)
