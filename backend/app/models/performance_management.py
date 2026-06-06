from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Numeric, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class AppraisalCycle(Base):
    """Appraisal review periods — matches appraisal_cycles table."""
    __tablename__ = "appraisal_cycles"

    id          = Column(Integer, primary_key=True, index=True)
    cycle_name  = Column(String(100), nullable=False)
    cycle_code  = Column(String(20), unique=True, nullable=False, index=True)
    start_date  = Column(Date, nullable=False)
    end_date    = Column(Date, nullable=False)
    # open | closed | draft
    status      = Column(String(20), default="open", nullable=True)
    description = Column(Text, nullable=True)
    created_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    creator     = relationship("User", foreign_keys=[created_by])
    appraisals  = relationship("PerformanceAppraisal", back_populates="cycle")


class PerformanceAppraisal(Base):
    """Individual appraisal record — matches performance_appraisals table."""
    __tablename__ = "performance_appraisals"

    id                   = Column(Integer, primary_key=True, index=True)
    personnel_id         = Column(Integer, ForeignKey("personnel.id"), nullable=False, index=True)
    cycle_id             = Column(Integer, ForeignKey("appraisal_cycles.id"), nullable=False, index=True)
    reviewer_id          = Column(Integer, ForeignKey("users.id"), nullable=True)
    appraisal_date       = Column(Date, nullable=False)
    # draft | submitted | in_progress | completed | approved | rejected
    status               = Column(String(20), default="draft", index=True)
    # excellent | very_good | good | satisfactory | needs_improvement | poor
    overall_rating       = Column(String(20), nullable=True)
    goals_achieved       = Column(Numeric(5, 2), nullable=True)   # 0–100 %
    performance_score    = Column(Numeric(5, 2), nullable=True)   # 0–100
    strengths            = Column(Text, nullable=True)
    areas_for_improvement = Column(Text, nullable=True)
    comments             = Column(Text, nullable=True)
    created_at           = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at           = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    personnel  = relationship("Personnel", foreign_keys=[personnel_id])
    cycle      = relationship("AppraisalCycle", back_populates="appraisals", foreign_keys=[cycle_id])
    reviewer   = relationship("User", foreign_keys=[reviewer_id])
