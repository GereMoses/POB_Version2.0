"""
Redis Client for Caching and Session Management

This module provides Redis functionality for:
- Permission caching
- Session management
- Parameter caching
- Rate limiting
"""

import redis
import json
import logging
from typing import Optional, Any, Dict, List
from .config import settings

logger = logging.getLogger(__name__)

# Redis connection
redis_client = None

def get_redis_client():
    """Get Redis client instance"""
    global redis_client
    if redis_client is None:
        try:
            redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB,
                password=settings.REDIS_PASSWORD,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True
            )
            # Test connection
            redis_client.ping()
            logger.info("✅ Redis connection established")
        except Exception as e:
            logger.error(f"❌ Redis connection failed: {e}")
            redis_client = None
    return redis_client

def test_redis_connection() -> bool:
    """Test Redis connection"""
    try:
        client = get_redis_client()
        if client:
            client.ping()
            return True
    except Exception as e:
        logger.error(f"Redis connection test failed: {e}")
    return False

# Cache operations
def set_cache(key: str, value: Any, expire: int = 3600) -> bool:
    """Set cache value with expiration"""
    try:
        client = get_redis_client()
        if not client:
            return False
        
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        
        return client.setex(key, expire, value)
    except Exception as e:
        logger.error(f"Error setting cache {key}: {e}")
        return False

def get_cache(key: str) -> Optional[Any]:
    """Get cache value"""
    try:
        client = get_redis_client()
        if not client:
            return None
        
        value = client.get(key)
        if value is None:
            return None
        
        # Try to parse as JSON
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    except Exception as e:
        logger.error(f"Error getting cache {key}: {e}")
        return None

def delete_cache(key: str) -> bool:
    """Delete cache key"""
    try:
        client = get_redis_client()
        if not client:
            return False
        
        return bool(client.delete(key))
    except Exception as e:
        logger.error(f"Error deleting cache {key}: {e}")
        return False

def delete_cache_pattern(pattern: str) -> int:
    """Delete cache keys matching pattern"""
    try:
        client = get_redis_client()
        if not client:
            return 0
        
        keys = client.keys(pattern)
        if keys:
            return client.delete(*keys)
        return 0
    except Exception as e:
        logger.error(f"Error deleting cache pattern {pattern}: {e}")
        return 0

# Session management
def set_session(session_id: str, session_data: Dict[str, Any], expire: int = 3600) -> bool:
    """Set session data"""
    try:
        client = get_redis_client()
        if not client:
            return False
        
        key = f"session:{session_id}"
        return set_cache(key, session_data, expire)
    except Exception as e:
        logger.error(f"Error setting session {session_id}: {e}")
        return False

def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Get session data"""
    try:
        key = f"session:{session_id}"
        return get_cache(key)
    except Exception as e:
        logger.error(f"Error getting session {session_id}: {e}")
        return None

def delete_session(session_id: str) -> bool:
    """Delete session"""
    try:
        key = f"session:{session_id}"
        return delete_cache(key)
    except Exception as e:
        logger.error(f"Error deleting session {session_id}: {e}")
        return False

# Permission caching
def set_user_permissions(user_id: int, permissions: List[str], expire: int = 900) -> bool:
    """Set user permissions cache"""
    try:
        key = f"user_permissions:{user_id}"
        return set_cache(key, permissions, expire)
    except Exception as e:
        logger.error(f"Error setting user permissions {user_id}: {e}")
        return False

def get_user_permissions(user_id: int) -> Optional[List[str]]:
    """Get user permissions from cache"""
    try:
        key = f"user_permissions:{user_id}"
        return get_cache(key)
    except Exception as e:
        logger.error(f"Error getting user permissions {user_id}: {e}")
        return None

def clear_user_permissions(user_id: int) -> bool:
    """Clear user permissions cache"""
    try:
        key = f"user_permissions:{user_id}"
        return delete_cache(key)
    except Exception as e:
        logger.error(f"Error clearing user permissions {user_id}: {e}")
        return False

# Parameter caching
def set_parameter(key: str, value: Any, expire: int = 1800) -> bool:
    """Set parameter cache"""
    try:
        cache_key = f"sys_param:{key}"
        return set_cache(cache_key, value, expire)
    except Exception as e:
        logger.error(f"Error setting parameter {key}: {e}")
        return False

def get_parameter(key: str) -> Optional[Any]:
    """Get parameter from cache"""
    try:
        cache_key = f"sys_param:{key}"
        return get_cache(cache_key)
    except Exception as e:
        logger.error(f"Error getting parameter {key}: {e}")
        return None

def clear_parameter(key: str) -> bool:
    """Clear parameter cache"""
    try:
        cache_key = f"sys_param:{key}"
        return delete_cache(cache_key)
    except Exception as e:
        logger.error(f"Error clearing parameter {key}: {e}")
        return False

# Rate limiting
def increment_rate_limit(key: str, expire: int = 3600) -> int:
    """Increment rate limit counter"""
    try:
        client = get_redis_client()
        if not client:
            return 0
        
        count = client.incr(key)
        if count == 1:
            client.expire(key, expire)
        return count
    except Exception as e:
        logger.error(f"Error incrementing rate limit {key}: {e}")
        return 0

def get_rate_limit(key: str) -> int:
    """Get current rate limit count"""
    try:
        client = get_redis_client()
        if not client:
            return 0
        
        value = client.get(key)
        return int(value) if value else 0
    except Exception as e:
        logger.error(f"Error getting rate limit {key}: {e}")
        return 0

# Utility functions
def get_redis_info() -> Dict[str, Any]:
    """Get Redis server information"""
    try:
        client = get_redis_client()
        if not client:
            return {"status": "disconnected"}
        
        info = client.info()
        return {
            "status": "connected",
            "version": info.get("redis_version"),
            "used_memory": info.get("used_memory_human"),
            "connected_clients": info.get("connected_clients"),
            "total_commands_processed": info.get("total_commands_processed"),
            "keyspace_hits": info.get("keyspace_hits"),
            "keyspace_misses": info.get("keyspace_misses"),
            "uptime_in_seconds": info.get("uptime_in_seconds")
        }
    except Exception as e:
        logger.error(f"Error getting Redis info: {e}")
        return {"status": "error", "error": str(e)}

def flush_all_cache() -> bool:
    """Flush all cache data (use with caution)"""
    try:
        client = get_redis_client()
        if not client:
            return False
        
        return client.flushdb()
    except Exception as e:
        logger.error(f"Error flushing cache: {e}")
        return False

# Health check
def health_check() -> Dict[str, Any]:
    """Redis health check"""
    try:
        client = get_redis_client()
        if not client:
            return {"status": "unhealthy", "error": "No connection"}
        
        # Test ping
        client.ping()
        
        # Test set/get
        test_key = "health_check_test"
        client.set(test_key, "test", ex=10)
        value = client.get(test_key)
        client.delete(test_key)
        
        if value == "test":
            info = get_redis_info()
            return {"status": "healthy", "info": info}
        else:
            return {"status": "unhealthy", "error": "Set/get test failed"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}
