"""
Advanced Overtime Calculation Service
Complex overtime calculation with multiple rule types
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, date, timedelta, time
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)


class OvertimeCalculationService:
    """
    Advanced overtime calculation service
    - Daily overtime calculation
    - Weekly overtime calculation
    - Holiday overtime calculation
    - Night shift differential
    - Complex overtime rules
    - Overtime approval workflow
    """
    
    def __init__(self):
        """Initialize overtime calculation service"""
    
    def calculate_daily_overtime(self, db: Session, emp_code: str, target_date: date) -> Dict[str, Any]:
        """
        Calculate daily overtime for an employee
        
        Args:
            db: Database session
            emp_code: Employee code
            target_date: Target date
            
        Returns:
            Overtime calculation result
        """
        try:
            # Get employee shift for the date
            shift_result = db.execute(text("""
                SELECT s.id, t.start_time, t.end_time, t.work_day
                FROM att_schedule sch
                JOIN att_shift s ON sch.shift_id = s.id
                JOIN att_timetable t ON s.timetable_id = t.id
                WHERE sch.emp_code = :emp_code
                AND sch.start_date <= :target_date
                AND (sch.end_date IS NULL OR sch.end_date >= :target_date)
                LIMIT 1
            """), {'emp_code': emp_code, 'target_date': target_date})
            
            shift_row = shift_result.fetchone()
            if not shift_row:
                return {'overtime_hours': 0, 'overtime_minutes': 0, 'rate': 1.0, 'reason': 'No shift assigned'}
            
            shift_id = shift_row[0]
            shift_start = shift_row[1]
            shift_end = shift_row[2]
            work_day = shift_row[3] if shift_row[3] else 1.0
            
            # Get actual work hours from attendance
            attendance_result = db.execute(text("""
                SELECT MIN(punch_time) as check_in, MAX(punch_time) as check_out
                FROM iclock_transaction
                WHERE emp_code = :emp_code
                AND DATE(punch_time) = :target_date
            """), {'emp_code': emp_code, 'target_date': target_date})
            
            attendance_row = attendance_result.fetchone()
            if not attendance_row or not attendance_row[0] or not attendance_row[1]:
                return {'overtime_hours': 0, 'overtime_minutes': 0, 'rate': 1.0, 'reason': 'No attendance records'}
            
            check_in = attendance_row[0]
            check_out = attendance_row[1]
            
            # Calculate actual work hours
            actual_work_seconds = (check_out - check_in).total_seconds()
            actual_work_hours = actual_work_seconds / 3600
            
            # Calculate expected work hours
            shift_work_seconds = (shift_end - shift_start).total_seconds()
            expected_work_hours = (shift_work_seconds / 3600) * work_day
            
            # Calculate overtime
            overtime_hours = max(0, actual_work_hours - expected_work_hours)
            overtime_minutes = int(overtime_hours * 60)
            
            # Get overtime rule for daily overtime
            rule = self._get_overtime_rule(db, 0, shift_id)  # 0 = daily
            
            if overtime_minutes >= (rule.get('min_minutes', 0) if rule else 0):
                rate = rule.get('rate', 1.5) if rule else 1.5
            else:
                rate = 1.0
                overtime_minutes = 0
                overtime_hours = 0
            
            return {
                'overtime_hours': round(overtime_hours, 2),
                'overtime_minutes': overtime_minutes,
                'rate': rate,
                'actual_work_hours': round(actual_work_hours, 2),
                'expected_work_hours': round(expected_work_hours, 2)
            }
            
        except Exception as e:
            logger.error(f"Error calculating daily overtime: {e}")
            return {'overtime_hours': 0, 'overtime_minutes': 0, 'rate': 1.0, 'error': str(e)}
    
    def calculate_weekly_overtime(self, db: Session, emp_code: str, week_start: date) -> Dict[str, Any]:
        """
        Calculate weekly overtime for an employee
        
        Args:
            db: Database session
            emp_code: Employee code
            week_start: Start of the week (Monday)
            
        Returns:
            Weekly overtime calculation result
        """
        try:
            week_end = week_start + timedelta(days=6)
            
            # Get total work hours for the week
            result = db.execute(text("""
                SELECT SUM(EXTRACT(EPOCH FROM (MAX(punch_time) - MIN(punch_time)))/3600) as total_hours
                FROM iclock_transaction
                WHERE emp_code = :emp_code
                AND DATE(punch_time) BETWEEN :week_start AND :week_end
                GROUP BY DATE(punch_time)
            """), {'emp_code': emp_code, 'week_start': week_start, 'week_end': week_end})
            
            total_hours = 0
            for row in result:
                if row[0]:
                    total_hours += row[0]
            
            # Standard work week is typically 40 hours
            standard_week_hours = 40
            overtime_hours = max(0, total_hours - standard_week_hours)
            overtime_minutes = int(overtime_hours * 60)
            
            # Get overtime rule for weekly overtime
            rule = self._get_overtime_rule(db, 1)  # 1 = weekly
            
            if overtime_minutes >= (rule.get('min_minutes', 0) if rule else 0):
                rate = rule.get('rate', 1.5) if rule else 1.5
            else:
                rate = 1.0
                overtime_minutes = 0
                overtime_hours = 0
            
            return {
                'week_start': week_start.isoformat(),
                'week_end': week_end.isoformat(),
                'total_hours': round(total_hours, 2),
                'standard_hours': standard_week_hours,
                'overtime_hours': round(overtime_hours, 2),
                'overtime_minutes': overtime_minutes,
                'rate': rate
            }
            
        except Exception as e:
            logger.error(f"Error calculating weekly overtime: {e}")
            return {'overtime_hours': 0, 'overtime_minutes': 0, 'rate': 1.0, 'error': str(e)}
    
    def calculate_holiday_overtime(self, db: Session, emp_code: str, target_date: date) -> Dict[str, Any]:
        """
        Calculate holiday overtime for an employee
        
        Args:
            db: Database session
            emp_code: Employee code
            target_date: Target date
            
        Returns:
            Holiday overtime calculation result
        """
        try:
            # Check if date is a holiday
            from .holiday_service import holiday_service
            is_holiday = holiday_service.is_holiday(db, target_date)
            
            if not is_holiday:
                return {'overtime_hours': 0, 'overtime_minutes': 0, 'rate': 1.0, 'reason': 'Not a holiday'}
            
            # Get work hours on holiday
            result = db.execute(text("""
                SELECT MIN(punch_time) as check_in, MAX(punch_time) as check_out
                FROM iclock_transaction
                WHERE emp_code = :emp_code
                AND DATE(punch_time) = :target_date
            """), {'emp_code': emp_code, 'target_date': target_date})
            
            row = result.fetchone()
            if not row or not row[0] or not row[1]:
                return {'overtime_hours': 0, 'overtime_minutes': 0, 'rate': 1.0, 'reason': 'No attendance records'}
            
            check_in = row[0]
            check_out = row[1]
            
            # All hours worked on holiday are overtime
            work_seconds = (check_out - check_in).total_seconds()
            work_hours = work_seconds / 3600
            overtime_minutes = int(work_hours * 60)
            
            # Get overtime rule for holiday overtime
            rule = self._get_overtime_rule(db, 2)  # 2 = holiday
            
            rate = rule.get('rate', 2.0) if rule else 2.0  # Holiday overtime typically 2x
            
            return {
                'overtime_hours': round(work_hours, 2),
                'overtime_minutes': overtime_minutes,
                'rate': rate,
                'is_holiday': True
            }
            
        except Exception as e:
            logger.error(f"Error calculating holiday overtime: {e}")
            return {'overtime_hours': 0, 'overtime_minutes': 0, 'rate': 1.0, 'error': str(e)}
    
    def calculate_night_shift_differential(self, db: Session, emp_code: str, target_date: date) -> Dict[str, Any]:
        """
        Calculate night shift differential
        
        Args:
            db: Database session
            emp_code: Employee code
            target_date: Target date
            
        Returns:
            Night shift differential calculation
        """
        try:
            # Night shift typically defined as hours between 10 PM and 6 AM
            night_start = time(22, 0)  # 10 PM
            night_end = time(6, 0)     # 6 AM
            
            # Get attendance records
            result = db.execute(text("""
                SELECT punch_time, punch_state
                FROM iclock_transaction
                WHERE emp_code = :emp_code
                AND DATE(punch_time) = :target_date
                ORDER BY punch_time
            """), {'emp_code': emp_code, 'target_date': target_date})
            
            records = result.fetchall()
            if len(records) < 2:
                return {'night_hours': 0, 'differential_rate': 1.0, 'reason': 'Insufficient records'}
            
            check_in = records[0][0]
            check_out = records[-1][0]
            
            # Calculate night hours worked
            night_hours = 0
            
            # If check-in is before midnight and check-out is after midnight
            if check_in.time() >= night_start or check_out.time() <= night_end:
                # Simplified calculation - in production, calculate exact night hours
                night_hours = 8  # Assume 8 hours of night work for full night shift
            
            # Night shift differential rate
            differential_rate = 1.1  # 10% differential
            
            return {
                'night_hours': night_hours,
                'differential_rate': differential_rate,
                'check_in': check_in.isoformat(),
                'check_out': check_out.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error calculating night shift differential: {e}")
            return {'night_hours': 0, 'differential_rate': 1.0, 'error': str(e)}
    
    def _get_overtime_rule(self, db: Session, rule_type: int, shift_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """
        Get overtime rule for a specific type
        
        Args:
            db: Database session
            rule_type: Rule type (0=daily, 1=weekly, 2=holiday, 3=night_shift)
            shift_id: Optional shift ID for shift-specific rules
            
        Returns:
            Rule dictionary or None
        """
        try:
            query = """
                SELECT id, rule_name, rule_type, min_minutes, rate, 
                       max_hours_per_day, max_hours_per_week
                FROM overtime_rule
                WHERE rule_type = :rule_type
                AND is_active = TRUE
            """
            
            params = {'rule_type': rule_type}
            
            if shift_id:
                query += " AND (shift_id IS NULL OR shift_id = :shift_id)"
                params['shift_id'] = shift_id
            
            query += " ORDER BY shift_id DESC NULLS LAST LIMIT 1"
            
            result = db.execute(text(query), params)
            row = result.fetchone()
            
            if row:
                return {
                    'id': row[0],
                    'rule_name': row[1],
                    'rule_type': row[2],
                    'min_minutes': row[3],
                    'rate': row[4],
                    'max_hours_per_day': row[5],
                    'max_hours_per_week': row[6]
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting overtime rule: {e}")
            return None
    
    def create_overtime_record(self, db: Session, overtime_data: Dict[str, Any]) -> Optional[int]:
        """
        Create overtime record
        
        Args:
            db: Database session
            overtime_data: Overtime data dictionary
            
        Returns:
            Record ID or None
        """
        try:
            result = db.execute(text("""
                INSERT INTO overtime_record (
                    emp_code, overtime_date, overtime_rule_id, start_time, end_time,
                    total_minutes, rate, overtime_amount, status, notes, created_at, updated_at
                )
                VALUES (
                    :emp_code, :overtime_date, :overtime_rule_id, :start_time, :end_time,
                    :total_minutes, :rate, :overtime_amount, :status, :notes, :created_at, :updated_at
                )
                RETURNING id
            """), {
                'emp_code': overtime_data['emp_code'],
                'overtime_date': overtime_data['overtime_date'],
                'overtime_rule_id': overtime_data.get('overtime_rule_id'),
                'start_time': overtime_data.get('start_time'),
                'end_time': overtime_data.get('end_time'),
                'total_minutes': overtime_data['total_minutes'],
                'rate': overtime_data['rate'],
                'overtime_amount': overtime_data.get('overtime_amount'),
                'status': overtime_data.get('status', 0),
                'notes': overtime_data.get('notes'),
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            })
            
            record_id = result.fetchone()[0]
            db.commit()
            
            logger.info(f"Created overtime record {record_id}")
            return record_id
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating overtime record: {e}")
            return None
    
    def approve_overtime(self, db: Session, record_id: int, approved_by: int) -> bool:
        """
        Approve overtime record
        
        Args:
            db: Database session
            record_id: Overtime record ID
            approved_by: User ID who approved
            
        Returns:
            True if successful
        """
        try:
            db.execute(text("""
                UPDATE overtime_record
                SET status = 1,
                    approved_by = :approved_by,
                    approved_time = :approved_time,
                    updated_at = :updated_at
                WHERE id = :record_id
            """), {
                'record_id': record_id,
                'approved_by': approved_by,
                'approved_time': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            })
            
            db.commit()
            logger.info(f"Approved overtime record {record_id}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error approving overtime: {e}")
            return False
    
    def get_employee_overtime_summary(self, db: Session, emp_code: str, start_date: date, end_date: date) -> Dict[str, Any]:
        """
        Get overtime summary for an employee in date range
        
        Args:
            db: Database session
            emp_code: Employee code
            start_date: Start date
            end_date: End date
            
        Returns:
            Overtime summary dictionary
        """
        try:
            result = db.execute(text("""
                SELECT 
                    COUNT(*) as total_records,
                    SUM(total_minutes) as total_minutes,
                    AVG(rate) as avg_rate,
                    SUM(CASE WHEN status = 1 THEN total_minutes ELSE 0 END) as approved_minutes,
                    SUM(CASE WHEN status = 0 THEN total_minutes ELSE 0 END) as pending_minutes
                FROM overtime_record
                WHERE emp_code = :emp_code
                AND overtime_date BETWEEN :start_date AND :end_date
            """), {'emp_code': emp_code, 'start_date': start_date, 'end_date': end_date})
            
            row = result.fetchone()
            
            total_minutes = row[1] if row[1] else 0
            total_hours = total_minutes / 60
            approved_minutes = row[3] if row[3] else 0
            pending_minutes = row[4] if row[4] else 0
            
            return {
                'total_records': row[0] if row[0] else 0,
                'total_minutes': total_minutes,
                'total_hours': round(total_hours, 2),
                'avg_rate': round(row[2], 2) if row[2] else 0,
                'approved_minutes': approved_minutes,
                'approved_hours': round(approved_minutes / 60, 2),
                'pending_minutes': pending_minutes,
                'pending_hours': round(pending_minutes / 60, 2)
            }
            
        except Exception as e:
            logger.error(f"Error getting overtime summary: {e}")
            return {}


# Global overtime calculation service instance
overtime_calculation_service = OvertimeCalculationService()
