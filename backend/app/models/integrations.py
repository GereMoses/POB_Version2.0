"""
SQLAlchemy models for third-party integration configuration and sync logs.
Covers SeamlessHR and Microsoft Business Central integrations.
"""
from sqlalchemy import Column, Integer, String, Boolean, Text, Date, DateTime
from sqlalchemy.sql import func
from ..core.database import Base


class HRIntegrationConfig(Base):
    __tablename__ = "hr_integration_config"

    id             = Column(Integer, primary_key=True)
    base_url       = Column(String(500))
    api_key        = Column(String(500))
    company_code   = Column(String(100))
    attendance_endpoint = Column(String(200), default="/api/v1/timeattendance/attendance")
    employee_endpoint   = Column(String(200), default="/api/v1/employees")
    is_enabled     = Column(Boolean, default=False)
    sync_time      = Column(String(10), default="00:00")
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class HRSyncLog(Base):
    __tablename__ = "hr_sync_log"

    id              = Column(Integer, primary_key=True)
    sync_date       = Column(Date)
    triggered_by    = Column(String(50))
    status          = Column(String(20))
    records_built   = Column(Integer, default=0)
    records_sent    = Column(Integer, default=0)
    records_failed  = Column(Integer, default=0)
    message         = Column(String(500))
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


class BCIntegrationConfig(Base):
    __tablename__ = "bc_integration_config"

    id             = Column(Integer, primary_key=True)
    tenant_id      = Column(String(200))
    client_id      = Column(String(200))
    client_secret  = Column(String(500))
    environment    = Column(String(50), default="Production")
    company_id     = Column(String(100))
    company_name   = Column(String(200))
    is_enabled     = Column(Boolean, default=False)
    sync_time      = Column(String(10), default="01:00")
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BCSyncLog(Base):
    __tablename__ = "bc_sync_log"

    id              = Column(Integer, primary_key=True)
    sync_date       = Column(Date)
    triggered_by    = Column(String(50))
    status          = Column(String(20))
    records_built   = Column(Integer, default=0)
    records_sent    = Column(Integer, default=0)
    records_failed  = Column(Integer, default=0)
    message         = Column(String(500))
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
