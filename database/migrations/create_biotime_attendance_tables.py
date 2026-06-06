"""
Create BioTime 9.5 Compatible Attendance Tables
Extends existing iclock_transaction with comprehensive attendance management
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sqlalchemy import text
import psycopg2
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/pob_production')

def create_attendance_tables():
    """Create all BioTime 9.5 compatible attendance tables"""
    
    try:
        # Connect to database
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        logger.info("Creating BioTime 9.5 attendance tables...")
        
        # 1. Timetable Table
        logger.info("Creating att_timetable table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS att_timetable (
                id SERIAL PRIMARY KEY,
                alias VARCHAR(50) NOT NULL,
                checkin_time TIME NOT NULL,
                checkout_time TIME NOT NULL,
                late_minutes INTEGER DEFAULT 0,
                early_minutes INTEGER DEFAULT 0,
                work_day FLOAT DEFAULT 1.0,
                color VARCHAR(7),
                break_time_start TIME,
                break_time_end TIME,
                must_checkin BOOLEAN DEFAULT true,
                must_checkout BOOLEAN DEFAULT true,
                area_id INTEGER REFERENCES personnel_area(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT true
            );
        """)
        
        # 2. Shift Table
        logger.info("Creating att_shift table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS att_shift (
                id SERIAL PRIMARY KEY,
                alias VARCHAR(50) NOT NULL,
                work_days VARCHAR(20) DEFAULT '0123456',
                cycle_unit SMALLINT DEFAULT 0,
                cycle_count INTEGER DEFAULT 1,
                roster_type SMALLINT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT true
            );
        """)
        
        # 3. Shift Timetable M2M Table
        logger.info("Creating att_shift_timetable table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS att_shift_timetable (
                id SERIAL PRIMARY KEY,
                shift_id INTEGER NOT NULL REFERENCES att_shift(id) ON DELETE CASCADE,
                day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
                timetable_id INTEGER NOT NULL REFERENCES att_timetable(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(shift_id, day_of_week)
            );
        """)
        
        # 4. Schedule Table
        logger.info("Creating att_schedule table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS att_schedule (
                id SERIAL PRIMARY KEY,
                emp_id INTEGER NOT NULL REFERENCES personnel_employee(id) ON DELETE CASCADE,
                shift_id INTEGER NOT NULL REFERENCES att_shift(id) ON DELETE CASCADE,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                area_id INTEGER REFERENCES personnel_area(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT true,
                CONSTRAINT schedule_date_check CHECK (end_date >= start_date)
            );
        """)
        
        # 5. Holiday Table
        logger.info("Creating att_holiday table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS att_holiday (
                id SERIAL PRIMARY KEY,
                holiday_name VARCHAR(50) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                holiday_type SMALLINT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT true,
                CONSTRAINT holiday_date_check CHECK (end_date >= start_date)
            );
        """)
        
        # 6. Leave Type Table
        logger.info("Creating att_leave_type table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS att_leave_type (
                id SERIAL PRIMARY KEY,
                leave_name VARCHAR(50) NOT NULL,
                unit SMALLINT DEFAULT 0,
                accrual_rule TEXT,
                affects_mustering BOOLEAN DEFAULT true,
                max_days_per_year INTEGER,
                requires_approval BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT true
            );
        """)
        
        # 7. Leave Table
        logger.info("Creating att_leave table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS att_leave (
                id SERIAL PRIMARY KEY,
                emp_id INTEGER NOT NULL REFERENCES personnel_employee(id) ON DELETE CASCADE,
                leave_type_id INTEGER REFERENCES att_leave_type(id) ON DELETE SET NULL,
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP NOT NULL,
                days FLOAT,
                reason VARCHAR(255),
                apply_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                approval_status SMALLINT DEFAULT 0,
                approver_id INTEGER REFERENCES auth_user(id),
                approved_at TIMESTAMP,
                attachment VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT leave_time_check CHECK (end_time >= start_time)
            );
        """)
        
        # 8. Overtime Rule Table
        logger.info("Creating att_overtime_rule table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS att_overtime_rule (
                id SERIAL PRIMARY KEY,
                rule_name VARCHAR(50) NOT NULL,
                ot_type SMALLINT NOT NULL,
                min_minutes INTEGER NOT NULL,
                rate FLOAT NOT NULL DEFAULT 1.0,
                area_id INTEGER REFERENCES personnel_area(id),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # 9. Overtime Table
        logger.info("Creating att_overtime table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS att_overtime (
                id SERIAL PRIMARY KEY,
                emp_id INTEGER NOT NULL REFERENCES personnel_employee(id) ON DELETE CASCADE,
                ot_date DATE NOT NULL,
                start_time TIME,
                end_time TIME,
                minutes INTEGER NOT NULL,
                reason VARCHAR(255),
                approval_status SMALLINT DEFAULT 0,
                approver_id INTEGER REFERENCES auth_user(id),
                approved_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # 10. Manual Log Table
        logger.info("Creating att_manual_log table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS att_manual_log (
                id SERIAL PRIMARY KEY,
                emp_id INTEGER NOT NULL REFERENCES personnel_employee(id) ON DELETE CASCADE,
                punch_time TIMESTAMP NOT NULL,
                punch_state SMALLINT NOT NULL,
                reason VARCHAR(255),
                attachment VARCHAR(255),
                approval_status SMALLINT DEFAULT 0,
                approver_id INTEGER REFERENCES auth_user(id),
                approved_at TIMESTAMP,
                created_by INTEGER NOT NULL REFERENCES auth_user(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # 11. Calculated Report Table (BioTime uses att_report)
        logger.info("Creating att_report table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS att_report (
                id BIGSERIAL PRIMARY KEY,
                emp_id INTEGER NOT NULL REFERENCES personnel_employee(id) ON DELETE CASCADE,
                att_date DATE NOT NULL,
                shift_id INTEGER REFERENCES att_shift(id),
                timetable_id INTEGER REFERENCES att_timetable(id),
                check_in TIMESTAMP,
                check_out TIMESTAMP,
                work_time INTEGER DEFAULT 0,
                late INTEGER DEFAULT 0,
                early INTEGER DEFAULT 0,
                absent BOOLEAN DEFAULT false,
                leave_minutes INTEGER DEFAULT 0,
                ot_minutes INTEGER DEFAULT 0,
                area_id INTEGER REFERENCES personnel_area(id),
                area_compliance BOOLEAN DEFAULT true,
                status SMALLINT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT report_unique_emp_date UNIQUE(emp_id, att_date)
            );
        """)
        
        # 12. Attendance Rules Table
        logger.info("Creating att_rules table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS att_rules (
                id SERIAL PRIMARY KEY,
                rule_key VARCHAR(50) NOT NULL UNIQUE,
                rule_value TEXT NOT NULL,
                rule_type VARCHAR(20) DEFAULT 'string',
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Create indexes for performance
        logger.info("Creating indexes...")
        
        # Schedule indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_att_schedule_emp_id ON att_schedule(emp_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_att_schedule_dates ON att_schedule(start_date, end_date);")
        
        # Report indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_att_report_emp_date ON att_report(emp_id, att_date);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_att_report_date ON att_report(att_date);")
        
        # iclock_transaction indexes (if not exists)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_iclock_emp_punch ON iclock_transaction(emp_code, punch_time);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_iclock_punch_time ON iclock_transaction(punch_time);")
        
        # Insert default attendance rules
        logger.info("Inserting default attendance rules...")
        default_rules = [
            ('grace_period', '15', 'integer', 'Grace period in minutes for check-in'),
            ('absent_after_minutes', '60', 'integer', 'Mark absent if no check-in within X minutes'),
            ('round_punches', '5', 'integer', 'Round punches to nearest X minutes'),
            ('break_deduction', 'true', 'boolean', 'Deduct break time from work hours'),
            ('ot_calculation_method', 'daily', 'string', 'OT calculation: daily/weekly/monthly'),
            ('night_shift_cross_day', 'true', 'boolean', 'Handle cross-day night shifts'),
            ('mustering_cutoff', '30', 'integer', 'Minutes before muster to mark missing'),
            ('auto_calculate', 'true', 'boolean', 'Auto-calculate attendance reports'),
            ('weekend_ot_rate', '2.0', 'float', 'Weekend overtime rate multiplier'),
            ('holiday_ot_rate', '2.5', 'float', 'Holiday overtime rate multiplier')
        ]
        
        for rule_key, rule_value, rule_type, description in default_rules:
            cursor.execute("""
                INSERT INTO att_rules (rule_key, rule_value, rule_type, description)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (rule_key) DO NOTHING
            """, (rule_key, rule_value, rule_type, description))
        
        # Insert sample data for testing
        logger.info("Inserting sample timetable...")
        cursor.execute("""
            INSERT INTO att_timetable (alias, checkin_time, checkout_time, late_minutes, early_minutes, work_day, color)
            VALUES ('Standard', '09:00:00', '18:00:00', 15, 15, 1.0, '#1890ff')
            ON CONFLICT DO NOTHING
        """)
        
        logger.info("Inserting sample shift...")
        cursor.execute("""
            INSERT INTO att_shift (alias, work_days, cycle_unit, cycle_count, roster_type)
            VALUES ('Monday-Friday', '01234', 0, 1, 0)
            ON CONFLICT DO NOTHING
        """)
        
        cursor.execute("""
            INSERT INTO att_shift_timetable (shift_id, day_of_week, timetable_id)
            SELECT s.id, d.day::SMALLINT, t.id
            FROM att_shift s, 
            (SELECT unnest(ARRAY[0,1,2,3,4]) as day) d,
            att_timetable t
            WHERE s.alias = 'Monday-Friday' AND t.alias = 'Standard'
            ON CONFLICT (shift_id, day_of_week) DO NOTHING
        """)
        
        logger.info("Inserting sample leave types...")
        leave_types = [
            ('Annual Leave', 0, 'accrual: 20 days per year', True, 20, True),
            ('Sick Leave', 0, 'accrual: 10 days per year', True, 10, True),
            ('Personal Leave', 0, 'no accrual', True, 5, True),
            ('Maternity Leave', 0, 'no accrual', False, 90, True),
            ('Unpaid Leave', 0, 'no accrual', True, 0, False)
        ]
        
        for leave_name, unit, accrual_rule, affects_mustering, max_days, requires_approval in leave_types:
            cursor.execute("""
                INSERT INTO att_leave_type (leave_name, unit, accrual_rule, affects_mustering, max_days_per_year, requires_approval)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
            """, (leave_name, unit, accrual_rule, affects_mustering, max_days, requires_approval))
        
        # Commit all changes
        conn.commit()
        
        logger.info("✅ BioTime 9.5 attendance tables created successfully!")
        
        # Print table summary
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'att_%'
            ORDER BY table_name
        """)
        
        tables = cursor.fetchall()
        logger.info(f"Created {len(tables)} attendance tables:")
        for table in tables:
            logger.info(f"  - {table[0]}")
            
    except Exception as e:
        logger.error(f"Error creating attendance tables: {e}")
        if 'conn' in locals():
            conn.rollback()
        raise
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    create_attendance_tables()
