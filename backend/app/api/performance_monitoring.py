"""
Performance Monitoring API
Real-time system performance and health monitoring endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..services.performance_monitoring import performance_monitor

router = APIRouter(prefix="/performance", tags=["performance"])

@router.get("/health")
async def get_system_health(
    current_user = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get overall system health status"""
    try:
        return performance_monitor.get_health_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get health status: {str(e)}")

@router.get("/system")
async def get_system_metrics(
    current_user = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get real system performance metrics"""
    try:
        return performance_monitor.get_system_metrics()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get system metrics: {str(e)}")

@router.get("/database")
async def get_database_metrics(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get database performance metrics"""
    try:
        return performance_monitor.get_database_metrics(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get database metrics: {str(e)}")

@router.get("/api")
async def get_api_metrics(
    current_user = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get API performance metrics"""
    try:
        return performance_monitor.get_api_metrics()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get API metrics: {str(e)}")

@router.get("/dashboard")
async def get_performance_dashboard(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get comprehensive performance dashboard"""
    try:
        system_metrics = performance_monitor.get_system_metrics()
        database_metrics = performance_monitor.get_database_metrics(db)
        api_metrics = performance_monitor.get_api_metrics()
        health_status = performance_monitor.get_health_status()
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "health": health_status,
            "system": system_metrics,
            "database": database_metrics,
            "api": api_metrics,
            "alerts": _generate_performance_alerts(system_metrics, database_metrics, api_metrics)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get performance dashboard: {str(e)}")

def _generate_performance_alerts(system_metrics: Dict, database_metrics: Dict, api_metrics: Dict) -> list:
    """Generate performance alerts based on metrics"""
    alerts = []
    
    # System alerts
    system = system_metrics.get("system", {})
    cpu_usage = system.get("cpu", {}).get("usage_percent", 0)
    memory_usage = system.get("memory", {}).get("usage_percent", 0)
    disk_usage = system.get("disk", {}).get("usage_percent", 0)
    
    if cpu_usage > 90:
        alerts.append({
            "type": "critical",
            "category": "system",
            "message": f"CPU usage is critically high at {cpu_usage}%",
            "timestamp": datetime.utcnow().isoformat()
        })
    elif cpu_usage > 70:
        alerts.append({
            "type": "warning",
            "category": "system",
            "message": f"CPU usage is high at {cpu_usage}%",
            "timestamp": datetime.utcnow().isoformat()
        })
    
    if memory_usage > 90:
        alerts.append({
            "type": "critical",
            "category": "system",
            "message": f"Memory usage is critically high at {memory_usage}%",
            "timestamp": datetime.utcnow().isoformat()
        })
    elif memory_usage > 80:
        alerts.append({
            "type": "warning",
            "category": "system",
            "message": f"Memory usage is high at {memory_usage}%",
            "timestamp": datetime.utcnow().isoformat()
        })
    
    if disk_usage > 90:
        alerts.append({
            "type": "critical",
            "category": "system",
            "message": f"Disk space is critically low at {disk_usage}% used",
            "timestamp": datetime.utcnow().isoformat()
        })
    elif disk_usage > 80:
        alerts.append({
            "type": "warning",
            "category": "system",
            "message": f"Disk space is low at {disk_usage}% used",
            "timestamp": datetime.utcnow().isoformat()
        })
    
    # Database alerts
    db_perf = database_metrics.get("performance", {})
    cache_hit_rate = db_perf.get("cache_hit_rate", 0)
    avg_query_time = db_perf.get("avg_query_time_ms", 0)
    
    if cache_hit_rate < 80:
        alerts.append({
            "type": "warning",
            "category": "database",
            "message": f"Database cache hit rate is low at {cache_hit_rate}%",
            "timestamp": datetime.utcnow().isoformat()
        })
    
    if avg_query_time > 1000:  # 1 second
        alerts.append({
            "type": "warning",
            "category": "database",
            "message": f"Average query time is high at {avg_query_time}ms",
            "timestamp": datetime.utcnow().isoformat()
        })
    
    # API alerts
    api_data = api_metrics.get("requests", {})
    error_rate = api_data.get("error_rate", 0)
    avg_response_time = api_metrics.get("response_times", {}).get("average_ms", 0)
    
    if error_rate > 5:
        alerts.append({
            "type": "critical" if error_rate > 10 else "warning",
            "category": "api",
            "message": f"API error rate is {error_rate}%",
            "timestamp": datetime.utcnow().isoformat()
        })
    
    if avg_response_time > 1000:  # 1 second
        alerts.append({
            "type": "warning",
            "category": "api",
            "message": f"Average API response time is {avg_response_time}ms",
            "timestamp": datetime.utcnow().isoformat()
        })
    
    return alerts
