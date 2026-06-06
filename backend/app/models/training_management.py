from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Numeric, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class TrainingCourse(Base):
    """Training course catalogue — matches training_courses table in DB."""
    __tablename__ = "training_courses"

    id = Column(Integer, primary_key=True, index=True)
    course_code = Column(String(20), unique=True, nullable=False, index=True)
    course_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    duration_hours = Column(Integer, nullable=True)
    # safety|technical|compliance|soft_skills|leadership|induction|refresher|certification
    category = Column(String(50), nullable=True)
    is_mandatory = Column(Boolean, default=False)
    # Months a certificate is valid after completion; NULL = never expires
    valid_period_months = Column(Integer, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    creator = relationship("User", foreign_keys=[created_by])
    enrollments = relationship("TrainingEnrollment", back_populates="course")


class TrainingEnrollment(Base):
    """Training enrollments — matches training_enrollment table in DB (12 columns)."""
    __tablename__ = "training_enrollment"

    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=True, index=True)
    course_id = Column(Integer, ForeignKey("training_courses.id"), nullable=True, index=True)
    enrollment_date = Column(Date, nullable=True)
    completion_date = Column(Date, nullable=True)
    # enrolled|in_progress|completed|failed|cancelled|certified
    status = Column(String(20), default="enrolled", index=True)
    score = Column(Numeric(5, 2), nullable=True)
    certificate_url = Column(String(255), nullable=True)
    # Populated at completion: completion_date + course.valid_period_months
    expiry_date = Column(Date, nullable=True)
    # Denormalized from personnel.personnel_type for fast compliance queries
    personnel_type = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    personnel = relationship("Personnel", foreign_keys=[personnel_id])
    course = relationship("TrainingCourse", back_populates="enrollments", foreign_keys=[course_id])
