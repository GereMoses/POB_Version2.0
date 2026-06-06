"""
Create BioTime 9.5 compatible personnel schema
Migration script to add BioTime 9.5 tables and columns to existing POB system
"""

from sqlalchemy import create_engine, text
import os
import sys

# Add the parent directory to the path to import from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

def create_biotime_personnel_schema():
    """Create BioTime 9.5 compatible personnel tables"""
    
    # Get database URL from environment or use default
    database_url = os.getenv('DATABASE_URL', 'postgresql://pob_user:pob_password@localhost:5432/pob_system')
    engine = create_engine(database_url)
    
    # SQL statements to create BioTime 9.5 compatible tables
    sql_statements = [
        """
        -- Core BioTime personnel_employee table
        CREATE TABLE IF NOT EXISTS personnel_employee (
            id SERIAL PRIMARY KEY,
            emp_code VARCHAR(20) UNIQUE NOT NULL,
            first_name VARCHAR(20),
            last_name VARCHAR(25) NOT NULL,
            nickname VARCHAR(20),
            dept_id INTEGER REFERENCES personnel_department(id),
            position_id INTEGER REFERENCES personnel_position(id),
            area_id INTEGER REFERENCES personnel_area(id),
            hire_date DATE,
            birthday DATE,
            gender CHAR(1) CHECK (gender IN ('M', 'F')),
            card_no VARCHAR(20),
            pwd VARCHAR(20),
            photo VARCHAR(255), -- path to /media/employee/photo/
            email VARCHAR(100),
            mobile VARCHAR(20),
            address VARCHAR(255),
            status SMALLINT DEFAULT 0, -- 0=active, 1=resigned
            is_admin BOOLEAN DEFAULT false,
            enroll_sn VARCHAR(20), -- device used for enrollment
            enable_att BOOLEAN DEFAULT true,
            enable_overtime BOOLEAN DEFAULT true,
            enable_holiday BOOLEAN DEFAULT true,
            dev_privilege SMALLINT DEFAULT 0, -- 0=user, 14=admin on device
            super_ssn VARCHAR(10) REFERENCES personnel_employee(emp_code), -- supervisor
            contractor_flag BOOLEAN DEFAULT false,
            vendor_id INTEGER REFERENCES personnel_vendor(id),
            blood_group VARCHAR(3),
            emergency_contact VARCHAR(100),
            emergency_phone VARCHAR(20),
            onboarding_status SMALLINT DEFAULT 0, -- 0=pending,1=in_progress,2=complete
            custom_fields JSONB,
            create_time TIMESTAMP DEFAULT now(),
            update_time TIMESTAMP DEFAULT now()
        );
        """,
        
        """
        -- Department table
        CREATE TABLE IF NOT EXISTS personnel_department (
            id SERIAL PRIMARY KEY,
            dept_code VARCHAR(20),
            dept_name VARCHAR(50) NOT NULL,
            parent_id INTEGER REFERENCES personnel_department(id),
            mgr_ssn VARCHAR(10) REFERENCES personnel_employee(emp_code),
            create_time TIMESTAMP DEFAULT now(),
            update_time TIMESTAMP DEFAULT now()
        );
        """,
        
        """
        -- Position table
        CREATE TABLE IF NOT EXISTS personnel_position (
            id SERIAL PRIMARY KEY,
            position_code VARCHAR(20),
            position_name VARCHAR(50) NOT NULL,
            dept_id INTEGER REFERENCES personnel_department(id),
            create_time TIMESTAMP DEFAULT now(),
            update_time TIMESTAMP DEFAULT now()
        );
        """,
        
        """
        -- Area table
        CREATE TABLE IF NOT EXISTS personnel_area (
            id SERIAL PRIMARY KEY,
            area_code VARCHAR(20),
            area_name VARCHAR(50) NOT NULL,
            area_type SMALLINT DEFAULT 0, -- 0=office,1=site,2=restricted,3=mustering
            create_time TIMESTAMP DEFAULT now(),
            update_time TIMESTAMP DEFAULT now()
        );
        """,
        
        """
        -- Resignation table
        CREATE TABLE IF NOT EXISTS personnel_resignation (
            id SERIAL PRIMARY KEY,
            emp_id INTEGER NOT NULL REFERENCES personnel_employee(id),
            resign_date DATE NOT NULL,
            reason VARCHAR(255),
            operate_time TIMESTAMP DEFAULT now()
        );
        """,
        
        """
        -- Biometric template tables - BioTime stores in separate tables
        CREATE TABLE IF NOT EXISTS personnel_fingerprint (
            id SERIAL PRIMARY KEY,
            emp_id INTEGER NOT NULL REFERENCES personnel_employee(id),
            finger_id SMALLINT NOT NULL,
            template TEXT NOT NULL,
            major_ver VARCHAR(10),
            minor_ver VARCHAR(10),
            create_time TIMESTAMP DEFAULT now()
        );
        """,
        
        """
        CREATE TABLE IF NOT EXISTS personnel_face (
            id SERIAL PRIMARY KEY,
            emp_id INTEGER NOT NULL REFERENCES personnel_employee(id),
            face_id SMALLINT DEFAULT 0,
            template TEXT NOT NULL,
            photo VARCHAR(255),
            create_time TIMESTAMP DEFAULT now()
        );
        """,
        
        """
        CREATE TABLE IF NOT EXISTS personnel_palm (
            id SERIAL PRIMARY KEY,
            emp_id INTEGER NOT NULL REFERENCES personnel_employee(id),
            palm_id SMALLINT DEFAULT 0,
            template TEXT NOT NULL,
            create_time TIMESTAMP DEFAULT now()
        );
        """,
        
        """
        -- New POB tables
        CREATE TABLE IF NOT EXISTS personnel_vendor (
            id SERIAL PRIMARY KEY,
            vendor_code VARCHAR(20) UNIQUE,
            vendor_name VARCHAR(100) NOT NULL,
            contact_person VARCHAR(50),
            contact_phone VARCHAR(20),
            contract_start DATE,
            contract_end DATE,
            status SMALLINT DEFAULT 0,
            create_time TIMESTAMP DEFAULT now(),
            update_time TIMESTAMP DEFAULT now()
        );
        """,
        
        """
        -- Onboarding task table
        CREATE TABLE IF NOT EXISTS onboarding_task (
            id SERIAL PRIMARY KEY,
            emp_id INTEGER NOT NULL REFERENCES personnel_employee(id),
            task_name VARCHAR(100) NOT NULL,
            category VARCHAR(50), -- Document/Training/Medical/PPE
            doc_path VARCHAR(255),
            required BOOLEAN DEFAULT true,
            status SMALLINT DEFAULT 0, -- 0=pending,1=submitted,2=approved,3=rejected
            due_date DATE,
            submitted_time TIMESTAMP,
            approved_by INTEGER REFERENCES auth_user(id),
            approved_time TIMESTAMP,
            expiry_date DATE,
            notes TEXT,
            create_time TIMESTAMP DEFAULT now(),
            update_time TIMESTAMP DEFAULT now()
        );
        """,
        
        """
        -- Onboarding template table
        CREATE TABLE IF NOT EXISTS onboarding_template (
            id SERIAL PRIMARY KEY,
            template_name VARCHAR(100),
            dept_id INTEGER REFERENCES personnel_department(id),
            position_id INTEGER REFERENCES personnel_position(id),
            is_contractor BOOLEAN DEFAULT false,
            create_time TIMESTAMP DEFAULT now(),
            update_time TIMESTAMP DEFAULT now()
        );
        """,
        
        """
        -- Onboarding template items
        CREATE TABLE IF NOT EXISTS onboarding_template_item (
            id SERIAL PRIMARY KEY,
            template_id INTEGER NOT NULL REFERENCES onboarding_template(id),
            task_name VARCHAR(100),
            category VARCHAR(50),
            required BOOLEAN,
            days_to_complete INTEGER,
            create_time TIMESTAMP DEFAULT now()
        );
        """
    ]
    
    # Indexes for performance
    index_statements = [
        "CREATE INDEX IF NOT EXISTS idx_personnel_employee_emp_code ON personnel_employee(emp_code);",
        "CREATE INDEX IF NOT EXISTS idx_personnel_employee_dept_id ON personnel_employee(dept_id);",
        "CREATE INDEX IF NOT EXISTS idx_personnel_employee_status ON personnel_employee(status);",
        "CREATE INDEX IF NOT EXISTS idx_personnel_fingerprint_emp_finger ON personnel_fingerprint(emp_id, finger_id);",
        "CREATE INDEX IF NOT EXISTS idx_onboarding_task_emp_id ON onboarding_task(emp_id);",
        "CREATE INDEX IF NOT EXISTS idx_onboarding_task_status ON onboarding_task(status);",
    ]
    
    try:
        with engine.connect() as conn:
            # Create tables
            for sql in sql_statements:
                conn.execute(text(sql))
                print(f"Created table: {sql.split('CREATE TABLE IF NOT EXISTS ')[1].split(' ')[0]}")
            
            # Create indexes
            for sql in index_statements:
                conn.execute(text(sql))
                print(f"Created index: {sql.split('CREATE INDEX IF NOT EXISTS ')[1].split(' ')[0]}")
            
            conn.commit()
            print("✅ BioTime 9.5 personnel schema created successfully!")
            
    except Exception as e:
        print(f"❌ Error creating BioTime schema: {e}")
        raise

if __name__ == "__main__":
    create_biotime_personnel_schema()
