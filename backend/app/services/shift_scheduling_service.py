"""
Shift Scheduling Service
Advanced shift scheduling with rotating patterns and roster management
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)


class ShiftSchedulingService:
    """
    Advanced shift scheduling service
    - Create shift rosters with rotating patterns
    - Calculate shift coverage
    - Auto-assign shifts to department personnel
    - Manage shift templates and patterns
    """
    
    def __init__(self):
        """Initialize shift scheduling service"""
    
    def create_shift(self, db: Session, shift_data: Dict[str, Any]) -> Optional[int]:
        """
        Create a new shift
        
        Args:
            db: Database session
            shift_data: Shift data dictionary
            
        Returns:
            Shift ID or None
        """
        try:
            result = db.execute(text("""
                INSERT INTO att_shift (name, timetable_id, days_of_week, created_at, updated_at)
                VALUES (:name, :timetable_id, :days_of_week, :created_at, :updated_at)
                RETURNING id
            """), {
                'name': shift_data['name'],
                'timetable_id': shift_data['timetable_id'],
                'days_of_week': shift_data.get('days_of_week', '0123456'),
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            })
            
            shift_id = result.fetchone()[0]
            db.commit()
            
            logger.info(f"Created shift {shift_data['name']} with ID {shift_id}")
            return shift_id
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating shift: {e}")
            return None
    
    def create_roster(self, db: Session, roster_data: Dict[str, Any]) -> Optional[int]:
        """
        Create a shift roster with rotating pattern
        
        Args:
            db: Database session
            roster_data: Roster data dictionary
            
        Returns:
            Roster ID or None
        """
        try:
            # Create schedule entries for each employee
            emp_codes = roster_data.get('emp_codes', [])
            shift_id = roster_data['shift_id']
            start_date = roster_data['start_date']
            end_date = roster_data.get('end_date')
            pattern = roster_data.get('pattern', 'daily')  # daily, weekly, custom
            
            schedule_count = 0
            
            for emp_code in emp_codes:
                if pattern == 'daily':
                    # Assign shift every day
                    current_date = start_date
                    while end_date is None or current_date <= end_date:
                        self._assign_shift_to_employee(db, emp_code, shift_id, current_date, current_date)
                        current_date += timedelta(days=1)
                        schedule_count += 1
                        
                elif pattern == 'weekly':
                    # Assign shift on specific days of week
                    days_of_week = roster_data.get('days_of_week', '0123456')
                    current_date = start_date
                    while end_date is None or current_date <= end_date:
                        day_of_week = str(current_date.weekday())
                        if day_of_week in days_of_week:
                            self._assign_shift_to_employee(db, emp_code, shift_id, current_date, current_date)
                            schedule_count += 1
                        current_date += timedelta(days=1)
                        
                elif pattern == 'rotating':
                    # Rotating pattern (e.g., 4 days on, 2 days off)
                    cycle_days = roster_data.get('cycle_days', 4)
                    off_days = roster_data.get('off_days', 2)
                    current_date = start_date
                    day_count = 0
                    while end_date is None or current_date <= end_date:
                        if day_count < cycle_days:
                            self._assign_shift_to_employee(db, emp_code, shift_id, current_date, current_date)
                            schedule_count += 1
                        day_count = (day_count + 1) % (cycle_days + off_days)
                        current_date += timedelta(days=1)
            
            db.commit()
            logger.info(f"Created roster with {schedule_count} schedule entries")
            return schedule_count
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating roster: {e}")
            return None
    
    def _assign_shift_to_employee(self, db: Session, emp_code: str, shift_id: int, 
                                 start_date: date, end_date: date):
        """
        Assign shift to employee for a date range
        
        Args:
            db: Database session
            emp_code: Employee code
            shift_id: Shift ID
            start_date: Start date
            end_date: End date
        """
        try:
            db.execute(text("""
                INSERT INTO att_schedule (emp_code, shift_id, start_date, end_date, created_at, updated_at)
                VALUES (:emp_code, :shift_id, :start_date, :end_date, :created_at, :updated_at)
                ON CONFLICT (emp_code, start_date) 
                DO UPDATE SET shift_id = :shift_id, end_date = :end_date, updated_at = :updated_at
            """), {
                'emp_code': emp_code,
                'shift_id': shift_id,
                'start_date': start_date,
                'end_date': end_date,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            })
            
        except Exception as e:
            logger.error(f"Error assigning shift to employee: {e}")
    
    def calculate_shift_coverage(self, db: Session, target_date: date) -> Dict[str, Any]:
        """
        Calculate shift coverage for a specific date
        
        Args:
            db: Database session
            target_date: Target date
            
        Returns:
            Coverage statistics dictionary
        """
        try:
            # Get shift assignments for the date
            result = db.execute(text("""
                SELECT 
                    s.id as shift_id,
                    s.name as shift_name,
                    t.start_time,
                    t.end_time,
                    COUNT(DISTINCT sch.emp_code) as employee_count
                FROM att_schedule sch
                JOIN att_shift s ON sch.shift_id = s.id
                JOIN att_timetable t ON s.timetable_id = t.id
                WHERE sch.start_date <= :target_date 
                AND (sch.end_date IS NULL OR sch.end_date >= :target_date)
                GROUP BY s.id, s.name, t.start_time, t.end_time
            """), {'target_date': target_date})
            
            shifts = []
            total_employees = 0
            
            for row in result:
                shift = {
                    'shift_id': row[0],
                    'shift_name': row[1],
                    'start_time': str(row[2]),
                    'end_time': str(row[3]),
                    'employee_count': row[4]
                }
                shifts.append(shift)
                total_employees += row[4]
            
            # Get total active employees
            total_result = db.execute(text("""
                SELECT COUNT(*) FROM personnel_employee WHERE status = 0
            """))
            total_active = total_result.fetchone()[0]
            
            coverage_percentage = 0
            if total_active > 0:
                coverage_percentage = round((total_employees / total_active) * 100, 2)
            
            return {
                'date': target_date.isoformat(),
                'shifts': shifts,
                'total_scheduled': total_employees,
                'total_active_employees': total_active,
                'coverage_percentage': coverage_percentage
            }
            
        except Exception as e:
            logger.error(f"Error calculating shift coverage: {e}")
            return {
                'date': target_date.isoformat(),
                'shifts': [],
                'total_scheduled': 0,
                'coverage_percentage': 0
            }
    
    def auto_assign_shifts(self, db: Session, department_id: int, shift_id: int, 
                          start_date: date, end_date: Optional[date] = None) -> int:
        """
        Automatically assign shift to all department personnel
        
        Args:
            db: Database session
            department_id: Department ID
            shift_id: Shift ID
            start_date: Start date
            end_date: End date (optional)
            
        Returns:
            Number of employees assigned
        """
        try:
            # Get all employees in department
            result = db.execute(text("""
                SELECT emp_code FROM personnel_employee 
                WHERE dept_id = :department_id AND status = 0
            """), {'department_id': department_id})
            
            emp_codes = [row[0] for row in result]
            assigned_count = 0
            
            for emp_code in emp_codes:
                self._assign_shift_to_employee(db, emp_code, shift_id, start_date, end_date)
                assigned_count += 1
            
            db.commit()
            logger.info(f"Auto-assigned shift {shift_id} to {assigned_count} employees in department {department_id}")
            return assigned_count
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error auto-assigning shifts: {e}")
            return 0
    
    def get_employee_shift(self, db: Session, emp_code: str, target_date: date) -> Optional[Dict[str, Any]]:
        """
        Get shift assigned to employee for a specific date
        
        Args:
            db: Database session
            emp_code: Employee code
            target_date: Target date
            
        Returns:
            Shift dictionary or None
        """
        try:
            result = db.execute(text("""
                SELECT 
                    s.id as shift_id,
                    s.name as shift_name,
                    t.id as timetable_id,
                    t.name as timetable_name,
                    t.start_time,
                    t.end_time,
                    t.late_grace_minutes,
                    t.early_exit_minutes
                FROM att_schedule sch
                JOIN att_shift s ON sch.shift_id = s.id
                JOIN att_timetable t ON s.timetable_id = t.id
                WHERE sch.emp_code = :emp_code
                AND sch.start_date <= :target_date
                AND (sch.end_date IS NULL OR sch.end_date >= :target_date)
                LIMIT 1
            """), {'emp_code': emp_code, 'target_date': target_date})
            
            row = result.fetchone()
            if row:
                return {
                    'shift_id': row[0],
                    'shift_name': row[1],
                    'timetable_id': row[2],
                    'timetable_name': row[3],
                    'start_time': str(row[4]),
                    'end_time': str(row[5]),
                    'late_grace_minutes': row[6],
                    'early_exit_minutes': row[7]
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting employee shift: {e}")
            return None
    
    def update_shift(self, db: Session, shift_id: int, shift_data: Dict[str, Any]) -> bool:
        """
        Update shift details
        
        Args:
            db: Database session
            shift_id: Shift ID
            shift_data: Updated shift data
            
        Returns:
            True if successful
        """
        try:
            db.execute(text("""
                UPDATE att_shift
                SET name = :name,
                    timetable_id = :timetable_id,
                    days_of_week = :days_of_week,
                    updated_at = :updated_at
                WHERE id = :shift_id
            """), {
                'shift_id': shift_id,
                'name': shift_data.get('name'),
                'timetable_id': shift_data.get('timetable_id'),
                'days_of_week': shift_data.get('days_of_week'),
                'updated_at': datetime.utcnow()
            })
            
            db.commit()
            logger.info(f"Updated shift {shift_id}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating shift: {e}")
            return False
    
    def delete_shift(self, db: Session, shift_id: int) -> bool:
        """
        Delete shift (also removes associated schedules)
        
        Args:
            db: Database session
            shift_id: Shift ID
            
        Returns:
            True if successful
        """
        try:
            # Delete associated schedules first
            db.execute(text("""
                DELETE FROM att_schedule WHERE shift_id = :shift_id
            """), {'shift_id': shift_id})
            
            # Delete shift
            db.execute(text("""
                DELETE FROM att_shift WHERE id = :shift_id
            """), {'shift_id': shift_id})
            
            db.commit()
            logger.info(f"Deleted shift {shift_id}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting shift: {e}")
            return False
    
    def get_all_shifts(self, db: Session) -> List[Dict[str, Any]]:
        """
        Get all shifts
        
        Args:
            db: Database session
            
        Returns:
            List of shift dictionaries
        """
        try:
            result = db.execute(text("""
                SELECT 
                    s.id,
                    s.name,
                    s.timetable_id,
                    t.name as timetable_name,
                    t.start_time,
                    t.end_time,
                    s.days_of_week,
                    s.created_at
                FROM att_shift s
                JOIN att_timetable t ON s.timetable_id = t.id
                ORDER BY s.name
            """))
            
            shifts = []
            for row in result:
                shifts.append({
                    'id': row[0],
                    'name': row[1],
                    'timetable_id': row[2],
                    'timetable_name': row[3],
                    'start_time': str(row[4]),
                    'end_time': str(row[5]),
                    'days_of_week': row[6],
                    'created_at': row[7].isoformat() if row[7] else None
                })
            
            return shifts
            
        except Exception as e:
            logger.error(f"Error getting shifts: {e}")
            return []


# Global shift scheduling service instance
shift_scheduling_service = ShiftSchedulingService()
