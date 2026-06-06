"""
Visitor Badge Printing Service
BioTime 9.5 compatible badge printing for visitor management
"""

import os
import io
from datetime import datetime
from typing import Dict, Any, Optional
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import letter, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from reportlab.lib.colors import Color, black, white
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet

from app.models.visitor import Visitor, VisitorVisitLog
from app.services.visitor_qr_service import VisitorQRService
from app.core.config import settings


class BadgeService:
    """Badge printing service for visitor management"""
    
    def __init__(self):
        self.qr_service = VisitorQRService()
        self.badge_templates_dir = os.path.join(settings.STATIC_DIR, 'badge_templates')
        self.default_font = os.path.join(settings.STATIC_DIR, 'fonts', 'Arial.ttf')
        
    def generate_visitor_badge_pdf(self, visitor: Visitor, visit_log: VisitorVisitLog) -> bytes:
        """Generate PDF visitor badge"""
        buffer = io.BytesIO()
        
        # Create PDF in landscape mode
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(letter),
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=18
        )
        
        # Get badge data
        badge_data = self.qr_service.create_badge_print_data(visitor, visit_log.__dict__)
        
        # Create badge content
        elements = []
        
        # Badge header
        header_data = [
            [self._create_company_logo(), self._create_badge_title()]
        ]
        
        header_table = Table(header_data, colWidths=[2*inch, 6*inch])
        header_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 16),
        ]))
        
        elements.append(header_table)
        elements.append(self._create_spacer(0.2*inch))
        
        # Visitor information section
        visitor_info = self._create_visitor_info_section(badge_data)
        elements.append(visitor_info)
        elements.append(self._create_spacer(0.2*inch))
        
        # Photo and QR section
        photo_qr_section = self._create_photo_qr_section(badge_data)
        elements.append(photo_qr_section)
        elements.append(self._create_spacer(0.2*inch))
        
        # Footer section
        footer = self._create_footer_section(badge_data)
        elements.append(footer)
        
        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
    
    def generate_visitor_badge_image(self, visitor: Visitor, visit_log: VisitorVisitLog) -> bytes:
        """Generate image visitor badge"""
        # Badge dimensions (credit card size: 3.375 x 2.125 inches)
        width, height = 1016, 638  # pixels at 300 DPI
        
        # Create white background
        badge_img = Image.new('RGB', (width, height), 'white')
        draw = ImageDraw.Draw(badge_img)
        
        # Get badge data
        badge_data = self.qr_service.create_badge_print_data(visitor, visit_log.__dict__)
        
        try:
            # Load fonts
            title_font = ImageFont.truetype(self.default_font, 48)
            text_font = ImageFont.truetype(self.default_font, 32)
            small_font = ImageFont.truetype(self.default_font, 24)
        except Exception as e:
            # Fallback to default fonts
            title_font = ImageFont.load_default()
            text_font = ImageFont.load_default()
            small_font = ImageFont.load_default()
        
        # Draw header
        draw.text((50, 30), "VISITOR BADGE", fill='black', font=title_font)
        draw.text((50, 80), "TEMPORARY ACCESS", fill='gray', font=small_font)
        
        # Draw visitor info
        y_pos = 140
        draw.text((50, y_pos), f"Name: {badge_data['visitor_name']}", fill='black', font=text_font)
        y_pos += 40
        draw.text((50, y_pos), f"Company: {badge_data['company'] or 'N/A'}", fill='black', font=text_font)
        y_pos += 40
        draw.text((50, y_pos), f"Code: {badge_data['visitor_code']}", fill='black', font=text_font)
        y_pos += 40
        if badge_data['host_name']:
            draw.text((50, y_pos), f"Host: {badge_data['host_name']}", fill='black', font=text_font)
        y_pos += 40
        if badge_data['area']:
            draw.text((50, y_pos), f"Area: {badge_data['area']}", fill='black', font=text_font)
        
        # Draw photo placeholder
        photo_x, photo_y = 650, 140
        photo_size = 150
        draw.rectangle([photo_x, photo_y, photo_x + photo_size, photo_y + photo_size], outline='black', width=2)
        draw.text((photo_x + 10, photo_y + 60), "PHOTO", fill='gray', font=small_font)
        
        # Draw QR code (placeholder)
        qr_x, qr_y = 650, 320
        qr_size = 150
        draw.rectangle([qr_x, qr_y, qr_x + qr_size, qr_y + qr_size], outline='black', width=2)
        draw.text((qr_x + 30, qr_y + 65), "QR CODE", fill='gray', font=small_font)
        
        # Draw footer
        footer_y = height - 80
        draw.text((50, footer_y), f"Valid: {badge_data['valid_until']}", fill='gray', font=small_font)
        draw.text((50, footer_y + 25), f"Issued: {datetime.now().strftime('%Y-%m-%d %H:%M')}", fill='gray', font=small_font)
        
        # Draw border
        draw.rectangle([10, 10, width-10, height-10], outline='black', width=3)
        
        # Convert to bytes
        buffer = io.BytesIO()
        badge_img.save(buffer, format='PNG')
        buffer.seek(0)
        return buffer.getvalue()
    
    def _create_company_logo(self):
        """Create company logo section"""
        # TODO: Implement actual company logo
        return Paragraph("COMPANY LOGO", getSampleStyleSheet()['Normal'])
    
    def _create_badge_title(self):
        """Create badge title section"""
        styles = getSampleStyleSheet()
        title_style = styles['Title']
        title_style.fontSize = 24
        title_style.textColor = black
        
        return Paragraph("VISITOR BADGE", title_style)
    
    def _create_visitor_info_section(self, badge_data: Dict[str, Any]):
        """Create visitor information section"""
        data = [
            ['Name:', badge_data['visitor_name']],
            ['Company:', badge_data['company'] or 'N/A'],
            ['Visitor Code:', badge_data['visitor_code']],
        ]
        
        if badge_data.get('host_name'):
            data.append(['Host:', badge_data['host_name']])
        
        if badge_data.get('area'):
            data.append(['Area:', badge_data['area']])
        
        table = Table(data, colWidths=[1.5*inch, 4*inch])
        table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        
        return table
    
    def _create_photo_qr_section(self, badge_data: Dict[str, Any]):
        """Create photo and QR code section"""
        # Photo placeholder
        photo_text = "PHOTO\n(3x3cm)"
        photo_para = Paragraph(photo_text, getSampleStyleSheet()['Normal'])
        
        # QR code placeholder
        qr_text = "QR CODE\n(Scan for\nverification)"
        qr_para = Paragraph(qr_text, getSampleStyleSheet()['Normal'])
        
        data = [[photo_para, qr_para]]
        table = Table(data, colWidths=[3*inch, 3*inch])
        table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOX', (0, 0), (-1, -1), 1, black),
            ('INNERGRID', (0, 0), (-1, -1), 1, black),
        ]))
        
        return table
    
    def _create_footer_section(self, badge_data: Dict[str, Any]):
        """Create footer section"""
        footer_data = [
            ['Valid Until:', badge_data['valid_until']],
            ['Issued:', datetime.now().strftime('%Y-%m-%d %H:%M')],
            ['Badge Type:', badge_data.get('badge_template', 'Standard')]
        ]
        
        table = Table(footer_data, colWidths=[2*inch, 2*inch, 2*inch])
        table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
        ]))
        
        return table
    
    def _create_spacer(self, height):
        """Create spacer element"""
        from reportlab.platypus import Spacer
        return Spacer(1, height)
    
    def print_badge(self, visitor: Visitor, visit_log: VisitorVisitLog, 
                   printer_name: Optional[str] = None) -> bool:
        """Print visitor badge to configured printer"""
        try:
            # Generate badge PDF
            badge_pdf = self.generate_visitor_badge_pdf(visitor, visit_log)
            
            # Save to temporary file
            temp_file = os.path.join(settings.TEMP_DIR, f'badge_{visitor.visitor_code}.pdf')
            with open(temp_file, 'wb') as f:
                f.write(badge_pdf)
            
            # Print using system command (platform-specific)
            if os.name == 'nt':  # Windows
                import subprocess
                if printer_name:
                    subprocess.run(['print', '/D:' + printer_name, temp_file], shell=True)
                else:
                    os.startfile(temp_file, 'print')
            else:  # Unix/Linux/Mac
                import subprocess
                if printer_name:
                    subprocess.run(['lp', '-d', printer_name, temp_file])
                else:
                    subprocess.run(['lp', temp_file])
            
            # Clean up temp file
            if os.path.exists(temp_file):
                os.remove(temp_file)
            
            return True
            
        except Exception as e:
            print(f"Failed to print badge: {e}")
            return False
    
    def get_available_printers(self) -> list:
        """Get list of available printers"""
        try:
            if os.name == 'nt':  # Windows
                import win32print
                printers = win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)
                return [printer[2] for printer in printers]
            else:  # Unix/Linux/Mac
                import subprocess
                result = subprocess.run(['lpstat', '-p'], capture_output=True, text=True)
                printers = []
                for line in result.stdout.split('\n'):
                    if line.startswith('printer'):
                        printer_name = line.split()[1]
                        printers.append(printer_name)
                return printers
        except Exception as e:
            print(f"Failed to get printers: {e}")
            return []
    
    def create_badge_template(self, template_name: str, template_config: Dict[str, Any]) -> bool:
        """Create custom badge template"""
        try:
            template_file = os.path.join(self.badge_templates_dir, f'{template_name}.json')
            
            with open(template_file, 'w') as f:
                import json
                json.dump(template_config, f, indent=2)
            
            return True
            
        except Exception as e:
            print(f"Failed to create badge template: {e}")
            return False
    
    def load_badge_template(self, template_name: str) -> Optional[Dict[str, Any]]:
        """Load custom badge template"""
        try:
            template_file = os.path.join(self.badge_templates_dir, f'{template_name}.json')
            
            with open(template_file, 'r') as f:
                import json
                return json.load(f)
                
        except Exception as e:
            print(f"Failed to load badge template: {e}")
            return None
