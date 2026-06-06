#!/usr/bin/env python3
"""
Create BioTime Stored Procedures
This script creates BioTime-compatible stored procedures for attendance calculation
"""

import sys
from sqlalchemy import create_engine, text

# Database connection
DATABASE_URL = "postgresql://pob_user:pob_password@postgres:5432/pob_system"

def create_stored_procedures():
    """Create BioTime stored procedures"""
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            print("📋 Creating BioTime stored procedures...")
            
            # Attendance calculation procedure
            conn.execute(text("""
                CREATE OR REPLACE FUNCTION calculate_attendance(emp_code_param VARCHAR, date_param DATE)
                RETURNS TABLE(
                    check_in_time TIMESTAMP WITH TIME ZONE,
                    check_out_time TIMESTAMP WITH TIME ZONE,
                    work_hours FLOAT,
                    late_minutes INTEGER,
                    early_departure INTEGER,
                    status VARCHAR(20)
                ) AS $$
                BEGIN
                    RETURN QUERY
                    SELECT 
                        MIN(punch_time) as check_in_time,
                        MAX(punch_time) as check_out_time,
                        EXTRACT(EPOCH FROM (MAX(punch_time) - MIN(punch_time)))/3600 as work_hours,
                        0 as late_minutes,
                        0 as early_departure,
                        'PRESENT' as status
                    FROM iclock_transaction
                    WHERE emp_code = emp_code_param
                    AND DATE(punch_time) = date_param
                    GROUP BY DATE(punch_time);
                END;
                $$ LANGUAGE plpgsql;
            """))
            print("✅ Created calculate_attendance procedure")
            
            # Get employee shift procedure
            conn.execute(text("""
                CREATE OR REPLACE FUNCTION get_employee_shift(emp_code_param VARCHAR, date_param DATE)
                RETURNS TABLE(
                    shift_id INTEGER,
                    shift_name VARCHAR,
                    timetable_id INTEGER,
                    start_time TIME,
                    end_time TIME
                ) AS $$
                BEGIN
                    RETURN QUERY
                    SELECT 
                        s.id as shift_id,
                        s.name as shift_name,
                        s.timetable_id,
                        t.start_time,
                        t.end_time
                    FROM att_schedule sch
                    JOIN att_shift s ON sch.shift_id = s.id
                    JOIN att_timetable t ON s.timetable_id = t.id
                    WHERE sch.emp_code = emp_code_param
                    AND date_param >= sch.start_date
                    AND (sch.end_date IS NULL OR date_param <= sch.end_date);
                END;
                $$ LANGUAGE plpgsql;
            """))
            print("✅ Created get_employee_shift procedure")
            
            # Calculate late arrival procedure
            conn.execute(text("""
                CREATE OR REPLACE FUNCTION calculate_late_arrival(check_in_time TIMESTAMP, shift_start_time TIME, grace_minutes INTEGER DEFAULT 0)
                RETURNS INTEGER AS $$
                DECLARE
                    late_mins INTEGER;
                BEGIN
                    IF check_in_time IS NULL OR shift_start_time IS NULL THEN
                        RETURN 0;
                    END IF;
                    
                    late_mins := EXTRACT(EPOCH FROM (check_in_time::time - shift_start_time))/60;
                    
                    IF late_mins > grace_minutes THEN
                        RETURN late_mins;
                    ELSE
                        RETURN 0;
                    END IF;
                END;
                $$ LANGUAGE plpgsql;
            """))
            print("✅ Created calculate_late_arrival procedure")
            
            # Calculate early departure procedure
            conn.execute(text("""
                CREATE OR REPLACE FUNCTION calculate_early_departure(check_out_time TIMESTAMP, shift_end_time TIME, grace_minutes INTEGER DEFAULT 0)
                RETURNS INTEGER AS $$
                DECLARE
                    early_mins INTEGER;
                BEGIN
                    IF check_out_time IS NULL OR shift_end_time IS NULL THEN
                        RETURN 0;
                    END IF;
                    
                    early_mins := EXTRACT(EPOCH FROM (shift_end_time - check_out_time::time))/60;
                    
                    IF early_mins > grace_minutes THEN
                        RETURN early_mins;
                    ELSE
                        RETURN 0;
                    END IF;
                END;
                $$ LANGUAGE plpgsql;
            """))
            print("✅ Created calculate_early_departure procedure")
            
            # Check if holiday procedure
            conn.execute(text("""
                CREATE OR REPLACE FUNCTION is_holiday(date_param DATE)
                RETURNS BOOLEAN AS $$
                DECLARE
                    holiday_count INTEGER;
                BEGIN
                    SELECT COUNT(*) INTO holiday_count
                    FROM holiday
                    WHERE is_active = TRUE
                    AND (
                        holiday_date = date_param
                        OR (is_repeatable = TRUE AND repeat_month = EXTRACT(MONTH FROM date_param) AND repeat_day = EXTRACT(DAY FROM date_param))
                    );
                    
                    RETURN holiday_count > 0;
                END;
                $$ LANGUAGE plpgsql;
            """))
            print("✅ Created is_holiday procedure")
            
            # Calculate overtime procedure
            conn.execute(text("""
                CREATE OR REPLACE FUNCTION calculate_overtime(emp_code_param VARCHAR, date_param DATE, shift_id INTEGER)
                RETURNS TABLE(
                    daily_overtime FLOAT,
                    daily_overtime_minutes INTEGER,
                    overtime_rate FLOAT
                ) AS $$
                DECLARE
                    work_hours FLOAT;
                    shift_hours FLOAT;
                    overtime FLOAT;
                BEGIN
                    -- Get actual work hours
                    SELECT EXTRACT(EPOCH FROM (MAX(punch_time) - MIN(punch_time)))/3600 INTO work_hours
                    FROM iclock_transaction
                    WHERE emp_code = emp_code_param
                    AND DATE(punch_time) = date_param;
                    
                    -- Get shift hours
                    SELECT EXTRACT(EPOCH FROM (end_time - start_time))/3600 INTO shift_hours
                    FROM att_timetable t
                    JOIN att_shift s ON t.id = s.timetable_id
                    WHERE s.id = shift_id;
                    
                    -- Calculate overtime
                    IF work_hours > shift_hours THEN
                        overtime := work_hours - shift_hours;
                    ELSE
                        overtime := 0;
                    END IF;
                    
                    RETURN QUERY
                    SELECT 
                        overtime as daily_overtime,
                        ROUND(overtime * 60) as daily_overtime_minutes,
                        1.5 as overtime_rate;
                END;
                $$ LANGUAGE plpgsql;
            """))
            print("✅ Created calculate_overtime procedure")
            
            # Get attendance summary procedure
            conn.execute(text("""
                CREATE OR REPLACE FUNCTION get_attendance_summary(emp_code_param VARCHAR, start_date DATE, end_date DATE)
                RETURNS TABLE(
                    date DATE,
                    check_in_time TIMESTAMP WITH TIME ZONE,
                    check_out_time TIMESTAMP WITH TIME ZONE,
                    work_hours FLOAT,
                    late_minutes INTEGER,
                    early_departure INTEGER,
                    status VARCHAR(20),
                    is_holiday BOOLEAN
                ) AS $$
                BEGIN
                    RETURN QUERY
                    SELECT 
                        DATE(t.punch_time) as date,
                        MIN(t.punch_time) as check_in_time,
                        MAX(t.punch_time) as check_out_time,
                        EXTRACT(EPOCH FROM (MAX(t.punch_time) - MIN(t.punch_time)))/3600 as work_hours,
                        0 as late_minutes,
                        0 as early_departure,
                        'PRESENT' as status,
                        is_holiday(DATE(t.punch_time)) as is_holiday
                    FROM iclock_transaction t
                    WHERE t.emp_code = emp_code_param
                    AND DATE(t.punch_time) BETWEEN start_date AND end_date
                    GROUP BY DATE(t.punch_time)
                    ORDER BY DATE(t.punch_time);
                END;
                $$ LANGUAGE plpgsql;
            """))
            print("✅ Created get_attendance_summary procedure")
            
            # Process attendance records procedure
            conn.execute(text("""
                CREATE OR REPLACE FUNCTION process_attendance_records(date_param DATE)
                RETURNS INTEGER AS $$
                DECLARE
                    processed_count INTEGER;
                BEGIN
                    -- Mark checkinout records as processed
                    UPDATE checkinout
                    SET processed = TRUE
                    WHERE DATE(check_time) = date_param
                    AND processed = FALSE;
                    
                    GET DIAGNOSTICS processed_count = ROW_COUNT;
                    
                    RETURN processed_count;
                END;
                $$ LANGUAGE plpgsql;
            """))
            print("✅ Created process_attendance_records procedure")
            
            # Get device statistics procedure
            conn.execute(text("""
                CREATE OR REPLACE FUNCTION get_device_statistics(device_sn_param VARCHAR, start_date DATE, end_date DATE)
                RETURNS TABLE(
                    total_transactions BIGINT,
                    unique_employees INTEGER,
                    first_transaction TIMESTAMP WITH TIME ZONE,
                    last_transaction TIMESTAMP WITH TIME ZONE
                ) AS $$
                BEGIN
                    RETURN QUERY
                    SELECT 
                        COUNT(*) as total_transactions,
                        COUNT(DISTINCT emp_code) as unique_employees,
                        MIN(punch_time) as first_transaction,
                        MAX(punch_time) as last_transaction
                    FROM iclock_transaction
                    WHERE terminal_sn = device_sn_param
                    AND DATE(punch_time) BETWEEN start_date AND end_date;
                END;
                $$ LANGUAGE plpgsql;
            """))
            print("✅ Created get_device_statistics procedure")
            
            trans.commit()
            print("✅ BioTime stored procedures created successfully!")
            
        except Exception as e:
            trans.rollback()
            print(f"❌ Failed to create procedures: {e}")
            sys.exit(1)

if __name__ == "__main__":
    create_stored_procedures()
