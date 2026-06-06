"""
Personnel Badge Printing Service

This service handles personnel badge printing including badge generation,
QR code creation, printing templates, and badge management.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
import qrcode
import io
import base64
from PIL import Image, ImageDraw, ImageFont
import json

from ..models.personnel import Personnel
from ..core.database import get_db


class BadgePrintingService:
    """Service for managing personnel badge printing"""
    
    def __init__(self):
        # Standard badge types
        self.badge_types = {
            "STAFF": "Staff Badge",
            "CONTRACTOR": "Contractor Badge",
            "VISITOR": "Visitor Badge",
            "TEMPORARY": "Temporary Badge",
            "EMERGENCY": "Emergency Response Badge",
            "SECURITY": "Security Badge"
        }
        
        # Badge access levels
        self.access_levels = {
            "FULL_ACCESS": "Full facility access",
            "LIMITED_ACCESS": "Limited access to designated areas",
            "VISITOR_ACCESS": "Visitor access only",
            "EMERGENCY_ACCESS": "Emergency access only",
            "SECURITY_ACCESS": "Security personnel access"
        }
        
        # Badge colors by access level
        self.badge_colors = {
            "FULL_ACCESS": "#2E7D32",  # Green
            "LIMITED_ACCESS": "#1976D2",  # Blue
            "VISITOR_ACCESS": "#F57C00",  # Orange
            "EMERGENCY_ACCESS": "#D32F2F",  # Red
            "SECURITY_ACCESS": "#7B1FA2"  # Purple
        }
    
    async def generate_qr_code(
        self,
        personnel_id: int,
        badge_id: str,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate QR code for personnel badge
        
        Args:
            personnel_id: Personnel ID
            badge_id: Badge ID
            additional_data: Additional data to encode (optional)
            
        Returns:
            Base64 encoded QR code image
        """
        # Create QR code data
        qr_data = {
            "personnel_id": personnel_id,
            "badge_id": badge_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "version": "1.0"
        }
        
        if additional_data:
            qr_data.update(additional_data)
        
        # Convert to JSON string
        qr_string = json.dumps(qr_data)
        
        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(qr_string)
        qr.make(fit=True)
        
        # Create QR code image
        qr_img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        buffer = io.BytesIO()
        qr_img.save(buffer, format='PNG')
        qr_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        return qr_base64
    
    async def create_badge_record(
        self,
        personnel_id: int,
        badge_data: Dict[str, Any],
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Create badge record for personnel
        
        Args:
            personnel_id: Personnel ID
            badge_data: Badge details
            db: Database session
            
        Returns:
            Created badge record information
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        # Validate required fields
        required_fields = ["badge_type", "access_level", "issued_by"]
        for field in required_fields:
            if not badge_data.get(field):
                raise ValueError(f"Missing required field: {field}")
        
        # Generate badge ID
        badge_id = f"BDG-{personnel.badge_id}-{datetime.now(timezone.utc).strftime('%Y%m%d')}"
        
        # Generate QR code
        qr_code = await self.generate_qr_code(
            personnel_id=personnel_id,
            badge_id=badge_id,
            additional_data={
                "full_name": personnel.full_name,
                "company": personnel.company,
                "role": personnel.role
            }
        )
        
        # Create badge record
        badge_record = {
            "id": f"badge_{datetime.now(timezone.utc).timestamp()}",
            "badge_id": badge_id,
            "badge_type": badge_data.get('badge_type'),
            "access_level": badge_data.get('access_level'),
            "qr_code": qr_code,
            "issued_date": datetime.now(timezone.utc).isoformat(),
            "expiry_date": badge_data.get('expiry_date'),
            "issued_by": badge_data.get('issued_by'),
            "printing_status": "PENDING",
            "printed_date": None,
            "printer_used": None,
            "badge_color": self.badge_colors.get(badge_data.get('access_level'), "#000000"),
            "notes": badge_data.get('notes', ''),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Store badge record in personnel record
        if not hasattr(personnel, 'badge_records') or not personnel.badge_records:
            personnel.badge_records = []
        
        personnel.badge_records.append(badge_record)
        db.commit()
        db.refresh(personnel)
        
        return {
            "success": True,
            "badge_id": badge_id,
            "badge_record_id": badge_record["id"],
            "personnel_id": personnel_id,
            "badge_type": badge_record["badge_type"],
            "access_level": badge_record["access_level"],
            "qr_code": qr_code,
            "issued_date": badge_record["issued_date"],
            "expiry_date": badge_record["expiry_date"],
            "message": "Badge record created successfully"
        }
    
    async def get_personnel_badges(
        self,
        personnel_id: int,
        badge_type: Optional[str] = None,
        status: Optional[str] = None,
        db: Session = None
    ) -> List[Dict[str, Any]]:
        """
        Get personnel badge records
        
        Args:
            personnel_id: Personnel ID
            badge_type: Filter by badge type (optional)
            status: Filter by printing status (optional)
            db: Database session
            
        Returns:
            List of badge records
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        badge_records = getattr(personnel, 'badge_records', [])
        
        # Apply filters
        if badge_type:
            badge_records = [
                record for record in badge_records
                if record.get('badge_type') == badge_type
            ]
        
        if status:
            badge_records = [
                record for record in badge_records
                if record.get('printing_status') == status
            ]
        
        # Sort by issued date descending
        badge_records.sort(
            key=lambda x: x.get('issued_date', '0000-01-01'),
            reverse=True
        )
        
        return badge_records
    
    async def update_badge_printing_status(
        self,
        personnel_id: int,
        badge_record_id: str,
        printing_status: str,
        printer_used: Optional[str] = None,
        notes: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Update badge printing status
        
        Args:
            personnel_id: Personnel ID
            badge_record_id: Badge record ID
            printing_status: New printing status
            printer_used: Printer used (optional)
            notes: Update notes (optional)
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
        
        if not hasattr(personnel, 'badge_records') or not personnel.badge_records:
            raise ValueError("No badge records found for personnel")
        
        # Find and update badge record
        record_found = False
        for record in personnel.badge_records:
            if record['id'] == badge_record_id:
                record['printing_status'] = printing_status
                record['updated_at'] = datetime.now(timezone.utc).isoformat()
                
                if printing_status == "PRINTED":
                    record['printed_date'] = datetime.now(timezone.utc).isoformat()
                    if printer_used:
                        record['printer_used'] = printer_used
                
                if notes:
                    record['notes'] += f" | Updated: {notes}"
                
                record_found = True
                break
        
        if not record_found:
            raise ValueError(f"Badge record with ID {badge_record_id} not found")
        
        db.commit()
        
        return {
            "success": True,
            "badge_record_id": badge_record_id,
            "new_status": printing_status,
            "message": "Badge printing status updated successfully"
        }
    
    async def get_badge_printing_summary(
        self,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Get badge printing summary statistics
        
        Args:
            db: Database session
            
        Returns:
            Badge printing summary
        """
        if db is None:
            db = next(get_db())
        
        # Get all personnel with badge records
        personnel_list = db.query(Personnel).all()
        
        # Initialize statistics
        stats = {
            "total_personnel": len(personnel_list),
            "personnel_with_badges": 0,
            "total_badges": 0,
            "printing_status_distribution": {},
            "badge_type_distribution": {},
            "access_level_distribution": {},
            "pending_printing": 0,
            "printed_badges": 0,
            "expired_badges": 0,
            "expiring_soon_30_days": 0,
            "printing_compliance_rate": 0.0
        }
        
        # Calculate dates
        now = datetime.now(timezone.utc)
        thirty_days_ahead = now + timedelta(days=30)
        
        personnel_with_badges = 0
        total_badges = 0
        pending_count = 0
        printed_count = 0
        expired_count = 0
        expiring_30 = 0
        printing_status_counts = {}
        badge_type_counts = {}
        access_level_counts = {}
        
        # Process badge records
        for person in personnel_list:
            if hasattr(person, 'badge_records') and person.badge_records:
                personnel_with_badges += 1
                
                for record in person.badge_records:
                    total_badges += 1
                    
                    # Count printing status
                    status = record.get('printing_status', 'UNKNOWN')
                    printing_status_counts[status] = printing_status_counts.get(status, 0) + 1
                    
                    # Count badge types
                    badge_type = record.get('badge_type', 'UNKNOWN')
                    badge_type_counts[badge_type] = badge_type_counts.get(badge_type, 0) + 1
                    
                    # Count access levels
                    access_level = record.get('access_level', 'UNKNOWN')
                    access_level_counts[access_level] = access_level_counts.get(access_level, 0) + 1
                    
                    # Check printing status
                    if status == 'PENDING':
                        pending_count += 1
                    elif status == 'PRINTED':
                        printed_count += 1
                    
                    # Check expiry
                    if record.get('expiry_date'):
                        try:
                            expiry_date = datetime.fromisoformat(record['expiry_date'].replace('Z', '+00:00'))
                            if expiry_date < now:
                                expired_count += 1
                            elif expiry_date <= thirty_days_ahead:
                                expiring_30 += 1
                        except ValueError:
                            # Handle invalid date format
                            pass
        
        # Update statistics
        stats.update({
            "personnel_with_badges": personnel_with_badges,
            "total_badges": total_badges,
            "printing_status_distribution": printing_status_counts,
            "badge_type_distribution": badge_type_counts,
            "access_level_distribution": access_level_counts,
            "pending_printing": pending_count,
            "printed_badges": printed_count,
            "expired_badges": expired_count,
            "expiring_soon_30_days": expiring_30,
            "printing_compliance_rate": round((printed_count / total_badges * 100) if total_badges > 0 else 0, 2)
        })
        
        return stats
    
    async def generate_badge_template(
        self,
        badge_type: str,
        access_level: str,
        template_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate badge template for printing
        
        Args:
            badge_type: Badge type
            access_level: Access level
            template_data: Template configuration data
            
        Returns:
            Badge template configuration
        """
        # Create badge template
        template = {
            "badge_type": badge_type,
            "access_level": access_level,
            "badge_color": self.badge_colors.get(access_level, "#000000"),
            "template_config": {
                "width": template_data.get('width', 300),
                "height": template_data.get('height', 200),
                "font_size_title": template_data.get('font_size_title', 16),
                "font_size_text": template_data.get('font_size_text', 12),
                "logo_position": template_data.get('logo_position', 'top_left'),
                "photo_position": template_data.get('photo_position', 'top_right'),
                "qr_position": template_data.get('qr_position', 'bottom_right'),
                "text_alignment": template_data.get('text_alignment', 'left'),
                "background_color": template_data.get('background_color', '#FFFFFF'),
                "text_color": template_data.get('text_color', '#000000')
            },
            "fields": [
                {
                    "name": "full_name",
                    "label": "Name",
                    "required": True,
                    "position": {"x": 50, "y": 80}
                },
                {
                    "name": "badge_id",
                    "label": "Badge ID",
                    "required": True,
                    "position": {"x": 50, "y": 100}
                },
                {
                    "name": "company",
                    "label": "Company",
                    "required": True,
                    "position": {"x": 50, "y": 120}
                },
                {
                    "name": "role",
                    "label": "Role",
                    "required": True,
                    "position": {"x": 50, "y": 140}
                },
                {
                    "name": "access_level",
                    "label": "Access",
                    "required": True,
                    "position": {"x": 50, "y": 160}
                }
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        return template
    
    async def get_badge_expiry_alerts(
        self,
        days_ahead: int = 30,
        db: Session = None
    ) -> List[Dict[str, Any]]:
        """
        Get badges expiring within specified days
        
        Args:
            days_ahead: Number of days ahead to check
            db: Database session
            
        Returns:
            List of expiring badges
        """
        if db is None:
            db = next(get_db())
        
        # Calculate expiry threshold
        expiry_threshold = datetime.now(timezone.utc) + timedelta(days=days_ahead)
        
        expiring_badges = []
        
        # Get all personnel with badge records
        personnel_list = db.query(Personnel).all()
        
        for person in personnel_list:
            if hasattr(person, 'badge_records') and person.badge_records:
                for record in person.badge_records:
                    if record.get('expiry_date'):
                        try:
                            expiry_date = datetime.fromisoformat(record['expiry_date'].replace('Z', '+00:00'))
                            if expiry_date <= expiry_threshold and expiry_date >= datetime.now(timezone.utc):
                                days_to_expiry = (expiry_date - datetime.now(timezone.utc)).days
                                expiring_badges.append({
                                    "personnel_id": person.id,
                                    "badge_id": person.badge_id,
                                    "full_name": person.full_name,
                                    "company": person.company,
                                    "badge_record": record,
                                    "days_to_expiry": days_to_expiry
                                })
                        except ValueError:
                            # Handle invalid date format
                            continue
        
        # Sort by days to expiry
        expiring_badges.sort(key=lambda x: x['days_to_expiry'])
        
        return expiring_badges
    
    async def create_badge_printing_batch(
        self,
        personnel_ids: List[int],
        badge_data: Dict[str, Any],
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Create badge records for multiple personnel (batch operation)
        
        Args:
            personnel_ids: List of personnel IDs
            badge_data: Common badge data
            db: Database session
            
        Returns:
            Batch creation result
        """
        if db is None:
            db = next(get_db())
        
        results = []
        errors = []
        
        for personnel_id in personnel_ids:
            try:
                result = await self.create_badge_record(
                    personnel_id=personnel_id,
                    badge_data=badge_data,
                    db=db
                )
                results.append(result)
            except Exception as e:
                errors.append({
                    "personnel_id": personnel_id,
                    "error": str(e)
                })
        
        return {
            "success": True,
            "total_requested": len(personnel_ids),
            "successful_creations": len(results),
            "failed_creations": len(errors),
            "results": results,
            "errors": errors
        }


# Create singleton instance
badge_printing_service = BadgePrintingService()
