"""
Personnel Attendance History Tracking Service

This service handles comprehensive attendance tracking for personnel,
including check-in/check-out records, attendance patterns, and analytics.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc, extract

from ..models.personnel import Personnel
from ..models.event import Event
from ..core.database import get_db


class AttendanceService:
    """Service for managing personnel attendance tracking"""
    
    def __init__(self):
        # Attendance event types
        self.attendance_events = ["CHECKIN", "CHECKOUT", "BOARDING", "DISEMBARK"]
        
        # Attendance status types
        self.attendance_status = [
            "PRESENT",
            "ABSENT",
            "LATE",
            "EARLY_DEPARTURE",
            "OVERTIME",
            "LEAVE",
            "SICK_LEAVE",
            "ANNUAL_LEAVE"
        ]
        
        # Work shift types
        self.shift_types = [
            "DAY_SHIFT",
            "NIGHT_SHIFT", 
            "ROTATION_SHIFT",
            "FLEXIBLE_SHIFT",
            "CALL_SHIFT",
            "OVERTIME_SHIFT"
        ]
    
    async def record_attendance_event(
        self,
        personnel_id: int,
        event_type: str,
        event_data: Dict[str, Any],
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Record an attendance event for personnel
        
        Args:
            personnel_id: Personnel ID
            event_type: Event type (CHECKIN, CHECKOUT, etc.)
            event_data: Event details (location, device, etc.)
            db: Database session
            
        Returns:
            Recorded attendance event information
        """
        if db is None:
            db = next(get_db())
        
        # Validate event type
        if event_type not in self.attendance_events:
            raise ValueError(f"Invalid event type: {event_type}")
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        # Create attendance event
        attendance_event = Event(
            personnel_id=personnel_id,
            event_type=event_type,
            timestamp=event_data.get('timestamp', datetime.now(timezone.utc)),
            description=f"Attendance event: {event_type}",
            event_metadata={
                **event_data,
                'attendance_recorded': True,
                'recorded_by': 'attendance_service'
            }
        )
        
        db.add(attendance_event)
        db.commit()
        db.refresh(attendance_event)
        
        # Update personnel attendance status
        await self._update_attendance_status(personnel_id, event_type, db)
        
        return {
            "success": True,
            "event_id": attendance_event.id,
            "personnel_id": personnel_id,
            "event_type": event_type,
            "timestamp": attendance_event.timestamp.isoformat(),
            "location": event_data.get('location'),
            "message": f"Attendance event {event_type} recorded successfully"
        }
    
    async def get_personnel_attendance_history(
        self,
        personnel_id: int,
        filters: Optional[Dict[str, Any]] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Get personnel attendance history with filtering
        
        Args:
            personnel_id: Personnel ID
            filters: Filter criteria (date range, event types, etc.)
            db: Database session
            
        Returns:
            Personnel attendance history
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        # Build base query
        query = db.query(Event).filter(
            Event.personnel_id == personnel_id,
            Event.event_type.in_(self.attendance_events)
        )
        
        # Apply filters
        if filters:
            # Date range filter
            if filters.get('date_from'):
                date_from = datetime.fromisoformat(filters['date_from'])
                query = query.filter(Event.timestamp >= date_from)
            
            if filters.get('date_to'):
                date_to = datetime.fromisoformat(filters['date_to'])
                query = query.filter(Event.timestamp <= date_to)
            
            # Event type filter
            if filters.get('event_types'):
                query = query.filter(Event.event_type.in_(filters['event_types']))
            
            # Location filter (from metadata)
            if filters.get('location'):
                query = query.filter(Event.event_metadata['location'].astext == filters['location'])
            
            # Device filter (from metadata)
            if filters.get('device_id'):
                query = query.filter(Event.event_metadata['device_id'].astext == filters['device_id'])
        
        # Order by timestamp (newest first)
        query = query.order_by(desc(Event.timestamp))
        
        # Pagination
        page = filters.get('page', 1) if filters else 1
        per_page = filters.get('per_page', 50) if filters else 50
        offset = (page - 1) * per_page
        
        total_count = query.count()
        events = query.offset(offset).limit(per_page).all()
        
        # Format events
        formatted_events = []
        for event in events:
            metadata = event.event_metadata or {}
            formatted_events.append({
                "id": event.id,
                "event_type": event.event_type,
                "timestamp": event.timestamp.isoformat(),
                "location": metadata.get('location'),
                "device_id": metadata.get('device_id'),
                "raw_data": metadata
            })
        
        return {
            "personnel_id": personnel_id,
            "personnel_name": personnel.full_name,
            "attendance_events": formatted_events,
            "total_count": total_count,
            "page": page,
            "per_page": per_page,
            "total_pages": (total_count + per_page - 1) // per_page
        }
    
    async def get_daily_attendance_summary(
        self,
        date: Optional[str] = None,
        location: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Get daily attendance summary
        
        Args:
            date: Date string (YYYY-MM-DD) or None for today
            location: Filter by location (optional)
            db: Database session
            
        Returns:
            Daily attendance summary
        """
        if db is None:
            db = next(get_db())
        
        # Set date (default to today)
        if date:
            target_date = datetime.fromisoformat(date).date()
        else:
            target_date = datetime.now(timezone.utc).date()
        
        # Create date range (full day)
        start_of_day = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        end_of_day = datetime.combine(target_date, datetime.max.time()).replace(tzinfo=timezone.utc)
        
        # Build query
        query = db.query(Event).filter(
            Event.timestamp >= start_of_day,
            Event.timestamp <= end_of_day,
            Event.event_type.in_(self.attendance_events)
        )
        
        if location:
            query = query.filter(Event.location == location)
        
        events = query.all()
        
        # Initialize summary
        summary = {
            "date": target_date.isoformat(),
            "location": location or "All Locations",
            "total_personnel": db.query(Personnel).filter(Personnel.is_active == True).count(),
            "present_today": set(),
            "checked_in": 0,
            "checked_out": 0,
            "boarded": 0,
            "disembarked": 0,
            "late_arrivals": 0,
            "early_departures": 0,
            "attendance_by_location": {},
            "attendance_by_shift": {},
            "attendance_events": []
        }
        
        # Process events
        for event in events:
            metadata = event.event_metadata or {}
            # Count by event type
            if event.event_type == "CHECKIN":
                summary["checked_in"] += 1
                summary["present_today"].add(event.personnel_id)
            elif event.event_type == "CHECKOUT":
                summary["checked_out"] += 1
            elif event.event_type == "BOARDING":
                summary["boarded"] += 1
                summary["present_today"].add(event.personnel_id)
            elif event.event_type == "DISEMBARK":
                summary["disembarked"] += 1
            
            # Count by location
            loc = metadata.get('location') or "Unknown"
            if loc not in summary["attendance_by_location"]:
                summary["attendance_by_location"][loc] = {
                    "CHECKIN": 0,
                    "CHECKOUT": 0,
                    "BOARDING": 0,
                    "DISEMBARK": 0
                }
            summary["attendance_by_location"][loc][event.event_type] += 1
            
            # Add to events list
            summary["attendance_events"].append({
                "id": event.id,
                "personnel_id": event.personnel_id,
                "event_type": event.event_type,
                "timestamp": event.timestamp.isoformat(),
                "location": metadata.get('location'),
                "device_id": metadata.get('device_id')
            })
        
        # Calculate final metrics
        summary["present_today"] = len(summary["present_today"])
        summary["absent_today"] = summary["total_personnel"] - summary["present_today"]
        summary["attendance_rate"] = round(
            (summary["present_today"] / summary["total_personnel"]) * 100, 2
        ) if summary["total_personnel"] > 0 else 0
        
        return summary
    
    async def get_attendance_analytics(
        self,
        date_from: str,
        date_to: str,
        group_by: str = "day",
        location: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Get attendance analytics for date range
        
        Args:
            date_from: Start date (YYYY-MM-DD)
            date_to: End date (YYYY-MM-DD)
            group_by: Grouping period (day, week, month)
            location: Filter by location (optional)
            db: Database session
            
        Returns:
            Attendance analytics
        """
        if db is None:
            db = next(get_db())
        
        # Parse dates
        start_date = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
        end_date = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
        
        # Build base query
        query = db.query(Event).filter(
            Event.timestamp >= start_date,
            Event.timestamp <= end_date,
            Event.event_type.in_(self.attendance_events)
        )
        
        if location:
            query = query.filter(Event.location == location)
        
        events = query.all()
        
        # Group events by period
        grouped_data = {}
        
        for event in events:
            # Determine grouping key based on group_by
            if group_by == "day":
                key = event.timestamp.date().isoformat()
            elif group_by == "week":
                week_start = event.timestamp.date() - timedelta(days=event.timestamp.weekday())
                key = f"Week of {week_start.isoformat()}"
            elif group_by == "month":
                key = event.timestamp.strftime("%Y-%m")
            else:
                key = event.timestamp.date().isoformat()
            
            if key not in grouped_data:
                grouped_data[key] = {
                    "date": key,
                    "CHECKIN": 0,
                    "CHECKOUT": 0,
                    "BOARDING": 0,
                    "DISEMBARK": 0,
                    "unique_personnel": set()
                }
            
            grouped_data[key][event.event_type] += 1
            grouped_data[key]["unique_personnel"].add(event.personnel_id)
        
        # Convert sets to counts and sort by date
        analytics_data = []
        for key in sorted(grouped_data.keys()):
            data = grouped_data[key]
            analytics_data.append({
                "date": data["date"],
                "checkins": data["CHECKIN"],
                "checkouts": data["CHECKOUT"],
                "boardings": data["BOARDING"],
                "disembarks": data["DISEMBARK"],
                "unique_personnel": len(data["unique_personnel"])
            })
        
        # Calculate overall statistics
        total_events = len(events)
        total_personnel = len(set(event.personnel_id for event in events))
        
        # Event type distribution
        event_distribution = {}
        for event_type in self.attendance_events:
            count = sum(1 for event in events if event.event_type == event_type)
            event_distribution[event_type] = count
        
        return {
            "date_range": {
                "start": date_from,
                "end": date_to,
                "group_by": group_by
            },
            "location": location or "All Locations",
            "total_events": total_events,
            "total_personnel": total_personnel,
            "event_distribution": event_distribution,
            "analytics_data": analytics_data
        }
    
    async def calculate_attendance_statistics(
        self,
        personnel_id: int,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Calculate attendance statistics for personnel
        
        Args:
            personnel_id: Personnel ID
            date_from: Start date (optional)
            date_to: End date (optional)
            db: Database session
            
        Returns:
            Attendance statistics
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        # Set date range (default to last 30 days)
        if not date_to:
            date_to = datetime.now(timezone.utc)
        else:
            date_to = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
        
        if not date_from:
            date_from = date_to - timedelta(days=30)
        else:
            date_from = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
        
        # Get attendance events
        events = db.query(Event).filter(
            Event.personnel_id == personnel_id,
            Event.timestamp >= date_from,
            Event.timestamp <= date_to,
            Event.event_type.in_(self.attendance_events)
        ).order_by(Event.timestamp).all()
        
        # Initialize statistics
        stats = {
            "personnel_id": personnel_id,
            "personnel_name": personnel.full_name,
            "date_range": {
                "start": date_from.date().isoformat(),
                "end": date_to.date().isoformat()
            },
            "total_days": (date_to.date() - date_from.date()).days + 1,
            "attendance_events": len(events),
            "checkins": 0,
            "checkouts": 0,
            "boardings": 0,
            "disembarks": 0,
            "unique_days_present": set(),
            "average_checkin_time": None,
            "average_checkout_time": None,
            "late_arrivals": 0,
            "early_departures": 0,
            "attendance_pattern": []
        }
        
        # Process events and calculate patterns
        checkin_times = []
        checkout_times = []
        daily_events = {}
        
        for event in events:
            metadata = event.event_metadata or {}
            # Count event types
            if event.event_type == "CHECKIN":
                stats["checkins"] += 1
                checkin_times.append(event.timestamp.time())
                stats["unique_days_present"].add(event.timestamp.date())
            elif event.event_type == "CHECKOUT":
                stats["checkouts"] += 1
                checkout_times.append(event.timestamp.time())
            elif event.event_type == "BOARDING":
                stats["boardings"] += 1
                stats["unique_days_present"].add(event.timestamp.date())
            elif event.event_type == "DISEMBARK":
                stats["disembarks"] += 1
            
            # Group events by day for pattern analysis
            day_key = event.timestamp.date().isoformat()
            if day_key not in daily_events:
                daily_events[day_key] = []
            daily_events[day_key].append({
                "type": event.event_type,
                "time": event.timestamp.time().isoformat(),
                "location": metadata.get('location')
            })
        
        # Calculate averages
        if checkin_times:
            total_seconds = sum(t.hour * 3600 + t.minute * 60 + t.second for t in checkin_times)
            avg_seconds = total_seconds // len(checkin_times)
            avg_hour = avg_seconds // 3600
            avg_minute = (avg_seconds % 3600) // 60
            stats["average_checkin_time"] = f"{avg_hour:02d}:{avg_minute:02d}"
        
        if checkout_times:
            total_seconds = sum(t.hour * 3600 + t.minute * 60 + t.second for t in checkout_times)
            avg_seconds = total_seconds // len(checkout_times)
            avg_hour = avg_seconds // 3600
            avg_minute = (avg_seconds % 3600) // 60
            stats["average_checkout_time"] = f"{avg_hour:02d}:{avg_minute:02d}"
        
        # Convert sets to counts
        stats["unique_days_present"] = len(stats["unique_days_present"])
        stats["attendance_rate"] = round(
            (stats["unique_days_present"] / stats["total_days"]) * 100, 2
        )
        
        # Create attendance pattern
        for day in sorted(daily_events.keys()):
            stats["attendance_pattern"].append({
                "date": day,
                "events": daily_events[day]
            })
        
        return stats
    
    async def _update_attendance_status(
        self,
        personnel_id: int,
        event_type: str,
        db: Session
    ):
        """Update personnel attendance status based on event"""
        # This could be expanded to update a dedicated attendance status field
        # For now, we rely on the event-based tracking
        pass
    
    async def get_attendance_exceptions(
        self,
        date: Optional[str] = None,
        location: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Get attendance exceptions (late arrivals, early departures, no-shows)
        
        Args:
            date: Date string (YYYY-MM-DD) or None for today
            location: Filter by location (optional)
            db: Database session
            
        Returns:
            Attendance exceptions
        """
        if db is None:
            db = next(get_db())
        
        # Set date (default to today)
        if date:
            target_date = datetime.fromisoformat(date).date()
        else:
            target_date = datetime.now(timezone.utc).date()
        
        # Create date range (full day)
        start_of_day = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        end_of_day = datetime.combine(target_date, datetime.max.time()).replace(tzinfo=timezone.utc)
        
        # Get all active personnel
        active_personnel = db.query(Personnel).filter(Personnel.is_active == True).all()
        
        # Get attendance events for the day
        events = db.query(Event).filter(
            Event.timestamp >= start_of_day,
            Event.timestamp <= end_of_day,
            Event.event_type.in_(self.attendance_events)
        ).all()
        
        # Group events by personnel
        personnel_events = {}
        for event in events:
            if event.personnel_id not in personnel_events:
                personnel_events[event.personnel_id] = []
            personnel_events[event.personnel_id].append(event)
        
        # Find exceptions
        exceptions = {
            "date": target_date.isoformat(),
            "location": location or "All Locations",
            "no_shows": [],
            "late_arrivals": [],
            "early_departures": [],
            "missing_checkout": [],
            "total_exceptions": 0
        }
        
        # Define business hours (could be configurable)
        checkin_deadline = datetime.combine(target_date, datetime.strptime("09:00", "%H:%M").time()).replace(tzinfo=timezone.utc)
        checkout_earliest = datetime.combine(target_date, datetime.strptime("16:00", "%H:%M").time()).replace(tzinfo=timezone.utc)
        
        for person in active_personnel:
            person_events = personnel_events.get(person.id, [])
            
            # Check for no-show (no attendance events)
            if not person_events:
                exceptions["no_shows"].append({
                    "personnel_id": person.id,
                    "personnel_name": person.full_name,
                    "badge_id": person.badge_id,
                    "exception_type": "NO_SHOW"
                })
                continue
            
            # Check for late arrival
            checkin_events = [e for e in person_events if e.event_type == "CHECKIN"]
            if checkin_events:
                first_checkin = min(checkin_events, key=lambda x: x.timestamp)
                if first_checkin.timestamp > checkin_deadline:
                    exceptions["late_arrivals"].append({
                        "personnel_id": person.id,
                        "personnel_name": person.full_name,
                        "badge_id": person.badge_id,
                        "checkin_time": first_checkin.timestamp.isoformat(),
                        "minutes_late": int((first_checkin.timestamp - checkin_deadline).total_seconds() / 60),
                        "exception_type": "LATE_ARRIVAL"
                    })
            
            # Check for early departure
            checkout_events = [e for e in person_events if e.event_type == "CHECKOUT"]
            if checkout_events:
                last_checkout = max(checkout_events, key=lambda x: x.timestamp)
                if last_checkout.timestamp < checkout_earliest:
                    exceptions["early_departures"].append({
                        "personnel_id": person.id,
                        "personnel_name": person.full_name,
                        "badge_id": person.badge_id,
                        "checkout_time": last_checkout.timestamp.isoformat(),
                        "minutes_early": int((checkout_earliest - last_checkout.timestamp).total_seconds() / 60),
                        "exception_type": "EARLY_DEPARTURE"
                    })
            
            # Check for missing checkout (has checkin but no checkout)
            if checkin_events and not checkout_events:
                exceptions["missing_checkout"].append({
                    "personnel_id": person.id,
                    "personnel_name": person.full_name,
                    "badge_id": person.badge_id,
                    "last_checkin": max(checkin_events, key=lambda x: x.timestamp).timestamp.isoformat(),
                    "exception_type": "MISSING_CHECKOUT"
                })
        
        # Calculate total exceptions
        exceptions["total_exceptions"] = (
            len(exceptions["no_shows"]) +
            len(exceptions["late_arrivals"]) +
            len(exceptions["early_departures"]) +
            len(exceptions["missing_checkout"])
        )
        
        return exceptions


# Create singleton instance
attendance_service = AttendanceService()
