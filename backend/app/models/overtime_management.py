from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Numeric, Date, Time
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class OvertimeManagement(Base):
    """Overtime requests — matches the 16-column overtime_management table in DB."""
    __tablename__ = "overtime_management"

    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False, index=True)
    overtime_type = Column(String(20), nullable=False)          # daily|weekly|weekend|holiday|special
    date = Column(Date, nullable=False, index=True)
    start_time = Column(Time, nullable=True)                    # time without time zone
    end_time = Column(Time, nullable=True)
    hours_worked = Column(Numeric(5, 2), nullable=True)         # total session hours
    overtime_hours = Column(Numeric(5, 2), nullable=True)       # qualifying OT hours
    reason = Column(Text, nullable=True)
    status = Column(String(20), default="pending", index=True)  # pending|approved|rejected|cancelled|processed
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    compensation_type = Column(String(20), nullable=True)       # pay|time_off|mixed
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    personnel = relationship("Personnel", foreign_keys=[personnel_id])
    approver = relationship("User", foreign_keys=[approved_by])


class OvertimeRule(Base):
    """Overtime calculation rules — matches the 16-column overtime_rules table in DB."""
    __tablename__ = "overtime_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String(100), nullable=False)
    rule_type = Column(String(20), nullable=False)              # daily|weekly|weekend|holiday|special
    daily_threshold_hours = Column(Numeric(5, 2), nullable=True)
    weekly_threshold_hours = Column(Numeric(5, 2), nullable=True)
    monthly_threshold_hours = Column(Numeric(5, 2), nullable=True)
    rate_multiplier = Column(Numeric(5, 2), default=1.5)
    max_daily_hours = Column(Numeric(5, 2), nullable=True)
    max_weekly_hours = Column(Numeric(5, 2), nullable=True)
    max_monthly_hours = Column(Numeric(5, 2), nullable=True)
    requires_approval = Column(Boolean, default=True)
    applies_to = Column(String(20), default="all")              # all | STAFF | CONTRACTOR
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    creator = relationship("User", foreign_keys=[created_by])
