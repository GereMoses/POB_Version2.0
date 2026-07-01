"""
SQLAlchemy models for third-party integration configuration and sync logs.
Covers SeamlessHR and Microsoft Business Central integrations.
"""
from sqlalchemy import Column, Integer, String, Boolean, Text, Date, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from ..core.database import Base


class HRIntegrationConfig(Base):
    __tablename__ = "hr_integration_config"

    id                   = Column(Integer, primary_key=True)
    api_base_url         = Column(String(255))
    api_key              = Column(String(500))
    org_id               = Column(String(100))
    auth_header_name     = Column(String(100), default="Authorization")
    attendance_endpoint  = Column(String(255), default="/v1/attendance/clock-records")
    employee_endpoint    = Column(String(255), default="/v1/employees")
    is_enabled           = Column(Boolean, default=False)
    sync_time            = Column(String(10), default="00:00")
    # Fully-configurable connector behaviour (auth scheme, payload shape, field
    # names, formats, headers) so a new HR API can be wired WITHOUT code changes.
    # Empty = the built-in defaults (see seamlesshr_service._DEFAULT_OPTIONS).
    options              = Column(JSONB, nullable=True)
    updated_at           = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


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
    # Real BC surface config (api route / company path / target entity / field map /
    # static fields) so standard, custom-partner, and OData endpoints wire with no code.
    options        = Column(JSONB, nullable=True)
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
