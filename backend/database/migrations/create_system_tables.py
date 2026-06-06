#!/usr/bin/env python3
"""
Create System Module Tables

This script creates all the system module tables and populates them with default data.
Run this script to initialize the System module database schema.
"""

import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add app directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.models.system import (
    Company, SystemPermission, SystemRole, SystemParameter, 
    DEFAULT_SYSTEM_PERMISSIONS
)
from app.models.user import User


def create_system_tables():
    """Create all system module tables and populate with default data"""
    
    print("🚀 Creating System module tables...")
    
    try:
        # Create database session
        engine = create_engine(settings.DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        print("✅ Database connection established")
        
        # Create tables
        from app.models.system import Base
        Base.metadata.create_all(bind=engine)
        print("✅ System module tables created")
        
        # Check if company exists
        existing_company = db.query(Company).count()
        if existing_company == 0:
            print("📝 Creating default company...")
            company = Company(
                company_name="Default Oil & Gas Company",
                address="123 Oil Field Road, Lagos, Nigeria",
                phone="+234-1-234-5678",
                email="info@oilgascompany.com",
                website="https://oilgascompany.com",
                work_days="0123456",
                timezone="Africa/Lagos",
                date_format="DD/MM/YYYY",
                currency="NGN",
                emergency_contact={
                    "primary_contact": "Safety Officer",
                    "primary_phone": "+234-802-345-6789",
                    "secondary_contact": "HR Manager",
                    "secondary_phone": "+234-803-456-7890"
                },
                company_type="subsidiary"
            )
            db.add(company)
            db.commit()
            print("✅ Default company created")
        else:
            print(f"ℹ️  Company already exists ({existing_company} found)")
        
        # Check if permissions already exist
        existing_permissions = db.query(SystemPermission).count()
        if existing_permissions == 0:
            print("📝 Creating default system permissions...")
            for perm_data in DEFAULT_SYSTEM_PERMISSIONS:
                permission = SystemPermission(**perm_data)
                db.add(permission)
            db.commit()
            print(f"✅ Created {len(DEFAULT_SYSTEM_PERMISSIONS)} default system permissions")
        else:
            print(f"ℹ️  System permissions already exist ({existing_permissions} found)")
        
        # Create default system roles
        default_roles = [
            {
                "name": "Superuser",
                "description": "Full system access with all permissions",
                "level": 10,
                "is_system": True
            },
            {
                "name": "Administrator",
                "description": "System administrator with most permissions",
                "level": 20,
                "is_system": True
            },
            {
                "name": "HR Manager",
                "description": "Human resources manager",
                "level": 30,
                "is_system": True
            },
            {
                "name": "HSE Officer",
                "description": "Health, Safety, and Environment officer",
                "level": 35,
                "is_system": True
            },
            {
                "name": "Security Manager",
                "description": "Security department manager",
                "level": 40,
                "is_system": True
            },
            {
                "name": "Registrar",
                "description": "Personnel registrar and records manager",
                "level": 45,
                "is_system": True
            },
            {
                "name": "ESS User",
                "description": "Employee Self Service user",
                "level": 80,
                "is_system": True
            },
            {
                "name": "Read Only",
                "description": "Read-only access to most modules",
                "level": 90,
                "is_system": True
            }
        ]
        
        existing_roles = db.query(SystemRole).count()
        if existing_roles == 0:
            print("📝 Creating default system roles...")
            for role_data in default_roles:
                role = SystemRole(**role_data)
                db.add(role)
                db.commit()
                # Get the role ID to assign permissions
                role_id = role.id
                
                # Assign permissions based on role
                if role.name == "Superuser":
                    # Superuser gets all permissions
                    all_permissions = db.query(SystemPermission).all()
                    for perm in all_permissions:
                        from app.models.system import SystemRolePermission
                        role_perm = SystemRolePermission(
                            role_id=role_id,
                            permission_code=perm.code,
                            granted_by="system"
                        )
                        db.add(role_perm)
                
                elif role.name == "Administrator":
                    # Admin gets most permissions except some critical ones
                    admin_perms = db.query(SystemPermission).filter(
                        ~SystemPermission.code.in_(['system.admin', 'system.license'])
                    ).all()
                    for perm in admin_perms:
                        from app.models.system import SystemRolePermission
                        role_perm = SystemRolePermission(
                            role_id=role_id,
                            permission_code=perm.code,
                            granted_by="system"
                        )
                        db.add(role_perm)
                
                elif role.name == "HR Manager":
                    # HR gets personnel, payroll, and reporting permissions
                    hr_perms = db.query(SystemPermission).filter(
                        SystemPermission.module.in_(['personnel', 'payroll', 'user', 'role', 'report'])
                    ).all()
                    for perm in hr_perms:
                        from app.models.system import SystemRolePermission
                        role_perm = SystemRolePermission(
                            role_id=role_id,
                            permission_code=perm.code,
                            granted_by="system"
                        )
                        db.add(role_perm)
                
                elif role.name == "HSE Officer":
                    # HSE gets emergency, medical, mustering, and safety permissions
                    hse_perms = db.query(SystemPermission).filter(
                        SystemPermission.module.in_(['emergency', 'mtd', 'mustering'])
                    ).all()
                    for perm in hse_perms:
                        from app.models.system import SystemRolePermission
                        role_perm = SystemRolePermission(
                            role_id=role_id,
                            permission_code=perm.code,
                            granted_by="system"
                        )
                        db.add(role_perm)
                
                elif role.name == "Security Manager":
                    # Security gets device, emergency, and access control permissions
                    security_perms = db.query(SystemPermission).filter(
                        SystemPermission.module.in_(['device', 'emergency'])
                    ).all()
                    for perm in security_perms:
                        from app.models.system import SystemRolePermission
                        role_perm = SystemRolePermission(
                            role_id=role_id,
                            permission_code=perm.code,
                            granted_by="system"
                        )
                        db.add(role_perm)
                
                elif role.name == "ESS User":
                    # ESS gets limited permissions for self-service
                    ess_perms = db.query(SystemPermission).filter(
                        SystemPermission.code.in_([
                            'personnel.view', 'personnel.update_own',
                            'attendance.view_own', 'attendance.update_own',
                            'mtd.view', 'mustering.view', 'payroll.view'
                        ])
                    ).all()
                    for perm in ess_perms:
                        from app.models.system import SystemRolePermission
                        role_perm = SystemRolePermission(
                            role_id=role_id,
                            permission_code=perm.code,
                            granted_by="system"
                        )
                        db.add(role_perm)
                
                elif role.name == "Read Only":
                    # Read Only gets view permissions only
                    readonly_perms = db.query(SystemPermission).filter(
                        SystemPermission.action == 'view'
                    ).all()
                    for perm in readonly_perms:
                        from app.models.system import SystemRolePermission
                        role_perm = SystemRolePermission(
                            role_id=role_id,
                            permission_code=perm.code,
                            granted_by="system"
                        )
                        db.add(role_perm)
            
            db.commit()
            print(f"✅ Created {len(default_roles)} default system roles with permissions")
        else:
            print(f"ℹ️  System roles already exist ({existing_roles} found)")
        
        # Create default system parameters
        default_parameters = [
            # Attendance Rules
            {"param_key": "attendance.grace_period", "param_value": "10", "param_type": "int", "module": "attendance", "description": "Grace period in minutes for late arrival"},
            {"param_key": "attendance.overtime_threshold", "param_value": "8", "param_type": "int", "module": "attendance", "description": "Hours per day before overtime applies"},
            {"param_key": "attendance.weekend_work_rate", "param_value": "1.5", "param_type": "float", "module": "attendance", "description": "Multiplier for weekend work"},
            
            # Password Policy
            {"param_key": "password.min_length", "param_value": "8", "param_type": "int", "module": "security", "description": "Minimum password length"},
            {"param_key": "password.require_upper", "param_value": "true", "param_type": "bool", "module": "security", "description": "Require uppercase letters"},
            {"param_key": "password.require_lower", "param_value": "true", "param_type": "bool", "module": "security", "description": "Require lowercase letters"},
            {"param_key": "password.require_digit", "param_value": "true", "param_type": "bool", "module": "security", "description": "Require digits"},
            {"param_key": "password.require_special", "param_value": "true", "param_type": "bool", "module": "security", "description": "Require special characters"},
            {"param_key": "password.expiry_days", "param_value": "90", "param_type": "int", "module": "security", "description": "Password expiry in days"},
            {"param_key": "password.max_attempts", "param_value": "5", "param_type": "int", "module": "security", "description": "Max failed login attempts"},
            
            # Session Management
            {"param_key": "session.timeout_minutes", "param_value": "30", "param_type": "int", "module": "security", "description": "Session timeout in minutes"},
            {"param_key": "session.max_concurrent", "param_value": "3", "param_type": "int", "module": "security", "description": "Max concurrent sessions per user"},
            
            # Device Settings
            {"param_key": "device.heartbeat_interval", "param_value": "60", "param_type": "int", "module": "device", "description": "Device heartbeat interval in seconds"},
            {"param_key": "device.sync_interval", "param_value": "300", "param_type": "int", "module": "device", "description": "Device sync interval in seconds"},
            {"param_key": "device.offline_threshold", "param_value": "600", "param_type": "int", "module": "device", "description": "Device offline threshold in seconds"},
            
            # GPS Settings
            {"param_key": "gps.fence_radius", "param_value": "100", "param_type": "int", "module": "location", "description": "GPS fence radius in meters"},
            {"param_key": "gps.accuracy_threshold", "param_value": "50", "param_type": "int", "module": "location", "description": "GPS accuracy threshold in meters"},
            
            # Mustering Settings
            {"param_key": "mustering.auto_start", "param_value": "false", "param_type": "bool", "module": "mustering", "description": "Auto-start mustering on emergency"},
            {"param_key": "mustering.timeout_minutes", "param_value": "30", "param_type": "int", "module": "mustering", "description": "Mustering timeout in minutes"},
            {"param_key": "mustering.siren_test_cron", "param_value": "0 9 * * 1", "param_type": "string", "module": "mustering", "description": "Siren test schedule (cron)"},
            
            # Emergency Settings
            {"param_key": "emergency.siren_duration", "param_value": "30", "param_type": "int", "module": "emergency", "description": "Emergency siren duration in seconds"},
            {"param_key": "emergency.auto_notify", "param_value": "true", "param_type": "bool", "module": "emergency", "description": "Auto-notify emergency contacts"},
            {"param_key": "emergency.drill_frequency", "param_value": "quarterly", "param_type": "string", "module": "emergency", "description": "Emergency drill frequency"},
            
            # Visitor Settings
            {"param_key": "visitor.qr_expiry_hours", "param_value": "24", "param_type": "int", "module": "visitor", "description": "Visitor QR code expiry in hours"},
            {"param_key": "visitor.auto_approve", "param_value": "false", "param_type": "bool", "module": "visitor", "description": "Auto-approve visitor requests"},
            {"param_key": "visitor.max_duration_days", "param_value": "7", "param_type": "int", "module": "visitor", "description": "Max visitor pass duration in days"},
            
            # System Settings
            {"param_key": "system.timezone", "param_value": "Africa/Lagos", "param_type": "string", "module": "system", "description": "System timezone", "is_public": True},
            {"param_key": "system.date_format", "param_value": "DD/MM/YYYY", "param_type": "string", "module": "system", "description": "System date format", "is_public": True},
            {"param_key": "system.currency", "param_value": "NGN", "param_type": "string", "module": "system", "description": "System currency", "is_public": True},
            {"param_key": "system.backup_retention_days", "param_value": "30", "param_type": "int", "module": "system", "description": "Backup retention period in days"},
            {"param_key": "system.log_retention_days", "param_value": "90", "param_type": "int", "module": "system", "description": "Log retention period in days"},
            {"param_key": "system.maintenance_window", "param_value": "02:00-04:00", "param_type": "string", "module": "system", "description": "System maintenance window"},
            
            # Email Settings
            {"param_key": "email.from_address", "param_value": "noreply@oilgascompany.com", "param_type": "string", "module": "notification", "description": "Default from email address"},
            {"param_key": "email.from_name", "param_value": "POB System", "param_type": "string", "module": "notification", "description": "Default from email name"},
            {"param_key": "email.smtp_timeout", "param_value": "30", "param_type": "int", "module": "notification", "description": "SMTP timeout in seconds"},
            
            # API Settings
            {"param_key": "api.rate_limit_default", "param_value": "1000", "param_type": "int", "module": "api", "description": "Default API rate limit per hour"},
            {"param_key": "api.key_length", "param_value": "64", "param_type": "int", "module": "api", "description": "API key length in characters"},
            {"param_key": "api.webhook_timeout", "param_value": "30", "param_type": "int", "module": "api", "description": "Webhook timeout in seconds"},
            {"param_key": "api.webhook_retries", "param_value": "3", "param_type": "int", "module": "api", "description": "Webhook retry attempts"},
        ]
        
        existing_parameters = db.query(SystemParameter).count()
        if existing_parameters == 0:
            print("📝 Creating default system parameters...")
            for param_data in default_parameters:
                parameter = SystemParameter(**param_data)
                db.add(parameter)
            db.commit()
            print(f"✅ Created {len(default_parameters)} default system parameters")
        else:
            print(f"ℹ️  System parameters already exist ({existing_parameters} found)")
        
        # Create default languages
        default_languages = [
            {"lang_code": "en", "lang_name": "English", "is_default": True, "is_rtl": False},
            {"lang_code": "fr", "lang_name": "Français", "is_default": False, "is_rtl": False},
            {"lang_code": "ar", "lang_name": "العربية", "is_default": False, "is_rtl": True},
            {"lang_code": "es", "lang_name": "Español", "is_default": False, "is_rtl": False},
        ]
        
        from app.models.system import Language
        existing_languages = db.query(Language).count()
        if existing_languages == 0:
            print("📝 Creating default languages...")
            for lang_data in default_languages:
                language = Language(**lang_data)
                db.add(language)
            db.commit()
            print(f"✅ Created {len(default_languages)} default languages")
        else:
            print(f"ℹ️  Languages already exist ({existing_languages} found)")
        
        # Create default branding
        from app.models.system import Branding
        existing_branding = db.query(Branding).count()
        if existing_branding == 0:
            print("📝 Creating default branding...")
            branding = Branding(
                app_name="POB System",
                primary_color="#1976d2",
                secondary_color="#dc004e",
                theme_mode="light",
                font_family="Inter",
                company_tagline="Personnel On Board Management System",
                footer_text="© 2024 POB System. All rights reserved."
            )
            db.add(branding)
            db.commit()
            print("✅ Default branding created")
        else:
            print(f"ℹ️  Branding already exists ({existing_branding} found)")
        
        # Print summary
        print("\n📊 System Module Summary:")
        total_permissions = db.query(SystemPermission).count()
        total_roles = db.query(SystemRole).count()
        total_parameters = db.query(SystemParameter).count()
        total_languages = db.query(Language).count()
        
        print(f"  - System Permissions: {total_permissions}")
        print(f"  - System Roles: {total_roles}")
        print(f"  - System Parameters: {total_parameters}")
        print(f"  - Languages: {total_languages}")
        print(f"  - Company: {existing_company}")
        
        print("\n🎉 System module initialization completed successfully!")
        
        db.close()
        
    except Exception as e:
        print(f"❌ Error creating system tables: {e}")
        if 'db' in locals():
            db.rollback()
            db.close()
        raise


if __name__ == "__main__":
    create_system_tables()
