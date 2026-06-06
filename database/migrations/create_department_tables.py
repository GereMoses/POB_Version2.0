"""
Create Department Tables Migration

This migration creates the department management tables for oil and gas operations.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import create_engine, text
from app.core.database import DATABASE_URL

def create_department_tables():
    """Create department management tables"""
    
    engine = create_engine(DATABASE_URL)
    
    # SQL statements to create department tables
    sql_statements = [
        """
        -- Create sites table
        CREATE TABLE IF NOT EXISTS sites (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            code VARCHAR(50) UNIQUE NOT NULL,
            description TEXT,
            address TEXT,
            city VARCHAR(100),
            state VARCHAR(100),
            country VARCHAR(100),
            postal_code VARCHAR(20),
            site_manager_id INTEGER,
            contact_person VARCHAR(255),
            contact_email VARCHAR(255),
            contact_phone VARCHAR(20),
            site_type VARCHAR(50),
            capacity INTEGER,
            current_occupancy INTEGER DEFAULT 0,
            zkteco_site_id VARCHAR(50),
            zkteco_sync_enabled BOOLEAN DEFAULT TRUE,
            last_sync_at TIMESTAMP WITH TIME ZONE,
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            updated_by INTEGER,
            is_active BOOLEAN DEFAULT TRUE
        );
        """,
        
        """
        -- Create departments table
        CREATE TABLE IF NOT EXISTS departments (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            code VARCHAR(50) UNIQUE NOT NULL,
            description TEXT,
            department_type VARCHAR(50) NOT NULL,
            status VARCHAR(20) DEFAULT 'active',
            parent_id INTEGER REFERENCES departments(id),
            level INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            site_id INTEGER REFERENCES sites(id),
            site_name VARCHAR(255),
            location VARCHAR(255),
            zone VARCHAR(100),
            manager_id INTEGER,
            contact_person VARCHAR(255),
            contact_email VARCHAR(255),
            contact_phone VARCHAR(20),
            max_personnel INTEGER,
            current_personnel_count INTEGER DEFAULT 0,
            budget_allocated NUMERIC(15,2),
            budget_used NUMERIC(15,2) DEFAULT 0.0,
            safety_critical BOOLEAN DEFAULT FALSE,
            required_certifications JSONB,
            safety_protocols JSONB,
            access_levels JSONB,
            security_clearance_required BOOLEAN DEFAULT FALSE,
            zkteco_department_id VARCHAR(50),
            zkteco_sync_enabled BOOLEAN DEFAULT TRUE,
            last_sync_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            updated_by INTEGER,
            is_active BOOLEAN DEFAULT TRUE
        );
        """,
        
        """
        -- Create department_personnel table
        CREATE TABLE IF NOT EXISTS department_personnel (
            id SERIAL PRIMARY KEY,
            department_id INTEGER NOT NULL REFERENCES departments(id),
            personnel_id INTEGER NOT NULL REFERENCES personnel(id),
            role VARCHAR(100) NOT NULL,
            position VARCHAR(100),
            is_primary BOOLEAN DEFAULT FALSE,
            is_manager BOOLEAN DEFAULT FALSE,
            assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            unassigned_at TIMESTAMP WITH TIME ZONE,
            approved_by INTEGER,
            approved_at TIMESTAMP WITH TIME ZONE,
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """,
        
        """
        -- Add department_id to personnel table if it doesn't exist
        ALTER TABLE personnel ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id);
        """,
        
        """
        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_departments_code ON departments(code);
        CREATE INDEX IF NOT EXISTS idx_departments_type ON departments(department_type);
        CREATE INDEX IF NOT EXISTS idx_departments_status ON departments(status);
        CREATE INDEX IF NOT EXISTS idx_departments_parent_id ON departments(parent_id);
        CREATE INDEX IF NOT EXISTS idx_departments_site_id ON departments(site_id);
        CREATE INDEX IF NOT EXISTS idx_departments_manager_id ON departments(manager_id);
        
        CREATE INDEX IF NOT EXISTS idx_sites_code ON sites(code);
        CREATE INDEX IF NOT EXISTS idx_sites_status ON sites(status);
        CREATE INDEX IF NOT EXISTS idx_sites_manager_id ON sites(site_manager_id);
        
        CREATE INDEX IF NOT EXISTS idx_department_personnel_dept_id ON department_personnel(department_id);
        CREATE INDEX IF NOT EXISTS idx_department_personnel_personnel_id ON department_personnel(personnel_id);
        CREATE INDEX IF NOT EXISTS idx_department_personnel_status ON department_personnel(status);
        
        CREATE INDEX IF NOT EXISTS idx_personnel_department_id ON personnel(department_id);
        """,
        
        """
        -- Insert default sites
        INSERT INTO sites (name, code, description, site_type, status) VALUES 
        ('Headquarters', 'HQ', 'Main headquarters office', 'office', 'active'),
        ('Offshore Platform Alpha', 'PA', 'Primary offshore platform', 'offshore', 'active'),
        ('Offshore Platform Beta', 'PB', 'Secondary offshore platform', 'offshore', 'active'),
        ('Onshore Base', 'OB', 'Main onshore operations base', 'onshore', 'active'),
        ('Field Operations', 'FO', 'Field operations site', 'field', 'active')
        ON CONFLICT (code) DO NOTHING;
        """,
        
        """
        -- Insert default departments
        INSERT INTO departments (name, code, description, department_type, site_id, site_name, safety_critical) VALUES 
        ('Operations', 'OPS', 'Operations department', 'operations', 1, 'Headquarters', TRUE),
        ('Maintenance', 'MAINT', 'Maintenance department', 'maintenance', 1, 'Headquarters', TRUE),
        ('Safety', 'SAFETY', 'Safety department', 'safety', 1, 'Headquarters', TRUE),
        ('Security', 'SEC', 'Security department', 'security', 1, 'Headquarters', FALSE),
        ('Administration', 'ADMIN', 'Administration department', 'administration', 1, 'Headquarters', FALSE),
        ('Logistics', 'LOG', 'Logistics department', 'logistics', 1, 'Headquarters', FALSE),
        ('Technical', 'TECH', 'Technical department', 'technical', 1, 'Headquarters', FALSE),
        ('Medical', 'MED', 'Medical department', 'medical', 1, 'Headquarters', FALSE),
        ('Training', 'TRAIN', 'Training department', 'training', 1, 'Headquarters', FALSE),
        ('Contractor Services', 'CONTRACT', 'Contractor services department', 'contractor', 1, 'Headquarters', FALSE),
        ('Management', 'MGMT', 'Management department', 'management', 1, 'Headquarters', FALSE),
        ('Support Services', 'SUPPORT', 'Support services department', 'support', 1, 'Headquarters', FALSE)
        ON CONFLICT (code) DO NOTHING;
        """,
        
        """
        -- Create function to update updated_at timestamp
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';
        """,
        
        """
        -- Create triggers for updated_at
        CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            
        CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            
        CREATE TRIGGER update_department_personnel_updated_at BEFORE UPDATE ON department_personnel
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        """
    ]
    
    try:
        with engine.connect() as connection:
            for sql in sql_statements:
                print(f"Executing: {sql[:100]}...")
                connection.execute(text(sql))
            connection.commit()
        
        print("✅ Department tables created successfully!")
        
        # Verify tables were created
        with engine.connect() as connection:
            result = connection.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('sites', 'departments', 'department_personnel')
                ORDER BY table_name;
            """))
            
            tables = [row[0] for row in result]
            print(f"✅ Created tables: {', '.join(tables)}")
            
            # Check record counts
            for table in ['sites', 'departments']:
                result = connection.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.scalar()
                print(f"✅ {table}: {count} records")
    
    except Exception as e:
        print(f"❌ Error creating department tables: {e}")
        raise

if __name__ == "__main__":
    create_department_tables()
