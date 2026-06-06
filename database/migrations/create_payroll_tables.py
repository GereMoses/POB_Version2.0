"""
Create BioTime 9.5 Payroll Tables with POB Extensions
Complete payroll system with salary structures, calculations, and reporting
"""

import sys
import os

# Add backend path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

from sqlalchemy import create_engine, text
from app.core.config import settings

def create_payroll_tables():
    """Create all payroll tables with BioTime 9.5 compatibility + POB extensions"""
    
    engine = create_engine(settings.DATABASE_URL)
    
    # Core BioTime Payroll Tables
    payroll_sql = """
    -- BioTime Payroll Core Tables
    
    -- Salary Structure Definition
    CREATE TABLE IF NOT EXISTS pay_structure (
        id SERIAL PRIMARY KEY,
        structure_name VARCHAR(100) NOT NULL,
        structure_type SMALLINT DEFAULT 0, -- 0=monthly,1=daily,2=hourly
        is_active BOOLEAN DEFAULT true,
        version INTEGER DEFAULT 1,
        effective_date DATE,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by INTEGER REFERENCES users(id)
    );

    -- Pay Structure Items (Earnings, Deductions, Attendance-based)
    CREATE TABLE IF NOT EXISTS pay_item (
        id SERIAL PRIMARY KEY,
        structure_id INTEGER NOT NULL REFERENCES pay_structure(id) ON DELETE CASCADE,
        item_name VARCHAR(50) NOT NULL, -- Basic, HRA, OT, LateDeduction, Tax, PF
        item_type SMALLINT NOT NULL, -- 0=earning,1=deduction,2=attendance
        calc_type SMALLINT DEFAULT 0, -- 0=fixed,1=formula,2=attendance
        amount NUMERIC(10,2), -- if fixed amount
        formula TEXT, -- if formula: "Basic * 0.4"
        attendance_field VARCHAR(50), -- if attendance: "work_time","ot_minutes","late_minutes"
        rate NUMERIC(10,4), -- for attendance type calculations
        sequence INTEGER DEFAULT 0, -- display order in payslip
        is_taxable BOOLEAN DEFAULT false,
        is_print BOOLEAN DEFAULT true,
        is_mandatory BOOLEAN DEFAULT false,
        gl_account VARCHAR(50), -- General ledger account
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Structure Assignment (Employee/Department/Position)
    CREATE TABLE IF NOT EXISTS pay_structure_assign (
        id SERIAL PRIMARY KEY,
        structure_id INTEGER NOT NULL REFERENCES pay_structure(id) ON DELETE CASCADE,
        assign_type SMALLINT NOT NULL, -- 0=employee,1=department,2=position
        assign_id INTEGER NOT NULL, -- emp_id or dept_id or position_id
        priority INTEGER DEFAULT 0, -- higher priority wins conflicts
        effective_date DATE,
        end_date DATE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Salary Period Management
    CREATE TABLE IF NOT EXISTS pay_period (
        id SERIAL PRIMARY KEY,
        period_name VARCHAR(50) NOT NULL, -- "Jan 2026", "Feb 2026"
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        pay_date DATE,
        status SMALLINT DEFAULT 0, -- 0=open,1=calculating,2=closed,3=cancelled
        is_att_locked BOOLEAN DEFAULT false, -- Locks attendance for this period
        description TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        closed_at TIMESTAMP WITH TIME ZONE,
        closed_by INTEGER REFERENCES users(id),
        CONSTRAINT check_dates CHECK (end_date >= start_date),
        CONSTRAINT unique_period_name UNIQUE (period_name)
    );

    -- Calculated Salary Records
    CREATE TABLE IF NOT EXISTS pay_salary (
        id BIGSERIAL PRIMARY KEY,
        period_id INTEGER NOT NULL REFERENCES pay_period(id) ON DELETE CASCADE,
        emp_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
        structure_id INTEGER REFERENCES pay_structure(id),
        
        -- Input Values from Attendance
        basic_salary NUMERIC(10,2),
        work_days NUMERIC(5,2) DEFAULT 0,
        present_days NUMERIC(5,2) DEFAULT 0,
        ot_hours NUMERIC(5,2) DEFAULT 0,
        late_minutes INTEGER DEFAULT 0,
        leave_days NUMERIC(5,2) DEFAULT 0,
        absent_days NUMERIC(5,2) DEFAULT 0,
        
        -- Calculated Totals
        gross_salary NUMERIC(10,2) DEFAULT 0,
        total_earnings NUMERIC(10,2) DEFAULT 0,
        total_deductions NUMERIC(10,2) DEFAULT 0,
        net_salary NUMERIC(10,2) DEFAULT 0,
        
        -- Status and Tracking
        is_final BOOLEAN DEFAULT false,
        calc_status SMALLINT DEFAULT 0, -- 0=pending,1=calculated,2=verified,3=approved
        calc_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        calc_by INTEGER REFERENCES users(id),
        verified_by INTEGER REFERENCES users(id),
        verified_at TIMESTAMP WITH TIME ZONE,
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP WITH TIME ZONE,
        
        -- POB Extensions
        zone_hours NUMERIC(5,2) DEFAULT 0,
        night_hours NUMERIC(5,2) DEFAULT 0,
        hazard_days NUMERIC(5,2) DEFAULT 0,
        contractor_flag BOOLEAN DEFAULT false,
        
        CONSTRAINT unique_period_emp UNIQUE (period_id, emp_id)
    );

    -- Salary Item Breakdown (for audit trail)
    CREATE TABLE IF NOT EXISTS pay_salary_item (
        id BIGSERIAL PRIMARY KEY,
        salary_id BIGINT NOT NULL REFERENCES pay_salary(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES pay_item(id),
        item_name VARCHAR(50) NOT NULL,
        item_value NUMERIC(10,2) DEFAULT 0,
        item_type SMALLINT NOT NULL, -- 0=earning,1=deduction
        formula_used TEXT,
        source_value NUMERIC(10,2), -- raw value from attendance
        calculation_order INTEGER DEFAULT 0,
        is_manual_adjustment BOOLEAN DEFAULT false,
        adjustment_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Loans and Advances Management
    CREATE TABLE IF NOT EXISTS pay_loan (
        id SERIAL PRIMARY KEY,
        emp_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
        loan_type VARCHAR(50) DEFAULT 'PERSONAL', -- PERSONAL, ADVANCE, EMERGENCY
        loan_amount NUMERIC(10,2) NOT NULL,
        emi_amount NUMERIC(10,2) NOT NULL,
        interest_rate NUMERIC(5,2) DEFAULT 0,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        balance NUMERIC(10,2) NOT NULL,
        status SMALLINT DEFAULT 0, -- 0=pending,1=active,2=completed,3=cancelled
        reason VARCHAR(255),
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT check_loan_dates CHECK (end_date >= start_date)
    );

    -- Loan EMI Deduction Tracking
    CREATE TABLE IF NOT EXISTS pay_loan_deduction (
        id SERIAL PRIMARY KEY,
        loan_id INTEGER NOT NULL REFERENCES pay_loan(id) ON DELETE CASCADE,
        salary_id BIGINT REFERENCES pay_salary(id) ON DELETE CASCADE,
        period_id INTEGER REFERENCES pay_period(id),
        emp_id INTEGER NOT NULL REFERENCES personnel(id),
        emi_amount NUMERIC(10,2) NOT NULL,
        principal_amount NUMERIC(10,2) DEFAULT 0,
        interest_amount NUMERIC(10,2) DEFAULT 0,
        balance_before NUMERIC(10,2),
        balance_after NUMERIC(10,2),
        deduction_date DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- POB Extension: Zone Allowance Configuration
    CREATE TABLE IF NOT EXISTS pay_zone_allowance (
        id SERIAL PRIMARY KEY,
        structure_id INTEGER NOT NULL REFERENCES pay_structure(id) ON DELETE CASCADE,
        area_id INTEGER REFERENCES zones(id),
        zone_name VARCHAR(100),
        allowance_type SMALLINT DEFAULT 0, -- 0=hourly,1=daily,2=fixed
        amount NUMERIC(10,2) NOT NULL,
        is_hazard BOOLEAN DEFAULT false,
        hazard_rate NUMERIC(5,2) DEFAULT 0, -- additional % for hazard zones
        effective_date DATE,
        end_date DATE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- POB Extension: Contractor Rate Configuration
    CREATE TABLE IF NOT EXISTS pay_contractor_rate (
        id SERIAL PRIMARY KEY,
        vendor_id INTEGER REFERENCES vendor_contractor(id),
        position_id INTEGER REFERENCES positions(id),
        position_name VARCHAR(100),
        hourly_rate NUMERIC(10,2),
        daily_rate NUMERIC(10,2),
        weekly_rate NUMERIC(10,2),
        monthly_rate NUMERIC(10,2),
        ot_rate NUMERIC(10,2) DEFAULT 1.5, -- OT multiplier
        night_shift_rate NUMERIC(10,2) DEFAULT 1.25,
        holiday_rate NUMERIC(10,2) DEFAULT 2.0,
        is_active BOOLEAN DEFAULT true,
        effective_date DATE,
        end_date DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Attendance to Payroll Field Mapping
    CREATE TABLE IF NOT EXISTS pay_attendance_mapping (
        id SERIAL PRIMARY KEY,
        attendance_field VARCHAR(50) NOT NULL, -- work_time, ot_minutes, late_minutes
        payroll_item_name VARCHAR(50) NOT NULL, -- Basic, OT, LateDeduction
        rate NUMERIC(10,4) DEFAULT 1.0,
        is_active BOOLEAN DEFAULT true,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Payslip Template Configuration
    CREATE TABLE IF NOT EXISTS pay_payslip_template (
        id SERIAL PRIMARY KEY,
        template_name VARCHAR(100) NOT NULL,
        template_type VARCHAR(20) DEFAULT 'STANDARD', -- STANDARD, DETAILED, CONTRACTOR
        header_html TEXT,
        body_html TEXT,
        footer_html TEXT,
        css_style TEXT,
        is_default BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Bank Sheet Export Configuration
    CREATE TABLE IF NOT EXISTS pay_bank_config (
        id SERIAL PRIMARY KEY,
        bank_name VARCHAR(100) NOT NULL,
        bank_code VARCHAR(20) NOT NULL,
        export_format VARCHAR(10) DEFAULT 'CSV', -- CSV, XLSX, TXT
        file_template TEXT, -- Column mapping and format
        header_rows INTEGER DEFAULT 1,
        footer_rows INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Payroll Calculation Log
    CREATE TABLE IF NOT EXISTS pay_calculation_log (
        id BIGSERIAL PRIMARY KEY,
        period_id INTEGER REFERENCES pay_period(id),
        emp_id INTEGER REFERENCES personnel(id),
        calculation_type VARCHAR(50), -- SALARY, ADJUSTMENT, RECALCULATION
        start_time TIMESTAMP WITH TIME ZONE,
        end_time TIMESTAMP WITH TIME ZONE,
        status VARCHAR(20), -- STARTED, COMPLETED, FAILED
        input_data JSONB,
        result_data JSONB,
        error_message TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Payroll Audit Trail
    CREATE TABLE IF NOT EXISTS pay_audit_log (
        id BIGSERIAL PRIMARY KEY,
        table_name VARCHAR(50) NOT NULL,
        record_id INTEGER NOT NULL,
        action_type VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
        old_values JSONB,
        new_values JSONB,
        changed_fields TEXT[],
        user_id INTEGER REFERENCES users(id),
        ip_address INET,
        user_agent TEXT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Indexes for Performance
    CREATE INDEX IF NOT EXISTS idx_pay_structure_active ON pay_structure(is_active);
    CREATE INDEX IF NOT EXISTS idx_pay_item_structure ON pay_item(structure_id, sequence);
    CREATE INDEX IF NOT EXISTS idx_pay_structure_assign ON pay_structure_assign(assign_type, assign_id, is_active);
    CREATE INDEX IF NOT EXISTS idx_pay_period_status ON pay_period(status, end_date);
    CREATE INDEX IF NOT EXISTS idx_pay_salary_lookup ON pay_salary(period_id, emp_id);
    CREATE INDEX IF NOT EXISTS idx_pay_salary_items ON pay_salary_item(salary_id);
    CREATE INDEX IF NOT EXISTS idx_pay_loan_emp ON pay_loan(emp_id, status);
    CREATE INDEX IF NOT EXISTS idx_pay_zone_allowance ON pay_zone_allowance(structure_id, area_id);
    CREATE INDEX IF NOT EXISTS idx_pay_contractor_rate ON pay_contractor_rate(vendor_id, position_id);
    CREATE INDEX IF NOT EXISTS idx_pay_calculation_log ON pay_calculation_log(period_id, emp_id);
    CREATE INDEX IF NOT EXISTS idx_pay_audit_log ON pay_audit_log(table_name, record_id, timestamp);
    
    -- Insert default attendance mapping
    INSERT INTO pay_attendance_mapping (attendance_field, payroll_item_name, rate, description) VALUES
    ('work_time', 'Basic', 1.0, 'Basic salary from work hours'),
    ('ot_minutes', 'OT', 1.5, 'Overtime at 1.5x rate'),
    ('late_minutes', 'LateDeduction', -2.0, 'Late deduction per minute'),
    ('leave_days', 'LeaveDeduction', 0.0, 'Leave without pay deduction'),
    ('absent_days', 'AbsentDeduction', 0.0, 'Absent days deduction')
    ON CONFLICT DO NOTHING;
    
    -- Insert default payslip template
    INSERT INTO pay_payslip_template (template_name, template_type, header_html, body_html, footer_html, is_default) VALUES
    ('Standard Payslip', 'STANDARD', 
     '<div style="text-align:center; margin-bottom:20px;"><h1>Salary Payslip</h1></div>',
     '<div><table>{{#items}}<tr><td>{{item_name}}</td><td>{{item_value}}</td></tr>{{/items}}</table></div>',
     '<div style="margin-top:20px; text-align:center;"><small>Generated by POB System</small></div>',
     true)
    ON CONFLICT DO NOTHING;
    
    -- Insert sample bank configuration
    INSERT INTO pay_bank_config (bank_name, bank_code, export_format, file_template) VALUES
    ('Standard Bank', 'STD', 'CSV', 'Emp Code,Name,Account No,Bank,Net Pay\n{{emp_code}},{{emp_name}},{{account_no}},{{bank_name}},{{net_pay}}')
    ON CONFLICT DO NOTHING;
    """
    
    # Execute the SQL
    with engine.connect() as conn:
        conn.execute(text(payroll_sql))
        conn.commit()
    
    print("✅ BioTime 9.5 Payroll tables created successfully with POB extensions")

if __name__ == "__main__":
    create_payroll_tables()
