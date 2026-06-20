from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import validator
import os
from pathlib import Path


class Settings(BaseSettings):
    model_config = {
        "extra": "ignore",
        "env_file": "/app/.env",
        "case_sensitive": True
    }

    # Database Configuration — PostgreSQL for ZKTeco ADMS
    DATABASE_URL: str = "postgresql://pob_user:pob_password@postgres:5432/pob_system"
    DATABASE_HOST: str = "postgres"
    DATABASE_PORT: int = 5432
    DATABASE_NAME: str = "pob_system"
    DATABASE_USER: str = "pob_user"
    DATABASE_PASSWORD: str = "pob_password"

    # PostgreSQL Connection Pooling (for ZKTeco ADMS concurrent requests)
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 30
    DB_POOL_RECYCLE: int = 3600
    DB_POOL_PRE_PING: bool = True

    # Redis Configuration
    REDIS_URL: str = "redis://redis:6379/0"
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""

    # JWT Configuration
    SECRET_KEY: str = "pob-system-production-secret-key-2024-secure-jwt-auth"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    EMAIL_RESET_TOKEN_EXPIRE_HOURS: int = 24

    # API / Application Configuration
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Apex POB"
    VERSION: str = "2.0.0"
    DESCRIPTION: str = "Personnel On Board Management System for Oil & Gas Operations"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    LOG_SQL: bool = False  # separate from DEBUG — avoids SQLAlchemy echo spam in dev
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/app.log"

    # File paths
    BASE_DIR: str = str(Path(__file__).parent.parent.parent)

    # CORS Configuration
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8000",
        "http://localhost:8080",
        "http://localhost:5173",
    ]

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v):
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # ZKTeco / ADMS Configuration
    # ZKTECO_ADMS_SERVER / ZKTECO_ADMS_PORT — ZKTeco cloud ADMS base URL
    ZKTECO_ADMS_SERVER: str = "https://adms.zkteco.com"
    ZKTECO_ADMS_PORT: str = "443"
    # ZKTECO_COMPANY_ID / ZKTECO_ADMS_TOKEN — credentials for ZKTeco cloud ADMS
    ZKTECO_COMPANY_ID: str = ""
    ZKTECO_ADMS_TOKEN: str = ""
    # ZKTECO_API_BASE_URL / credentials — for direct device HTTP API (optional)
    ZKTECO_API_BASE_URL: str = ""
    ZKTECO_USERNAME: str = ""
    ZKTECO_PASSWORD: str = ""
    ZKTECO_TIMEOUT: int = 30
    # Auto-register unknown devices that check in via ADMS /iclock/cdata
    ZKTECO_AUTO_REGISTER_DEVICES: bool = True

    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60
    RATE_LIMIT_AUTH_REQUESTS: int = 10
    RATE_LIMIT_AUTH_WINDOW: int = 300

    # File Upload
    MAX_FILE_SIZE: int = 10485760  # 10 MB

    # Security Headers
    SECURE_SSL_REDIRECT: bool = False
    SECURE_HSTS_SECONDS: int = 31536000
    SECURE_CONTENT_TYPE_NOSNIFF: bool = True

    # License / Subscription
    LICENSE_SECRET: str = "pob-vendor-license-secret-change-this"
    GLOBAL_ADMIN_PASSWORD: str = "GlobalAdmin@2026"

    # Emergency webhook — required for external fire/gas panel integration
    # Must be set explicitly; left empty to disable the webhook endpoint entirely
    EMERGENCY_WEBHOOK_KEY: str = ""

    # Notification channels (SMTP, SMS, WhatsApp)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = ""
    SMTP_TLS: bool = True
    SMS_API_URL: str = ""
    SMS_API_KEY: str = ""
    WHATSAPP_API_URL: str = ""
    WHATSAPP_API_KEY: str = ""
    FCM_KEY: str = ""

    @validator("SECRET_KEY")
    def secret_key_must_be_strong(cls, v, values):
        insecure_defaults = {
            "pob-system-production-secret-key-2024-secure-jwt-auth",
            "changethis",
            "secret",
            "your-secret-key",
        }
        env = values.get("ENVIRONMENT", "development")
        if v in insecure_defaults and env == "production":
            raise ValueError(
                "SECRET_KEY is using an insecure default value. "
                "Generate a strong key: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        return v

    @validator("GLOBAL_ADMIN_PASSWORD")
    def global_admin_password_must_be_changed(cls, v, values):
        insecure_defaults = {"GlobalAdmin@2026", "changethis", "admin", "password"}
        env = values.get("ENVIRONMENT", "development")
        if v in insecure_defaults and env == "production":
            raise ValueError(
                "GLOBAL_ADMIN_PASSWORD is using an insecure default. "
                "Set a strong value in .env.prod (min 16 chars, mixed case, numbers, symbols)."
            )
        return v

    @validator("LICENSE_SECRET")
    def license_secret_must_be_changed(cls, v, values):
        env = values.get("ENVIRONMENT", "development")
        if v == "pob-vendor-license-secret-change-this" and env == "production":
            raise ValueError(
                "LICENSE_SECRET is using the default value. "
                "Set a unique secret in .env.prod to prevent unauthorized license generation."
            )
        return v


settings = Settings()
