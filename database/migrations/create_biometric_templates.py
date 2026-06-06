"""
Create Biometric Templates Table Migration
Adds biometric enrollment and verification functionality
"""

import sys
import os

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import create_engine, text

# Import settings directly
try:
    from app.core.config import settings
except ImportError:
    # Fallback for testing
    class Settings:
        DATABASE_URL = "postgresql://pob_user:pob_password@localhost:5432/pob_system"
    settings = Settings()


def create_biometric_templates_table():
    """Create biometric templates and related tables"""
    
    # Create database engine
    engine = create_engine(settings.DATABASE_URL)
    
    # SQL statements to create biometric tables
    create_statements = [
        """
        -- Create biometric_templates table
        CREATE TABLE IF NOT EXISTS biometric_templates (
            id SERIAL PRIMARY KEY,
            personnel_id INTEGER NOT NULL REFERENCES personnel(id),
            template_type VARCHAR(20) NOT NULL,
            template_data TEXT NOT NULL,
            template_quality FLOAT DEFAULT 0.0,
            finger_index INTEGER,
            hand VARCHAR(10),
            device_serial VARCHAR(50),
            enrollment_method VARCHAR(20),
            is_active BOOLEAN DEFAULT TRUE,
            is_verified BOOLEAN DEFAULT FALSE,
            verification_count INTEGER DEFAULT 0,
            last_used TIMESTAMP WITH TIME ZONE,
            enrolled_by INTEGER REFERENCES users(id),
            enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            notes TEXT
        );
        
        -- Create indexes for biometric_templates
        CREATE INDEX IF NOT EXISTS idx_biometric_templates_personnel_id ON biometric_templates(personnel_id);
        CREATE INDEX IF NOT EXISTS idx_biometric_templates_template_type ON biometric_templates(template_type);
        CREATE INDEX IF NOT EXISTS idx_biometric_templates_is_active ON biometric_templates(is_active);
        CREATE INDEX IF NOT EXISTS idx_biometric_templates_device_serial ON biometric_templates(device_serial);
        """,
        
        """
        -- Create biometric_enrollment_sessions table
        CREATE TABLE IF NOT EXISTS biometric_enrollment_sessions (
            id SERIAL PRIMARY KEY,
            session_id VARCHAR(100) UNIQUE NOT NULL,
            personnel_id INTEGER NOT NULL REFERENCES personnel(id),
            template_type VARCHAR(20) NOT NULL,
            device_serial VARCHAR(50),
            status VARCHAR(20) DEFAULT 'INITIATED',
            progress_percentage FLOAT DEFAULT 0.0,
            current_step VARCHAR(50),
            templates_collected INTEGER DEFAULT 0,
            templates_required INTEGER DEFAULT 1,
            quality_threshold FLOAT DEFAULT 70.0,
            error_message TEXT,
            retry_count INTEGER DEFAULT 0,
            max_retries INTEGER DEFAULT 3,
            started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            completed_at TIMESTAMP WITH TIME ZONE,
            last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes for biometric_enrollment_sessions
        CREATE INDEX IF NOT EXISTS idx_biometric_enrollment_sessions_session_id ON biometric_enrollment_sessions(session_id);
        CREATE INDEX IF NOT EXISTS idx_biometric_enrollment_sessions_personnel_id ON biometric_enrollment_sessions(personnel_id);
        CREATE INDEX IF NOT EXISTS idx_biometric_enrollment_sessions_status ON biometric_enrollment_sessions(status);
        """,
        
        """
        -- Create biometric_devices table
        CREATE TABLE IF NOT EXISTS biometric_devices (
            id SERIAL PRIMARY KEY,
            device_serial VARCHAR(50) UNIQUE NOT NULL,
            device_name VARCHAR(100) NOT NULL,
            device_type VARCHAR(20) NOT NULL,
            manufacturer VARCHAR(50),
            model VARCHAR(50),
            firmware_version VARCHAR(20),
            ip_address VARCHAR(15),
            port INTEGER,
            communication_key VARCHAR(50),
            supported_templates JSONB,
            max_templates_per_user INTEGER DEFAULT 10,
            enrollment_quality_threshold FLOAT DEFAULT 70.0,
            is_online BOOLEAN DEFAULT FALSE,
            is_active BOOLEAN DEFAULT TRUE,
            last_heartbeat TIMESTAMP WITH TIME ZONE,
            configuration JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_sync TIMESTAMP WITH TIME ZONE
        );
        
        -- Create indexes for biometric_devices
        CREATE INDEX IF NOT EXISTS idx_biometric_devices_device_serial ON biometric_devices(device_serial);
        CREATE INDEX IF NOT EXISTS idx_biometric_devices_is_active ON biometric_devices(is_active);
        CREATE INDEX IF NOT EXISTS idx_biometric_devices_ip_address ON biometric_devices(ip_address);
        """,
        
        """
        -- Create biometric_verification_logs table
        CREATE TABLE IF NOT EXISTS biometric_verification_logs (
            id SERIAL PRIMARY KEY,
            personnel_id INTEGER REFERENCES personnel(id),
            template_type VARCHAR(20) NOT NULL,
            device_serial VARCHAR(50),
            is_successful BOOLEAN,
            confidence_score FLOAT,
            response_time_ms INTEGER,
            verification_method VARCHAR(20),
            template_used INTEGER REFERENCES biometric_templates(id),
            error_code VARCHAR(20),
            error_message TEXT,
            location VARCHAR(100),
            purpose VARCHAR(50),
            verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes for biometric_verification_logs
        CREATE INDEX IF NOT EXISTS idx_biometric_verification_logs_personnel_id ON biometric_verification_logs(personnel_id);
        CREATE INDEX IF NOT EXISTS idx_biometric_verification_logs_template_type ON biometric_verification_logs(template_type);
        CREATE INDEX IF NOT EXISTS idx_biometric_verification_logs_verified_at ON biometric_verification_logs(verified_at);
        CREATE INDEX IF NOT EXISTS idx_biometric_verification_logs_device_serial ON biometric_verification_logs(device_serial);
        """
    ]
    
    try:
        with engine.connect() as conn:
            for statement in create_statements:
                print(f"Executing: {statement[:100]}...")
                conn.execute(text(statement))
                conn.commit()
        
        print("✅ Biometric templates tables created successfully")
        return True
        
    except Exception as e:
        print(f"❌ Error creating biometric templates tables: {str(e)}")
        return False


