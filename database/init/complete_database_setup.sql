-- Complete Database Setup for POB System
-- This script ensures all necessary tables exist with proper relationships
-- for department and personnel assignment management

-- Start transaction
BEGIN;

-- Create extensions if they don't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types for department management
DO $$ BEGIN
    CREATE TYPE department_status AS ENUM ('active', 'inactive', 'temporary', 'under_review');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE department_type AS ENUM (
        'operations', 'maintenance', 'safety', 'security', 'administration', 
        'logistics', 'technical', 'medical', 'training', 'contractor', 
        'management', 'support'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE personnel_status AS ENUM (
        'active', 'inactive', 'on_leave', 'transit', 'offshore', 'onshore'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create sites table (for multi-location management)
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
    zkteco_sync_enabled BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    is_active BOOLEAN DEFAULT true
);

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    department_type department_type NOT NULL,
    status department_status DEFAULT 'active',
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
    budget_allocated DECIMAL(15,2),
    budget_used DECIMAL(15,2) DEFAULT 0.00,
    safety_critical BOOLEAN DEFAULT false,
    required_certifications JSONB,
    safety_protocols JSONB,
    access_levels JSONB,
    security_clearance_required BOOLEAN DEFAULT false,
    zkteco_department_id VARCHAR(50),
    zkteco_sync_enabled BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    is_active BOOLEAN DEFAULT true
);

-- Create department_personnel table (for assignments)
CREATE TABLE IF NOT EXISTS department_personnel (
    id SERIAL PRIMARY KEY,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    personnel_id INTEGER NOT NULL,
    role VARCHAR(100) NOT NULL,
    position VARCHAR(100),
    is_primary BOOLEAN DEFAULT false,
    is_manager BOOLEAN DEFAULT false,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    unassigned_at TIMESTAMP WITH TIME ZONE,
    approved_by INTEGER,
    approved_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(department_id, personnel_id) -- Ensure unique assignment
);

-- Create personnel table (if not exists)
CREATE TABLE IF NOT EXISTS personnel (
    id SERIAL PRIMARY KEY,
    badge_id VARCHAR(50) UNIQUE NOT NULL,
    user_id INTEGER,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    company VARCHAR(255) NOT NULL,
    department VARCHAR(100),
    department_id INTEGER REFERENCES departments(id),
    role VARCHAR(100) NOT NULL,
    position VARCHAR(100),
    status personnel_status DEFAULT 'active',
    current_location VARCHAR(255),
    current_zone VARCHAR(100),
    is_onboard BOOLEAN DEFAULT false,
    personnel_type VARCHAR(20) DEFAULT 'STAFF',
    safety_critical BOOLEAN DEFAULT false,
    biometric_enrolled BOOLEAN DEFAULT false,
    compliance_score DECIMAL(5,2) DEFAULT 0.00,
    photo_url VARCHAR(500),
    biometric_data JSONB,
    fingerprint_templates JSONB,
    face_template VARCHAR(255),
    certifications JSONB,
    training_records JSONB,
    medical_fitness_date TIMESTAMP WITH TIME ZONE,
    emergency_contact JSONB,
    blood_group VARCHAR(10),
    medical_conditions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE
);

-- Create users table (if not exists)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
CREATE INDEX IF NOT EXISTS idx_departments_code ON departments(code);
CREATE INDEX IF NOT EXISTS idx_departments_type ON departments(department_type);
CREATE INDEX IF NOT EXISTS idx_departments_status ON departments(status);
CREATE INDEX IF NOT EXISTS idx_departments_site_id ON departments(site_id);
CREATE INDEX IF NOT EXISTS idx_departments_parent_id ON departments(parent_id);
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments(is_active);

CREATE INDEX IF NOT EXISTS idx_department_personnel_department_id ON department_personnel(department_id);
CREATE INDEX IF NOT EXISTS idx_department_personnel_personnel_id ON department_personnel(personnel_id);
CREATE INDEX IF NOT EXISTS idx_department_personnel_status ON department_personnel(status);
CREATE INDEX IF NOT EXISTS idx_department_personnel_assigned_at ON department_personnel(assigned_at);

CREATE INDEX IF NOT EXISTS idx_personnel_badge_id ON personnel(badge_id);
CREATE INDEX IF NOT EXISTS idx_personnel_full_name ON personnel(full_name);
CREATE INDEX IF NOT EXISTS idx_personnel_email ON personnel(email);
CREATE INDEX IF NOT EXISTS idx_personnel_department_id ON personnel(department_id);
CREATE INDEX IF NOT EXISTS idx_personnel_status ON personnel(status);
CREATE INDEX IF NOT EXISTS idx_personnel_is_active ON personnel(is_active);

CREATE INDEX IF NOT EXISTS idx_sites_name ON sites(name);
CREATE INDEX IF NOT EXISTS idx_sites_code ON sites(code);
CREATE INDEX IF NOT EXISTS idx_sites_is_active ON sites(is_active);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables
DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
CREATE TRIGGER update_departments_updated_at 
    BEFORE UPDATE ON departments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_department_personnel_updated_at ON department_personnel;
CREATE TRIGGER update_department_personnel_updated_at 
    BEFORE UPDATE ON department_personnel 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sites_updated_at ON sites;
CREATE TRIGGER update_sites_updated_at 
    BEFORE UPDATE ON sites 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create foreign key constraints for users
