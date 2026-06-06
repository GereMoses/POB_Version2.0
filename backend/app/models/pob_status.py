from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base

class POBStatus(Base):
    __tablename__ = "pob_status"

    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=True)  # nullable: location-level records
    personnel_count = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default='active')  # active, OFFSHORE, ONSHORE, TRANSIT
    location = Column(String(100), nullable=True)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    notes = Column(Text, nullable=True)

    # Relationships
    personnel = relationship("Personnel")
