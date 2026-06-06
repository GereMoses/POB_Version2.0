"""
Branding and Audit & Compliance Service

This service provides comprehensive branding and compliance functionality including:
- Company branding customization
- Theme management (colors, fonts, logos)
- GDPR compliance management
- Data access logging
- Consent record management
- Compliance reporting
"""

import logging
import json
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc

from ..models.system import Branding, DataAccessLog, ConsentRecord, SystemParameter
from ..models.user import User
from ..core.config import settings

logger = logging.getLogger(__name__)


class BrandingComplianceService:
    """Comprehensive branding and compliance service"""
    
    def __init__(self, db: Session):
        self.db = db
        self.branding_dir = settings.BRANDING_DIR or "branding"
        self.ensure_branding_directory()
    
    def ensure_branding_directory(self):
        """Ensure branding directory exists"""
        if not os.path.exists(self.branding_dir):
            os.makedirs(self.branding_dir, exist_ok=True)
    
    # Branding Management
    async def get_branding(self) -> Optional[Dict[str, Any]]:
        """Get current branding configuration"""
        try:
            branding = self.db.query(Branding).filter(
                Branding.is_active == True
            ).first()
            
            if not branding:
                # Return default branding
                return self._get_default_branding()
            
            return {
                "id": branding.id,
                "app_name": branding.app_name,
                "company_name": branding.company_name,
                "logo_url": branding.logo_url,
                "favicon_url": branding.favicon_url,
                "primary_color": branding.primary_color,
                "secondary_color": branding.secondary_color,
                "accent_color": branding.accent_color,
                "background_color": branding.background_color,
                "text_color": branding.text_color,
                "theme_mode": branding.theme_mode,
                "font_family": branding.font_family,
                "font_size": branding.font_size,
                "custom_css": branding.custom_css,
                "custom_js": branding.custom_js,
                "company_tagline": branding.company_tagline,
                "footer_text": branding.footer_text,
                "login_background": branding.login_background,
                "sidebar_logo": branding.sidebar_logo,
                "is_active": branding.is_active,
                "created_at": branding.created_at,
                "updated_at": branding.updated_at
            }
            
        except Exception as e:
            logger.error(f"Error getting branding: {e}")
            return self._get_default_branding()
    
    def _get_default_branding(self) -> Dict[str, Any]:
        """Get default branding configuration"""
        return {
            "app_name": "POB System",
            "company_name": "POB Management",
            "logo_url": "/assets/logo.png",
            "favicon_url": "/assets/favicon.ico",
            "primary_color": "#1976d2",
            "secondary_color": "#dc004e",
            "accent_color": "#ff9800",
            "background_color": "#ffffff",
            "text_color": "#333333",
            "theme_mode": "light",
            "font_family": "Inter",
            "font_size": "14",
            "custom_css": "",
            "custom_js": "",
            "company_tagline": "Personnel On Board Management System",
            "footer_text": "© 2024 POB System. All rights reserved.",
            "login_background": "/assets/login-bg.jpg",
            "sidebar_logo": "/assets/sidebar-logo.png",
            "is_active": True
        }
    
    async def update_branding(self, branding_data: Dict[str, Any], 
                            updated_by: str = None) -> Dict[str, Any]:
        """Update branding configuration"""
        try:
            branding = self.db.query(Branding).filter(
                Branding.is_active == True
            ).first()
            
            if not branding:
                # Create new branding
                branding = Branding(
                    app_name=branding_data.get("app_name", "POB System"),
                    company_name=branding_data.get("company_name", "POB Management"),
                    is_active=True,
                    created_by=updated_by
                )
                self.db.add(branding)
            else:
                # Update existing branding
                for field, value in branding_data.items():
                    if hasattr(branding, field) and value is not None:
                        setattr(branding, field, value)
                branding.updated_at = datetime.now(timezone.utc)
                branding.updated_by = updated_by
            
            self.db.commit()
            
            logger.info(f"Branding updated by {updated_by}")
            return {"success": True, "message": "Branding updated successfully"}
            
        except Exception as e:
            logger.error(f"Error updating branding: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    async def upload_branding_asset(self, asset_type: str, file_data: bytes, 
                                  filename: str, uploaded_by: str = None) -> Dict[str, Any]:
        """Upload branding asset (logo, favicon, etc.)"""
        try:
            # Generate unique filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            unique_filename = f"{asset_type}_{timestamp}_{filename}"
            file_path = os.path.join(self.branding_dir, unique_filename)
            
            # Save file
            with open(file_path, 'wb') as f:
                f.write(file_data)
            
            # Generate URL
            asset_url = f"/branding/{unique_filename}"
            
            # Update branding configuration
            branding = self.db.query(Branding).filter(
                Branding.is_active == True
            ).first()
            
            if not branding:
                branding = Branding(is_active=True, created_by=uploaded_by)
                self.db.add(branding)
            
            # Set appropriate field based on asset type
            if asset_type == "logo":
                branding.logo_url = asset_url
            elif asset_type == "favicon":
                branding.favicon_url = asset_url
            elif asset_type == "login_background":
                branding.login_background = asset_url
            elif asset_type == "sidebar_logo":
                branding.sidebar_logo = asset_url
            
            branding.updated_at = datetime.now(timezone.utc)
            branding.updated_by = uploaded_by
            
            self.db.commit()
            
            logger.info(f"Branding asset uploaded: {asset_type} -> {asset_url}")
            return {
                "success": True,
                "asset_url": asset_url,
                "asset_type": asset_type
            }
            
        except Exception as e:
            logger.error(f"Error uploading branding asset: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    async def get_branding_themes(self) -> List[Dict[str, Any]]:
        """Get predefined branding themes"""
        try:
            themes = [
                {
                    "name": "Default Blue",
                    "primary_color": "#1976d2",
                    "secondary_color": "#dc004e",
                    "accent_color": "#ff9800",
                    "background_color": "#ffffff",
                    "text_color": "#333333"
                },
                {
                    "name": "Dark Mode",
                    "primary_color": "#90caf9",
                    "secondary_color": "#f48fb1",
                    "accent_color": "#ffcc80",
                    "background_color": "#121212",
                    "text_color": "#ffffff"
                },
                {
                    "name": "Corporate Green",
                    "primary_color": "#2e7d32",
                    "secondary_color": "#c62828",
                    "accent_color": "#f9a825",
                    "background_color": "#f5f5f5",
                    "text_color": "#1b1b1b"
                },
                {
                    "name": "Oil & Gas",
                    "primary_color": "#ff6b35",
                    "secondary_color": "#004e89",
                    "accent_color": "#ffd23f",
                    "background_color": "#ffffff",
                    "text_color": "#333333"
                }
            ]
            
            return themes
            
        except Exception as e:
            logger.error(f"Error getting branding themes: {e}")
            return []
    
    # GDPR Compliance Management
    async def log_data_access(self, user_id: int, data_type: str, 
                            action: str, ip_address: str = None,
                            user_agent: str = None, details: Dict = None) -> bool:
        """Log data access for GDPR compliance"""
        try:
            access_log = DataAccessLog(
                user_id=user_id,
                data_type=data_type,
                action=action,
                ip_address=ip_address,
                user_agent=user_agent,
                details=details or {}
            )
            
            self.db.add(access_log)
            self.db.commit()
            
            return True
            
        except Exception as e:
            logger.error(f"Error logging data access: {e}")
            self.db.rollback()
            return False
    
    async def get_data_access_logs(self, user_id: int = None, 
                                 data_type: str = None, action: str = None,
                                 start_date: datetime = None, end_date: datetime = None,
                                 limit: int = 100) -> List[Dict[str, Any]]:
        """Get data access logs"""
        try:
            query = self.db.query(DataAccessLog)
            
            if user_id:
                query = query.filter(DataAccessLog.user_id == user_id)
            
            if data_type:
                query = query.filter(DataAccessLog.data_type == data_type)
            
            if action:
                query = query.filter(DataAccessLog.action == action)
            
            if start_date:
                query = query.filter(DataAccessLog.access_time >= start_date)
            
            if end_date:
                query = query.filter(DataAccessLog.access_time <= end_date)
            
            logs = query.order_by(desc(DataAccessLog.access_time)).limit(limit).all()
            
            result = []
            for log in logs:
                result.append({
                    "id": log.id,
                    "user_id": log.user_id,
                    "data_type": log.data_type,
                    "action": log.action,
                    "ip_address": log.ip_address,
                    "user_agent": log.user_agent,
                    "details": log.details,
                    "access_time": log.access_time
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting data access logs: {e}")
            return []
    
    async def create_consent_record(self, user_id: int, consent_type: str, 
                                 consent_value: bool, ip_address: str = None,
                                 user_agent: str = None, details: Dict = None) -> Dict[str, Any]:
        """Create consent record"""
        try:
            consent = ConsentRecord(
                user_id=user_id,
                consent_type=consent_type,
                consent_value=consent_value,
                ip_address=ip_address,
                user_agent=user_agent,
                details=details or {}
            )
            
            self.db.add(consent)
            self.db.commit()
            
            logger.info(f"Consent record created: user_id={user_id}, type={consent_type}, value={consent_value}")
            return {
                "success": True,
                "consent_id": consent.id,
                "consent_type": consent_type,
                "consent_value": consent_value
            }
            
        except Exception as e:
            logger.error(f"Error creating consent record: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    async def get_user_consents(self, user_id: int) -> List[Dict[str, Any]]:
        """Get user consent records"""
        try:
            consents = self.db.query(ConsentRecord).filter(
                ConsentRecord.user_id == user_id
            ).order_by(desc(ConsentRecord.created_at)).all()
            
            result = []
            for consent in consents:
                result.append({
                    "id": consent.id,
                    "consent_type": consent.consent_type,
                    "consent_value": consent.consent_value,
                    "ip_address": consent.ip_address,
                    "user_agent": consent.user_agent,
                    "details": consent.details,
                    "created_at": consent.created_at,
                    "expires_at": consent.expires_at
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting user consents: {e}")
            return []
    
    async def update_consent(self, user_id: int, consent_type: str, 
                           consent_value: bool, ip_address: str = None,
                           user_agent: str = None) -> Dict[str, Any]:
        """Update user consent"""
        try:
            # Create new consent record (consents are immutable, we create new records)
            result = await self.create_consent_record(
                user_id, consent_type, consent_value, ip_address, user_agent
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error updating consent: {e}")
            return {"success": False, "error": str(e)}
    
    async def check_consent(self, user_id: int, consent_type: str) -> bool:
        """Check if user has given consent for specific type"""
        try:
            # Get most recent consent record for this type
            consent = self.db.query(ConsentRecord).filter(
                ConsentRecord.user_id == user_id,
                ConsentRecord.consent_type == consent_type
            ).order_by(desc(ConsentRecord.created_at)).first()
            
            if not consent:
                return False
            
            # Check if consent has expired
            if consent.expires_at and consent.expires_at < datetime.now(timezone.utc):
                return False
            
            return consent.consent_value
            
        except Exception as e:
            logger.error(f"Error checking consent: {e}")
            return False
    
    # Compliance Reporting
    async def get_compliance_report(self, report_type: str = "gdpr", 
                                  start_date: datetime = None, end_date: datetime = None) -> Dict[str, Any]:
        """Generate compliance report"""
        try:
            if report_type == "gdpr":
                return await self._generate_gdpr_report(start_date, end_date)
            elif report_type == "data_access":
                return await self._generate_data_access_report(start_date, end_date)
            elif report_type == "consent":
                return await self._generate_consent_report(start_date, end_date)
            else:
                return {"error": "Unsupported report type"}
                
        except Exception as e:
            logger.error(f"Error generating compliance report: {e}")
            return {"error": str(e)}
    
    async def _generate_gdpr_report(self, start_date: datetime = None, 
                                   end_date: datetime = None) -> Dict[str, Any]:
        """Generate GDPR compliance report"""
        try:
            # Data access statistics
            access_stats = self.db.query(
                DataAccessLog.data_type,
                func.count(DataAccessLog.id).label('count')
            ).filter(
                DataAccessLog.access_time >= (start_date or datetime.now(timezone.utc) - timedelta(days=30)),
                DataAccessLog.access_time <= (end_date or datetime.now(timezone.utc))
            ).group_by(DataAccessLog.data_type).all()
            
            # Consent statistics
            consent_stats = self.db.query(
                ConsentRecord.consent_type,
                func.count(ConsentRecord.id).label('total'),
                func.sum(func.case([(ConsentRecord.consent_value == True, 1)], else_=0)).label('granted'),
                func.sum(func.case([(ConsentRecord.consent_value == False, 1)], else_=0)).label('denied')
            ).filter(
                ConsentRecord.created_at >= (start_date or datetime.now(timezone.utc) - timedelta(days=30)),
                ConsentRecord.created_at <= (end_date or datetime.now(timezone.utc))
            ).group_by(ConsentRecord.consent_type).all()
            
            # User statistics
            total_users = self.db.query(User).count()
            active_users = self.db.query(User).filter(User.is_active == True).count()
            
            return {
                "report_type": "gdpr",
                "period": {
                    "start_date": start_date or datetime.now(timezone.utc) - timedelta(days=30),
                    "end_date": end_date or datetime.now(timezone.utc)
                },
                "user_statistics": {
                    "total_users": total_users,
                    "active_users": active_users
                },
                "data_access": {
                    "by_type": {stat.data_type: stat.count for stat in access_stats},
                    "total_accesses": sum(stat.count for stat in access_stats)
                },
                "consents": {
                    "by_type": [
                        {
                            "type": stat.consent_type,
                            "total": stat.total,
                            "granted": stat.granted,
                            "denied": stat.denied,
                            "grant_rate": (stat.granted / stat.total * 100) if stat.total > 0 else 0
                        }
                        for stat in consent_stats
                    ]
                },
                "generated_at": datetime.now(timezone.utc)
            }
            
        except Exception as e:
            logger.error(f"Error generating GDPR report: {e}")
            return {"error": str(e)}
    
    async def _generate_data_access_report(self, start_date: datetime = None, 
                                         end_date: datetime = None) -> Dict[str, Any]:
        """Generate data access report"""
        try:
            # Access by user
            user_access = self.db.query(
                DataAccessLog.user_id,
                func.count(DataAccessLog.id).label('access_count')
            ).filter(
                DataAccessLog.access_time >= (start_date or datetime.now(timezone.utc) - timedelta(days=30)),
                DataAccessLog.access_time <= (end_date or datetime.now(timezone.utc))
            ).group_by(DataAccessLog.user_id).order_by(desc('access_count')).limit(20).all()
            
            # Access by action
            action_access = self.db.query(
                DataAccessLog.action,
                func.count(DataAccessLog.id).label('count')
            ).filter(
                DataAccessLog.access_time >= (start_date or datetime.now(timezone.utc) - timedelta(days=30)),
                DataAccessLog.access_time <= (end_date or datetime.now(timezone.utc))
            ).group_by(DataAccessLog.action).all()
            
            return {
                "report_type": "data_access",
                "period": {
                    "start_date": start_date or datetime.now(timezone.utc) - timedelta(days=30),
                    "end_date": end_date or datetime.now(timezone.utc)
                },
                "top_users": [
                    {"user_id": stat.user_id, "access_count": stat.access_count}
                    for stat in user_access
                ],
                "actions": {stat.action: stat.count for stat in action_access},
                "generated_at": datetime.now(timezone.utc)
            }
            
        except Exception as e:
            logger.error(f"Error generating data access report: {e}")
            return {"error": str(e)}
    
    async def _generate_consent_report(self, start_date: datetime = None, 
                                     end_date: datetime = None) -> Dict[str, Any]:
        """Generate consent report"""
        try:
            # Consent trends
            consent_trends = self.db.query(
                func.date(ConsentRecord.created_at).label('date'),
                ConsentRecord.consent_type,
                func.count(ConsentRecord.id).label('count')
            ).filter(
                ConsentRecord.created_at >= (start_date or datetime.now(timezone.utc) - timedelta(days=30)),
                ConsentRecord.created_at <= (end_date or datetime.now(timezone.utc))
            ).group_by(
                func.date(ConsentRecord.created_at),
                ConsentRecord.consent_type
            ).all()
            
            # Current consent status
            current_consents = self.db.query(
                ConsentRecord.user_id,
                ConsentRecord.consent_type,
                ConsentRecord.consent_value
            ).filter(
                ConsentRecord.expires_at >= datetime.now(timezone.utc)
            ).order_by(ConsentRecord.user_id, ConsentRecord.consent_type).all()
            
            return {
                "report_type": "consent",
                "period": {
                    "start_date": start_date or datetime.now(timezone.utc) - timedelta(days=30),
                    "end_date": end_date or datetime.now(timezone.utc)
                },
                "trends": [
                    {
                        "date": str(stat.date),
                        "consent_type": stat.consent_type,
                        "count": stat.count
                    }
                    for stat in consent_trends
                ],
                "current_status": [
                    {
                        "user_id": stat.user_id,
                        "consent_type": stat.consent_type,
                        "consent_value": stat.consent_value
                    }
                    for stat in current_consents
                ],
                "generated_at": datetime.now(timezone.utc)
            }
            
        except Exception as e:
            logger.error(f"Error generating consent report: {e}")
            return {"error": str(e)}
    
    async def export_user_data(self, user_id: int) -> Dict[str, Any]:
        """Export all user data for GDPR right to access"""
        try:
            # Get user information
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                return {"error": "User not found"}
            
            # Get user extension
            from ..models.system import UserExtension
            extension = self.db.query(UserExtension).filter(
                UserExtension.user_id == user_id
            ).first()
            
            # Get user roles
            from ..models.system import SystemUserRole, SystemRole
            user_roles = self.db.query(SystemRole).join(SystemUserRole).filter(
                SystemUserRole.user_id == user_id,
                SystemUserRole.is_active == True
            ).all()
            
            # Get data access logs
            access_logs = await self.get_data_access_logs(user_id=user_id, limit=100)
            
            # Get consent records
            consents = await self.get_user_consents(user_id)
            
            # Get personnel data if exists
            personnel_data = None
            from ..models.personnel import Personnel
            personnel = self.db.query(Personnel).filter(Personnel.user_id == user_id).first()
            if personnel:
                personnel_data = {
                    "id": personnel.id,
                    "personnel_id": personnel.personnel_id,
                    "full_name": personnel.full_name,
                    "email": personnel.email,
                    "phone": personnel.phone,
                    "position": personnel.position,
                    "department": personnel.department,
                    "is_active": personnel.is_active,
                    "created_at": personnel.created_at
                }
            
            export_data = {
                "user_information": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "full_name": user.full_name,
                    "phone": user.phone,
                    "is_active": user.is_active,
                    "is_verified": user.is_verified,
                    "created_at": user.created_at,
                    "last_login": user.last_login
                },
                "user_extension": {
                    "avatar": extension.avatar if extension else None,
                    "language": extension.language if extension else None,
                    "two_fa_enabled": extension.two_fa_enabled if extension else False,
                    "sso_id": extension.sso_id if extension else None,
                    "ldap_dn": extension.ldap_dn if extension else None
                },
                "roles": [
                    {"id": role.id, "name": role.name, "description": role.description}
                    for role in user_roles
                ],
                "personnel_data": personnel_data,
                "data_access_logs": access_logs,
                "consent_records": consents,
                "export_timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            logger.info(f"User data exported: user_id={user_id}")
            return {
                "success": True,
                "data": export_data
            }
            
        except Exception as e:
            logger.error(f"Error exporting user data: {e}")
            return {"success": False, "error": str(e)}
    
    async def delete_user_data(self, user_id: int, confirm: bool = False) -> Dict[str, Any]:
        """Delete user data for GDPR right to erasure"""
        try:
            if not confirm:
                return {"success": False, "error": "Explicit confirmation required"}
            
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                return {"success": False, "error": "User not found"}
            
            # Log data deletion
            await self.log_data_access(
                user_id=user_id,
                data_type="user_account",
                action="delete",
                details={"reason": "GDPR right to erasure"}
            )
            
            # Delete user and related data
            # This should be done carefully with proper cascading
            self.db.delete(user)
            self.db.commit()
            
            logger.info(f"User data deleted: user_id={user_id}")
            return {"success": True, "message": "User data deleted successfully"}
            
        except Exception as e:
            logger.error(f"Error deleting user data: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}


# Branding/Compliance service factory
def get_branding_compliance_service(db: Session) -> BrandingComplianceService:
    """Get branding/compliance service instance"""
    return BrandingComplianceService(db)
