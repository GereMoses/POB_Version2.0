"""
Production-ready rate limiting middleware for API security
"""

import time
import asyncio
from typing import Dict, Optional
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import logging
import redis
from .config import settings

logger = logging.getLogger(__name__)

class RateLimiter:
    """Redis-based rate limiter for production use"""
    
    def __init__(self):
        self.redis_client = None
        self._memory_store = {}
        self._memory_expiry = {}
        self._connect_redis()
    
    def _connect_redis(self):
        """Connect to Redis with fallback to in-memory storage"""
        max_retries = 3
        retry_delay = 2
        
        for attempt in range(max_retries):
            try:
                import redis
                self.redis_client = redis.Redis(
                    host=settings.REDIS_HOST if hasattr(settings, 'REDIS_HOST') else 'localhost',
                    port=settings.REDIS_PORT if hasattr(settings, 'REDIS_PORT') else 6379,
                    db=settings.REDIS_DB if hasattr(settings, 'REDIS_DB') else 0,
                    decode_responses=True,
                    socket_connect_timeout=10,
                    socket_timeout=5,
                    retry_on_timeout=True,
                    health_check_interval=30
                )
                # Test connection
                self.redis_client.ping()
                logger.info("✅ Rate limiter connected to Redis")
                return
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f"Redis connection attempt {attempt + 1} failed, retrying in {retry_delay}s: {e}")
                    time.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    logger.warning(f"⚠️ Redis not available after {max_retries} attempts, using in-memory rate limiting: {e}")
                    self.redis_client = None
                    self._memory_store = {}
                    self._memory_expiry = {}
    
    def _get_key(self, key: str) -> Optional[str]:
        """Get value from Redis or memory store"""
        if self.redis_client:
            try:
                return self.redis_client.get(key)
            except Exception as e:
                logger.error(f"Redis get error: {e}")
                return self._memory_store.get(key)
        return self._memory_store.get(key)
    
    def _set_key(self, key: str, value: str, expire: int):
        """Set value in Redis or memory store"""
        if self.redis_client:
            try:
                self.redis_client.setex(key, expire, value)
                return
            except Exception as e:
                logger.error(f"Redis set error: {e}")
        
        # Fallback to memory store
        self._memory_store[key] = value
        # Simple expiration for memory store
        if not hasattr(self, '_memory_expiry'):
            self._memory_expiry = {}
        self._memory_expiry[key] = time.time() + expire
    
    def _increment_key(self, key: str, expire: int) -> int:
        """Increment counter in Redis or memory store"""
        if self.redis_client:
            try:
                pipe = self.redis_client.pipeline()
                pipe.incr(key)
                pipe.expire(key, expire)
                results = pipe.execute()
                return results[0]
            except Exception as e:
                logger.error(f"Redis increment error: {e}")
        
        # Fallback to memory store
        current = self._memory_store.get(key, 0)
        current += 1
        self._memory_store[key] = current
        self._memory_expiry[key] = time.time() + expire
        return current
    
    def is_allowed(self, key: str, limit: int, window: int) -> tuple[bool, Dict]:
        """
        Check if request is allowed
        
        Args:
            key: Unique identifier (IP address or user ID)
            limit: Number of requests allowed
            window: Time window in seconds
            
        Returns:
            (allowed, info_dict)
        """
        current_time = int(time.time())
        window_start = current_time - (current_time % window)
        rate_key = f"rate_limit:{key}:{window_start}"
        
        # Clean expired memory entries
        if not self.redis_client and hasattr(self, '_memory_expiry'):
            expired_keys = [
                k for k, exp in self._memory_expiry.items() 
                if exp < current_time
            ]
            for k in expired_keys:
                self._memory_store.pop(k, None)
                self._memory_expiry.pop(k, None)
        
        # Get current count
        current_count = self._increment_key(rate_key, window)
        
        # Calculate remaining requests and reset time
        remaining = max(0, limit - current_count)
        reset_time = window_start + window
        
        info = {
            "limit": limit,
            "remaining": remaining,
            "reset": reset_time,
            "retry_after": max(0, reset_time - current_time) if current_count >= limit else 0
        }
        
        return current_count <= limit, info

# Global rate limiter instance
rate_limiter = RateLimiter()

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware for FastAPI"""
    
    def __init__(self, app, calls: int = 100, period: int = 60):
        super().__init__(app)
        self.calls = calls  # Number of calls allowed
        self.period = period  # Time period in seconds
    
    async def dispatch(self, request: Request, call_next):
        """Process request through rate limiting"""
        
        # Get client identifier
        client_id = self._get_client_id(request)
        
        # Check rate limit
        allowed, info = rate_limiter.is_allowed(
            key=client_id,
            limit=self.calls,
            window=self.period
        )
        
        # Add rate limit headers to response
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(info["limit"])
        response.headers["X-RateLimit-Remaining"] = str(info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(info["reset"])
        response.headers["X-RateLimit-RetryAfter"] = str(info["retry_after"])
        
        # Block request if rate limit exceeded
        if not allowed:
            logger.warning(f"Rate limit exceeded for {client_id}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "Rate limit exceeded",
                    "message": f"Too many requests. Try again in {info['retry_after']} seconds.",
                    "retry_after": info["retry_after"],
                    "limit": info["limit"],
                    "period": self.period
                },
                headers={
                    "X-RateLimit-Limit": str(info["limit"]),
                    "X-RateLimit-Remaining": str(info["remaining"]),
                    "X-RateLimit-Reset": str(info["reset"]),
                    "X-RateLimit-RetryAfter": str(info["retry_after"]),
                    "Retry-After": str(info["retry_after"])
                }
            )
        
        return response
    
    def _get_client_id(self, request: Request) -> str:
        """Get unique client identifier"""
        # Try to get user ID from authenticated request
        if hasattr(request.state, 'user') and request.state.user:
            return f"user:{request.state.user.id}"
        
        # Fall back to IP address
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Get the first IP in the list
            ip = forwarded_for.split(",")[0].strip()
        else:
            ip = request.client.host if request.client else "unknown"
        
        return f"ip:{ip}"

def add_rate_limit_middleware(app):
    """Add rate limiting middleware to FastAPI app"""
    
    app.add_middleware(
        RateLimitMiddleware,
        calls=1000,  # 1000 requests
        period=60    # per minute per client
    )
    
    logger.info("✅ Rate limiting middleware added")
    return app
