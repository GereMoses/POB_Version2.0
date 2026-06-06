from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
import redis
import psycopg2
import psycopg2.extras
from .config import settings

# Database Setup - Conditional configuration for PostgreSQL vs SQLite
if "postgresql" in settings.DATABASE_URL:
    # PostgreSQL Database Setup with Connection Pooling
    engine = create_engine(
        settings.DATABASE_URL,
        # PostgreSQL-specific connection pooling for ZKTeco ADMS concurrent requests
        poolclass=QueuePool,
        pool_size=20,  # Base connection pool size
        max_overflow=30,  # Additional connections for peak load (total 50)
        pool_pre_ping=True,  # Validate connections before use
        pool_recycle=3600,  # Recycle connections every hour
        pool_timeout=5,  # Give up waiting for a pool slot after 5s (prevents health check hang)
        echo=settings.LOG_SQL,
        # PostgreSQL-specific settings
        connect_args={
            "application_name": "pob_system_zkteco",
            "connect_timeout": 5,
            "client_encoding": "utf8"
        }
    )
else:
    # SQLite Database Setup for development
    engine = create_engine(
        settings.DATABASE_URL,
        echo=settings.LOG_SQL,
        connect_args={"check_same_thread": False}  # SQLite-specific setting
    )

# Test database connection
def test_db_connection():
    """Test database connection"""
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            return result.scalar() == 1
    except Exception as e:
        print(f"Database connection error: {e}")
        return False

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Redis Setup
redis_client = redis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=settings.REDIS_DB,
    decode_responses=True,
    socket_connect_timeout=5,
    socket_timeout=5,
    retry_on_timeout=True
)

# Database Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()

# Redis Dependency
def get_redis():
    return redis_client

# Test Redis Connection
def test_redis_connection():
    """Test Redis connection"""
    try:
        redis_client.ping()
        return True
    except Exception as e:
        print(f"Redis connection error: {e}")
        return False
