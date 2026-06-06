-- MTD (Medical, Training, Development) Module Tables
-- POB Version 2.0 - HSE Compliance Module
-- Created: 2026-05-07

-- Medical Records Table
CREATE TABLE IF NOT EXISTS mtd_medical_record (
    id BIGSERIAL PRIMARY KEY,
    person_type SMALLINT NOT NULL, -- 0=employee,1=visitor
    emp_id INTEGER REFERENCES personnel_employee(id) ON DELETE CASCADE,
    visitor_id BIGINT REFERENCES vis_visitor(id) ON DELETE CASCADE,
    blood_group VARCHAR(3),
    height_cm INTEGER,
    weight_kg NUMERIC(5,2),
    bmi NUMERIC(4,2) GENERATED ALWAYS AS (weight_kg / ((height_cm/100.0)^2)) STORED,
    medical_conditions TEXT,
    allergies TEXT,
    disabilities TEXT,
    fit_status SMALLINT DEFAULT 0, -- 0=fit,1=restricted,2=unfit
    restrictions TEXT,
    doctor_name VARCHAR(100),
    last_checkup DATE,
    next_due DATE,
    cert_path VARCHAR(255),
    updated_by INTEGER REFERENCES auth_user(id),
    updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_emp_medical UNIQUE(emp_id),
    CONSTRAINT unique_visitor_medical UNIQUE(visitor_id),
    CONSTRAINT valid_person_type CHECK (person_type IN (0, 1))
);

