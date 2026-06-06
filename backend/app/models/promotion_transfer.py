from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Numeric, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class PromotionTransfer(Base):
    """Promotion & transfer records — matches promotion_transfers table exactly."""
    __tablename__ = "promotion_transfers"

    id               = Column(Integer, primary_key=True, index=True)
    personnel_id     = Column(Integer, ForeignKey("personnel.id"), nullable=False, index=True)

    # promotion | department | location | position | role | lateral
    transfer_type    = Column(String(20), nullable=False)
    # pending | approved | rejected | completed | cancelled
    status           = Column(String(20), default="pending", index=True)

    effective_date   = Column(Date, nullable=True)

    # From / To department (FK to departments table)
    from_department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    to_department_id   = Column(Integer, ForeignKey("departments.id"), nullable=True)

    # From / To position (FK to positions table)
    from_position_id   = Column(Integer, ForeignKey("positions.id"), nullable=True)
    to_position_id     = Column(Integer, ForeignKey("positions.id"), nullable=True)

    # From / To location — free-text platform/site name (e.g. "Bonga FPSO", "Lagos Office")
    from_location      = Column(String(100), nullable=True)
    to_location        = Column(String(100), nullable=True)

    # Net salary change (positive = increase, negative = decrease)
    salary_change      = Column(Numeric(10, 2), nullable=True)

    reason             = Column(Text, nullable=True)
    requested_by       = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by        = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at        = Column(DateTime(timezone=True), nullable=True)
    rejection_reason   = Column(Text, nullable=True)

    created_at         = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at         = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    personnel        = relationship("Personnel", foreign_keys=[personnel_id])
    from_department  = relationship("Department", foreign_keys=[from_department_id])
    to_department    = relationship("Department", foreign_keys=[to_department_id])
    requester        = relationship("User", foreign_keys=[requested_by])
    approver         = relationship("User", foreign_keys=[approved_by])