def add_sample_biometric_devices():
    """Add sample biometric devices for testing"""
    
    engine = create_engine(settings.DATABASE_URL)
    
    sample_devices = [
        {
            "device_serial": "ZKTECO_FP001",
            "device_name": "ZKTeco Fingerprint Scanner",
            "device_type": "FINGERPRINT",
            "manufacturer": "ZKTeco",
            "model": "MB560",
            "firmware_version": "1.8.0",
            "ip_address": "192.168.1.100",
            "port": 4370,
            "communication_key": "0",
            "supported_templates": ["FINGERPRINT", "FACE"],
            "max_templates_per_user": 10,
            "enrollment_quality_threshold": 70.0,
            "configuration": {
                "auto_capture": True,
                "timeout_seconds": 30,
                "retry_attempts": 3
            }
        },
        {
            "device_serial": "ZKTECO_FACE001",
            "device_name": "ZKTeco Face Scanner",
            "device_type": "FACE",
            "manufacturer": "ZKTeco",
            "model": "MB20",
            "firmware_version": "2.1.0",
            "ip_address": "192.168.1.101",
            "port": 4370,
            "communication_key": "0",
            "supported_templates": ["FACE", "FINGERPRINT"],
            "max_templates_per_user": 5,
            "enrollment_quality_threshold": 75.0,
            "configuration": {
                "face_detection_threshold": 0.8,
                "capture_timeout": 10,
                "quality_check": True
            }
        }
    ]
    
    try:
        with engine.connect() as conn:
            for device in sample_devices:
                # Check if device already exists
                result = conn.execute(text(
                    "SELECT COUNT(*) FROM biometric_devices WHERE device_serial = :device_serial",
                    {"device_serial": device["device_serial"]}
                )).scalar()
                
                if result == 0:
                    # Insert device
                    columns = ", ".join(device.keys())
                    placeholders = ", ".join([f":{key}" for key in device.keys()])
                    values = device
                    
                    insert_sql = f"""
                        INSERT INTO biometric_devices ({columns})
                        VALUES ({placeholders})
                    """
                    
                    conn.execute(text(insert_sql), values)
                    conn.commit()
                    print(f"✅ Added sample device: {device['device_serial']}")
        
        print("✅ Sample biometric devices added successfully")
        return True
        
    except Exception as e:
        print(f"❌ Error adding sample biometric devices: {str(e)}")
        return False


if __name__ == "__main__":
    print("Creating biometric templates tables...")
    
    # Create tables
    if create_biometric_templates_table():
        print("✅ Tables created successfully")
        
        # Add sample data
        print("Adding sample biometric devices...")
        if add_sample_biometric_devices():
            print("✅ Sample data added successfully")
            print("\n🎯 Biometric enrollment system is ready!")
        else:
            print("⚠️ Tables created but sample data failed")
    else:
        print("❌ Failed to create tables")
        sys.exit(1)
