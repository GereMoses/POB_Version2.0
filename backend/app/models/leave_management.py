from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Numeric, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class LeaveManagement(Base):
    """Leave requests — matches the 13-column leave_management table in the DB."""
    __tablename__ = "leave_management"

    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False, index=True)
    leave_type = Column(String(50), nullable=False)
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False)
    days_count = Column(Numeric(5, 2), nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(String(20), default="pending", index=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    personnel = relationship("Personnel", foreign_keys=[personnel_id])
    approver = relationship("User", foreign_keys=[approved_by])


class LeaveBalance(Base):
    """Leave balance per personnel per type per year — matches 11-column leave_balance table."""
    __tablename__ = "leave_balance"

    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False, index=True)
    leave_type = Column(String(50), nullable=False)
    year = Column(Integer, nullable=False, index=True)
    total_days = Column(Numeric(5, 2), nullable=False, default=0)
    used_days = Column(Numeric(5, 2), nullable=False, default=0)
    balance_days = Column(Numeric(5, 2), nullable=False, default=0)
    carry_forward_days = Column(Numeric(5, 2), nullable=False, default=0)
    accrual_rate = Column(Numeric(5, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    personnel = relationship("Personnel", foreign_keys=[personnel_id])


class LeaveBlackout(Base):
    """Blackout periods — matches 10-column leave_blackout table (name, applies_to varchar)."""
    __tablename__ = "leave_blackout"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=True)
    applies_to = Column(String(50), default="all")   # "all" | specific department name
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    department = relationship("Department")
    creator = relationship("User", foreign_keys=[created_by])
