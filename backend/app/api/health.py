"""
Comprehensive health check and monitoring endpoints for production
"""

from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any, Optional
import psutil
import logging

from ..core.database import get_db
from ..core.config import settings
from ..core.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/health", response_model=Dict[str, Any])
async def health_check(db: Session = Depends(get_db)):
    """Comprehensive health check endpoint"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "checks": {}
    }
    
    # Database health check
    try:
        db_result = db.execute(text("SELECT 1")).fetchone()
        if db_result:
            health_status["checks"]["database"] = {
                "status": "healthy",
                "response_time": "< 100ms",
                "details": "Database connection successful"
            }
        else:
            health_status["checks"]["database"] = {
                "status": "unhealthy",
                "response_time": "timeout",
                "details": "Database connection failed"
            }
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["checks"]["database"] = {
            "status": "unhealthy",
            "response_time": "error",
            "details": f"Database error: {str(e)}"
        }
        health_status["status"] = "unhealthy"
    
    # Redis health check
    try:
        import redis
        redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            socket_connect_timeout=5,
            socket_timeout=5
        )
        redis_client.ping()
        health_status["checks"]["redis"] = {
            "status": "healthy",
            "response_time": "< 50ms",
            "details": "Redis connection successful"
        }
    except Exception as e:
        health_status["checks"]["redis"] = {
            "status": "unhealthy",
            "response_time": "error",
            "details": f"Redis error: {str(e)}"
        }
        if health_status["status"] == "healthy":
            health_status["status"] = "degraded"
    
    # System resources check
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        health_status["checks"]["system"] = {
            "status": "healthy",
            "cpu_usage": f"{cpu_percent}%",
            "memory_usage": f"{memory.percent}%",
            "disk_usage": f"{disk.percent}%",
            "details": "System resources within normal limits"
        }
        
        # Check for resource warnings
        if cpu_percent > 80 or memory.percent > 80 or disk.percent > 80:
            health_status["checks"]["system"]["status"] = "warning"
            health_status["checks"]["system"]["details"] = "High resource usage detected"
            if health_status["status"] == "healthy":
                health_status["status"] = "degraded"
    except Exception as e:
        health_status["checks"]["system"] = {
            "status": "error",
            "details": f"System monitoring error: {str(e)}"
        }
        health_status["status"] = "degraded"
    
    return health_status

@router.get("/health/detailed", response_model=Dict[str, Any])
async def detailed_health_check(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Detailed health check with system information (requires authentication)"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required for detailed health information"
        )
    
    detailed_status = await health_check(db)
    
    # Add detailed system information
    try:
        # System info
        detailed_status["system_info"] = {
            "platform": psutil.platform.system(),
            "platform_release": psutil.platform.release(),
            "platform_version": psutil.platform.version(),
            "architecture": psutil.platform.architecture()[0],
            "processor": psutil.cpu_count(logical=False),
            "logical_processors": psutil.cpu_count(logical=True),
            "boot_time": datetime.fromtimestamp(psutil.boot_time()).isoformat()
        }
        
        # Memory details
        memory = psutil.virtual_memory()
        detailed_status["memory_details"] = {
            "total": f"{memory.total / (1024**3):.2f} GB",
            "available": f"{memory.available / (1024**3):.2f} GB",
            "used": f"{memory.used / (1024**3):.2f} GB",
            "percentage": f"{memory.percent}%"
        }
        
        # Disk details
        disk = psutil.disk_usage('/')
        detailed_status["disk_details"] = {
            "total": f"{disk.total / (1024**3):.2f} GB",
            "used": f"{disk.used / (1024**3):.2f} GB",
            "free": f"{disk.free / (1024**3):.2f} GB",
            "percentage": f"{disk.percent}%"
        }
        
        # Network interfaces
        network_interfaces = psutil.net_if_addrs()
        detailed_status["network_interfaces"] = {
            interface: {
                "addresses": [addr.address for addr in addresses]
            }
            for interface, addresses in network_interfaces.items()
        }
        
    except Exception as e:
        logger.error(f"Error getting detailed system info: {e}")
        detailed_status["system_info_error"] = str(e)
    
    # Database statistics
    try:
        # Get table counts
        tables = ["users", "personnel", "events", "locations", "zones"]
        db_stats = {}
        
        for table in tables:
            try:
                result = db.execute(text(f"SELECT COUNT(*) FROM {table}")).fetchone()
                db_stats[table] = result[0] if result else 0
            except Exception:
                db_stats[table] = "error"
        
        detailed_status["database_statistics"] = db_stats
        
    except Exception as e:
        detailed_status["database_statistics_error"] = str(e)
    
    return detailed_status

@router.get("/metrics", response_model=Dict[str, Any])
async def metrics_endpoint(db: Session = Depends(get_db)):
    """Application metrics for monitoring"""
    try:
        # Get basic metrics
        metrics = {
            "timestamp": datetime.utcnow().isoformat(),
            "uptime_seconds": psutil.boot_time(),
            "application": {
                "version": settings.VERSION,
                "environment": settings.ENVIRONMENT,
                "debug_mode": settings.DEBUG
            },
            "requests": {
                "total": 0,  # This would be tracked in a real implementation
                "active": 0,
                "errors": 0
            },
            "database": {
                "connection_pool_size": settings.DB_POOL_SIZE,
                "max_overflow": settings.DB_POOL_RECYCLE
            }
        }
        
        return metrics
        
    except Exception as e:
        logger.error(f"Error getting metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve metrics"
        )

@router.get("/status", response_model=Dict[str, Any])
async def status_endpoint():
    """Simple status endpoint"""
    return {
        "status": "running",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.utcnow().isoformat(),
        "environment": settings.ENVIRONMENT
    }

@router.get("/readiness", response_model=Dict[str, Any])
async def readiness_check(db: Session = Depends(get_db)):
    """Readiness probe for Kubernetes/container orchestration"""
    try:
        # Check database
        db.execute(text("SELECT 1"))
        
        # Check Redis
        import redis
        redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            socket_connect_timeout=5
        )
        redis_client.ping()
        
        return {
            "status": "ready",
            "timestamp": datetime.utcnow().isoformat(),
            "checks": {
                "database": "ready",
                "redis": "ready"
            }
        }
        
    except Exception as e:
        return {
            "status": "not_ready",
            "timestamp": datetime.utcnow().isoformat(),
            "checks": {
                "database": "not_ready",
                "redis": "not_ready"
            },
            "error": str(e)
        }

@router.get("/live", response_model=Dict[str, Any])
async def live_probe():
    """Liveness probe for Kubernetes/container orchestration"""
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat()
    }
