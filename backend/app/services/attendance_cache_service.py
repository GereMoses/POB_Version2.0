"""
Attendance Cache Service
Advanced caching layer for attendance module performance optimization
"""

import json
import hashlib
from datetime import datetime, timedelta
from typing import Any, Optional, List, Dict
from ..core.redis_client import redis_client
import logging

logger = logging.getLogger(__name__)

class AttendanceCacheService:
    """Advanced caching service for attendance operations"""
    
    def __init__(self):
        self.redis = redis_client
        self.default_ttl = 3600  # 1 hour
        self.long_ttl = 86400  # 24 hours
        self.short_ttl = 300  # 5 minutes
    
    def _generate_cache_key(self, prefix: str, *args) -> str:
        """Generate cache key with consistent hashing"""
        key_data = ":".join(str(arg) for arg in args)
        hash_obj = hashlib.md5(key_data.encode())
        return f"attendance:{prefix}:{hash_obj.hexdigest()}"
    
    async def get_employee_schedule(self, emp_id: int, date: str) -> Optional[Dict]:
        """Get cached employee schedule"""
        cache_key = self._generate_cache_key("schedule", emp_id, date)
        try:
            cached_data = self.redis.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logger.error(f"Error getting cached schedule: {e}")
        return None
    
    async def set_employee_schedule(self, emp_id: int, date: str, schedule_data: Dict):
        """Cache employee schedule"""
        cache_key = self._generate_cache_key("schedule", emp_id, date)
        try:
            self.redis.setex(
                cache_key, 
                self.long_ttl, 
                json.dumps(schedule_data, default=str)
            )
        except Exception as e:
            logger.error(f"Error caching schedule: {e}")
    
    async def get_attendance_calculation(self, emp_id: int, start_date: str, end_date: str) -> Optional[Dict]:
        """Get cached attendance calculation"""
        cache_key = self._generate_cache_key("calculation", emp_id, start_date, end_date)
        try:
            cached_data = self.redis.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logger.error(f"Error getting cached calculation: {e}")
        return None
    
    async def set_attendance_calculation(self, emp_id: int, start_date: str, end_date: str, calc_data: Dict):
        """Cache attendance calculation"""
        cache_key = self._generate_cache_key("calculation", emp_id, start_date, end_date)
        try:
            self.redis.setex(
                cache_key, 
                self.default_ttl, 
                json.dumps(calc_data, default=str)
            )
        except Exception as e:
            logger.error(f"Error caching calculation: {e}")
    
    async def get_timetable(self, timetable_id: int) -> Optional[Dict]:
        """Get cached timetable"""
        cache_key = self._generate_cache_key("timetable", timetable_id)
        try:
            cached_data = self.redis.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logger.error(f"Error getting cached timetable: {e}")
        return None
    
    async def set_timetable(self, timetable_id: int, timetable_data: Dict):
        """Cache timetable"""
        cache_key = self._generate_cache_key("timetable", timetable_id)
        try:
            self.redis.setex(
                cache_key, 
                self.long_ttl, 
                json.dumps(timetable_data, default=str)
            )
        except Exception as e:
            logger.error(f"Error caching timetable: {e}")
    
    async def get_shift(self, shift_id: int) -> Optional[Dict]:
        """Get cached shift"""
        cache_key = self._generate_cache_key("shift", shift_id)
        try:
            cached_data = self.redis.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logger.error(f"Error getting cached shift: {e}")
        return None
    
    async def set_shift(self, shift_id: int, shift_data: Dict):
        """Cache shift"""
        cache_key = self._generate_cache_key("shift", shift_id)
        try:
            self.redis.setex(
                cache_key, 
                self.long_ttl, 
                json.dumps(shift_data, default=str)
            )
        except Exception as e:
            logger.error(f"Error caching shift: {e}")
    
    async def get_holidays(self, year: int) -> Optional[List[Dict]]:
        """Get cached holidays for a year"""
        cache_key = self._generate_cache_key("holidays", year)
        try:
            cached_data = self.redis.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logger.error(f"Error getting cached holidays: {e}")
        return None
    
    async def set_holidays(self, year: int, holidays_data: List[Dict]):
        """Cache holidays for a year"""
        cache_key = self._generate_cache_key("holidays", year)
        try:
            self.redis.setex(
                cache_key, 
                self.long_ttl, 
                json.dumps(holidays_data, default=str)
            )
        except Exception as e:
            logger.error(f"Error caching holidays: {e}")
    
    async def get_leave_balance(self, emp_id: int, leave_type_id: int) -> Optional[float]:
        """Get cached leave balance"""
        cache_key = self._generate_cache_key("leave_balance", emp_id, leave_type_id)
        try:
            cached_data = self.redis.get(cache_key)
            if cached_data:
                return float(cached_data)
        except Exception as e:
            logger.error(f"Error getting cached leave balance: {e}")
        return None
    
    async def set_leave_balance(self, emp_id: int, leave_type_id: int, balance: float):
        """Cache leave balance"""
        cache_key = self._generate_cache_key("leave_balance", emp_id, leave_type_id)
        try:
            self.redis.setex(cache_key, self.short_ttl, str(balance))
        except Exception as e:
            logger.error(f"Error caching leave balance: {e}")
    
    async def get_attendance_stats(self, date: str, area_id: Optional[int] = None) -> Optional[Dict]:
        """Get cached attendance statistics"""
        cache_key = self._generate_cache_key("stats", date, area_id or 0)
        try:
            cached_data = self.redis.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logger.error(f"Error getting cached stats: {e}")
        return None
    
    async def set_attendance_stats(self, date: str, stats_data: Dict, area_id: Optional[int] = None):
        """Cache attendance statistics"""
        cache_key = self._generate_cache_key("stats", date, area_id or 0)
        try:
            self.redis.setex(
                cache_key, 
                self.short_ttl, 
                json.dumps(stats_data, default=str)
            )
        except Exception as e:
            logger.error(f"Error caching stats: {e}")
    
    async def get_employee_attendance_summary(self, emp_id: int, month: str) -> Optional[Dict]:
        """Get cached employee attendance summary"""
        cache_key = self._generate_cache_key("summary", emp_id, month)
        try:
            cached_data = self.redis.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logger.error(f"Error getting cached summary: {e}")
        return None
    
    async def set_employee_attendance_summary(self, emp_id: int, month: str, summary_data: Dict):
        """Cache employee attendance summary"""
        cache_key = self._generate_cache_key("summary", emp_id, month)
        try:
            self.redis.setex(
                cache_key, 
                self.default_ttl, 
                json.dumps(summary_data, default=str)
            )
        except Exception as e:
            logger.error(f"Error caching summary: {e}")
    
    async def invalidate_employee_cache(self, emp_id: int):
        """Invalidate all cache entries for an employee"""
        try:
            # Get all attendance-related keys
            pattern = "attendance:*"
            keys = self.redis.keys(pattern)
            
            # Filter keys related to this employee
            emp_keys = [key for key in keys if str(emp_id) in key.decode()]
            
            if emp_keys:
                self.redis.delete(*emp_keys)
                logger.info(f"Invalidated {len(emp_keys)} cache entries for employee {emp_id}")
        except Exception as e:
            logger.error(f"Error invalidating employee cache: {e}")
    
    async def invalidate_timetable_cache(self, timetable_id: int):
        """Invalidate timetable cache"""
        cache_key = self._generate_cache_key("timetable", timetable_id)
        try:
            self.redis.delete(cache_key)
            logger.info(f"Invalidated timetable cache for {timetable_id}")
        except Exception as e:
            logger.error(f"Error invalidating timetable cache: {e}")
    
    async def invalidate_shift_cache(self, shift_id: int):
        """Invalidate shift cache"""
        cache_key = self._generate_cache_key("shift", shift_id)
        try:
            self.redis.delete(cache_key)
            logger.info(f"Invalidated shift cache for {shift_id}")
        except Exception as e:
            logger.error(f"Error invalidating shift cache: {e}")
    
    async def invalidate_date_cache(self, date: str):
        """Invalidate all cache entries for a specific date"""
        try:
            pattern = "attendance:*"
            keys = self.redis.keys(pattern)
            
            # Filter keys related to this date
            date_keys = [key for key in keys if date in key.decode()]
            
            if date_keys:
                self.redis.delete(*date_keys)
                logger.info(f"Invalidated {len(date_keys)} cache entries for date {date}")
        except Exception as e:
            logger.error(f"Error invalidating date cache: {e}")
    
    async def get_cache_stats(self) -> Dict:
        """Get cache statistics"""
        try:
            pattern = "attendance:*"
            keys = self.redis.keys(pattern)
            
            stats = {
                "total_keys": len(keys),
                "memory_usage": 0,
                "key_types": {}
            }
            
            for key in keys:
                key_str = key.decode()
                key_type = key_str.split(":")[1] if ":" in key_str else "unknown"
                stats["key_types"][key_type] = stats["key_types"].get(key_type, 0) + 1
                
                # Get memory usage
                try:
                    memory = self.redis.memory_usage(key)
                    stats["memory_usage"] += memory
                except Exception as e:
                    logger.warning(f"Unexpected error: {e}")
            
            return stats
        except Exception as e:
            logger.error(f"Error getting cache stats: {e}")
            return {"error": str(e)}
    
    async def clear_expired_cache(self):
        """Clear expired cache entries"""
        try:
            pattern = "attendance:*"
            keys = self.redis.keys(pattern)
            
            expired_count = 0
            for key in keys:
                try:
                    ttl = self.redis.ttl(key)
                    if ttl == -1:  # No expiration set
                        # Set default expiration for keys without TTL
                        self.redis.expire(key, self.default_ttl)
                        expired_count += 1
                except Exception as e:
                    logger.warning(f"Unexpected error: {e}")
            
            logger.info(f"Set expiration for {expired_count} cache entries")
            return expired_count
        except Exception as e:
            logger.error(f"Error clearing expired cache: {e}")
            return 0

# Global instance
attendance_cache_service = AttendanceCacheService()
