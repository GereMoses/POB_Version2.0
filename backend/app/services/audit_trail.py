"""
Personnel Audit Trail Service

This service handles audit trail and history tracking for personnel,
including change tracking, activity logging, and compliance auditing.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
import json

from ..models.personnel import Personnel, AttendanceLog
from ..core.database import get_db


class AuditTrailService:
    """Service for managing personnel audit trail and history"""
    
    def __init__(self):
        # Standard audit event types
        self.event_types = {
            "PERSONNEL_CREATED": "Personnel record created",
            "PERSONNEL_UPDATED": "Personnel record updated",
            "PERSONNEL_DELETED": "Personnel record deleted",
            "STATUS_CHANGED": "Personnel status changed",
            "LOCATION_UPDATED": "Personnel location updated",
            "PHOTO_UPLOADED": "Personnel photo uploaded",
            "PHOTO_DELETED": "Personnel photo deleted",
            "CERTIFICATION_ADDED": "Certification added",
            "CERTIFICATION_UPDATED": "Certification updated",
            "CERTIFICATION_DELETED": "Certification deleted",
            "TRAINING_ADDED": "Training record added",
            "TRAINING_UPDATED": "Training record updated",
            "TRAINING_DELETED": "Training record deleted",
            "EMERGENCY_CONTACT_ADDED": "Emergency contact added",
            "EMERGENCY_CONTACT_UPDATED": "Emergency contact updated",
            "EMERGENCY_CONTACT_DELETED": "Emergency contact deleted",
            "MEDICAL_FITNESS_ADDED": "Medical fitness record added",
            "MEDICAL_FITNESS_UPDATED": "Medical fitness record updated",
            "MEDICAL_ALERT_CREATED": "Medical alert created",
            "BADGE_CREATED": "Badge created",
            "BADGE_UPDATED": "Badge updated",
            "BADGE_PRINTED": "Badge printed",
            "CHECK_IN": "Personnel checked in",
            "CHECK_OUT": "Personnel checked out",
            "BIOMETRIC_CAPTURED": "Biometric data captured",
            "BIOMETRIC_VERIFIED": "Biometric data verified",
            "BULK_IMPORT": "Bulk personnel import",
            "LOGIN": "User login",
            "LOGOUT": "User logout",
            "PASSWORD_CHANGED": "Password changed",
            "ROLE_CHANGED": "User role changed",
            "PERMISSIONS_CHANGED": "User permissions changed"
        }
        
        # Standard audit severity levels
        self.severity_levels = {
            "LOW": "Routine operation",
            "MEDIUM": "Important change",
            "HIGH": "Critical change",
            "CRITICAL": "Security incident"
        }
    
    async def create_audit_entry(
        self,
        personnel_id: int,
        event_type: str,
        description: str,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        severity: str = "LOW",
        user_id: Optional[int] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Create audit entry for personnel
        
        Args:
            personnel_id: Personnel ID
            event_type: Type of event
            description: Event description
            old_values: Previous values (optional)
            new_values: New values (optional)
            severity: Event severity level
            user_id: User who performed the action (optional)
            ip_address: IP address of the action (optional)
            user_agent: User agent string (optional)
            db: Database session
            
        Returns:
            Created audit entry
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        # Create audit entry
        audit_entry = {
            "id": f"audit_{datetime.now(timezone.utc).timestamp()}",
            "personnel_id": personnel_id,
            "event_type": event_type,
            "description": description,
            "old_values": old_values or {},
            "new_values": new_values or {},
            "severity": severity,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": user_id,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Store audit entry in personnel record
        if not hasattr(personnel, 'audit_trail') or not personnel.audit_trail:
            personnel.audit_trail = []
        
        personnel.audit_trail.append(audit_entry)
        db.commit()
        db.refresh(personnel)
        
        return {
            "success": True,
            "audit_id": audit_entry["id"],
            "personnel_id": personnel_id,
            "event_type": event_type,
            "timestamp": audit_entry["timestamp"],
            "message": "Audit entry created successfully"
        }
    
    async def get_personnel_audit_trail(
        self,
        personnel_id: int,
        event_type: Optional[str] = None,
        severity: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        db: Session = None
    ) -> List[Dict[str, Any]]:
        """
        Get personnel audit trail
        
        Args:
            personnel_id: Personnel ID
            event_type: Filter by event type (optional)
            severity: Filter by severity (optional)
            start_date: Filter by start date (optional)
            end_date: Filter by end date (optional)
            limit: Maximum number of records to return
            db: Database session
            
        Returns:
            List of audit entries
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        audit_trail = getattr(personnel, 'audit_trail', [])
        
        # Apply filters
        if event_type:
            audit_trail = [
                entry for entry in audit_trail
                if entry.get('event_type') == event_type
            ]
        
        if severity:
            audit_trail = [
                entry for entry in audit_trail
                if entry.get('severity') == severity
            ]
        
        if start_date:
            audit_trail = [
                entry for entry in audit_trail
                if datetime.fromisoformat(entry.get('timestamp', '').replace('Z', '+00:00')) >= start_date
            ]
        
        if end_date:
            audit_trail = [
                entry for entry in audit_trail
                if datetime.fromisoformat(entry.get('timestamp', '').replace('Z', '+00:00')) <= end_date
            ]
        
        # Sort by timestamp descending
        audit_trail.sort(
            key=lambda x: x.get('timestamp', ''),
            reverse=True
        )
        
        # Apply limit
        audit_trail = audit_trail[:limit]
        
        return audit_trail
    
    async def get_audit_summary(
        self,
        personnel_id: int,
        days: int = 30,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Get audit summary for personnel
        
        Args:
            personnel_id: Personnel ID
            days: Number of days to analyze
            db: Database session
            
        Returns:
            Audit summary statistics
        """
        if db is None:
            db = next(get_db())
        
        # Calculate date range
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=days)
        
        # Get audit trail
        audit_trail = await self.get_personnel_audit_trail(
            personnel_id=personnel_id,
            start_date=start_date,
            end_date=end_date,
            limit=1000,
            db=db
        )
        
        # Initialize summary
        summary = {
            "personnel_id": personnel_id,
            "period_days": days,
            "total_events": len(audit_trail),
            "event_type_distribution": {},
            "severity_distribution": {},
            "daily_activity": {},
            "most_active_days": [],
            "recent_events": audit_trail[:10],
            "high_severity_events": []
        }
        
        # Process audit entries
        daily_counts = {}
        for entry in audit_trail:
            # Count event types
            event_type = entry.get('event_type', 'UNKNOWN')
            summary['event_type_distribution'][event_type] = summary['event_type_distribution'].get(event_type, 0) + 1
            
            # Count severity levels
            severity = entry.get('severity', 'LOW')
            summary['severity_distribution'][severity] = summary['severity_distribution'].get(severity, 0) + 1
            
            # Count daily activity
            try:
                entry_date = datetime.fromisoformat(entry.get('timestamp', '').replace('Z', '+00:00')).date()
                date_str = entry_date.isoformat()
                daily_counts[date_str] = daily_counts.get(date_str, 0) + 1
            except ValueError:
                continue
            
            # Collect high severity events
            if severity in ['HIGH', 'CRITICAL']:
                summary['high_severity_events'].append(entry)
        
        # Update daily activity
        summary['daily_activity'] = daily_counts
        
        # Get most active days
        sorted_days = sorted(daily_counts.items(), key=lambda x: x[1], reverse=True)
        summary['most_active_days'] = sorted_days[:10]
        
        return summary
    
    async def get_system_audit_report(
        self,
        days: int = 30,
        event_type: Optional[str] = None,
        severity: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Get system-wide audit report
        
        Args:
            days: Number of days to analyze
            event_type: Filter by event type (optional)
            severity: Filter by severity (optional)
            db: Database session
            
        Returns:
            System audit report
        """
        if db is None:
            db = next(get_db())
        
        # Calculate date range
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=days)
        
        # Get all personnel with audit trails
        personnel_list = db.query(Personnel).all()
        
        # Initialize report
        report = {
            "period_days": days,
            "total_personnel": len(personnel_list),
            "personnel_with_activity": 0,
            "total_events": 0,
            "event_type_distribution": {},
            "severity_distribution": {},
            "top_active_personnel": [],
            "daily_activity": {},
            "high_severity_events": [],
            "compliance_alerts": []
        }
        
        # Process audit trails
        personnel_activity = []
        daily_counts = {}
        high_severity_events = []
        
        for person in personnel_list:
            if hasattr(person, 'audit_trail') and person.audit_trail:
                personnel_activity.append({
                    "personnel_id": person.id,
                    "badge_id": person.badge_id,
                    "full_name": person.full_name,
                    "activity_count": len(person.audit_trail)
                })
                
                for entry in person.audit_trail:
                    # Filter by date range
                    try:
                        entry_date = datetime.fromisoformat(entry.get('timestamp', '').replace('Z', '+00:00'))
                        if start_date <= entry_date <= end_date:
                            # Apply filters
                            if event_type and entry.get('event_type') != event_type:
                                continue
                            if severity and entry.get('severity') != severity:
                                continue
                            
                            # Count event types
                            evt_type = entry.get('event_type', 'UNKNOWN')
                            report['event_type_distribution'][evt_type] = report['event_type_distribution'].get(evt_type, 0) + 1
                            
                            # Count severity levels
                            sev = entry.get('severity', 'LOW')
                            report['severity_distribution'][sev] = report['severity_distribution'].get(sev, 0) + 1
                            
                            # Count daily activity
                            date_str = entry_date.date().isoformat()
                            daily_counts[date_str] = daily_counts.get(date_str, 0) + 1
                            
                            # Collect high severity events
                            if sev in ['HIGH', 'CRITICAL']:
                                high_severity_events.append({
                                    "personnel_id": person.id,
                                    "badge_id": person.badge_id,
                                    "full_name": person.full_name,
                                    "event": entry
                                })
                            
                            report['total_events'] += 1
                    except ValueError:
                        continue
        
        # Update report
        report['personnel_with_activity'] = len(personnel_activity)
        report['daily_activity'] = daily_counts
        report['high_severity_events'] = high_severity_events[:20]  # Top 20
        
        # Get top active personnel
        personnel_activity.sort(key=lambda x: x['activity_count'], reverse=True)
        report['top_active_personnel'] = personnel_activity[:20]  # Top 20
        
        # Generate compliance alerts
        compliance_alerts = []
        
        # Alert for personnel with no activity
        for person in personnel_list:
            if not hasattr(person, 'audit_trail') or not person.audit_trail:
                compliance_alerts.append({
                    "type": "NO_ACTIVITY",
                    "personnel_id": person.id,
                    "badge_id": person.badge_id,
                    "full_name": person.full_name,
                    "message": "No audit activity recorded"
                })
        
        # Alert for high severity events
        if len(high_severity_events) > 10:
            compliance_alerts.append({
                "type": "HIGH_SEVERITY_VOLUME",
                "count": len(high_severity_events),
                "message": f"High number of high severity events: {len(high_severity_events)}"
            })
        
        report['compliance_alerts'] = compliance_alerts[:10]  # Top 10
        
        return report
    
    async def get_compliance_report(
        self,
        personnel_id: int,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Get compliance report for personnel
        
        Args:
            personnel_id: Personnel ID
            db: Database session
            
        Returns:
            Compliance report
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        # Get audit trail for last 90 days
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=90)
        
        audit_trail = await self.get_personnel_audit_trail(
            personnel_id=personnel_id,
            start_date=start_date,
            end_date=end_date,
            limit=1000,
            db=db
        )
        
        # Initialize compliance report
        compliance_report = {
            "personnel_id": personnel_id,
            "badge_id": personnel.badge_id,
            "full_name": personnel.full_name,
            "period_days": 90,
            "total_events": len(audit_trail),
            "compliance_score": 0.0,
            "event_categories": {
                "profile_changes": 0,
                "status_changes": 0,
                "certification_changes": 0,
                "security_events": 0,
                "system_events": 0
            },
            "recent_activity": audit_trail[:10],
            "compliance_issues": [],
            "recommendations": []
        }
        
        # Categorize events
        for entry in audit_trail:
            event_type = entry.get('event_type', '')
            severity = entry.get('severity', 'LOW')
            
            # Profile changes
            if event_type in ['PERSONNEL_CREATED', 'PERSONNEL_UPDATED', 'PHOTO_UPLOADED', 'PHOTO_DELETED']:
                compliance_report['event_categories']['profile_changes'] += 1
            
            # Status changes
            elif event_type in ['STATUS_CHANGED', 'LOCATION_UPDATED', 'CHECK_IN', 'CHECK_OUT']:
                compliance_report['event_categories']['status_changes'] += 1
            
            # Certification changes
            elif event_type in ['CERTIFICATION_ADDED', 'CERTIFICATION_UPDATED', 'CERTIFICATION_DELETED']:
                compliance_report['event_categories']['certification_changes'] += 1
            
            # Security events
            elif event_type in ['LOGIN', 'LOGOUT', 'PASSWORD_CHANGED', 'ROLE_CHANGED', 'PERMISSIONS_CHANGED']:
                compliance_report['event_categories']['security_events'] += 1
            
            # System events
            else:
                compliance_report['event_categories']['system_events'] += 1
        
        # Calculate compliance score
        total_categories = sum(compliance_report['event_categories'].values())
        if total_categories > 0:
            # Score based on activity distribution
            profile_score = min(compliance_report['event_categories']['profile_changes'] / 10, 1.0) * 20
            status_score = min(compliance_report['event_categories']['status_changes'] / 30, 1.0) * 25
            cert_score = min(compliance_report['event_categories']['certification_changes'] / 5, 1.0) * 25
            security_score = min(compliance_report['event_categories']['security_events'] / 20, 1.0) * 20
            system_score = min(compliance_report['event_categories']['system_events'] / 10, 1.0) * 10
            
            compliance_report['compliance_score'] = round(profile_score + status_score + cert_score + security_score + system_score, 2)
        
        # Identify compliance issues
        if compliance_report['total_events'] < 10:
            compliance_report['compliance_issues'].append("Low activity level - may indicate incomplete tracking")
        
        if compliance_report['event_categories']['certification_changes'] == 0:
            compliance_report['compliance_issues'].append("No certification activity recorded")
        
        if compliance_report['event_categories']['security_events'] == 0:
            compliance_report['compliance_issues'].append("No security events recorded")
        
        # Generate recommendations
        if compliance_report['compliance_score'] < 70:
            compliance_report['recommendations'].append("Increase audit trail coverage")
        
        if compliance_report['event_categories']['status_changes'] < 10:
            compliance_report['recommendations'].append("Ensure regular status updates are recorded")
        
        if compliance_report['event_categories']['certification_changes'] < 3:
            compliance_report['recommendations'].append("Record all certification changes")
        
        return compliance_report
    
    async def export_audit_trail(
        self,
        personnel_id: int,
        format_type: str = "json",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Export audit trail for personnel
        
        Args:
            personnel_id: Personnel ID
            format_type: Export format (json, csv)
            start_date: Filter by start date (optional)
            end_date: Filter by end date (optional)
            db: Database session
            
        Returns:
            Export result
        """
        if db is None:
            db = next(get_db())
        
        # Get audit trail
        audit_trail = await self.get_personnel_audit_trail(
            personnel_id=personnel_id,
            start_date=start_date,
            end_date=end_date,
            limit=10000,
            db=db
        )
        
        # Get personnel info
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        
        # Create export data
        export_data = {
            "export_info": {
                "personnel_id": personnel_id,
                "badge_id": personnel.badge_id if personnel else "",
                "full_name": personnel.full_name if personnel else "",
                "export_date": datetime.now(timezone.utc).isoformat(),
                "format": format_type,
                "total_records": len(audit_trail)
            },
            "audit_trail": audit_trail
        }
        
        return {
            "success": True,
            "export_data": export_data,
            "format": format_type,
            "records_count": len(audit_trail),
            "message": "Audit trail exported successfully"
        }


# Create singleton instance
audit_trail_service = AuditTrailService()
