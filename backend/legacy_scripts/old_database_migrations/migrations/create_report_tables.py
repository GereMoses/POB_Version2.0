"""
Create Report Module Tables
BioTime 9.5 compatible with POB extensions
"""

from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://pob_user:pob_password@localhost:5432/pob_system")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class ReportTemplate(Base):
    """Report templates and configurations"""
    __tablename__ = 'rpt_template'
    
    id = Column(Integer, primary_key=True, index=True)
    template_name = Column(String(100), nullable=False)
    module = Column(String(50), nullable=False)  # attendance, mustering, emergency, etc.
    report_code = Column(String(100), nullable=False)  # att.monthly, muster.event
    filters = Column(JSONB)  # default filters
    columns = Column(JSONB)  # [{field:"emp_name", label:"Name", show:true, width:120}]
    group_by = Column(String(50))
    chart_type = Column(String(20), default='none')  # bar, line, pie, heatmap, none
    is_system = Column(Boolean, default=False)  # cannot delete system templates
    created_by = Column(Integer, ForeignKey('auth_user.id'))
    is_public = Column(Boolean, default=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_rpt_template_module_code', 'module', 'report_code'),
        Index('idx_rpt_template_created_by', 'created_by'),
        Index('idx_rpt_template_is_public', 'is_public'),
    )

class ReportSchedule(Base):
    """Report scheduling and automation"""
    __tablename__ = 'rpt_schedule'
    
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey('rpt_template.id'), nullable=False)
    schedule_name = Column(String(100), nullable=False)
    cron = Column(String(50), nullable=False)  # "0 8 * * 1" = Monday 8am
    format = Column(String(10), default='pdf')  # pdf, xlsx, csv
    recipients = Column(JSONB)  # {users:[1,2], emails:["a@b.com"], roles:[3]}
    last_run = Column(DateTime)
    next_run = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey('auth_user.id'))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_rpt_schedule_next_run_active', 'next_run', 'is_active'),
        Index('idx_rpt_schedule_template_id', 'template_id'),
    )

class ReportExportLog(Base):
    """Report export history and audit trail"""
    __tablename__ = 'rpt_export_log'
    
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey('rpt_template.id'))
    user_id = Column(Integer, ForeignKey('auth_user.id'))
    export_time = Column(DateTime, default=datetime.utcnow)
    format = Column(String(10))  # pdf, xlsx, csv
    filters = Column(JSONB)  # filters used for export
    row_count = Column(Integer)
    file_path = Column(String(255))  # path to exported file
    file_size = Column(Integer)  # bytes
    ip_address = Column(String(45))
    status = Column(String(20), default='completed')  # completed, failed, pending
    error_message = Column(Text)
    task_id = Column(String(100))  # Celery task ID for async exports
    
    # Indexes
    __table_args__ = (
        Index('idx_rpt_export_log_export_time', 'export_time'),
        Index('idx_rpt_export_log_user_id', 'user_id'),
        Index('idx_rpt_export_log_template_id', 'template_id'),
    )

class ReportUserPreset(Base):
    """User-specific filter and column presets"""
    __tablename__ = 'rpt_user_preset'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('auth_user.id'), nullable=False)
    template_id = Column(Integer, ForeignKey('rpt_template.id'))
    preset_name = Column(String(100), nullable=False)
    preset_type = Column(String(20), nullable=False)  # filter, column, both
    filters = Column(JSONB)
    columns = Column(JSONB)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_rpt_user_preset_user_id', 'user_id'),
        Index('idx_rpt_user_preset_template_id', 'template_id'),
    )

class ReportFavorite(Base):
    """User favorite reports"""
    __tablename__ = 'rpt_favorite'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('auth_user.id'), nullable=False)
    template_id = Column(Integer, ForeignKey('rpt_template.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_rpt_favorite_user_id', 'user_id'),
        Index('idx_rpt_favorite_template_id', 'template_id'),
        Index('idx_rpt_favorite_user_template', 'user_id', 'template_id', unique=True),
    )

def create_report_tables():
    """Create all report module tables"""
    print("Creating Report Module Tables...")
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    print("✅ Report tables created successfully")
    
    # Insert system templates
    insert_system_templates()
    
    print("✅ Report module setup completed")