DO $$ BEGIN
    ALTER TABLE departments ADD CONSTRAINT fk_departments_created_by 
        FOREIGN KEY (created_by) REFERENCES users(id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE departments ADD CONSTRAINT fk_departments_updated_by 
        FOREIGN KEY (updated_by) REFERENCES users(id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE department_personnel ADD CONSTRAINT fk_department_personnel_approved_by 
        FOREIGN KEY (approved_by) REFERENCES users(id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE sites ADD CONSTRAINT fk_sites_created_by 
        FOREIGN KEY (created_by) REFERENCES users(id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE sites ADD CONSTRAINT fk_sites_updated_by 
        FOREIGN KEY (updated_by) REFERENCES users(id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create view for department statistics
CREATE OR REPLACE VIEW department_statistics AS
SELECT 
    d.id,
    d.name,
    d.code,
    d.department_type,
    d.status,
    d.site_name,
    COUNT(dp.personnel_id) as assigned_personnel,
    COUNT(CASE WHEN dp.is_primary = true THEN 1 END) as primary_assignments,
    COUNT(CASE WHEN dp.is_manager = true THEN 1 END) as manager_count,
    d.max_personnel,
    CASE 
        WHEN d.max_personnel IS NOT NULL THEN 
            ROUND((COUNT(dp.personnel_id)::DECIMAL / d.max_personnel) * 100, 2)
        ELSE NULL 
    END as utilization_percentage
FROM departments d
LEFT JOIN department_personnel dp ON d.id = dp.department_id AND dp.status = 'active'
WHERE d.is_active = true
GROUP BY d.id, d.name, d.code, d.department_type, d.status, d.site_name, d.max_personnel;

-- Create view for personnel assignment summary
CREATE OR REPLACE VIEW personnel_assignment_summary AS
SELECT 
    p.id,
    p.full_name,
    p.badge_id,
    p.company,
    p.personnel_type,
    COUNT(dp.department_id) as total_assignments,
    COUNT(CASE WHEN dp.is_primary = true THEN 1 END) as primary_assignments,
    COUNT(CASE WHEN dp.is_manager = true THEN 1 END) as manager_assignments,
    STRING_AGG(d.name, ', ' ORDER BY d.name) as assigned_departments
FROM personnel p
LEFT JOIN department_personnel dp ON p.id = dp.personnel_id AND dp.status = 'active'
LEFT JOIN departments d ON dp.department_id = d.id AND d.is_active = true
WHERE p.status = 'active'
GROUP BY p.id, p.full_name, p.badge_id, p.company, p.personnel_type;

-- Insert sample data if tables are empty
INSERT INTO sites (name, code, description, city, state, country, site_type, capacity)
SELECT 
    'Platform Alpha', 
    'PF-001', 
    'Main offshore production platform',
    'Atlantic Ocean', 
    'Offshore', 
    'Nigeria', 
    'offshore', 
    100
WHERE NOT EXISTS (SELECT 1 FROM sites);

INSERT INTO sites (name, code, description, city, state, country, site_type, capacity)
SELECT 
    'Onshore Base', 
    'OB-001', 
    'Main onshore support base',
    'Port Harcourt', 
    'Rivers State', 
    'Nigeria', 
    'onshore', 
    200
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE code = 'OB-001');

-- Insert sample departments if none exist
INSERT INTO departments (name, code, description, department_type, site_id, site_name, manager_id, level, is_active)
SELECT 
    'Operations Department',
    'OPS-001',
    'Main operations department for platform activities',
    'operations',
    (SELECT id FROM sites WHERE code = 'PF-001'),
    'Platform Alpha',
    1,
    1,
    true
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE code = 'OPS-001');

INSERT INTO departments (name, code, description, department_type, site_id, site_name, manager_id, level, is_active)
SELECT 
    'Safety Department',
    'SAF-001',
    'Safety and compliance department',
    'safety',
    (SELECT id FROM sites WHERE code = 'PF-001'),
    'Platform Alpha',
    2,
    1,
    true
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE code = 'SAF-001');

INSERT INTO departments (name, code, description, department_type, site_id, site_name, manager_id, level, is_active)
SELECT 
    'Maintenance Department',
    'MAINT-001',
    'Equipment maintenance and repairs',
    'maintenance',
    (SELECT id FROM sites WHERE code = 'PF-001'),
    'Platform Alpha',
    3,
    1,
    true
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE code = 'MAINT-001');

INSERT INTO departments (name, code, description, department_type, site_id, site_name, manager_id, level, is_active)
SELECT 
    'Logistics Department',
    'LOG-001',
    'Supply chain and logistics management',
    'logistics',
    (SELECT id FROM sites WHERE code = 'OB-001'),
    'Onshore Base',
    4,
    1,
    true
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE code = 'LOG-001');

-- Update department personnel counts
UPDATE departments 
SET current_personnel_count = (
    SELECT COUNT(*) 
    FROM department_personnel dp 
    WHERE dp.department_id = departments.id AND dp.status = 'active'
);

-- Commit transaction
COMMIT;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✅ Complete database setup finished successfully';
    RAISE NOTICE '📊 Tables created: sites, departments, department_personnel, personnel, users';
    RAISE NOTICE '🔗 Indexes and constraints created';
    RAISE NOTICE '📈 Views created: department_statistics, personnel_assignment_summary';
    RAISE NOTICE '📝 Sample data inserted where tables were empty';
END $$;
