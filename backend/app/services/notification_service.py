"""
Personnel Notification Service

This service handles comprehensive notification management for personnel,
including system notifications, alerts, reminders, and emergency notifications.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc

from ..models.personnel import Personnel
# from ..models.event import Event, EventTypeEnum  # Temporarily commented out
from ..core.database import get_db


class NotificationService:
    """Service for managing personnel notifications"""
    
    def __init__(self):
        # Notification types
        self.notification_types = [
            "SYSTEM",
            "ALERT", 
            "REMINDER",
            "EMERGENCY",
            "TRAINING",
            "MEDICAL",
            "SAFETY",
            "ADMINISTRATIVE",
            "SCHEDULE",
            "COMPLIANCE"
        ]
        
        # Notification priorities
        self.priorities = [
            "LOW",
            "MEDIUM", 
            "HIGH",
            "CRITICAL",
            "URGENT"
        ]
        
        # Notification channels
        self.channels = [
            "IN_APP",
            "EMAIL",
            "SMS",
            "PUSH",
            "WHATSAPP",
            "SYSTEM_LOG"
        ]
        
        # Default notification templates
        self.templates = {
            "TRAINING_EXPIRY": {
                "title": "Training Expiry Alert",
                "message": "Your {training_type} training expires on {expiry_date}",
                "type": "TRAINING",
                "priority": "HIGH"
            },
            "MEDICAL_EXPIRY": {
                "title": "Medical Certificate Expiry",
                "message": "Your medical certificate expires on {expiry_date}",
                "type": "MEDICAL", 
                "priority": "HIGH"
            },
            "BADGE_EXPIRY": {
                "title": "Badge Expiry Notice",
                "message": "Your access badge expires on {expiry_date}",
                "type": "SYSTEM",
                "priority": "MEDIUM"
            },
            "EMERGENCY_ALERT": {
                "title": "Emergency Alert",
                "message": "{emergency_type} - Please proceed to {location}",
                "type": "EMERGENCY",
                "priority": "URGENT"
            },
            "SCHEDULE_CHANGE": {
                "title": "Schedule Update",
                "message": "Your schedule has been updated: {details}",
                "type": "SCHEDULE",
                "priority": "MEDIUM"
            },
            "SAFETY_BREACH": {
                "title": "Safety Alert",
                "message": "Safety protocol breach detected: {details}",
                "type": "SAFETY",
                "priority": "HIGH"
            },
            "COMPLIANCE_REQUIRED": {
                "title": "Compliance Action Required",
                "message": "Compliance item requires attention: {details}",
                "type": "COMPLIANCE",
                "priority": "HIGH"
            }
        }
    
    async def create_notification(
        self,
        personnel_id: int,
        notification_data: Dict[str, Any],
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Create a new notification for personnel
        
        Args:
            personnel_id: Personnel ID
            notification_data: Notification details
            db: Database session
            
        Returns:
            Created notification information
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        # Validate notification data
        required_fields = ["title", "message", "type"]
        for field in required_fields:
            if not notification_data.get(field):
                raise ValueError(f"Missing required field: {field}")
        
        # Validate notification type and priority
        if notification_data.get('type') not in self.notification_types:
            notification_data['type'] = 'SYSTEM'
        
        if notification_data.get('priority') not in self.priorities:
            notification_data['priority'] = 'MEDIUM'
        
        # Create notification record
        notification_record = {
            "id": f"notif_{datetime.now(timezone.utc).timestamp()}",
            "title": notification_data.get('title'),
            "message": notification_data.get('message'),
            "type": notification_data.get('type'),
            "priority": notification_data.get('priority', 'MEDIUM'),
            "channel": notification_data.get('channel', 'IN_APP'),
            "sender": notification_data.get('sender', 'SYSTEM'),
            "action_required": notification_data.get('action_required', False),
            "action_url": notification_data.get('action_url'),
            "action_deadline": notification_data.get('action_deadline'),
            "metadata": notification_data.get('metadata', {}),
            "is_read": False,
            "is_archived": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "read_at": None,
            "expires_at": notification_data.get('expires_at')
        }
        
        # Initialize notifications if not exists
        if not hasattr(personnel, 'notifications') or not personnel.notifications:
            personnel.notifications = []
        
        # Add notification to personnel record
        personnel.notifications.append(notification_record)
        
        db.commit()
        db.refresh(personnel)
        
        return {
            "success": True,
            "notification_id": notification_record["id"],
            "personnel_id": personnel_id,
            "title": notification_record["title"],
            "type": notification_record["type"],
            "priority": notification_record["priority"],
            "message": "Notification created successfully"
        }
    
    async def create_bulk_notification(
        self,
        personnel_ids: List[int],
        notification_data: Dict[str, Any],
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Create notifications for multiple personnel
        
        Args:
            personnel_ids: List of personnel IDs
            notification_data: Notification details
            db: Database session
            
        Returns:
            Bulk notification creation result
        """
        if db is None:
            db = next(get_db())
        
        results = []
        failed = []
        
        for personnel_id in personnel_ids:
            try:
                result = await self.create_notification(personnel_id, notification_data, db)
                results.append(result)
            except Exception as e:
                failed.append({
                    "personnel_id": personnel_id,
                    "error": str(e)
                })
        
        return {
            "success": True,
            "total_sent": len(results),
            "total_failed": len(failed),
            "successful_notifications": results,
            "failed_notifications": failed,
            "message": f"Bulk notification completed: {len(results)} sent, {len(failed)} failed"
        }
    
    async def get_personnel_notifications(
        self,
        personnel_id: int,
        filters: Optional[Dict[str, Any]] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Get personnel notifications with filtering
        
        Args:
            personnel_id: Personnel ID
            filters: Filter criteria (optional)
            db: Database session
            
        Returns:
            Personnel notifications
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        notifications = getattr(personnel, 'notifications', [])
        
        # Apply filters
        if filters:
            # Filter by type
            if filters.get('type'):
                notifications = [n for n in notifications if n.get('type') == filters['type']]
            
            # Filter by priority
            if filters.get('priority'):
                notifications = [n for n in notifications if n.get('priority') == filters['priority']]
            
            # Filter by read status
            if 'is_read' in filters:
                notifications = [n for n in notifications if n.get('is_read') == filters['is_read']]
            
            # Filter by archived status
            if 'is_archived' in filters:
                notifications = [n for n in notifications if n.get('is_archived') == filters['is_archived']]
            
            # Filter by date range
            if filters.get('date_from'):
                date_from = datetime.fromisoformat(filters['date_from'])
                notifications = [n for n in notifications 
                               if datetime.fromisoformat(n['created_at']) >= date_from]
            
            if filters.get('date_to'):
                date_to = datetime.fromisoformat(filters['date_to'])
                notifications = [n for n in notifications 
                               if datetime.fromisoformat(n['created_at']) <= date_to]
        
        # Sort by created date (newest first)
        notifications.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        # Pagination
        page = filters.get('page', 1) if filters else 1
        per_page = filters.get('per_page', 20) if filters else 20
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        
        paginated_notifications = notifications[start_idx:end_idx]
        
        return {
            "personnel_id": personnel_id,
            "notifications": paginated_notifications,
            "total_count": len(notifications),
            "page": page,
            "per_page": per_page,
            "total_pages": (len(notifications) + per_page - 1) // per_page,
            "unread_count": len([n for n in notifications if not n.get('is_read', False)]),
            "unread_critical_count": len([n for n in notifications 
                                       if not n.get('is_read', False) and n.get('priority') in ['CRITICAL', 'URGENT']])
        }
    
    async def mark_notification_read(
        self,
        personnel_id: int,
        notification_id: str,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Mark notification as read
        
        Args:
            personnel_id: Personnel ID
            notification_id: Notification ID
            db: Database session
            
        Returns:
            Update result
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        if not hasattr(personnel, 'notifications'):
            raise ValueError("No notifications found for personnel")
        
        # Find and update notification
        notification_found = False
        for notification in personnel.notifications:
            if notification.get('id') == notification_id:
                notification['is_read'] = True
                notification['read_at'] = datetime.now(timezone.utc).isoformat()
                notification_found = True
                break
        
        if not notification_found:
            raise ValueError(f"Notification with ID {notification_id} not found")
        
        db.commit()
        
        return {
            "success": True,
            "notification_id": notification_id,
            "read_at": datetime.now(timezone.utc).isoformat(),
            "message": "Notification marked as read"
        }
    
    async def mark_all_notifications_read(
        self,
        personnel_id: int,
        filters: Optional[Dict[str, Any]] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Mark all notifications as read (with optional filters)
        
        Args:
            personnel_id: Personnel ID
            filters: Filter criteria (optional)
            db: Database session
            
        Returns:
            Update result
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        if not hasattr(personnel, 'notifications'):
            return {"success": True, "marked_count": 0, "message": "No notifications found"}
        
        # Apply filters if provided
        notifications_to_mark = personnel.notifications
        if filters:
            if filters.get('type'):
                notifications_to_mark = [n for n in notifications_to_mark if n.get('type') == filters['type']]
            if filters.get('priority'):
                notifications_to_mark = [n for n in notifications_to_mark if n.get('priority') == filters['priority']]
        
        # Mark notifications as read
        marked_count = 0
        current_time = datetime.now(timezone.utc).isoformat()
        for notification in notifications_to_mark:
            if not notification.get('is_read', False):
                notification['is_read'] = True
                notification['read_at'] = current_time
                marked_count += 1
        
        db.commit()
        
        return {
            "success": True,
            "marked_count": marked_count,
            "message": f"Marked {marked_count} notifications as read"
        }
    
    async def archive_notification(
        self,
        personnel_id: int,
        notification_id: str,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Archive notification
        
        Args:
            personnel_id: Personnel ID
            notification_id: Notification ID
            db: Database session
            
        Returns:
            Archive result
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        if not hasattr(personnel, 'notifications'):
            raise ValueError("No notifications found for personnel")
        
        # Find and archive notification
        notification_found = False
        for notification in personnel.notifications:
            if notification.get('id') == notification_id:
                notification['is_archived'] = True
                notification['archived_at'] = datetime.now(timezone.utc).isoformat()
                notification_found = True
                break
        
        if not notification_found:
            raise ValueError(f"Notification with ID {notification_id} not found")
        
        db.commit()
        
        return {
            "success": True,
            "notification_id": notification_id,
            "archived_at": datetime.now(timezone.utc).isoformat(),
            "message": "Notification archived successfully"
        }
    
    async def delete_notification(
        self,
        personnel_id: int,
        notification_id: str,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Delete notification
        
        Args:
            personnel_id: Personnel ID
            notification_id: Notification ID
            db: Database session
            
        Returns:
            Delete result
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        if not hasattr(personnel, 'notifications'):
            raise ValueError("No notifications found for personnel")
        
        # Remove notification
        original_count = len(personnel.notifications)
        personnel.notifications = [
            notification for notification in personnel.notifications
            if notification.get('id') != notification_id
        ]
        
        if len(personnel.notifications) == original_count:
            raise ValueError(f"Notification with ID {notification_id} not found")
        
        db.commit()
        
        return {
            "success": True,
            "notification_id": notification_id,
            "message": "Notification deleted successfully"
        }
    
    async def get_notification_summary(
        self,
        personnel_id: Optional[int] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Get notification summary statistics
        
        Args:
            personnel_id: Personnel ID (optional, for specific personnel)
            db: Database session
            
        Returns:
            Notification summary
        """
        if db is None:
            db = next(get_db())
        
        if personnel_id:
            # Get specific personnel notifications
            personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
            if not personnel:
                raise ValueError(f"Personnel with ID {personnel_id} not found")
            
            personnel_list = [personnel]
        else:
            # Get all personnel
            personnel_list = db.query(Personnel).all()
        
        # Initialize summary
        summary = {
            "total_personnel": len(personnel_list),
            "total_notifications": 0,
            "unread_notifications": 0,
            "unread_critical_notifications": 0,
            "notifications_by_type": {},
            "notifications_by_priority": {},
            "notifications_by_channel": {},
            "recent_notifications": [],
            "expired_notifications": 0,
            "action_required_notifications": 0,
            "personnel_with_notifications": 0
        }
        
        # Aggregate data
        current_time = datetime.now(timezone.utc)
        for person in personnel_list:
            personnel_has_notifications = False
            notifications = getattr(person, 'notifications', [])
            
            for notification in notifications:
                personnel_has_notifications = True
                summary['total_notifications'] += 1
                
                # Count unread
                if not notification.get('is_read', False):
                    summary['unread_notifications'] += 1
                    
                    # Count unread critical/urgent
                    if notification.get('priority') in ['CRITICAL', 'URGENT']:
                        summary['unread_critical_notifications'] += 1
                
                # Count by type
                notif_type = notification.get('type', 'SYSTEM')
                summary['notifications_by_type'][notif_type] = summary['notifications_by_type'].get(notif_type, 0) + 1
                
                # Count by priority
                priority = notification.get('priority', 'MEDIUM')
                summary['notifications_by_priority'][priority] = summary['notifications_by_priority'].get(priority, 0) + 1
                
                # Count by channel
                channel = notification.get('channel', 'IN_APP')
                summary['notifications_by_channel'][channel] = summary['notifications_by_channel'].get(channel, 0) + 1
                
                # Count expired
                expires_at = notification.get('expires_at')
                if expires_at:
                    expiry_time = datetime.fromisoformat(expires_at.replace('Z', '+00:00') if expires_at.endswith('Z') else expires_at)
                    if expiry_time < current_time:
                        summary['expired_notifications'] += 1
                
                # Count action required
                if notification.get('action_required', False):
                    summary['action_required_notifications'] += 1
                
                # Get recent notifications (last 24 hours)
                created_time = datetime.fromisoformat(notification['created_at'].replace('Z', '+00:00') if notification['created_at'].endswith('Z') else notification['created_at'])
                if created_time > current_time - timedelta(hours=24):
                    summary['recent_notifications'].append({
                        "personnel_id": person.id,
                        "personnel_name": person.full_name,
                        "notification_id": notification['id'],
                        "title": notification['title'],
                        "type": notification['type'],
                        "priority": notification['priority'],
                        "created_at": notification['created_at']
                    })
            
            if personnel_has_notifications:
                summary['personnel_with_notifications'] += 1
        
        # Sort recent notifications by creation time
        summary['recent_notifications'].sort(key=lambda x: x['created_at'], reverse=True)
        
        return summary
    
    async def create_system_notification(
        self,
        template_key: str,
        recipients: List[int],
        template_data: Dict[str, Any],
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Create system notification using template
        
        Args:
            template_key: Template key from self.templates
            recipients: List of personnel IDs
            template_data: Data to populate template
            db: Database session
            
        Returns:
            System notification creation result
        """
        if template_key not in self.templates:
            raise ValueError(f"Template key '{template_key}' not found")
        
        template = self.templates[template_key]
        
        # Populate template
        notification_data = {
            "title": template['title'].format(**template_data),
            "message": template['message'].format(**template_data),
            "type": template['type'],
            "priority": template['priority'],
            "sender": "SYSTEM",
            "metadata": {
                "template_key": template_key,
                "template_data": template_data,
                "auto_generated": True
            }
        }
        
        return await self.create_bulk_notification(recipients, notification_data, db)
    
    async def cleanup_expired_notifications(
        self,
        days_old: int = 30,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Clean up old expired notifications
        
        Args:
            days_old: Number of days to keep notifications
            db: Database session
            
        Returns:
            Cleanup result
        """
        if db is None:
            db = next(get_db())
        
        # Get all personnel
        personnel_list = db.query(Personnel).all()
        
        total_deleted = 0
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)
        
        for person in personnel_list:
            if not hasattr(person, 'notifications'):
                continue
            
            original_count = len(person.notifications)
            
            # Remove old notifications
            person.notifications = [
                notification for notification in person.notifications
                if datetime.fromisoformat(notification['created_at'].replace('Z', '+00:00') if notification['created_at'].endswith('Z') else notification['created_at']) > cutoff_date
            ]
            
            deleted_count = original_count - len(person.notifications)
            total_deleted += deleted_count
        
        db.commit()
        
        return {
            "success": True,
            "total_deleted": total_deleted,
            "cutoff_date": cutoff_date.isoformat(),
            "message": f"Cleaned up {total_deleted} old notifications"
        }


# Create singleton instance
notification_service = NotificationService()
