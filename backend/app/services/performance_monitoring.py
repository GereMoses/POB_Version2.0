"""
Real Performance Monitoring Service
Provides actual system performance metrics and monitoring
"""

import logging
import psutil
import time
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text, func

logger = logging.getLogger(__name__)

class PerformanceMonitoringService:
    """Real performance monitoring service"""
    
    def __init__(self):
        self.start_time = datetime.utcnow()
        self.request_count = 0
        self.error_count = 0
        self.response_times = []
        
    def get_system_metrics(self) -> Dict[str, Any]:
        """Get real system performance metrics"""
        try:
            # CPU metrics
            cpu_percent = psutil.cpu_percent(interval=1)
            cpu_count = psutil.cpu_count()
            
            # Memory metrics
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            memory_used_gb = memory.used / (1024**3)
            memory_total_gb = memory.total / (1024**3)
            
            # Disk metrics
            disk = psutil.disk_usage('/')
            disk_percent = disk.percent
            disk_used_gb = disk.used / (1024**3)
            disk_total_gb = disk.total / (1024**3)
            
            # Network metrics
            network = psutil.net_io_counters()
            bytes_sent = network.bytes_sent
            bytes_recv = network.bytes_recv
            
            # Process metrics
            process = psutil.Process()
            process_memory = process.memory_info().rss / (1024**2)  # MB
            process_cpu = process.cpu_percent()
            
            # System uptime
            uptime_seconds = time.time() - psutil.boot_time()
            uptime_days = uptime_seconds / (24 * 3600)
            
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "system": {
                    "cpu": {
                        "usage_percent": cpu_percent,
                        "core_count": cpu_count,
                        "load_average": psutil.getloadavg() if hasattr(psutil, 'getloadavg') else [0, 0, 0]
                    },
                    "memory": {
                        "usage_percent": memory_percent,
                        "used_gb": round(memory_used_gb, 2),
                        "total_gb": round(memory_total_gb, 2),
                        "available_gb": round((memory_total_gb - memory_used_gb), 2)
                    },
                    "disk": {
                        "usage_percent": disk_percent,
                        "used_gb": round(disk_used_gb, 2),
                        "total_gb": round(disk_total_gb, 2),
                        "free_gb": round((disk_total_gb - disk_used_gb), 2)
                    },
                    "network": {
                        "bytes_sent": bytes_sent,
                        "bytes_recv": bytes_recv,
                        "packets_sent": getattr(network, 'packets_sent', 0),
                        "packets_recv": getattr(network, 'packets_recv', 0)
                    },
                    "uptime": {
                        "days": round(uptime_days, 2),
                        "seconds": int(uptime_seconds)
                    }
                },
                "application": {
                    "process_memory_mb": round(process_memory, 2),
                    "process_cpu_percent": process_cpu,
                    "uptime_hours": (datetime.utcnow() - self.start_time).total_seconds() / 3600,
                    "request_count": self.request_count,
                    "error_count": self.error_count,
                    "error_rate": (self.error_count / self.request_count * 100) if self.request_count > 0 else 0,
                    "avg_response_time": sum(self.response_times) / len(self.response_times) if self.response_times else 0
                }
            }
        except Exception as e:
            logger.error(f"Error getting system metrics: {e}")
            return {"error": str(e), "timestamp": datetime.utcnow().isoformat()}
    
    def get_database_metrics(self, db: Session) -> Dict[str, Any]:
        """Get real database performance metrics"""
        try:
            # PostgreSQL performance metrics
            db_stats = db.execute(text("""
                SELECT 
                    count(*) as total_connections,
                    (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
                    (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
                    (SELECT count(*) FROM pg_stat_activity WHERE wait_event_type IS NOT NULL) as waiting_connections,
                    (SELECT round(sum(blks_hit)*100/sum(blks_hit+blks_read), 2) 
                     FROM pg_stat_database WHERE datname = current_database()) as cache_hit_rate,
                    (SELECT round(avg(total_time)/1000, 3) FROM pg_stat_statements) as avg_query_time_ms,
                    (SELECT count(*) FROM pg_stat_statements) as total_queries_tracked,
                    (SELECT round(sum(calls)/3600, 2) FROM pg_stat_statements) as queries_per_hour
            """)).fetchone()
            
            # Database size metrics
            size_stats = db.execute(text("""
                SELECT 
                    pg_database_size(current_database()) as database_size_bytes,
                    pg_size_pretty(pg_database_size(current_database())) as database_size_pretty
            """)).fetchone()
            
            # Table statistics
            table_stats = db.execute(text("""
                SELECT 
                    schemaname,
                    tablename,
                    n_tup_ins as inserts,
                    n_tup_upd as updates,
                    n_tup_del as deletes,
                    n_live_tup as live_tuples,
                    n_dead_tup as dead_tuples
                FROM pg_stat_user_tables 
                ORDER BY n_live_tup DESC 
                LIMIT 10
            """)).fetchall()
            
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "connections": {
                    "total": db_stats[0] if db_stats else 0,
                    "active": db_stats[1] if db_stats and len(db_stats) > 1 else 0,
                    "idle": db_stats[2] if db_stats and len(db_stats) > 2 else 0,
                    "waiting": db_stats[3] if db_stats and len(db_stats) > 3 else 0
                },
                "performance": {
                    "cache_hit_rate": float(db_stats[4]) if db_stats and len(db_stats) > 4 else 0.0,
                    "avg_query_time_ms": float(db_stats[5]) if db_stats and len(db_stats) > 5 else 0.0,
                    "total_queries_tracked": db_stats[6] if db_stats and len(db_stats) > 6 else 0,
                    "queries_per_hour": float(db_stats[7]) if db_stats and len(db_stats) > 7 else 0.0
                },
                "storage": {
                    "database_size_bytes": size_stats[0] if size_stats else 0,
                    "database_size_pretty": size_stats[1] if size_stats and len(size_stats) > 1 else "0 B"
                },
                "tables": [
                    {
                        "schema": row[0],
                        "table": row[1],
                        "inserts": row[2],
                        "updates": row[3],
                        "deletes": row[4],
                        "live_tuples": row[5],
                        "dead_tuples": row[6]
                    }
                    for row in table_stats
                ]
            }
        except Exception as e:
            logger.error(f"Error getting database metrics: {e}")
            return {"error": str(e), "timestamp": datetime.utcnow().isoformat()}
    
    def get_api_metrics(self) -> Dict[str, Any]:
        """Get API performance metrics"""
        try:
            # Calculate response time statistics
            if self.response_times:
                avg_response_time = sum(self.response_times) / len(self.response_times)
                min_response_time = min(self.response_times)
                max_response_time = max(self.response_times)
                
                # Calculate percentiles
                sorted_times = sorted(self.response_times)
                p50 = sorted_times[int(len(sorted_times) * 0.5)]
                p95 = sorted_times[int(len(sorted_times) * 0.95)]
                p99 = sorted_times[int(len(sorted_times) * 0.99)]
            else:
                avg_response_time = min_response_time = max_response_time = 0
                p50 = p95 = p99 = 0
            
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "requests": {
                    "total_count": self.request_count,
                    "error_count": self.error_count,
                    "success_count": self.request_count - self.error_count,
                    "error_rate": (self.error_count / self.request_count * 100) if self.request_count > 0 else 0,
                    "success_rate": ((self.request_count - self.error_count) / self.request_count * 100) if self.request_count > 0 else 100
                },
                "response_times": {
                    "average_ms": round(avg_response_time * 1000, 2),
                    "minimum_ms": round(min_response_time * 1000, 2),
                    "maximum_ms": round(max_response_time * 1000, 2),
                    "p50_ms": round(p50 * 1000, 2),
                    "p95_ms": round(p95 * 1000, 2),
                    "p99_ms": round(p99 * 1000, 2)
                },
                "uptime": {
                    "application_hours": (datetime.utcnow() - self.start_time).total_seconds() / 3600,
                    "requests_per_hour": self.request_count / ((datetime.utcnow() - self.start_time).total_seconds() / 3600) if self.request_count > 0 else 0
                }
            }
        except Exception as e:
            logger.error(f"Error getting API metrics: {e}")
            return {"error": str(e), "timestamp": datetime.utcnow().isoformat()}
    
    def record_request(self, response_time: float, is_error: bool = False):
        """Record a request for metrics"""
        self.request_count += 1
        if is_error:
            self.error_count += 1
        self.response_times.append(response_time)
        
        # Keep only last 1000 response times to prevent memory bloat
        if len(self.response_times) > 1000:
            self.response_times = self.response_times[-1000:]
    
    def get_health_status(self) -> Dict[str, Any]:
        """Get overall system health status"""
        try:
            # Get system metrics
            system_metrics = self.get_system_metrics()
            
            # Determine health status based on metrics
            health_score = 100
            issues = []
            
            # Check CPU usage
            cpu_usage = system_metrics.get("system", {}).get("cpu", {}).get("usage_percent", 0)
            if cpu_usage > 90:
                health_score -= 20
                issues.append("High CPU usage")
            elif cpu_usage > 70:
                health_score -= 10
                issues.append("Moderate CPU usage")
            
            # Check memory usage
            memory_usage = system_metrics.get("system", {}).get("memory", {}).get("usage_percent", 0)
            if memory_usage > 90:
                health_score -= 20
                issues.append("High memory usage")
            elif memory_usage > 80:
                health_score -= 10
                issues.append("Moderate memory usage")
            
            # Check disk usage
            disk_usage = system_metrics.get("system", {}).get("disk", {}).get("usage_percent", 0)
            if disk_usage > 90:
                health_score -= 15
                issues.append("Low disk space")
            elif disk_usage > 80:
                health_score -= 5
                issues.append("Moderate disk usage")
            
            # Check error rate
            error_rate = system_metrics.get("application", {}).get("error_rate", 0)
            if error_rate > 10:
                health_score -= 25
                issues.append("High error rate")
            elif error_rate > 5:
                health_score -= 10
                issues.append("Moderate error rate")
            
            # Determine status
            if health_score >= 90:
                status = "healthy"
                status_level = "success"
            elif health_score >= 70:
                status = "warning"
                status_level = "warning"
            else:
                status = "critical"
                status_level = "error"
            
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "status": status,
                "status_level": status_level,
                "health_score": max(0, health_score),
                "issues": issues,
                "system_metrics": system_metrics
            }
        except Exception as e:
            logger.error(f"Error getting health status: {e}")
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "status": "unknown",
                "status_level": "warning",
                "health_score": 0,
                "issues": [f"Monitoring error: {str(e)}"],
                "error": str(e)
            }

# Global performance monitoring instance
performance_monitor = PerformanceMonitoringService()
