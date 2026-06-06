from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from ..core.database import Base

class Event(Base):
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    event_metadata = Column(JSON, nullable=True)
    
    # Relationships
    personnel = relationship("Personnel")
    user = relationship("User")
