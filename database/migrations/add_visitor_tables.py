"""
Database migration for Visitor Management Module
BioTime 9.5 compatible visitor tables with POB extensions
"""

from sqlalchemy import text

# SQL migration script
VISITOR_TABLES_SQL = """
-- Visitor Type Configuration
CREATE TABLE IF NOT EXISTS vis_type (
    id SERIAL PRIMARY KEY,
    type_name VARCHAR(50) NOT NULL,
    access_level_id INTEGER REFERENCES acc_level(id),
    badge_template VARCHAR(100),
    induction_required BOOLEAN DEFAULT FALSE,
    default_visit_hours INTEGER DEFAULT 8,
    auto_checkout BOOLEAN DEFAULT TRUE,
    mustering_zone_id INTEGER REFERENCES mustering_zone(id),
    contractor_visitor BOOLEAN DEFAULT FALSE,
    safety_induction_required BOOLEAN DEFAULT FALSE,
    created_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Visitor Master Data
CREATE TABLE IF NOT EXISTS vis_visitor (
    id BIGSERIAL PRIMARY KEY,
    visitor_code VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    company VARCHAR(100),
    id_type SMALLINT, -- 0=NIC,1=Passport,2=License
    id_no VARCHAR(50),
    photo VARCHAR(255),
    signature VARCHAR(255),
    visitor_type_id INTEGER REFERENCES vis_type(id),
    is_blacklist BOOLEAN DEFAULT FALSE,
    blacklist_reason VARCHAR(255),
    vendor_id INTEGER REFERENCES personnel_vendor(id),
    safety_induction_done BOOLEAN DEFAULT FALSE,
    induction_doc VARCHAR(255),
    created_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Visitor Pre-Registration
CREATE TABLE IF NOT EXISTS vis_pre_registration (
    id BIGSERIAL PRIMARY KEY,
    visitor_id BIGINT REFERENCES vis_visitor(id),
    host_emp_id INTEGER NOT NULL REFERENCES personnel_employee(id),
    visit_date DATE NOT NULL,
    visit_time_start TIME,
    visit_time_end TIME,
    purpose VARCHAR(255),
    area_id INTEGER REFERENCES personnel_area(id),
    vehicle_no VARCHAR(20),
    qr_code VARCHAR(100) UNIQUE NOT NULL,
    status SMALLINT DEFAULT 0, -- 0=pending,1=approved,2=rejected,3=checked_in,4=checked_out,5=expired
    approval_time TIMESTAMP WITH TIME ZONE,
    approval_by INTEGER REFERENCES personnel_employee(id),
    approval_note VARCHAR(255),
    safety_induction_done BOOLEAN DEFAULT FALSE,
    induction_doc VARCHAR(255),
    contractor_visitor BOOLEAN DEFAULT FALSE,
    created_by INTEGER REFERENCES auth_user(id),
    created_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Visitor Visit Log
CREATE TABLE IF NOT EXISTS vis_visit_log (
    id BIGSERIAL PRIMARY KEY,
    visitor_id BIGINT NOT NULL REFERENCES vis_visitor(id),
    pre_reg_id BIGINT REFERENCES vis_pre_registration(id),
    host_emp_id INTEGER REFERENCES personnel_employee(id),
    check_in_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    check_out_time TIMESTAMP WITH TIME ZONE,
    card_no VARCHAR(20),
    device_sn VARCHAR(20) REFERENCES iclock_terminal(sn),
    badge_printed BOOLEAN DEFAULT FALSE,
    status SMALLINT DEFAULT 0, -- 0=in,1=out,2=overstay
    area_id INTEGER REFERENCES personnel_area(id),
    mustering_zone_id INTEGER REFERENCES mustering_zone(id),
    mustering_status SMALLINT, -- null,0=missing,1=safe during event
    overstay_alert_sent BOOLEAN DEFAULT FALSE,
    created_by INTEGER REFERENCES auth_user(id),
    created_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Visitor Blacklist
CREATE TABLE IF NOT EXISTS vis_blacklist (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100),
    id_no VARCHAR(50) NOT NULL UNIQUE,
    phone VARCHAR(20),
    email VARCHAR(100),
    reason VARCHAR(255) NOT NULL,
    added_by INTEGER REFERENCES auth_user(id),
    added_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vis_type_name ON vis_type(type_name);
CREATE INDEX IF NOT EXISTS idx_vis_visitor_code ON vis_visitor(visitor_code);
CREATE INDEX IF NOT EXISTS idx_vis_visitor_phone ON vis_visitor(phone);
CREATE INDEX IF NOT EXISTS idx_vis_visitor_id_no ON vis_visitor(id_no);
CREATE INDEX IF NOT EXISTS idx_vis_visitor_blacklist ON vis_visitor(is_blacklist);
CREATE INDEX IF NOT EXISTS idx_vis_pre_reg_qr ON vis_pre_registration(qr_code);
CREATE INDEX IF NOT EXISTS idx_vis_pre_reg_status_date ON vis_pre_registration(status, visit_date);
CREATE INDEX IF NOT EXISTS idx_vis_visit_log_checkin ON vis_visit_log(check_in_time);
CREATE INDEX IF NOT EXISTS idx_vis_visit_log_status ON vis_visit_log(status);
CREATE INDEX IF NOT EXISTS idx_vis_visit_log_card_no ON vis_visit_log(card_no);
CREATE INDEX IF NOT EXISTS idx_vis_blacklist_id_no ON vis_blacklist(id_no);
CREATE INDEX IF NOT EXISTS idx_vis_blacklist_phone ON vis_blacklist(phone);

-- Insert default visitor types
INSERT INTO vis_type (type_name, induction_required, default_visit_hours, auto_checkout, contractor_visitor) 
VALUES 
    ('Contractor', TRUE, 8, TRUE, TRUE),
    ('Vendor', TRUE, 4, TRUE, TRUE),
    ('Interview', FALSE, 2, TRUE, FALSE),
    ('VIP', FALSE, 4, FALSE, FALSE),
    ('Delivery', FALSE, 1, TRUE, FALSE)
ON CONFLICT DO NOTHING;

-- Insert sample blacklist entry for testing
INSERT INTO vis_blacklist (full_name, id_no, phone, email, reason, added_by)
VALUES 
    ('Test Blacklisted', 'TEST001', '+1234567890', 'blacklisted@test.com', 'Security violation', 1)
ON CONFLICT (id_no) DO NOTHING;
"""

def upgrade():
    """Create visitor management tables"""
    return VISITOR_TABLES_SQL

def downgrade():
    """Drop visitor management tables"""
    return """
    DROP TABLE IF EXISTS vis_visit_log;
    DROP TABLE IF EXISTS vis_pre_registration;
    DROP TABLE IF EXISTS vis_blacklist;
    DROP TABLE IF EXISTS vis_visitor;
    DROP TABLE IF EXISTS vis_type;
    """
