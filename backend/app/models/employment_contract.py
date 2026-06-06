from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Numeric, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class EmploymentContract(Base):
    """Employment contracts — matches employment_contracts table exactly."""
    __tablename__ = "employment_contracts"

    id              = Column(Integer, primary_key=True, index=True)
    personnel_id    = Column(Integer, ForeignKey("personnel.id"), nullable=False, index=True)

    contract_number = Column(String(50), nullable=True, unique=True, index=True)
    # permanent | fixed_term | contractor | intern | apprentice | temporary
    contract_type   = Column(String(20), nullable=False)
    # draft | active | expired | terminated | suspended | renewed
    status          = Column(String(20), default="draft", index=True)

    start_date          = Column(Date, nullable=True)
    end_date            = Column(Date, nullable=True)
    probation_end_date  = Column(Date, nullable=True)

    salary              = Column(Numeric(10, 2), nullable=True)
    currency            = Column(String(3), default="USD")
    payment_frequency   = Column(String(20), nullable=True)  # monthly | bi_weekly | weekly

    working_hours       = Column(Integer, nullable=True)      # hours per week
    job_title           = Column(String(100), nullable=True)
    department_id       = Column(Integer, ForeignKey("departments.id"), nullable=True)
    position_id         = Column(Integer, ForeignKey("positions.id"), nullable=True)

    terms               = Column(Text, nullable=True)

    signed_by           = Column(Integer, ForeignKey("users.id"), nullable=True)
    signed_date         = Column(Date, nullable=True)
    document_url        = Column(String(255), nullable=True)

    created_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    personnel   = relationship("Personnel", foreign_keys=[personnel_id])
    department  = relationship("Department", foreign_keys=[department_id])
    signer      = relationship("User", foreign_keys=[signed_by])
