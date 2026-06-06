"""
System Module Database Models

This module contains SQLAlchemy models for the System module including:
- Company management
- User management with extended fields
- System parameters
- Operation logs
- Database backups
- License management
- Email/SMS templates
- API keys and webhooks
- SSO/LDAP configuration
- Language and translation support
- Branding configuration
- Audit and compliance
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON, ForeignKey, BigInteger, SmallInteger, Date, Enum
from sqlalchemy.orm import relationship
from ..core.database import Base
import enum


class CompanyType(enum.Enum):
    HOLDING = "holding"
    SUBSIDIARY = "subsidiary"
    BRANCH = "branch"


class LicenseType(enum.Enum):
    TRIAL = 0
    STANDARD = 1
    ENTERPRISE = 2


class SSOType(enum.Enum):
    LDAP = 0
    SAML = 1


class DataClassification(enum.Enum):
    NORMAL = 0
    SENSITIVE = 1
    MEDICAL = 2


class Company(Base):
    """Company information with multi-company support"""
    __tablename__ = "base_company"
    
    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(100), nullable=False, index=True)
    address = Column(Text, nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    logo = Column(String(255), nullable=True)
    website = Column(String(100), nullable=True)
    work_days = Column(String(7), default='0123456')  # 0=Sunday, 1=Monday, etc.
    timezone = Column(String(50), default='UTC')
    date_format = Column(String(20), default='YYYY-MM-DD')
    currency = Column(String(10), default='USD')
    emergency_contact = Column(JSON, nullable=True)  # POB extension
    evac_map_pdf = Column(String(255), nullable=True)  # POB extension
    parent_company_id = Column(Integer, ForeignKey("base_company.id"), nullable=True)  # POB multi-company
    company_type = Column(Enum(CompanyType), default=CompanyType.SUBSIDIARY)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    subsidiaries = relationship("Company", backref="parent", remote_side=[id])


# Extend the existing User model with additional fields
class UserExtension(Base):
    """Extension to User model for System module features"""
    __tablename__ = "user_extensions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    avatar = Column(String(255), nullable=True)  # POB
    sso_id = Column(String(100), nullable=True)  # POB
    ldap_dn = Column(String(255), nullable=True)  # POB
    api_access = Column(Boolean, default=False)  # POB
    language = Column(String(5), default='en')  # POB
    two_fa_secret = Column(String(32), nullable=True)  # POB
    two_fa_enabled = Column(Boolean, default=False)
    must_change_pass = Column(Boolean, default=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    password_changed_at = Column(DateTime(timezone=True), nullable=True)
    last_password_change = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    user = relationship("User", backref="extension")



class SystemParameter(Base):
    """System configuration parameters"""
    __tablename__ = "sys_parameters"
    
    id = Column(Integer, primary_key=True, index=True)
    param_key = Column(String(100), unique=True, nullable=False, index=True)
    param_value = Column(Text, nullable=True)
    param_type = Column(String(20), default='string')  # string, int, bool, json
    module = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    is_public = Column(Boolean, default=False)  # can FE read
    is_encrypted = Column(Boolean, default=False)  # sensitive data
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    updated_by = Column(String(100), nullable=True)


# class OperationLog(Base):
#     """Immutable operation log for audit trail"""
#     __tablename__ = "base_operationlog"
    
    #     id = Column(BigInteger, primary_key=True, index=True)
#     log_time = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
#     user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
#     username = Column(String(150), nullable=True)
#     ip_address = Column(String(45), nullable=True)
#     module = Column(String(50), nullable=False, index=True)
#     action = Column(String(50), nullable=False, index=True)
#     target = Column(String(255), nullable=True)  # "Employee EMP001"
#     result = Column(SmallInteger, default=0)  # 0=success, 1=fail
#     details = Column(JSON, nullable=True)
#     data_classification = Column(SmallInteger, default=0)  # POB: 0=normal,1=sensitive,2=medical
#     session_id = Column(String(255), nullable=True)
#     user_agent = Column(Text, nullable=True)
#     
#     # Relationships
#     user = relationship("User")


class DatabaseBackup(Base):
    """Database backup records"""
    __tablename__ = "sys_db_backups"
    
    id = Column(BigInteger, primary_key=True, index=True)
    backup_time = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    backup_type = Column(SmallInteger, default=0)  # 0=manual, 1=scheduled
    file_path = Column(String(255), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    status = Column(SmallInteger, default=0)  # 0=success, 1=fail
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    s3_key = Column(String(255), nullable=True)  # POB
    backup_method = Column(String(50), default='local')  # local, s3, azure
    encryption_enabled = Column(Boolean, default=False)
    checksum = Column(String(64), nullable=True)  # SHA-256 checksum
    retention_days = Column(Integer, default=30)
    notes = Column(Text, nullable=True)
    
    # Relationships
    creator = relationship("User")


class SystemLicense(Base):
    """System license management"""
    __tablename__ = "sys_licenses"
    
    id = Column(Integer, primary_key=True, index=True)
    license_key = Column(Text, nullable=False)
    license_type = Column(Enum(LicenseType), default=LicenseType.TRIAL)
    max_devices = Column(Integer, nullable=True)
    max_employees = Column(Integer, nullable=True)
    modules = Column(JSON, nullable=True)  # ["personnel","device","mustering"]
    issue_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    company_name = Column(String(100), nullable=True)
    signature = Column(String(512), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class EmailTemplate(Base):
    """Email templates for notifications"""
    __tablename__ = "sys_email_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    template_code = Column(String(100), unique=True, nullable=False, index=True)
    template_name = Column(String(100), nullable=False)
    subject = Column(String(255), nullable=True)
    body_html = Column(Text, nullable=True)
    body_text = Column(Text, nullable=True)
    variables = Column(JSON, nullable=True)  # ["{emp_name}","{date}"]
    language = Column(String(5), default='en')  # POB
    module = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    updated_by = Column(String(100), nullable=True)


class ApiKey(Base):
    """API key management"""
    __tablename__ = "sys_api_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    key_name = Column(String(100), nullable=False)
    api_key = Column(String(64), unique=True, nullable=False, index=True)
    secret_hash = Column(String(255), nullable=True)
    modules = Column(JSON, nullable=True)  # ["personnel","device"]
    rate_limit = Column(Integer, default=1000)  # req/hour
    ip_whitelist = Column(JSON, nullable=True)  # JSON array
    expiry_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    last_used = Column(DateTime(timezone=True), nullable=True)
    usage_count = Column(Integer, default=0)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    creator = relationship("User")


class Webhook(Base):
    """Webhook configuration"""
    __tablename__ = "sys_webhooks"
    
    id = Column(Integer, primary_key=True, index=True)
    event_code = Column(String(100), nullable=False, index=True)  # employee.created, mustering.start
    target_url = Column(String(500), nullable=False)
    secret = Column(String(100), nullable=True)  # for HMAC
    is_active = Column(Boolean, default=True)
    retry_count = Column(Integer, default=3)
    last_trigger = Column(DateTime(timezone=True), nullable=True)
    last_status = Column(Integer, nullable=True)  # HTTP status code
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    creator = relationship("User")


class SSOConfig(Base):
    """SSO/LDAP configuration"""
    __tablename__ = "sys_sso_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    sso_type = Column(Enum(SSOType), nullable=False)
    enabled = Column(Boolean, default=False)
    config = Column(JSON, nullable=True)  # host, base_dn, etc
    attr_map = Column(JSON, nullable=True)  # {email: "mail", name: "cn"}
    auto_create_user = Column(Boolean, default=True)
    default_role_id = Column(Integer, nullable=True)
    sync_schedule = Column(String(100), nullable=True)  # cron expression
    last_sync = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Language(Base):
    """Language configuration"""
    __tablename__ = "sys_languages"
    
    id = Column(Integer, primary_key=True, index=True)
    lang_code = Column(String(5), unique=True, nullable=False, index=True)  # en, fr, ar
    lang_name = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    is_rtl = Column(Boolean, default=False)  # Right-to-left
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Translation(Base):
    """Translation key-value pairs"""
    __tablename__ = "sys_translations"
    
    id = Column(BigInteger, primary_key=True, index=True)
    lang_code = Column(String(5), ForeignKey("sys_languages.lang_code"), nullable=False, index=True)
    key = Column(String(255), nullable=False, index=True)
    value = Column(Text, nullable=True)
    module = Column(String(50), nullable=True)
    is_plural = Column(Boolean, default=False)
    context = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    language = relationship("Language")


class Branding(Base):
    """System branding configuration"""
    __tablename__ = "sys_branding"
    
    id = Column(Integer, primary_key=True, index=True)
    app_name = Column(String(100), default='POB')
    logo = Column(String(255), nullable=True)
    favicon = Column(String(255), nullable=True)
    login_bg = Column(String(255), nullable=True)
    primary_color = Column(String(7), default='#1976d2')
    secondary_color = Column(String(7), default='#dc004e')
    custom_css = Column(Text, nullable=True)
    theme_mode = Column(String(20), default='light')  # light, dark, auto
    font_family = Column(String(50), default='Inter')
    company_tagline = Column(String(200), nullable=True)
    footer_text = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    updated_by = Column(String(100), nullable=True)


class DataAccessLog(Base):
    """GDPR/HIPAA compliance data access log"""
    __tablename__ = "sys_data_access_logs"
    
    id = Column(BigInteger, primary_key=True, index=True)
    access_time = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    data_type = Column(String(50), nullable=False)  # medical, personal, sensitive
    action = Column(String(50), nullable=False)  # view, export, delete
    records_affected = Column(Integer, default=0)
    purpose = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    session_id = Column(String(255), nullable=True)
    consent_given = Column(Boolean, nullable=True)
    legal_basis = Column(String(100), nullable=True)  # consent, contract, legal_obligation
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    target_user = relationship("User", foreign_keys=[target_user_id])


class ConsentRecord(Base):
    """User consent tracking for GDPR"""
    __tablename__ = "sys_consent_records"
    
    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    consent_type = Column(String(100), nullable=False)  # data_processing, marketing, analytics
    consent_given = Column(Boolean, nullable=False)
    consent_text = Column(Text, nullable=True)  # What user agreed to
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=True)
    withdrawn_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User")


# Default system permissions
DEFAULT_SYSTEM_PERMISSIONS = [
    # Personnel Management
    {"code": "personnel.create", "name": "Create Personnel", "module": "personnel", "action": "create", "category": "Personnel Management", "is_system": True},
    {"code": "personnel.view", "name": "View Personnel", "module": "personnel", "action": "view", "category": "Personnel Management", "is_system": True},
    {"code": "personnel.update", "name": "Update Personnel", "module": "personnel", "action": "update", "category": "Personnel Management", "is_system": True},
    {"code": "personnel.delete", "name": "Delete Personnel", "module": "personnel", "action": "delete", "category": "Personnel Management", "is_system": True},
    {"code": "personnel.approve", "name": "Approve Personnel Changes", "module": "personnel", "action": "approve", "category": "Personnel Management", "is_system": True},
    {"code": "personnel.export", "name": "Export Personnel Data", "module": "personnel", "action": "export", "category": "Personnel Management", "is_system": True},
    
    # Device Management
    {"code": "device.create", "name": "Create Device", "module": "device", "action": "create", "category": "Device Management", "is_system": True},
    {"code": "device.view", "name": "View Device", "module": "device", "action": "view", "category": "Device Management", "is_system": True},
    {"code": "device.update", "name": "Update Device", "module": "device", "action": "update", "category": "Device Management", "is_system": True},
    {"code": "device.delete", "name": "Delete Device", "module": "device", "action": "delete", "category": "Device Management", "is_system": True},
    {"code": "device.reboot", "name": "Reboot Device", "module": "device", "action": "execute", "category": "Device Management", "is_system": True},
    
    # Emergency Management
    {"code": "emergency.create", "name": "Create Emergency", "module": "emergency", "action": "create", "category": "Emergency Management", "is_system": True},
    {"code": "emergency.view", "name": "View Emergency", "module": "emergency", "action": "view", "category": "Emergency Management", "is_system": True},
    {"code": "emergency.update", "name": "Update Emergency", "module": "emergency", "action": "update", "category": "Emergency Management", "is_system": True},
    {"code": "emergency.lockdown", "name": "Execute Lockdown", "module": "emergency", "action": "execute", "category": "Emergency Management", "is_system": True},
    
    # MTD (Medical) Module
    {"code": "mtd.create", "name": "Create MTD Record", "module": "mtd", "action": "create", "category": "Medical Management", "is_system": True},
    {"code": "mtd.view", "name": "View MTD Records", "module": "mtd", "action": "view", "category": "Medical Management", "is_system": True},
    {"code": "mtd.update", "name": "Update MTD Records", "module": "mtd", "action": "update", "category": "Medical Management", "is_system": True},
    {"code": "mtd.medical_view", "name": "View Medical Data", "module": "mtd", "action": "view", "category": "Medical Management", "is_system": True},
    
    # Mustering
    {"code": "mustering.create", "name": "Create Mustering", "module": "mustering", "action": "create", "category": "Mustering Management", "is_system": True},
    {"code": "mustering.view", "name": "View Mustering", "module": "mustering", "action": "view", "category": "Mustering Management", "is_system": True},
    {"code": "mustering.update", "name": "Update Mustering", "module": "mustering", "action": "update", "category": "Mustering Management", "is_system": True},
    {"code": "mustering.start", "name": "Start Mustering", "module": "mustering", "action": "execute", "category": "Mustering Management", "is_system": True},
    
    # Payroll
    {"code": "payroll.create", "name": "Create Payroll", "module": "payroll", "action": "create", "category": "Payroll Management", "is_system": True},
    {"code": "payroll.view", "name": "View Payroll", "module": "payroll", "action": "view", "category": "Payroll Management", "is_system": True},
    {"code": "payroll.update", "name": "Update Payroll", "module": "payroll", "action": "update", "category": "Payroll Management", "is_system": True},
    {"code": "payroll.close", "name": "Close Payroll Period", "module": "payroll", "action": "execute", "category": "Payroll Management", "is_system": True},
    {"code": "payroll.export", "name": "Export Payroll", "module": "payroll", "action": "export", "category": "Payroll Management", "is_system": True},
    
    # System Administration
    {"code": "system.config", "name": "System Configuration", "module": "system", "action": "update", "category": "System Administration", "is_system": True},
    {"code": "system.backup", "name": "System Backup", "module": "system", "action": "execute", "category": "System Administration", "is_system": True},
    {"code": "system.maintain", "name": "System Maintenance", "module": "system", "action": "execute", "category": "System Administration", "is_system": True},
    {"code": "system.admin", "name": "System Administration", "module": "system", "action": "manage", "category": "System Administration", "is_system": True},
    {"code": "system.logs", "name": "View System Logs", "module": "system", "action": "view", "category": "System Administration", "is_system": True},
    {"code": "system.license", "name": "Manage License", "module": "system", "action": "manage", "category": "System Administration", "is_system": True},
    
    # User Management
    {"code": "user.create", "name": "Create User", "module": "user", "action": "create", "category": "User Management", "is_system": True},
    {"code": "user.view", "name": "View User", "module": "user", "action": "view", "category": "User Management", "is_system": True},
    {"code": "user.update", "name": "Update User", "module": "user", "action": "update", "category": "User Management", "is_system": True},
    {"code": "user.delete", "name": "Delete User", "module": "user", "action": "delete", "category": "User Management", "is_system": True},
    {"code": "user.roles", "name": "Manage User Roles", "module": "user", "action": "manage", "category": "User Management", "is_system": True},
    
    # Role Management
    {"code": "role.create", "name": "Create Role", "module": "role", "action": "create", "category": "Role Management", "is_system": True},
    {"code": "role.view", "name": "View Role", "module": "role", "action": "view", "category": "Role Management", "is_system": True},
    {"code": "role.update", "name": "Update Role", "module": "role", "action": "update", "category": "Role Management", "is_system": True},
    {"code": "role.delete", "name": "Delete Role", "module": "role", "action": "delete", "category": "Role Management", "is_system": True},
    {"code": "role.permissions", "name": "Manage Role Permissions", "module": "role", "action": "manage", "category": "Role Management", "is_system": True},
    
    # Reporting
    {"code": "report.view", "name": "View Reports", "module": "report", "action": "view", "category": "Reporting", "is_system": True},
    {"code": "report.create", "name": "Create Reports", "module": "report", "action": "create", "category": "Reporting", "is_system": True},
    {"code": "report.export", "name": "Export Reports", "module": "report", "action": "export", "category": "Reporting", "is_system": True},
    
    # API Management
    {"code": "api.create", "name": "Create API Keys", "module": "api", "action": "create", "category": "API Management", "is_system": True},
    {"code": "api.view", "name": "View API Keys", "module": "api", "action": "view", "category": "API Management", "is_system": True},
    {"code": "api.update", "name": "Update API Keys", "module": "api", "action": "update", "category": "API Management", "is_system": True},
    {"code": "api.delete", "name": "Delete API Keys", "module": "api", "action": "delete", "category": "API Management", "is_system": True},
]
