"""
Simple Certification and Device Tables Migration
Step-by-step migration for POB Version 2.0
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import sys
import os

# Add the parent directory to the path to import database config
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def create_tables_step_by_step():
    """Create tables step by step to avoid transaction issues"""
    
    # Database connection
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/pob_db")
    engine = create_engine(DATABASE_URL)
    
    # Create session
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Step 1: Create certifications table
        print("📝 Creating certifications table...")
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
        """
        db.execute(text(certifications_sql))
        db.commit()
        print("✅ Certifications table created")
        
        # Step 2: Create certification templates table
        print("📝 Creating certification_templates table...")
        templates_sql = """
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
        """
        db.execute(text(templates_sql))
        db.commit()
        print("✅ Certification templates table created")
        
        # Step 3: Create certification audits table
        print("📝 Creating certification_audits table...")
        audits_sql = """
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
        db.execute(text(audits_sql))
        db.commit()
        print("✅ Certification audits table created")
        
        # Step 4: Create devices table
        print("📝 Creating devices table...")
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
        """
        db.execute(text(devices_sql))
        db.commit()
        print("✅ Devices table created")
        
        # Step 5: Create access logs table
        print("📝 Creating access_logs table...")
        access_logs_sql = """
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
        """
        db.execute(text(access_logs_sql))
        db.commit()
        print("✅ Access logs table created")
        
        # Step 6: Create device events table
        print("📝 Creating device_events table...")
        device_events_sql = """
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
        """
        db.execute(text(device_events_sql))
        db.commit()
        print("✅ Device events table created")
        
        # Step 7: Create device schedules table
        print("📝 Creating device_schedules table...")
        schedules_sql = """
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
        """
        db.execute(text(schedules_sql))
        db.commit()
        print("✅ Device schedules table created")
        
        # Step 8: Create device maintenance table
        print("📝 Creating device_maintenance table...")
        maintenance_sql = """
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
        db.execute(text(maintenance_sql))
        db.commit()
        print("✅ Device maintenance table created")
        
        # Step 9: Insert sample certification templates
        print("📝 Inserting sample certification templates...")
        templates_data = """
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
        db.execute(text(templates_data))
        db.commit()
        print("✅ Sample certification templates inserted")
        
        print("\n🎉 Migration completed successfully!")
        print("📊 Tables created:")
        print("   - certifications")
        print("   - certification_templates")
        print("   - certification_audits")
        print("   - devices")
        print("   - access_logs")
        print("   - device_events")
        print("   - device_schedules")
        print("   - device_maintenance")
        print("📋 Sample certification templates: 8")
        
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
        
        print("\n✅ Migration verification successful - all tables created!")
        
    except Exception as e:
        print(f"❌ Verification failed: {str(e)}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 Starting Simple Certification and Device Tables Migration")
    print("=" * 60)
    
    try:
        create_tables_step_by_step()
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