def insert_system_templates():
    """Insert system report templates"""
    session = SessionLocal()
    
    try:
        # Check if templates already exist
        existing = session.query(ReportTemplate).filter(ReportTemplate.is_system == True).first()
        if existing:
            print("System templates already exist")
            return
        
        # Personnel Reports
        personnel_templates = [
            {
                'template_name': 'Employee List',
                'module': 'personnel',
                'report_code': 'personnel.employee_list',
                'description': 'Complete employee listing with details',
                'columns': [
                    {'field': 'badge_id', 'label': 'Badge ID', 'show': True, 'width': 100},
                    {'field': 'full_name', 'label': 'Full Name', 'show': True, 'width': 150},
                    {'field': 'department', 'label': 'Department', 'show': True, 'width': 120},
                    {'field': 'position', 'label': 'Position', 'show': True, 'width': 120},
                    {'field': 'email', 'label': 'Email', 'show': True, 'width': 180},
                    {'field': 'phone', 'label': 'Phone', 'show': True, 'width': 120},
                    {'field': 'personnel_type', 'label': 'Type', 'show': True, 'width': 80},
                    {'field': 'is_active', 'label': 'Active', 'show': True, 'width': 60},
                ],
                'chart_type': 'none',
                'is_system': True,
                'is_public': True
            },
            {
                'template_name': 'Department Summary',
                'module': 'personnel',
                'report_code': 'personnel.dept_summary',
                'description': 'Personnel count by department',
                'columns': [
                    {'field': 'department', 'label': 'Department', 'show': True, 'width': 150},
                    {'field': 'total_count', 'label': 'Total Count', 'show': True, 'width': 100},
                    {'field': 'active_count', 'label': 'Active Count', 'show': True, 'width': 100},
                    {'field': 'contractor_count', 'label': 'Contractor Count', 'show': True, 'width': 120},
                ],
                'group_by': 'department',
                'chart_type': 'bar',
                'is_system': True,
                'is_public': True
            },
            {
                'template_name': 'Birthday List',
                'module': 'personnel',
                'report_code': 'personnel.birthday',
                'description': 'Employee birthdays by month',
                'columns': [
                    {'field': 'full_name', 'label': 'Full Name', 'show': True, 'width': 150},
                    {'field': 'department', 'label': 'Department', 'show': True, 'width': 120},
                    {'field': 'birth_date', 'label': 'Birth Date', 'show': True, 'width': 100},
                    {'field': 'age', 'label': 'Age', 'show': True, 'width': 60},
                ],
                'group_by': 'birth_month',
                'chart_type': 'pie',
                'is_system': True,
                'is_public': True
            }
        ]
        
        # Attendance Reports
        attendance_templates = [
            {
                'template_name': 'Daily Attendance',
                'module': 'attendance',
                'report_code': 'att.daily',
                'description': 'Daily attendance report with in/out times',
                'columns': [
                    {'field': 'badge_id', 'label': 'Badge ID', 'show': True, 'width': 100},
                    {'field': 'full_name', 'label': 'Full Name', 'show': True, 'width': 150},
                    {'field': 'department', 'label': 'Department', 'show': True, 'width': 120},
                    {'field': 'check_in', 'label': 'Check In', 'show': True, 'width': 100},
                    {'field': 'check_out', 'label': 'Check Out', 'show': True, 'width': 100},
                    {'field': 'work_hours', 'label': 'Work Hours', 'show': True, 'width': 80},
                    {'field': 'status', 'label': 'Status', 'show': True, 'width': 80},
                ],
                'chart_type': 'none',
                'is_system': True,
                'is_public': True
            },
            {
                'template_name': 'Monthly Attendance Summary',
                'module': 'attendance',
                'report_code': 'att.monthly',
                'description': 'Monthly attendance summary by employee',
                'columns': [
                    {'field': 'badge_id', 'label': 'Badge ID', 'show': True, 'width': 100},
                    {'field': 'full_name', 'label': 'Full Name', 'show': True, 'width': 150},
                    {'field': 'department', 'label': 'Department', 'show': True, 'width': 120},
                    {'field': 'work_days', 'label': 'Work Days', 'show': True, 'width': 80},
                    {'field': 'present_days', 'label': 'Present', 'show': True, 'width': 80},
                    {'field': 'absent_days', 'label': 'Absent', 'show': True, 'width': 80},
                    {'field': 'late_count', 'label': 'Late', 'show': True, 'width': 60},
                    {'field': 'early_count', 'label': 'Early', 'show': True, 'width': 60},
                    {'field': 'ot_hours', 'label': 'OT Hours', 'show': True, 'width': 80},
                    {'field': 'leave_days', 'label': 'Leave', 'show': True, 'width': 80},
                ],
                'group_by': 'department',
                'chart_type': 'bar',
                'is_system': True,
                'is_public': True
            },
            {
                'template_name': 'Late Arrival Report',
                'module': 'attendance',
                'report_code': 'att.late',
                'description': 'Late arrival analysis',
                'columns': [
                    {'field': 'badge_id', 'label': 'Badge ID', 'show': True, 'width': 100},
                    {'field': 'full_name', 'label': 'Full Name', 'show': True, 'width': 150},
                    {'field': 'department', 'label': 'Department', 'show': True, 'width': 120},
                    {'field': 'date', 'label': 'Date', 'show': True, 'width': 100},
                    {'field': 'scheduled_in', 'label': 'Scheduled In', 'show': True, 'width': 100},
                    {'field': 'actual_in', 'label': 'Actual In', 'show': True, 'width': 100},
                    {'field': 'late_minutes', 'label': 'Late Minutes', 'show': True, 'width': 100},
                ],
                'chart_type': 'bar',
                'is_system': True,
                'is_public': True
            }
        ]
        
        # Mustering Reports (POB Extension)
        mustering_templates = [
            {
                'template_name': 'Mustering Event Report',
                'module': 'mustering',
                'report_code': 'muster.event',
                'description': 'POB mustering event report with compliance',
                'columns': [
                    {'field': 'event_type', 'label': 'Event Type', 'show': True, 'width': 120},
                    {'field': 'zone_name', 'label': 'Zone', 'show': True, 'width': 100},
                    {'field': 'start_time', 'label': 'Start Time', 'show': True, 'width': 120},
                    {'field': 'duration', 'label': 'Duration', 'show': True, 'width': 80},
                    {'field': 'expected_count', 'label': 'Expected', 'show': True, 'width': 80},
                    {'field': 'safe_count', 'label': 'Safe', 'show': True, 'width': 60},
                    {'field': 'missing_count', 'label': 'Missing', 'show': True, 'width': 80},
                    {'field': 'compliance_pct', 'label': 'Compliance %', 'show': True, 'width': 100},
                ],
                'chart_type': 'bar',
                'is_system': True,
                'is_public': True
            },
            {
                'template_name': 'Mustering Compliance Matrix',
                'module': 'mustering',
                'report_code': 'muster.compliance',
                'description': 'Mustering compliance by zone and time',
                'columns': [
                    {'field': 'zone_name', 'label': 'Zone', 'show': True, 'width': 120},
                    {'field': 'total_drills', 'label': 'Total Drills', 'show': True, 'width': 100},
                    {'field': 'compliant_drills', 'label': 'Compliant', 'show': True, 'width': 100},
                    {'field': 'avg_response_time', 'label': 'Avg Response', 'show': True, 'width': 120},
                    {'field': 'compliance_rate', 'label': 'Compliance Rate', 'show': True, 'width': 120},
                ],
                'chart_type': 'heatmap',
                'is_system': True,
                'is_public': True
            }
        ]
        
        # Emergency Reports (POB Extension)
        emergency_templates = [
            {
                'template_name': 'Emergency Event Log',
                'module': 'emergency',
                'report_code': 'emergency.events',
                'description': 'Emergency event audit trail',
                'columns': [
                    {'field': 'event_time', 'label': 'Event Time', 'show': True, 'width': 120},
                    {'field': 'event_type', 'label': 'Event Type', 'show': True, 'width': 120},
                    {'field': 'initiator', 'label': 'Initiator', 'show': True, 'width': 120},
                    {'field': 'action', 'label': 'Action', 'show': True, 'width': 100},
                    {'field': 'target', 'label': 'Target', 'show': True, 'width': 120},
                    {'field': 'result', 'label': 'Result', 'show': True, 'width': 100},
                    {'field': 'duration', 'label': 'Duration', 'show': True, 'width': 80},
                ],
                'chart_type': 'timeline',
                'is_system': True,
                'is_public': True
            }
        ]
        
        # Payroll Reports
        payroll_templates = [
            {
                'template_name': 'Salary Summary',
                'module': 'payroll',
                'report_code': 'pay.salary_summary',
                'description': 'Payroll salary summary by department',
                'columns': [
                    {'field': 'department', 'label': 'Department', 'show': True, 'width': 120},
                    {'field': 'employee_count', 'label': 'Employees', 'show': True, 'width': 100},
                    {'field': 'total_gross', 'label': 'Total Gross', 'show': True, 'width': 120},
                    {'field': 'total_net', 'label': 'Total Net', 'show': True, 'width': 120},
                    {'field': 'total_deductions', 'label': 'Deductions', 'show': True, 'width': 120},
                    {'field': 'average_gross', 'label': 'Avg Gross', 'show': True, 'width': 100},
                ],
                'group_by': 'department',
                'chart_type': 'bar',
                'is_system': True,
                'is_public': True
            },
            {
                'template_name': 'Zone Cost Report',
                'module': 'payroll',
                'report_code': 'pay.zone_cost',
                'description': 'POB zone cost analysis',
                'columns': [
                    {'field': 'zone_name', 'label': 'Zone', 'show': True, 'width': 120},
                    {'field': 'employee_count', 'label': 'Employees', 'show': True, 'width': 100},
                    {'field': 'total_hours', 'label': 'Total Hours', 'show': True, 'width': 100},
                    {'field': 'night_hours', 'label': 'Night Hours', 'show': True, 'width': 100},
                    {'field': 'hazard_days', 'label': 'Hazard Days', 'show': True, 'width': 100},
                    {'field': 'total_cost', 'label': 'Total Cost', 'show': True, 'width': 120},
                ],
                'chart_type': 'bar',
                'is_system': True,
                'is_public': True
            }
        ]
        
        # Visitor Reports
        visitor_templates = [
            {
                'template_name': 'Daily Visitor Log',
                'module': 'visitor',
                'report_code': 'visitor.daily_log',
                'description': 'Daily visitor check-in/out log',
                'columns': [
                    {'field': 'visitor_name', 'label': 'Visitor Name', 'show': True, 'width': 150},
                    {'field': 'company', 'label': 'Company', 'show': True, 'width': 120},
                    {'field': 'host_name', 'label': 'Host', 'show': True, 'width': 120},
                    {'field': 'check_in_time', 'label': 'Check In', 'show': True, 'width': 120},
                    {'field': 'check_out_time', 'label': 'Check Out', 'show': True, 'width': 120},
                    {'field': 'duration_hours', 'label': 'Hours on Site', 'show': True, 'width': 100},
                    {'field': 'purpose', 'label': 'Purpose', 'show': True, 'width': 120},
                    {'field': 'status', 'label': 'Status', 'show': True, 'width': 80},
                ],
                'chart_type': 'none',
                'is_system': True,
                'is_public': True
            },
            {
                'template_name': 'Visitor Overstay Report',
                'module': 'visitor',
                'report_code': 'visitor.overstay',
                'description': 'Visitors who overstayed their welcome',
                'columns': [
                    {'field': 'visitor_name', 'label': 'Visitor Name', 'show': True, 'width': 150},
                    {'field': 'company', 'label': 'Company', 'show': True, 'width': 120},
                    {'field': 'host_name', 'label': 'Host', 'show': True, 'width': 120},
                    {'field': 'check_in_time', 'label': 'Check In', 'show': True, 'width': 120},
                    {'field': 'hours_on_site', 'label': 'Hours on Site', 'show': True, 'width': 100},
                    {'field': 'overstay_hours', 'label': 'Overstay Hours', 'show': True, 'width': 120},
                    {'field': 'host_email', 'label': 'Host Email', 'show': True, 'width': 180},
                ],
                'chart_type': 'bar',
                'is_system': True,
                'is_public': True
            }
        ]
        
        # Combine all templates
        all_templates = (personnel_templates + attendance_templates + 
                         mustering_templates + emergency_templates + 
                         payroll_templates + visitor_templates)
        
        # Insert templates
        for template_data in all_templates:
            template = ReportTemplate(**template_data)
            session.add(template)
        
        session.commit()
        print(f"✅ Inserted {len(all_templates)} system report templates")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Error inserting system templates: {str(e)}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    create_report_tables()
