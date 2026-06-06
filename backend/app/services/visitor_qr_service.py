"""
Visitor QR Code Generation Service
BioTime 9.5 compatible QR code generation for visitor management
"""

import qrcode
import io
import base64
import json
from datetime import datetime, date, time
from typing import Dict, Any, Optional

from app.models.visitor import VisitorPreRegistration, Visitor
from app.core.config import settings


class VisitorQRService:
    """QR code generation service for visitor management"""
    
    def __init__(self):
        self.base_url = settings.FRONTEND_URL or "http://localhost:3000"
    
    def generate_visitor_qr(self, pre_registration: VisitorPreRegistration) -> str:
        """Generate QR code for visitor pre-registration"""
        qr_data = {
            'type': 'visitor_pre_registration',
            'id': pre_registration.id,
            'qr_code': pre_registration.qr_code,
            'visitor_name': pre_registration.visitor.full_name if pre_registration.visitor else None,
            'company': pre_registration.visitor.company if pre_registration.visitor else None,
            'host_name': pre_registration.host_employee.full_name if pre_registration.host_employee else None,
            'visit_date': pre_registration.visit_date.isoformat() if pre_registration.visit_date else None,
            'visit_time_start': pre_registration.visit_time_start.isoformat() if pre_registration.visit_time_start else None,
            'visit_time_end': pre_registration.visit_time_end.isoformat() if pre_registration.visit_time_end else None,
            'purpose': pre_registration.purpose,
            'area_id': pre_registration.area_id,
            'status': pre_registration.status,
            'generated_at': datetime.utcnow().isoformat()
        }
        
        return self._generate_qr_code(qr_data)
    
    def generate_visitor_badge_qr(self, visitor: Visitor, visit_log_id: int) -> str:
        """Generate QR code for visitor badge"""
        qr_data = {
            'type': 'visitor_badge',
            'visitor_id': visitor.id,
            'visitor_code': visitor.visitor_code,
            'full_name': visitor.full_name,
            'company': visitor.company,
            'visit_log_id': visit_log_id,
            'generated_at': datetime.utcnow().isoformat()
        }
        
        return self._generate_qr_code(qr_data)
    
    def generate_check_out_qr(self, visitor_code: str) -> str:
        """Generate QR code for visitor check-out"""
        qr_data = {
            'type': 'visitor_check_out',
            'visitor_code': visitor_code,
            'generated_at': datetime.utcnow().isoformat()
        }
        
        return self._generate_qr_code(qr_data)
    
    def _generate_qr_code(self, data: Dict[str, Any]) -> str:
        """Generate QR code image and return as base64 string"""
        # Convert data to JSON string
        qr_string = json.dumps(data)
        
        # Create QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(qr_string)
        qr.make(fit=True)
        
        # Create image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        return f"data:image/png;base64,{img_str}"
    
    def validate_qr_data(self, qr_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate QR code data and return validation result"""
        try:
            if not isinstance(qr_data, dict):
                return {'valid': False, 'error': 'Invalid QR data format'}
            
            qr_type = qr_data.get('type')
            if not qr_type:
                return {'valid': False, 'error': 'Missing QR type'}
            
            if qr_type == 'visitor_pre_registration':
                return self._validate_pre_registration_qr(qr_data)
            elif qr_type == 'visitor_badge':
                return self._validate_badge_qr(qr_data)
            elif qr_type == 'visitor_check_out':
                return self._validate_check_out_qr(qr_data)
            else:
                return {'valid': False, 'error': 'Unknown QR type'}
                
        except Exception as e:
            return {'valid': False, 'error': f'Validation error: {str(e)}'}
    
    def _validate_pre_registration_qr(self, qr_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate pre-registration QR code"""
        required_fields = ['id', 'qr_code', 'visitor_name', 'visit_date']
        
        for field in required_fields:
            if field not in qr_data:
                return {'valid': False, 'error': f'Missing required field: {field}'}
        
        # Check if QR code is expired (visit date passed)
        try:
            visit_date = datetime.fromisoformat(qr_data['visit_date']).date()
            if visit_date < date.today():
                return {'valid': False, 'error': 'QR code expired'}
        except (ValueError, TypeError):
            return {'valid': False, 'error': 'Invalid visit date format'}
        
        return {'valid': True, 'data': qr_data}
    
    def _validate_badge_qr(self, qr_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate visitor badge QR code"""
        required_fields = ['visitor_id', 'visitor_code', 'full_name']
        
        for field in required_fields:
            if field not in qr_data:
                return {'valid': False, 'error': f'Missing required field: {field}'}
        
        return {'valid': True, 'data': qr_data}
    
    def _validate_check_out_qr(self, qr_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate check-out QR code"""
        if 'visitor_code' not in qr_data:
            return {'valid': False, 'error': 'Missing visitor code'}
        
        return {'valid': True, 'data': qr_data}
    
    def create_qr_email_content(self, pre_registration: VisitorPreRegistration) -> Dict[str, Any]:
        """Create email content with QR code"""
        qr_image = self.generate_visitor_qr(pre_registration)
        
        return {
            'subject': 'Your Visit Registration - QR Code',
            'template': 'visitor_qr_email',
            'data': {
                'visitor_name': pre_registration.visitor.full_name if pre_registration.visitor else 'Guest',
                'company': pre_registration.visitor.company if pre_registration.visitor else None,
                'host_name': pre_registration.host_employee.full_name if pre_registration.host_employee else None,
                'visit_date': pre_registration.visit_date.strftime('%A, %B %d, %Y'),
                'visit_time': f"{pre_registration.visit_time_start} - {pre_registration.visit_time_end}" if pre_registration.visit_time_start else 'All day',
                'purpose': pre_registration.purpose,
                'qr_image': qr_image,
                'qr_code': pre_registration.qr_code,
                'check_in_url': f"{self.base_url}/visitor/kiosk?qr={pre_registration.qr_code}"
            }
        }
    
    def create_badge_print_data(self, visitor: Visitor, visit_log: Dict[str, Any]) -> Dict[str, Any]:
        """Create badge printing data"""
        qr_image = self.generate_visitor_badge_qr(visitor, visit_log.get('id'))
        
        return {
            'visitor_name': visitor.full_name,
            'company': visitor.company,
            'visitor_code': visitor.visitor_code,
            'qr_image': qr_image,
            'photo': visitor.photo,
            'check_in_time': visit_log.get('check_in_time'),
            'host_name': visit_log.get('host_employee', {}).get('full_name') if visit_log.get('host_employee') else None,
            'area': visit_log.get('area', {}).get('name') if visit_log.get('area') else None,
            'valid_until': visit_log.get('check_out_time') or 'End of day',
            'badge_template': visitor.visitor_type.badge_template if visitor.visitor_type else 'default'
        }
