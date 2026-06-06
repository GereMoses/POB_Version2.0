"""
Zone Reader Assignment Model for Oil & Gas Personnel Management
Handles assignments of readers to zones for access control
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class ZoneReaderAssignment(Base):
    """Zone-Reader assignments for access control"""
    __tablename__ = "zone_reader_assignments"

    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False)
    reader_id = Column(Integer, ForeignKey("devices.id"), nullable=False)

    # Assignment Details
    assignment_type = Column(String(50), default="PERMANENT")
    status = Column(String(20), default="active")
    is_primary = Column(Boolean, default=False)  # Primary reader for zone
    
    # Assignment Period
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    unassigned_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Configuration
    access_level = Column(String(20), default="STANDARD")  # BASIC, STANDARD, ENHANCED, FULL
    access_schedule = Column(JSON, nullable=True)  # Access time schedules
    reader_config = Column(JSON, nullable=True)  # Reader-specific configuration
    
    # Monitoring
    last_heartbeat = Column(DateTime(timezone=True), nullable=True)
    last_activity = Column(DateTime(timezone=True), nullable=True)
    error_count = Column(Integer, default=0)
    
    # Notes and Metadata
    notes = Column(Text, nullable=True)
    assigned_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    zone = relationship("Zone", back_populates="reader_assignments")
    reader = relationship("Device", back_populates="zone_assignments")
    
    def __repr__(self):
        return f"<ZoneReaderAssignment(zone_id={self.zone_id}, reader_id={self.reader_id}, status={self.status})>"
