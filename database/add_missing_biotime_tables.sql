-- Add Missing BioTime Tables
-- This script adds the missing BioTime standard tables that were identified in the analysis

-- Fingerprint templates table
CREATE TABLE IF NOT EXISTS fingerprint (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES personnel_employee(id) ON DELETE CASCADE,
    finger_index INTEGER NOT NULL CHECK (finger_index >= 0 AND finger_index <= 9),
    template_data BYTEA NOT NULL,
    template_version INTEGER DEFAULT 1,
    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
    template_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, finger_index)
);

-- Face recognition templates table
CREATE TABLE IF NOT EXISTS face (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES personnel_employee(id) ON DELETE CASCADE,
    template_data BYTEA NOT NULL,
    template_version INTEGER DEFAULT 1,
    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
    template_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Device mapping table for ZKTeco devices
CREATE TABLE IF NOT EXISTS devicemap (
    id SERIAL PRIMARY KEY,
    device_sn VARCHAR(20) UNIQUE NOT NULL,
    ip_address VARCHAR(15),
    port INTEGER DEFAULT 4370,
    comm_key VARCHAR(20) DEFAULT '0',
    device_type SMALLINT DEFAULT 0, -- 0=terminal,1=reader,2=other
    area_id INTEGER REFERENCES personnel_area(id),
    last_sync TIMESTAMP WITH TIME ZONE,
    sync_status SMALLINT DEFAULT 0, -- 0=not synced,1=synced,2=error
    status SMALLINT DEFAULT 0, -- 0=offline,1=online,2=error
    firmware_version VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Holiday calendar table
CREATE TABLE IF NOT EXISTS holiday (
    id SERIAL PRIMARY KEY,
    holiday_name VARCHAR(100) NOT NULL,
    holiday_date DATE NOT NULL,
    end_date DATE, -- For multi-day holidays
    is_repeatable BOOLEAN DEFAULT FALSE, -- Repeat every year
    repeat_month INTEGER, -- Month for repeatable holidays (1-12)
    repeat_day INTEGER, -- Day for repeatable holidays (1-31)
    holiday_type SMALLINT DEFAULT 0, -- 0=public,1=company,2=religious
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(holiday_date, holiday_name)
);

-- Overtime rules table
CREATE TABLE IF NOT EXISTS overtime_rule (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    rule_type SMALLINT NOT NULL, -- 0=daily,1=weekly,2=holiday,3=night_shift
    min_minutes INTEGER NOT NULL, -- Minimum minutes to qualify
    rate FLOAT NOT NULL DEFAULT 1.0, -- Multiplier rate (1.5x, 2.0x, etc.)
    max_hours_per_day FLOAT, -- Maximum overtime hours per day
    max_hours_per_week FLOAT, -- Maximum overtime hours per week
    area_id INTEGER REFERENCES personnel_area(id),
    department_id INTEGER REFERENCES personnel_department(id),
    is_active BOOLEAN DEFAULT TRUE,
    effective_date DATE NOT NULL,
    expiry_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Overtime records table
CREATE TABLE IF NOT EXISTS overtime_record (
    id BIGSERIAL PRIMARY KEY,
    emp_code VARCHAR(20) NOT NULL REFERENCES personnel_employee(emp_code),
    overtime_date DATE NOT NULL,
    overtime_rule_id INTEGER REFERENCES overtime_rule(id),
    start_time TIME,
    end_time TIME,
    total_minutes INTEGER NOT NULL,
    rate FLOAT NOT NULL,
    overtime_amount FLOAT,
    approved_by INTEGER REFERENCES auth_user(id),
    approved_time TIMESTAMP WITH TIME ZONE,
    status SMALLINT DEFAULT 0, -- 0=pending,1=approved,2=rejected,3=processed
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Check-in/out raw records table (BioTime standard)
CREATE TABLE IF NOT EXISTS checkinout (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES personnel_employee(id),
    emp_code VARCHAR(20) NOT NULL,
    check_time TIMESTAMP WITH TIME ZONE NOT NULL,
    check_type SMALLINT NOT NULL, -- 0=check-in,1=check-out,2=break-in,3=break-out
    verify_type SMALLINT,
    sensor_id VARCHAR(20),
    terminal_sn VARCHAR(20) REFERENCES iclock_terminal(sn),
    work_code INTEGER,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Serial number management table (BioTime standard)
CREATE TABLE IF NOT EXISTS sn (
    id SERIAL PRIMARY KEY,
    sn VARCHAR(20) UNIQUE NOT NULL,
    device_type VARCHAR(50),
    model VARCHAR(50),
    firmware VARCHAR(20),
    purchase_date DATE,
    warranty_expiry DATE,
    status SMALLINT DEFAULT 0, -- 0=active,1=retired,2=lost,3=damaged
    location VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Access control group table (BioTime standard)
CREATE TABLE IF NOT EXISTS acgroup (
    id SERIAL PRIMARY KEY,
    group_name VARCHAR(50) NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES acgroup(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Self-service records table (BioTime standard)
CREATE TABLE IF NOT EXISTS ssr (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES personnel_employee(id),
    ssr_type SMALLINT NOT NULL, -- 0=leave_request,1=overtime_request,2=attendance_correction
    request_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    reason TEXT,
    status SMALLINT DEFAULT 0, -- 0=pending,1=approved,2=rejected,3=processed
    approved_by INTEGER REFERENCES auth_user(id),
    approved_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fingerprint_user_id ON fingerprint(user_id);
CREATE INDEX IF NOT EXISTS idx_face_user_id ON face(user_id);
CREATE INDEX IF NOT EXISTS idx_devicemap_sn ON devicemap(device_sn);
CREATE INDEX IF NOT EXISTS idx_holiday_date ON holiday(holiday_date);
CREATE INDEX IF NOT EXISTS idx_overtime_rule_type ON overtime_rule(rule_type);
CREATE INDEX IF NOT EXISTS idx_overtime_record_emp_code ON overtime_record(emp_code);
CREATE INDEX IF NOT EXISTS idx_overtime_record_date ON overtime_record(overtime_date);
CREATE INDEX IF NOT EXISTS idx_checkinout_emp_code ON checkinout(emp_code);
CREATE INDEX IF NOT EXISTS idx_checkinout_time ON checkinout(check_time);
CREATE INDEX IF NOT EXISTS idx_ssr_user_id ON ssr(user_id);
CREATE INDEX IF NOT EXISTS idx_ssr_status ON ssr(status);

-- Add comments for documentation
COMMENT ON TABLE fingerprint IS 'Stores fingerprint biometric templates for personnel';
COMMENT ON TABLE face IS 'Stores face recognition biometric templates for personnel';
COMMENT ON TABLE devicemap IS 'Maps ZKTeco devices to their network configurations';
COMMENT ON TABLE holiday IS 'Holiday calendar for attendance calculations';
COMMENT ON TABLE overtime_rule IS 'Overtime calculation rules and policies';
COMMENT ON TABLE overtime_record IS 'Records of overtime worked by employees';
COMMENT ON TABLE checkinout IS 'Raw check-in/out records from devices';
COMMENT ON TABLE sn IS 'Serial number management for devices';
COMMENT ON TABLE acgroup IS 'Access control group hierarchy';
COMMENT ON TABLE ssr IS 'Self-service requests from employees';
