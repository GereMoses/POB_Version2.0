"""
Report Builder Service
Custom report builder for generating various reports
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text
import json

logger = logging.getLogger(__name__)


class ReportBuilderService:
    """
    Custom report builder service
    - Create custom report templates
    - Generate reports from templates
    - Schedule automatic report generation
    - Export reports in various formats
    """
    
    def __init__(self):
        """Initialize report builder service"""
    
    def create_report_template(self, db: Session, template_data: Dict[str, Any]) -> Optional[int]:
        """
        Create custom report template
        
        Args:
            db: Database session
            template_data: Template data dictionary
            
        Returns:
            Template ID or None
        """
        try:
            result = db.execute(text("""
                INSERT INTO report_template (
                    name, description, report_type, query, parameters,
                    columns, created_by, created_at, updated_at
                )
                VALUES (
                    :name, :description, :report_type, :query, :parameters,
                    :columns, :created_by, :created_at, :updated_at
                )
                RETURNING id
            """), {
                'name': template_data['name'],
                'description': template_data.get('description', ''),
                'report_type': template_data['report_type'],
                'query': template_data['query'],
                'parameters': json.dumps(template_data.get('parameters', {})),
                'columns': json.dumps(template_data.get('columns', [])),
                'created_by': template_data.get('created_by'),
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            })
            
            template_id = result.fetchone()[0]
            db.commit()
            
            logger.info(f"Created report template {template_data['name']} with ID {template_id}")
            return template_id
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating report template: {e}")
            return None
    
    def generate_report(self, db: Session, template_id: int, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate report from template
        
        Args:
            db: Database session
            template_id: Template ID
            parameters: Report parameters
            
        Returns:
            Generated report data
        """
        try:
            # Get template
            result = db.execute(text("""
                SELECT name, description, report_type, query, columns
                FROM report_template
                WHERE id = :template_id
            """), {'template_id': template_id})
            
            row = result.fetchone()
            if not row:
                return {'error': 'Template not found'}
            
            query = row[3]
            columns = json.loads(row[4]) if row[4] else []
            
            # Replace parameters in query
            for key, value in parameters.items():
                query = query.replace(f':{key}', f"'{value}'")
            
            # Execute query
            result = db.execute(text(query))
            
            # Build report data
            report_data = {
                'template_name': row[0],
                'description': row[1],
                'report_type': row[2],
                'columns': columns,
                'data': [],
                'generated_at': datetime.utcnow().isoformat()
            }
            
            for row in result:
                report_data['data'].append(dict(row._mapping))
            
            return report_data
            
        except Exception as e:
            logger.error(f"Error generating report: {e}")
            return {'error': str(e)}
    
    def schedule_report(self, db: Session, schedule_data: Dict[str, Any]) -> Optional[int]:
        """
        Schedule automatic report generation
        
        Args:
            db: Database session
            schedule_data: Schedule data dictionary
            
        Returns:
            Schedule ID or None
        """
        try:
            result = db.execute(text("""
                INSERT INTO report_schedule (
                    template_id, schedule_type, schedule_value,
                    recipients, parameters, is_active, created_at, updated_at
                )
                VALUES (
                    :template_id, :schedule_type, :schedule_value,
                    :recipients, :parameters, :is_active, :created_at, :updated_at
                )
                RETURNING id
            """), {
                'template_id': schedule_data['template_id'],
                'schedule_type': schedule_data['schedule_type'],  # daily, weekly, monthly
                'schedule_value': schedule_data.get('schedule_value', ''),
                'recipients': json.dumps(schedule_data.get('recipients', [])),
                'parameters': json.dumps(schedule_data.get('parameters', {})),
                'is_active': schedule_data.get('is_active', True),
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            })
            
            schedule_id = result.fetchone()[0]
            db.commit()
            
            logger.info(f"Created report schedule {schedule_id}")
            return schedule_id
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error scheduling report: {e}")
            return None
    
    def get_attendance_report(self, db: Session, start_date: date, end_date: date, 
                            department_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Generate attendance report
        
        Args:
            db: Database session
            start_date: Start date
            end_date: End date
            department_id: Optional department filter
            
        Returns:
            Attendance report data
        """
        try:
            query = """
                SELECT 
                    pe.emp_code, pe.first_name, pe.last_name,
                    pd.dept_name,
                    COUNT(DISTINCT DATE(it.punch_time)) as days_present,
                    AVG(EXTRACT(EPOCH FROM (MAX(it.punch_time) - MIN(it.punch_time)))/3600) as avg_work_hours,
                    SUM(CASE WHEN EXTRACT(EPOCH FROM (MAX(it.punch_time) - MIN(it.punch_time)))/3600 > 8 THEN 1 ELSE 0 END) as overtime_days
                FROM personnel_employee pe
                LEFT JOIN personnel_department pd ON pe.dept_id = pd.id
                LEFT JOIN iclock_transaction it ON pe.emp_code = it.emp_code
                    AND DATE(it.punch_time) BETWEEN :start_date AND :end_date
                WHERE pe.status = 0
            """
            
            params = {'start_date': start_date, 'end_date': end_date}
            
            if department_id:
                query += " AND pe.dept_id = :department_id"
                params['department_id'] = department_id
            
            query += " GROUP BY pe.emp_code, pe.first_name, pe.last_name, pd.dept_name ORDER BY pd.dept_name, pe.last_name"
            
            result = db.execute(text(query), params)
            
            report_data = []
            for row in result:
                report_data.append({
                    'emp_code': row[0],
                    'name': f"{row[1]} {row[2]}",
                    'department': row[3],
                    'days_present': row[4],
                    'avg_work_hours': round(row[5], 2) if row[5] else 0,
                    'overtime_days': row[6]
                })
            
            return {
                'report_type': 'attendance',
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'data': report_data,
                'generated_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error generating attendance report: {e}")
            return {'error': str(e)}
    
    def get_overtime_report(self, db: Session, start_date: date, end_date: date,
                           department_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Generate overtime report
        
        Args:
            db: Database session
            start_date: Start date
            end_date: End date
            department_id: Optional department filter
            
        Returns:
            Overtime report data
        """
        try:
            query = """
                SELECT 
                    pe.emp_code, pe.first_name, pe.last_name,
                    pd.dept_name,
                    SUM(or.total_minutes) as total_overtime_minutes,
                    AVG(or.rate) as avg_rate,
                    SUM(or.overtime_amount) as total_amount
                FROM overtime_record or
                JOIN personnel_employee pe ON or.emp_code = pe.emp_code
                LEFT JOIN personnel_department pd ON pe.dept_id = pd.id
                WHERE or.overtime_date BETWEEN :start_date AND :end_date
                AND or.status = 1
            """
            
            params = {'start_date': start_date, 'end_date': end_date}
            
            if department_id:
                query += " AND pe.dept_id = :department_id"
                params['department_id'] = department_id
            
            query += " GROUP BY pe.emp_code, pe.first_name, pe.last_name, pd.dept_name ORDER BY total_overtime_minutes DESC"
            
            result = db.execute(text(query), params)
            
            report_data = []
            for row in result:
                report_data.append({
                    'emp_code': row[0],
                    'name': f"{row[1]} {row[2]}",
                    'department': row[3],
                    'total_overtime_minutes': row[4],
                    'total_overtime_hours': round(row[4] / 60, 2) if row[4] else 0,
                    'avg_rate': round(row[5], 2) if row[5] else 0,
                    'total_amount': round(row[6], 2) if row[6] else 0
                })
            
            return {
                'report_type': 'overtime',
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'data': report_data,
                'generated_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error generating overtime report: {e}")
            return {'error': str(e)}
    
    def get_leave_report(self, db: Session, start_date: date, end_date: date,
                        department_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Generate leave report
        
        Args:
            db: Database session
            start_date: Start date
            end_date: End date
            department_id: Optional department filter
            
        Returns:
            Leave report data
        """
        try:
            query = """
                SELECT 
                    pe.emp_code, pe.first_name, pe.last_name,
                    pd.dept_name,
                    al.leave_type,
                    COUNT(*) as leave_count,
                    SUM(al.days_count) as total_days
                FROM att_leave al
                JOIN personnel_employee pe ON al.emp_code = pe.emp_code
                LEFT JOIN personnel_department pd ON pe.dept_id = pd.id
                WHERE al.start_date BETWEEN :start_date AND :end_date
                AND al.status = 1
            """
            
            params = {'start_date': start_date, 'end_date': end_date}
            
            if department_id:
                query += " AND pe.dept_id = :department_id"
                params['department_id'] = department_id
            
            query += " GROUP BY pe.emp_code, pe.first_name, pe.last_name, pd.dept_name, al.leave_type ORDER BY pd.dept_name, pe.last_name"
            
            result = db.execute(text(query), params)
            
            report_data = []
            for row in result:
                report_data.append({
                    'emp_code': row[0],
                    'name': f"{row[1]} {row[2]}",
                    'department': row[3],
                    'leave_type': row[4],
                    'leave_count': row[5],
                    'total_days': round(row[6], 2) if row[6] else 0
                })
            
            return {
                'report_type': 'leave',
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'data': report_data,
                'generated_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error generating leave report: {e}")
            return {'error': str(e)}


# Global report builder service instance
report_builder_service = ReportBuilderService()
