from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class DisciplinaryCase(Base):
    """Disciplinary case record — matches disciplinary_cases table exactly."""
    __tablename__ = "disciplinary_cases"

    id               = Column(Integer, primary_key=True, index=True)
    personnel_id     = Column(Integer, ForeignKey("personnel.id"), nullable=False, index=True)
    case_number      = Column(String(50), unique=True, nullable=False, index=True)

    incident_date    = Column(Date, nullable=False)
    # safety_violation|hse_breach|misconduct|attendance|substance_abuse|
    # theft|harassment|insubordination|negligence|policy_violation|other
    incident_type    = Column(String(50), nullable=True)
    description      = Column(Text, nullable=True)
    # minor|moderate|major|critical
    severity_level   = Column(String(20), nullable=True)

    # verbal_warning|written_warning|final_warning|suspension|demotion|termination|retraining|fine|other
    action_type      = Column(String(20), nullable=True)
    # open|under_investigation|resolved|appealed|closed
    status           = Column(String(20), default="open", index=True)

    reported_by      = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_to      = Column(Integer, ForeignKey("users.id"), nullable=True)

    resolution_date  = Column(Date, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    appeal_status    = Column(String(20), nullable=True)   # pending|upheld|dismissed

    created_at       = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    personnel    = relationship("Personnel", foreign_keys=[personnel_id])
    reporter     = relationship("User", foreign_keys=[reported_by])
    assignee     = relationship("User", foreign_keys=[assigned_to])
