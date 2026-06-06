"""
Holiday Management Service
Holiday calendar management for attendance calculations
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)


class HolidayService:
    """
    Holiday calendar management service
    - Create holiday calendar entries
    - Support repeatable holidays (e.g., Christmas every year)
    - Check if a date is a holiday
    - Get holidays in date range
    - Manage holiday types (public, company, religious)
    """
    
    def __init__(self):
        """Initialize holiday service"""
    
    def create_holiday(self, db: Session, holiday_data: Dict[str, Any]) -> Optional[int]:
        """
        Create a holiday entry
        
        Args:
            db: Database session
            holiday_data: Holiday data dictionary
            
        Returns:
            Holiday ID or None
        """
        try:
            result = db.execute(text("""
                INSERT INTO holiday (
                    holiday_name, holiday_date, end_date, is_repeatable, 
                    repeat_month, repeat_day, holiday_type, is_active, 
                    created_at, updated_at
                )
                VALUES (
                    :holiday_name, :holiday_date, :end_date, :is_repeatable,
                    :repeat_month, :repeat_day, :holiday_type, :is_active,
                    :created_at, :updated_at
                )
                RETURNING id
            """), {
                'holiday_name': holiday_data['holiday_name'],
                'holiday_date': holiday_data['holiday_date'],
                'end_date': holiday_data.get('end_date'),
                'is_repeatable': holiday_data.get('is_repeatable', False),
                'repeat_month': holiday_data.get('repeat_month'),
                'repeat_day': holiday_data.get('repeat_day'),
                'holiday_type': holiday_data.get('holiday_type', 0),
                'is_active': holiday_data.get('is_active', True),
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            })
            
            holiday_id = result.fetchone()[0]
            db.commit()
            
            logger.info(f"Created holiday {holiday_data['holiday_name']} with ID {holiday_id}")
            return holiday_id
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating holiday: {e}")
            return None
    
    def get_holidays_between(self, db: Session, start_date: date, end_date: date) -> List[Dict[str, Any]]:
        """
        Get holidays in date range
        
        Args:
            db: Database session
            start_date: Start date
            end_date: End date
            
        Returns:
            List of holiday dictionaries
        """
        try:
            result = db.execute(text("""
                SELECT 
                    id, holiday_name, holiday_date, end_date, 
                    is_repeatable, repeat_month, repeat_day, 
                    holiday_type, is_active, created_at
                FROM holiday
                WHERE is_active = TRUE
                AND (
                    holiday_date BETWEEN :start_date AND :end_date
                    OR (
                        is_repeatable = TRUE
                        AND (
                            (repeat_month = EXTRACT(MONTH FROM :start_date) 
                             AND repeat_day BETWEEN EXTRACT(DAY FROM :start_date) AND EXTRACT(DAY FROM :end_date))
                            OR (repeat_month = EXTRACT(MONTH FROM :end_date) 
                               AND repeat_day BETWEEN EXTRACT(DAY FROM :start_date) AND EXTRACT(DAY FROM :end_date))
                            OR (repeat_month > EXTRACT(MONTH FROM :start_date) 
                               AND repeat_month < EXTRACT(MONTH FROM :end_date))
                        )
                    )
                )
                ORDER BY holiday_date
            """), {'start_date': start_date, 'end_date': end_date})
            
            holidays = []
            for row in result:
                holidays.append({
                    'id': row[0],
                    'holiday_name': row[1],
                    'holiday_date': row[2].isoformat() if row[2] else None,
                    'end_date': row[3].isoformat() if row[3] else None,
                    'is_repeatable': row[4],
                    'repeat_month': row[5],
                    'repeat_day': row[6],
                    'holiday_type': row[7],
                    'is_active': row[8],
                    'created_at': row[9].isoformat() if row[9] else None
                })
            
            return holidays
            
        except Exception as e:
            logger.error(f"Error getting holidays: {e}")
            return []
    
    def is_holiday(self, db: Session, target_date: date) -> bool:
        """
        Check if a date is a holiday
        
        Args:
            db: Database session
            target_date: Target date
            
        Returns:
            True if holiday, False otherwise
        """
        try:
            result = db.execute(text("""
                SELECT COUNT(*) FROM holiday
                WHERE is_active = TRUE
                AND (
                    holiday_date = :target_date
                    OR (
                        is_repeatable = TRUE
                        AND repeat_month = EXTRACT(MONTH FROM :target_date)
                        AND repeat_day = EXTRACT(DAY FROM :target_date)
                    )
                )
            """), {'target_date': target_date})
            
            count = result.fetchone()[0]
            return count > 0
            
        except Exception as e:
            logger.error(f"Error checking holiday: {e}")
            return False
    
    def update_holiday(self, db: Session, holiday_id: int, holiday_data: Dict[str, Any]) -> bool:
        """
        Update holiday details
        
        Args:
            db: Database session
            holiday_id: Holiday ID
            holiday_data: Updated holiday data
            
        Returns:
            True if successful
        """
        try:
            db.execute(text("""
                UPDATE holiday
                SET holiday_name = :holiday_name,
                    holiday_date = :holiday_date,
                    end_date = :end_date,
                    is_repeatable = :is_repeatable,
                    repeat_month = :repeat_month,
                    repeat_day = :repeat_day,
                    holiday_type = :holiday_type,
                    is_active = :is_active,
                    updated_at = :updated_at
                WHERE id = :holiday_id
            """), {
                'holiday_id': holiday_id,
                'holiday_name': holiday_data.get('holiday_name'),
                'holiday_date': holiday_data.get('holiday_date'),
                'end_date': holiday_data.get('end_date'),
                'is_repeatable': holiday_data.get('is_repeatable'),
                'repeat_month': holiday_data.get('repeat_month'),
                'repeat_day': holiday_data.get('repeat_day'),
                'holiday_type': holiday_data.get('holiday_type'),
                'is_active': holiday_data.get('is_active'),
                'updated_at': datetime.utcnow()
            })
            
            db.commit()
            logger.info(f"Updated holiday {holiday_id}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating holiday: {e}")
            return False
    
    def delete_holiday(self, db: Session, holiday_id: int) -> bool:
        """
        Delete holiday
        
        Args:
            db: Database session
            holiday_id: Holiday ID
            
        Returns:
            True if successful
        """
        try:
            db.execute(text("""
                DELETE FROM holiday WHERE id = :holiday_id
            """), {'holiday_id': holiday_id})
            
            db.commit()
            logger.info(f"Deleted holiday {holiday_id}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting holiday: {e}")
            return False
    
    def get_all_holidays(self, db: Session, year: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get all holidays
        
        Args:
            db: Database session
            year: Optional year filter
            
        Returns:
            List of holiday dictionaries
        """
        try:
            if year:
                result = db.execute(text("""
                    SELECT 
                        id, holiday_name, holiday_date, end_date, 
                        is_repeatable, repeat_month, repeat_day, 
                        holiday_type, is_active, created_at
                    FROM holiday
                    WHERE is_active = TRUE
                    AND (
                        EXTRACT(YEAR FROM holiday_date) = :year
                        OR is_repeatable = TRUE
                    )
                    ORDER BY holiday_date
                """), {'year': year})
            else:
                result = db.execute(text("""
                    SELECT 
                        id, holiday_name, holiday_date, end_date, 
                        is_repeatable, repeat_month, repeat_day, 
                        holiday_type, is_active, created_at
                    FROM holiday
                    WHERE is_active = TRUE
                    ORDER BY holiday_date
                """))
            
            holidays = []
            for row in result:
                holidays.append({
                    'id': row[0],
                    'holiday_name': row[1],
                    'holiday_date': row[2].isoformat() if row[2] else None,
                    'end_date': row[3].isoformat() if row[3] else None,
                    'is_repeatable': row[4],
                    'repeat_month': row[5],
                    'repeat_day': row[6],
                    'holiday_type': row[7],
                    'is_active': row[8],
                    'created_at': row[9].isoformat() if row[9] else None
                })
            
            return holidays
            
        except Exception as e:
            logger.error(f"Error getting all holidays: {e}")
            return []
    
    def create_standard_holidays(self, db: Session, year: int) -> int:
        """
        Create standard holidays for a year
        
        Args:
            db: Database session
            year: Year to create holidays for
            
        Returns:
            Number of holidays created
        """
        try:
            count = 0
            
            # New Year's Day (January 1)
            self.create_holiday(db, {
                'holiday_name': "New Year's Day",
                'holiday_date': date(year, 1, 1),
                'is_repeatable': True,
                'repeat_month': 1,
                'repeat_day': 1,
                'holiday_type': 0
            })
            count += 1
            
            # Labor Day (May 1)
            self.create_holiday(db, {
                'holiday_name': "Labor Day",
                'holiday_date': date(year, 5, 1),
                'is_repeatable': True,
                'repeat_month': 5,
                'repeat_day': 1,
                'holiday_type': 0
            })
            count += 1
            
            # Christmas Day (December 25)
            self.create_holiday(db, {
                'holiday_name': "Christmas Day",
                'holiday_date': date(year, 12, 25),
                'is_repeatable': True,
                'repeat_month': 12,
                'repeat_day': 25,
                'holiday_type': 0
            })
            count += 1
            
            # Add more standard holidays as needed based on region
            
            logger.info(f"Created {count} standard holidays for year {year}")
            return count
            
        except Exception as e:
            logger.error(f"Error creating standard holidays: {e}")
            return 0
    
    def get_holiday_count(self, db: Session, start_date: date, end_date: date) -> int:
        """
        Get count of holidays in date range
        
        Args:
            db: Database session
            start_date: Start date
            end_date: End date
            
        Returns:
            Number of holidays
        """
        try:
            holidays = self.get_holidays_between(db, start_date, end_date)
            return len(holidays)
            
        except Exception as e:
            logger.error(f"Error getting holiday count: {e}")
            return 0


# Global holiday service instance
holiday_service = HolidayService()
