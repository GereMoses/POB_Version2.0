"""
BioTime 9.5 Payroll Models with POB Extensions
Complete payroll system with salary structures, calculations, and reporting
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Enum, Numeric, Date, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB, INET
from ..core.database import Base
import enum
from datetime import date, datetime


class PayStructureType(str, enum.Enum):
    MONTHLY = "monthly"
    DAILY = "daily"
    HOURLY = "hourly"


class PayItemType(str, enum.Enum):
    EARNING = "earning"
    DEDUCTION = "deduction"
    ATTENDANCE = "attendance"


class PayCalcType(str, enum.Enum):
    FIXED = "fixed"
    FORMULA = "formula"
    ATTENDANCE = "attendance"


class PayPeriodStatus(str, enum.Enum):
    OPEN = "open"
    CALCULATING = "calculating"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class PayCalcStatus(str, enum.Enum):
    PENDING = "pending"
    CALCULATED = "calculated"
    VERIFIED = "verified"
    APPROVED = "approved"


class PayLoanStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PayStructure(Base):
    """Salary structure definition"""
    __tablename__ = "pay_structure"

    id = Column(Integer, primary_key=True, index=True)
    structure_name = Column(String(100), nullable=False, index=True)
    structure_type = Column(Enum(PayStructureType), default=PayStructureType.MONTHLY)
    is_active = Column(Boolean, default=True, index=True)
    version = Column(Integer, default=1)
    effective_date = Column(Date, nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    items = relationship("PayItem", back_populates="structure", cascade="all, delete-orphan")
    assignments = relationship("PayStructureAssign", back_populates="structure", cascade="all, delete-orphan")
    zone_allowances = relationship("PayZoneAllowance", back_populates="structure", cascade="all, delete-orphan")
    salaries = relationship("PaySalary", back_populates="structure")


class PayItem(Base):
    """Pay structure items (earnings, deductions, attendance-based)"""
    __tablename__ = "pay_item"

    id = Column(Integer, primary_key=True, index=True)
    structure_id = Column(Integer, ForeignKey("pay_structure.id"), nullable=False)
    item_name = Column(String(50), nullable=False)  # Basic, HRA, OT, LateDeduction, Tax, PF
    item_type = Column(Enum(PayItemType), nullable=False)  # earning, deduction, attendance
    calc_type = Column(Enum(PayCalcType), default=PayCalcType.FIXED)  # fixed, formula, attendance
    amount = Column(Numeric(10, 2), nullable=True)  # if fixed amount
    formula = Column(Text, nullable=True)  # if formula: "Basic * 0.4"
    attendance_field = Column(String(50), nullable=True)  # if attendance: work_time, ot_minutes, late_minutes
    rate = Column(Numeric(10, 4), nullable=True)  # for attendance type calculations
    sequence = Column(Integer, default=0)  # display order in payslip
    is_taxable = Column(Boolean, default=False)
    is_print = Column(Boolean, default=True)
    is_mandatory = Column(Boolean, default=False)
    gl_account = Column(String(50), nullable=True)  # General ledger account
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    structure = relationship("PayStructure", back_populates="items")
    salary_items = relationship("PaySalaryItem", back_populates="item")


class PayStructureAssign(Base):
    """Structure assignment to employees/departments/positions"""
    __tablename__ = "pay_structure_assign"

    id = Column(Integer, primary_key=True, index=True)
    structure_id = Column(Integer, ForeignKey("pay_structure.id"), nullable=False)
    assign_type = Column(Integer, nullable=False)  # 0=employee,1=department,2=position
    assign_id = Column(Integer, nullable=False)  # emp_id or dept_id or position_id
    priority = Column(Integer, default=0)  # higher priority wins conflicts
    effective_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    structure = relationship("PayStructure", back_populates="assignments")


class PayPeriod(Base):
    """Salary period management"""
    __tablename__ = "pay_period"

    id = Column(Integer, primary_key=True, index=True)
    period_name = Column(String(50), nullable=False, unique=True)  # "Jan 2026", "Feb 2026"
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    pay_date = Column(Date, nullable=True)
    status = Column(Enum(PayPeriodStatus), default=PayPeriodStatus.OPEN, index=True)
    is_att_locked = Column(Boolean, default=False)  # Locks attendance for this period
    description = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)
    closed_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    salaries = relationship("PaySalary", back_populates="period", cascade="all, delete-orphan")
    loan_deductions = relationship("PayLoanDeduction", back_populates="period")
    calculation_logs = relationship("PayCalculationLog", back_populates="period")


class PaySalary(Base):
    """Calculated salary records"""
    __tablename__ = "pay_salary"

    id = Column(BigInteger, primary_key=True, index=True)
    period_id = Column(Integer, ForeignKey("pay_period.id"), nullable=False)
    emp_id = Column(Integer, ForeignKey("personnel.id"), nullable=False)
    structure_id = Column(Integer, ForeignKey("pay_structure.id"), nullable=True)

    # Input Values from Attendance
    basic_salary = Column(Numeric(10, 2), nullable=True)
    work_days = Column(Numeric(5, 2), default=0)
    present_days = Column(Numeric(5, 2), default=0)
    ot_hours = Column(Numeric(5, 2), default=0)
    late_minutes = Column(Integer, default=0)
    leave_days = Column(Numeric(5, 2), default=0)
    absent_days = Column(Numeric(5, 2), default=0)

    # Calculated Totals
    gross_salary = Column(Numeric(10, 2), default=0)
    total_earnings = Column(Numeric(10, 2), default=0)
    total_deductions = Column(Numeric(10, 2), default=0)
    net_salary = Column(Numeric(10, 2), default=0)

    # Status and Tracking
    is_final = Column(Boolean, default=False)
    calc_status = Column(Enum(PayCalcStatus), default=PayCalcStatus.PENDING)
    calc_time = Column(DateTime(timezone=True), server_default=func.now())
    # Actor audit columns are SOFT references (no FK): the app authenticates against
    # auth_user, whose id-space differs from the legacy `users` table these once
    # FK'd to — a hard FK here breaks approvals. Store the authenticated actor id.
    calc_by = Column(Integer, nullable=True)
    verified_by = Column(Integer, nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(Integer, nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    # POB Extensions
    zone_hours = Column(Numeric(5, 2), default=0)
    night_hours = Column(Numeric(5, 2), default=0)
    hazard_days = Column(Numeric(5, 2), default=0)
    contractor_flag = Column(Boolean, default=False)

    # Relationships
    period = relationship("PayPeriod", back_populates="salaries")
    structure = relationship("PayStructure", back_populates="salaries")
    employee = relationship("Personnel")
    items = relationship("PaySalaryItem", back_populates="salary", cascade="all, delete-orphan")
    loan_deductions = relationship("PayLoanDeduction", back_populates="salary")


class PaySalaryItem(Base):
    """Salary item breakdown for audit trail"""
    __tablename__ = "pay_salary_item"

    id = Column(BigInteger, primary_key=True, index=True)
    salary_id = Column(BigInteger, ForeignKey("pay_salary.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("pay_item.id"), nullable=True)
    item_name = Column(String(50), nullable=False)
    item_value = Column(Numeric(10, 2), default=0)
    item_type = Column(Enum(PayItemType), nullable=False)
    formula_used = Column(Text, nullable=True)
    source_value = Column(Numeric(10, 2), nullable=True)  # raw value from attendance
    calculation_order = Column(Integer, default=0)
    is_manual_adjustment = Column(Boolean, default=False)
    adjustment_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    salary = relationship("PaySalary", back_populates="items")
    item = relationship("PayItem", back_populates="salary_items")


class PayLoan(Base):
    """Loans and advances management"""
    __tablename__ = "pay_loan"

    id = Column(Integer, primary_key=True, index=True)
    emp_id = Column(Integer, ForeignKey("personnel.id"), nullable=False)
    loan_type = Column(String(50), default="PERSONAL")  # PERSONAL, ADVANCE, EMERGENCY
    loan_amount = Column(Numeric(10, 2), nullable=False)
    emi_amount = Column(Numeric(10, 2), nullable=False)
    interest_rate = Column(Numeric(5, 2), default=0)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    balance = Column(Numeric(10, 2), nullable=False)
    status = Column(Enum(PayLoanStatus), default=PayLoanStatus.PENDING, index=True)
    reason = Column(String(255), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    employee = relationship("Personnel")
    deductions = relationship("PayLoanDeduction", back_populates="loan", cascade="all, delete-orphan")


class PayLoanDeduction(Base):
    """Loan EMI deduction tracking"""
    __tablename__ = "pay_loan_deduction"

    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("pay_loan.id"), nullable=False)
    salary_id = Column(BigInteger, ForeignKey("pay_salary.id"), nullable=True)
    period_id = Column(Integer, ForeignKey("pay_period.id"), nullable=True)
    emp_id = Column(Integer, ForeignKey("personnel.id"), nullable=False)
    emi_amount = Column(Numeric(10, 2), nullable=False)
    principal_amount = Column(Numeric(10, 2), default=0)
    interest_amount = Column(Numeric(10, 2), default=0)
    balance_before = Column(Numeric(10, 2), nullable=True)
    balance_after = Column(Numeric(10, 2), nullable=True)
    deduction_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    loan = relationship("PayLoan", back_populates="deductions")
    salary = relationship("PaySalary", back_populates="loan_deductions")
    period = relationship("PayPeriod", back_populates="loan_deductions")
    employee = relationship("Personnel")


class PayZoneAllowance(Base):
    """POB Extension: Zone allowance configuration"""
    __tablename__ = "pay_zone_allowance"

    id = Column(Integer, primary_key=True, index=True)
    structure_id = Column(Integer, ForeignKey("pay_structure.id"), nullable=False)
    area_id = Column(Integer, ForeignKey("zones.id"), nullable=True)
    zone_name = Column(String(100), nullable=True)
    allowance_type = Column(Integer, default=0)  # 0=hourly,1=daily,2=fixed
    amount = Column(Numeric(10, 2), nullable=False)
    is_hazard = Column(Boolean, default=False)
    hazard_rate = Column(Numeric(5, 2), default=0)  # additional % for hazard zones
    effective_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    structure = relationship("PayStructure", back_populates="zone_allowances")
    zone = relationship("Zone")


class PayContractorRate(Base):
    """POB Extension: Contractor rate configuration"""
    __tablename__ = "pay_contractor_rate"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    position_id = Column(Integer, ForeignKey("positions.id"), nullable=True)
    position_name = Column(String(100), nullable=True)
    hourly_rate = Column(Numeric(10, 2), nullable=True)
    daily_rate = Column(Numeric(10, 2), nullable=True)
    weekly_rate = Column(Numeric(10, 2), nullable=True)
    monthly_rate = Column(Numeric(10, 2), nullable=True)
    ot_rate = Column(Numeric(10, 2), default=1.5)  # OT multiplier
    night_shift_rate = Column(Numeric(10, 2), default=1.25)
    holiday_rate = Column(Numeric(10, 2), default=2.0)
    is_active = Column(Boolean, default=True)
    effective_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    vendor = relationship("Vendor", foreign_keys=[vendor_id])
    position = relationship("Position")


class PayAttendanceMapping(Base):
    """Attendance to payroll field mapping"""
    __tablename__ = "pay_attendance_mapping"

    id = Column(Integer, primary_key=True, index=True)
    attendance_field = Column(String(50), nullable=False)  # work_time, ot_minutes, late_minutes
    payroll_item_name = Column(String(50), nullable=False)  # Basic, OT, LateDeduction
    rate = Column(Numeric(10, 4), default=1.0)
    is_active = Column(Boolean, default=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PayPayslipTemplate(Base):
    """Payslip template configuration"""
    __tablename__ = "pay_payslip_template"

    id = Column(Integer, primary_key=True, index=True)
    template_name = Column(String(100), nullable=False)
    template_type = Column(String(20), default="STANDARD")  # STANDARD, DETAILED, CONTRACTOR
    header_html = Column(Text, nullable=True)
    body_html = Column(Text, nullable=True)
    footer_html = Column(Text, nullable=True)
    css_style = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    creator = relationship("User")


class PayBankConfig(Base):
    """Bank sheet export configuration"""
    __tablename__ = "pay_bank_config"

    id = Column(Integer, primary_key=True, index=True)
    bank_name = Column(String(100), nullable=False)
    bank_code = Column(String(20), nullable=False)
    export_format = Column(String(10), default="CSV")  # CSV, XLSX, TXT
    file_template = Column(Text, nullable=True)  # Column mapping and format
    header_rows = Column(Integer, default=1)
    footer_rows = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PayCalculationLog(Base):
    """Payroll calculation log"""
    __tablename__ = "pay_calculation_log"

    id = Column(BigInteger, primary_key=True, index=True)
    period_id = Column(Integer, ForeignKey("pay_period.id"), nullable=True)
    emp_id = Column(Integer, ForeignKey("personnel.id"), nullable=True)
    calculation_type = Column(String(50), nullable=True)  # SALARY, ADJUSTMENT, RECALCULATION
    start_time = Column(DateTime(timezone=True), nullable=True)
    end_time = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=True)  # STARTED, COMPLETED, FAILED
    input_data = Column(JSONB, nullable=True)
    result_data = Column(JSONB, nullable=True)
    error_message = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    period = relationship("PayPeriod", back_populates="calculation_logs")
    employee = relationship("Personnel")
    creator = relationship("User")


class PayEmployeeCompensation(Base):
    """Per-employee salary components + statutory identifiers.

    The base payroll keyed pay at the structure level (every assigned employee got
    identical pay, defaulting to a hardcoded basic). Real organisations pay each
    person individually; this effective-dated table is the per-employee source of
    Basic/Housing/Transport/other and the statutory IDs needed to file PAYE/pension.
    Money is Numeric(14,2) to comfortably hold senior-grade and annualised figures.
    """
    __tablename__ = "pay_employee_compensation"

    id = Column(Integer, primary_key=True, index=True)
    emp_id = Column(Integer, ForeignKey("personnel.id"), nullable=False, index=True)

    # Monthly salary components (Basic+Housing+Transport = pension base)
    basic = Column(Numeric(14, 2), nullable=False, default=0)
    housing = Column(Numeric(14, 2), nullable=False, default=0)
    transport = Column(Numeric(14, 2), nullable=False, default=0)
    other_allowances = Column(Numeric(14, 2), nullable=False, default=0)
    nhis = Column(Numeric(14, 2), nullable=False, default=0)            # PAYE-relievable
    life_assurance = Column(Numeric(14, 2), nullable=False, default=0)  # PAYE-relievable

    currency = Column(String(3), nullable=False, default="NGN")
    grade = Column(String(50), nullable=True)
    nhf_enabled = Column(Boolean, default=True)

    # Statutory / payment identifiers (required to actually remit)
    tin = Column(String(30), nullable=True)            # tax identification number
    rsa_pin = Column(String(30), nullable=True)        # pension RSA PIN
    pfa_name = Column(String(100), nullable=True)      # pension fund administrator
    nhf_number = Column(String(30), nullable=True)
    tax_state = Column(String(50), nullable=True)      # state of PAYE remittance
    bank_name = Column(String(100), nullable=True)
    bank_account_no = Column(String(20), nullable=True)

    # Effective dating — most recent active row applicable to the period wins
    effective_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    employee = relationship("Personnel")


class PayAuditLog(Base):
    """Payroll audit trail"""
    __tablename__ = "pay_audit_log"

    id = Column(BigInteger, primary_key=True, index=True)
    table_name = Column(String(50), nullable=False)
    record_id = Column(Integer, nullable=False)
    action_type = Column(String(20), nullable=False)  # INSERT, UPDATE, DELETE
    old_values = Column(JSONB, nullable=True)
    new_values = Column(JSONB, nullable=True)
    changed_fields = Column(JSONB, nullable=True)  # Array of field names
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    ip_address = Column(INET, nullable=True)
    user_agent = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User")
