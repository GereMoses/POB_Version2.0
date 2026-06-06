-- BioTime 9.5 Schema Migration
-- Run this script in PostgreSQL to create BioTime-compatible tables

-- Personnel Employee table (BioTime standard)
CREATE TABLE IF NOT EXISTS personnel_employee (
    id SERIAL PRIMARY KEY,
    emp_code VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(20),
    last_name VARCHAR(25) NOT NULL,
    dept_id INTEGER,
    area_id INTEGER,
    position_id INTEGER,
    hire_date DATE,
    birthday DATE,
    sex CHAR(1),
    photo VARCHAR(255),
    card_no VARCHAR(20),
    pwd VARCHAR(20),
    status SMALLINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Personnel Department table (BioTime standard)
CREATE TABLE IF NOT EXISTS personnel_department (
    id SERIAL PRIMARY KEY,
    dept_code VARCHAR(20),
    dept_name VARCHAR(50) NOT NULL,
    parent_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Personnel Area table (BioTime standard)
CREATE TABLE IF NOT EXISTS personnel_area (
    id SERIAL PRIMARY KEY,
    area_code VARCHAR(20),
    area_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- iClock Terminal table (BioTime standard)
CREATE TABLE IF NOT EXISTS iclock_terminal (
    id SERIAL PRIMARY KEY,
    sn VARCHAR(20) UNIQUE NOT NULL,
    alias VARCHAR(50),
    ip_address VARCHAR(15),
    area_id INTEGER,
    last_activity TIMESTAMP WITH TIME ZONE,
    state SMALLINT DEFAULT 0,
    comm_key VARCHAR(20),
    fw_ver VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- iClock Transaction table (BioTime standard)
CREATE TABLE IF NOT EXISTS iclock_transaction (
    id BIGSERIAL PRIMARY KEY,
    emp_code VARCHAR(20) NOT NULL,
    punch_time TIMESTAMP WITH TIME ZONE NOT NULL,
    punch_state SMALLINT,
    verify_type SMALLINT,
    work_code INTEGER,
    terminal_sn VARCHAR(20),
    area_alias VARCHAR(50),
    upload_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance Timetable (BioTime standard)
CREATE TABLE IF NOT EXISTS att_timetable (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    late_grace_minutes INTEGER DEFAULT 0,
    early_exit_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance Shift (BioTime standard)
CREATE TABLE IF NOT EXISTS att_shift (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    timetable_id INTEGER,
    days_of_week VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance Schedule (BioTime standard)
CREATE TABLE IF NOT EXISTS att_schedule (
    id SERIAL PRIMARY KEY,
    emp_code VARCHAR(20) NOT NULL,
    shift_id INTEGER,
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance Leave (BioTime standard)
CREATE TABLE IF NOT EXISTS att_leave (
    id SERIAL PRIMARY KEY,
    emp_code VARCHAR(20) NOT NULL,
    leave_type VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count FLOAT DEFAULT 0,
    status SMALLINT DEFAULT 0,
    approved_by VARCHAR(20),
    approved_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Access Control Level (BioTime standard)
CREATE TABLE IF NOT EXISTS acc_level (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    time_zone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Access User Authorization (BioTime standard)
CREATE TABLE IF NOT EXISTS acc_userauthorize (
    id SERIAL PRIMARY KEY,
    emp_code VARCHAR(20) NOT NULL,
    acc_level_id INTEGER,
    start_time TIME,
    end_time TIME,
    valid_days VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Access Door (BioTime standard)
CREATE TABLE IF NOT EXISTS acc_door (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    terminal_sn VARCHAR(20),
    acc_level_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auth User (BioTime standard)
CREATE TABLE IF NOT EXISTS auth_user (
    id SERIAL PRIMARY KEY,
    username VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(128) NOT NULL,
    email VARCHAR(100),
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    is_superuser BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auth Role (BioTime standard)
CREATE TABLE IF NOT EXISTS auth_role (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auth Permission (BioTime standard)
CREATE TABLE IF NOT EXISTS auth_permission (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    codename VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Base Operation Log (BioTime standard)
CREATE TABLE IF NOT EXISTS base_operationlog (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER,
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(50),
    record_id INTEGER,
    old_values TEXT,
    new_values TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mustering Zone table
CREATE TABLE IF NOT EXISTS mustering_zone (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    capacity INTEGER,
    evac_point VARCHAR(100),
    zone_type SMALLINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mustering Event table
CREATE TABLE IF NOT EXISTS mustering_event (
    id BIGSERIAL PRIMARY KEY,
    zone_id INTEGER REFERENCES mustering_zone(id) NOT NULL,
    event_type SMALLINT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    status SMALLINT DEFAULT 0,
    initiated_by INTEGER,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mustering Log table
CREATE TABLE IF NOT EXISTS mustering_log (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT REFERENCES mustering_event(id) NOT NULL,
    emp_code VARCHAR(20) NOT NULL,
    check_time TIMESTAMP WITH TIME ZONE NOT NULL,
    device_sn VARCHAR(20),
    status SMALLINT DEFAULT 0,
    location VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Onboarding Task table
CREATE TABLE IF NOT EXISTS onboarding_task (
    id SERIAL PRIMARY KEY,
    emp_id INTEGER,
    task_name VARCHAR(100) NOT NULL,
    doc_path VARCHAR(255),
    status SMALLINT DEFAULT 0,
    due_date DATE,
    approved_by INTEGER,
    approved_time TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Emergency Device table
CREATE TABLE IF NOT EXISTS emergency_device (
    id SERIAL PRIMARY KEY,
    terminal_sn VARCHAR(20),
    device_type SMALLINT DEFAULT 0,
    zone_id INTEGER,
    status SMALLINT DEFAULT 0,
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_personnel_emp_code ON personnel_employee(emp_code);
CREATE INDEX IF NOT EXISTS idx_personnel_dept_id ON personnel_employee(dept_id);
CREATE INDEX IF NOT EXISTS idx_personnel_status ON personnel_employee(status);

CREATE INDEX IF NOT EXISTS idx_transaction_emp_code ON iclock_transaction(emp_code);
CREATE INDEX IF NOT EXISTS idx_transaction_punch_time ON iclock_transaction(punch_time);
CREATE INDEX IF NOT EXISTS idx_transaction_terminal_sn ON iclock_transaction(terminal_sn);
CREATE INDEX IF NOT EXISTS idx_transaction_upload_time ON iclock_transaction(upload_time);

CREATE INDEX IF NOT EXISTS idx_terminal_sn ON iclock_terminal(sn);
CREATE INDEX IF NOT EXISTS idx_terminal_ip ON iclock_terminal(ip_address);
CREATE INDEX IF NOT EXISTS idx_terminal_state ON iclock_terminal(state);

CREATE INDEX IF NOT EXISTS idx_auth_user_username ON auth_user(username);
CREATE INDEX IF NOT EXISTS idx_auth_user_active ON auth_user(is_active);

CREATE INDEX IF NOT EXISTS idx_mustering_event_zone ON mustering_event(zone_id);
CREATE INDEX IF NOT EXISTS idx_mustering_event_status ON mustering_event(status);
CREATE INDEX IF NOT EXISTS idx_mustering_log_event ON mustering_log(event_id);
CREATE INDEX IF NOT EXISTS idx_mustering_log_emp ON mustering_log(emp_code);

CREATE INDEX IF NOT EXISTS idx_operation_log_user ON base_operationlog(user_id);
CREATE INDEX IF NOT EXISTS idx_operation_log_action ON base_operationlog(action);
CREATE INDEX IF NOT EXISTS idx_operation_log_created ON base_operationlog(created_at);