-- Certification Types Table
CREATE TABLE IF NOT EXISTS mtd_cert_type (
    id SERIAL PRIMARY KEY,
    cert_name VARCHAR(100) NOT NULL UNIQUE, -- H2S, BOSIET, HUET, First Aid, Fire Fighting, Forklift
    validity_days INTEGER NOT NULL, -- 365, 730, etc.
    is_critical BOOLEAN DEFAULT FALSE, -- blocks access if expired
    required_for_dept INTEGER[], -- array of dept_id
    required_for_position INTEGER[], -- array of position_id
    required_for_vendor INTEGER[], -- array of vendor_id
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Certifications Table
CREATE TABLE IF NOT EXISTS mtd_certification (
    id BIGSERIAL PRIMARY KEY,
    person_type SMALLINT NOT NULL, -- 0=employee,1=visitor
    emp_id INTEGER REFERENCES personnel_employee(id) ON DELETE CASCADE,
    visitor_id BIGINT REFERENCES vis_visitor(id) ON DELETE CASCADE,
    cert_type_id INTEGER REFERENCES mtd_cert_type(id) NOT NULL,
    cert_no VARCHAR(100),
    issuer VARCHAR(100),
    issue_date DATE NOT NULL,
    expiry_date DATE GENERATED ALWAYS AS (issue_date + (mtd_cert_type.validity_days || ' days')::INTERVAL) STORED,
    cert_path VARCHAR(255),
    status SMALLINT GENERATED ALWAYS AS (
        CASE WHEN expiry_date < CURRENT_DATE THEN 2 -- expired
             WHEN expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 1 -- expiring
             ELSE 0 END -- valid
    ) STORED,
    verified_by INTEGER REFERENCES auth_user(id),
    verified_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_cert_person_type CHECK (person_type IN (0, 1))
);

-- PPE Types Table
CREATE TABLE IF NOT EXISTS mtd_ppe_type (
    id SERIAL PRIMARY KEY,
    ppe_name VARCHAR(100) NOT NULL, -- Helmet, Coverall, Boots, H2S Monitor
    lifespan_days INTEGER,
    requires_calibration BOOLEAN DEFAULT FALSE,
    calib_interval_days INTEGER,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PPE Issue Table
CREATE TABLE IF NOT EXISTS mtd_ppe_issue (
    id BIGSERIAL PRIMARY KEY,
    emp_id INTEGER REFERENCES personnel_employee(id) ON DELETE CASCADE NOT NULL,
    ppe_type_id INTEGER REFERENCES mtd_ppe_type(id) NOT NULL,
    serial_no VARCHAR(100),
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_return_date DATE,
    return_date DATE,
    condition_out SMALLINT, -- 0=new,1=good,2=fair
    condition_in SMALLINT,
    last_calib_date DATE,
    next_calib_date DATE GENERATED ALWAYS AS (
        CASE WHEN mtd_ppe_type.requires_calibration = TRUE 
             THEN last_calib_date + (mtd_ppe_type.calib_interval_days || ' days')::INTERVAL 
             ELSE NULL END
    ) STORED,
    status SMALLINT DEFAULT 0, -- 0=issued,1=returned,2=lost,3=expired
    notes TEXT,
    issued_by INTEGER REFERENCES auth_user(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_ppe_condition CHECK (condition_out IN (0,1,2)),
    CONSTRAINT valid_ppe_condition_in CHECK (condition_in IN (0,1,2)),
    CONSTRAINT valid_ppe_status CHECK (status IN (0,1,2,3))
);

-- Induction Templates Table
CREATE TABLE IF NOT EXISTS mtd_induction_template (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(100) NOT NULL,
    video_path VARCHAR(255),
    slides_path VARCHAR(255),
    quiz_questions JSONB, -- [{q:"", a:[], correct:0}]
    passing_score INTEGER DEFAULT 80,
    validity_days INTEGER DEFAULT 365,
    required_for_type SMALLINT, -- 0=employee,1=contractor,2=visitor
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_induction_type CHECK (required_for_type IN (0,1,2))
);

-- Induction Records Table
CREATE TABLE IF NOT EXISTS mtd_induction_record (
    id BIGSERIAL PRIMARY KEY,
    person_type SMALLINT NOT NULL, -- 0=employee,1=visitor
    emp_id INTEGER REFERENCES personnel_employee(id) ON DELETE CASCADE,
    visitor_id BIGINT REFERENCES vis_visitor(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES mtd_induction_template(id) NOT NULL,
    taken_date DATE NOT NULL DEFAULT CURRENT_DATE,
    score INTEGER,
    passed BOOLEAN,
    valid_until DATE GENERATED ALWAYS AS (taken_date + (mtd_induction_template.validity_days || ' days')::INTERVAL) STORED,
    signed_doc VARCHAR(255),
    trainer_emp_id INTEGER REFERENCES personnel_employee(id),
    quiz_answers JSONB, -- Store answers for audit
    completion_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_induction_person_type CHECK (person_type IN (0, 1)),
    CONSTRAINT valid_score CHECK (score >= 0 AND score <= 100)
);

-- Compliance Log Table
CREATE TABLE IF NOT EXISTS mtd_compliance_log (
    id BIGSERIAL PRIMARY KEY,
    check_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    emp_id INTEGER REFERENCES personnel_employee(id) ON DELETE CASCADE,
    cert_type_id INTEGER REFERENCES mtd_cert_type(id) ON DELETE SET NULL,
    record_type VARCHAR(50), -- medical, certification, ppe, induction
    record_id BIGINT,
    status SMALLINT, -- 0=compliant,1=expiring,2=non-compliant
    action_taken VARCHAR(100), -- "Suspended", "Notified", "Warning"
    details TEXT,
    created_by INTEGER REFERENCES auth_user(id),
    CONSTRAINT valid_compliance_status CHECK (status IN (0,1,2))
);

-- Audit Log Table (GDPR Compliance)
CREATE TABLE IF NOT EXISTS mtd_audit_log (
    id BIGSERIAL PRIMARY KEY,
    access_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER REFERENCES auth_user(id) ON DELETE SET NULL,
    record_type VARCHAR(50), -- medical_record, certification, induction
    record_id BIGINT,
    action VARCHAR(20), -- view, edit, create, delete, export
    ip_address VARCHAR(45),
    user_agent TEXT,
    details TEXT,
    CONSTRAINT valid_audit_action CHECK (action IN ('view', 'edit', 'create', 'delete', 'export'))
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_mtd_medical_emp_id ON mtd_medical_record(emp_id);
CREATE INDEX IF NOT EXISTS idx_mtd_medical_visitor_id ON mtd_medical_record(visitor_id);
CREATE INDEX IF NOT EXISTS idx_mtd_medical_fit_status ON mtd_medical_record(fit_status);
CREATE INDEX IF NOT EXISTS idx_mtd_medical_next_due ON mtd_medical_record(next_due);

CREATE INDEX IF NOT EXISTS idx_mtd_cert_emp_id ON mtd_certification(emp_id);
CREATE INDEX IF NOT EXISTS idx_mtd_cert_visitor_id ON mtd_certification(visitor_id);
CREATE INDEX IF NOT EXISTS idx_mtd_cert_type_id ON mtd_certification(cert_type_id);
CREATE INDEX IF NOT EXISTS idx_mtd_cert_status ON mtd_certification(status);
CREATE INDEX IF NOT EXISTS idx_mtd_cert_expiry_date ON mtd_certification(expiry_date);
CREATE INDEX IF NOT EXISTS idx_mtd_cert_issue_date ON mtd_certification(issue_date);

CREATE INDEX IF NOT EXISTS idx_mtd_ppe_issue_emp_id ON mtd_ppe_issue(emp_id);
CREATE INDEX IF NOT EXISTS idx_mtd_ppe_issue_type_id ON mtd_ppe_issue(ppe_type_id);
CREATE INDEX IF NOT EXISTS idx_mtd_ppe_issue_status ON mtd_ppe_issue(status);
CREATE INDEX IF NOT EXISTS idx_mtd_ppe_issue_return_date ON mtd_ppe_issue(due_return_date);
CREATE INDEX IF NOT EXISTS idx_mtd_ppe_calib_date ON mtd_ppe_issue(next_calib_date);

CREATE INDEX IF NOT EXISTS idx_mtd_induction_emp_id ON mtd_induction_record(emp_id);
CREATE INDEX IF NOT EXISTS idx_mtd_induction_visitor_id ON mtd_induction_record(visitor_id);
CREATE INDEX IF NOT EXISTS idx_mtd_induction_template_id ON mtd_induction_record(template_id);
CREATE INDEX IF NOT EXISTS idx_mtd_induction_valid_until ON mtd_induction_record(valid_until);
CREATE INDEX IF NOT EXISTS idx_mtd_induction_passed ON mtd_induction_record(passed);

CREATE INDEX IF NOT EXISTS idx_mtd_compliance_emp_id ON mtd_compliance_log(emp_id);
CREATE INDEX IF NOT EXISTS idx_mtd_compliance_check_time ON mtd_compliance_log(check_time);
CREATE INDEX IF NOT EXISTS idx_mtd_compliance_status ON mtd_compliance_log(status);
CREATE INDEX IF NOT EXISTS idx_mtd_compliance_record_type ON mtd_compliance_log(record_type);

CREATE INDEX IF NOT EXISTS idx_mtd_audit_user_id ON mtd_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_mtd_audit_access_time ON mtd_audit_log(access_time);
CREATE INDEX IF NOT EXISTS idx_mtd_audit_record_type ON mtd_audit_log(record_type);
CREATE INDEX IF NOT EXISTS idx_mtd_audit_action ON mtd_audit_log(action);

-- Create Triggers for Automatic Updates
CREATE OR REPLACE FUNCTION update_mtd_cert_type_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_mtd_ppe_type_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_mtd_induction_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_mtd_medical_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_time = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_mtd_certification_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_mtd_ppe_issue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply Triggers
DROP TRIGGER IF EXISTS trigger_update_mtd_cert_type_timestamp ON mtd_cert_type;
CREATE TRIGGER trigger_update_mtd_cert_type_timestamp
    BEFORE UPDATE ON mtd_cert_type
    FOR EACH ROW EXECUTE FUNCTION update_mtd_cert_type_timestamp();

DROP TRIGGER IF EXISTS trigger_update_mtd_ppe_type_timestamp ON mtd_ppe_type;
CREATE TRIGGER trigger_update_mtd_ppe_type_timestamp
    BEFORE UPDATE ON mtd_ppe_type
    FOR EACH ROW EXECUTE FUNCTION update_mtd_ppe_type_timestamp();

DROP TRIGGER IF EXISTS trigger_update_mtd_induction_template_timestamp ON mtd_induction_template;
CREATE TRIGGER trigger_update_mtd_induction_template_timestamp
    BEFORE UPDATE ON mtd_induction_template
    FOR EACH ROW EXECUTE FUNCTION update_mtd_induction_template_timestamp();

DROP TRIGGER IF EXISTS trigger_update_mtd_medical_timestamp ON mtd_medical_record;
CREATE TRIGGER trigger_update_mtd_medical_timestamp
    BEFORE UPDATE ON mtd_medical_record
    FOR EACH ROW EXECUTE FUNCTION update_mtd_medical_timestamp();

DROP TRIGGER IF EXISTS trigger_update_mtd_certification_timestamp ON mtd_certification;
CREATE TRIGGER trigger_update_mtd_certification_timestamp
    BEFORE UPDATE ON mtd_certification
    FOR EACH ROW EXECUTE FUNCTION update_mtd_certification_timestamp();

DROP TRIGGER IF EXISTS trigger_update_mtd_ppe_issue_timestamp ON mtd_ppe_issue;
CREATE TRIGGER trigger_update_mtd_ppe_issue_timestamp
    BEFORE UPDATE ON mtd_ppe_issue
    FOR EACH ROW EXECUTE FUNCTION update_mtd_ppe_issue_timestamp();

-- Insert Default Data
INSERT INTO mtd_cert_type (cert_name, validity_days, is_critical, description) VALUES
('H2S Certified', 365, TRUE, 'Hydrogen Sulfide Safety Certification'),
('BOSIET', 730, TRUE, 'Basic Offshore Safety Induction and Emergency Training'),
('HUET', 730, TRUE, 'Helicopter Underwater Escape Training'),
('First Aid/CPR', 365, FALSE, 'First Aid and CPR Certification'),
('Fire Fighting', 365, TRUE, 'Fire Fighting and Safety Training'),
('Forklift Operator', 365, FALSE, 'Forklift Operation Certification'),
('Confined Space Entry', 365, TRUE, 'Confined Space Entry Safety'),
('Working at Height', 365, TRUE, 'Working at Height Safety Training')
ON CONFLICT (cert_name) DO NOTHING;

INSERT INTO mtd_ppe_type (ppe_name, lifespan_days, requires_calibration, calib_interval_days, description) VALUES
('Safety Helmet', 1095, FALSE, NULL, 'Industrial Safety Helmet'),
('Safety Coverall', 365, FALSE, NULL, 'Flame Retardant Coverall'),
('Steel Toe Boots', 730, FALSE, NULL, 'Safety Steel Toe Boots'),
('H2S Monitor', 365, TRUE, 90, 'Portable H2S Gas Monitor'),
('Safety Glasses', 365, FALSE, NULL, 'Protective Safety Glasses'),
('Safety Gloves', 180, FALSE, NULL, 'Industrial Safety Gloves'),
('Hearing Protection', 365, FALSE, NULL, 'Ear Plugs/Muffs'),
('Respirator', 365, TRUE, 180, 'Dust/Chemical Respirator')
ON CONFLICT (ppe_name) DO NOTHING;

INSERT INTO mtd_induction_template (template_name, passing_score, validity_days, required_for_type, description) VALUES
('General Safety Induction', 80, 365, 0, 'General Safety Induction for Employees'),
('Contractor Safety Induction', 80, 365, 1, 'Safety Induction for Contractors'),
('Visitor Safety Briefing', 70, 90, 2, 'Basic Safety Briefing for Visitors'),
('H2S Safety Induction', 85, 365, 0, 'H2S Specific Safety Training'),
('Emergency Response Induction', 80, 365, 0, 'Emergency Procedures Training')
ON CONFLICT (template_name) DO NOTHING;

-- Create Media Directory for File Uploads
-- Note: This should be created at the application level
-- mkdir -p /media/mtd/medical
-- mkdir -p /media/mtd/certifications  
-- mkdir -p /media/mtd/induction_docs

COMMIT;
