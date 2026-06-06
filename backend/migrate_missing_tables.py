"""
One-time migration: create any ORM-defined tables that are missing from the DB.
Safe to run multiple times — checkfirst=True skips tables that already exist.
"""
import sys
sys.path.insert(0, "/app")

from app.core.database import engine, Base

# Import every model module so all Table metadata is registered on Base
import app.models.access_control
import app.models.benefits_management
import app.models.biometric_templates
import app.models.biotime_enhancements
import app.models.biotime_models
import app.models.certification
import app.models.custom_attributes
import app.models.department
import app.models.device
import app.models.disciplinary_management
import app.models.emergency
import app.models.emergency_enhanced
import app.models.employment_contract
import app.models.event
import app.models.leave_management
import app.models.meeting
import app.models.mtd
import app.models.onboarding
import app.models.overtime_management
import app.models.payroll
import app.models.performance_management
import app.models.personnel
import app.models.pob_status
import app.models.position
import app.models.promotion_transfer
import app.models.report
import app.models.resignation
import app.models.roles
import app.models.shift_management
import app.models.system
import app.models.training_management
import app.models.user
import app.models.vendor_contractor
import app.models.visitor
import app.models.zone
import app.models.zone_reader_assignment

print("Creating any missing tables (checkfirst=True — existing tables untouched)...")
Base.metadata.create_all(bind=engine, checkfirst=True)
print("Done.")
