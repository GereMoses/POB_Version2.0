"""
Email Service for Visitor Management and Reports
BioTime 9.5 compatible email templates with POB extensions
Visitor notification system and report scheduling with company branding
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.image import MIMEImage
from email import encoders
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from jinja2 import Template
import logging

from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.system import Company as BaseCompany

logger = logging.getLogger(__name__)


class VisitorEmailService:
    """Email service for visitor management notifications"""
    
    def __init__(self):
        self.smtp_server = getattr(settings, 'SMTP_SERVER', 'localhost')
        self.smtp_port = getattr(settings, 'SMTP_PORT', 587)
        self.smtp_username = getattr(settings, 'SMTP_USERNAME', '')
        self.smtp_password = getattr(settings, 'SMTP_PASSWORD', '')
        self.smtp_use_tls = getattr(settings, 'SMTP_USE_TLS', True)
        self.from_email = getattr(settings, 'FROM_EMAIL', 'noreply@pob-system.com')
        self.from_name = getattr(settings, 'FROM_NAME', 'POB Visitor System')
    
    def send_visitor_registration_email(self, visitor_data: Dict[str, Any], 
                                      qr_code: str, host_name: str) -> Dict[str, Any]:
        """Send visitor pre-registration confirmation email"""
        try:
            subject = f"Visitor Registration Confirmation - {visitor_data['visit_date']}"
            
            # Email template
            html_template = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Visitor Registration Confirmation</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0 0; }
                    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
                    .qr-section { text-align: center; margin: 30px 0; }
                    .qr-code { width: 200px; height: 200px; border: 2px solid #ddd; margin: 0 auto; }
                    .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    .info-item { margin-bottom: 15px; }
                    .label { font-weight: bold; color: #555; }
                    .footer { background: #f1f3f4; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #666; }
                    .btn { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Visitor Registration Confirmed</h1>
                        <p>Your visit has been registered successfully</p>
                    </div>
                    
                    <div class="content">
                        <div class="info-box">
                            <h2>Visit Details</h2>
                            <div class="info-item">
                                <span class="label">Visitor Name:</span> {visitor_name}
                            </div>
                            <div class="info-item">
                                <span class="label">Company:</span> {company}
                            </div>
                            <div class="info-item">
                                <span class="label">Visit Date:</span> {visit_date}
                            </div>
                            <div class="info-item">
                                <span class="label">Visit Time:</span> {visit_time_start} - {visit_time_end}
                            </div>
                            <div class="info-item">
                                <span class="label">Host:</span> {host_name}
                            </div>
                            <div class="info-item">
                                <span class="label">Purpose:</span> {purpose}
                            </div>
                            <div class="info-item">
                                <span class="label">Area:</span> {area || 'Not specified'}
                            </div>
                        </div>
                        
                        <div class="qr-section">
                            <h3>Your QR Code</h3>
                            <p>Please show this QR code at the reception desk for check-in</p>
                            <div class="qr-code">
                                [QR Code Placeholder - {qr_code}]
                            </div>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p><strong>Important:</strong> Please arrive 10 minutes before your scheduled visit time.</p>
                        <p>Bring a valid photo ID for verification.</p>
                        <p>If you need to cancel or reschedule, please contact your host.</p>
                        <p>For assistance, contact reception at +234-800-0000</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Render template with visitor data
            template = Template(html_template)
            html_content = template.render(
                visitor_name=visitor_data.get('full_name', ''),
                company=visitor_data.get('company', ''),
                visit_date=visitor_data.get('visit_date', ''),
                visit_time_start=visitor_data.get('visit_time_start', ''),
                visit_time_end=visitor_data.get('visit_time_end', ''),
                host_name=host_name,
                purpose=visitor_data.get('purpose', ''),
                area=visitor_data.get('area_name', ''),
                qr_code=qr_code
            )
            
            # Send email
            return self._send_email(
                to_email=visitor_data.get('email'),
                subject=subject,
                html_content=html_content
            )
            
        except Exception as e:
            logger.error(f"Failed to send visitor registration email: {e}")
            return {'success': False, 'error': str(e)}
    
    def send_host_approval_email(self, host_data: Dict[str, Any], 
                                   visitor_data: Dict[str, Any], 
                                   approval_url: str) -> Dict[str, Any]:
        """Send host approval request email"""
        try:
            subject = f"Visitor Approval Request - {visitor_data['full_name']}"
            
            html_template = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Visitor Approval Request</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #ffc107; color: #333; padding: 20px; text-align: center; border-radius: 8px 8px 0 0 0; }
                    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
                    .visitor-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    .approval-section { background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    .btn { display: inline-block; padding: 12px 24px; margin: 5px; text-decoration: none; border-radius: 5px; font-weight: bold; }
                    .btn-approve { background: #28a745; color: white; }
                    .btn-reject { background: #dc3545; color: white; }
                    .footer { background: #f1f3f4; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Visitor Approval Required</h1>
                        <p>A visitor requires your approval for access</p>
                    </div>
                    
                    <div class="content">
                        <div class="visitor-info">
                            <h2>Visitor Information</h2>
                            <div class="info-item">
                                <strong>Name:</strong> {visitor_name}
                            </div>
                            <div class="info-item">
                                <strong>Company:</strong> {company}
                            </div>
                            <div class="info-item">
                                <strong>Visit Date:</strong> {visit_date}
                            </div>
                            <div class="info-item">
                                <strong>Visit Time:</strong> {visit_time_start} - {visit_time_end}
                            </div>
                            <div class="info-item">
                                <strong>Purpose:</strong> {purpose}
                            </div>
                        </div>
                        
                        <div class="approval-section">
                            <h2>Approval Required</h2>
                            <p>Please review the visitor information and approve or reject this visit request.</p>
                            <div style="text-align: center; margin: 20px 0;">
                                <a href="{approval_url}?action=approve" class="btn btn-approve">Approve Visit</a>
                                <a href="{approval_url}?action=reject" class="btn btn-reject">Reject Visit</a>
                            </div>
                            <p><small>This approval link will expire in 24 hours.</small></p>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>If you did not request this visitor approval, please contact security immediately.</p>
                        <p>For assistance, contact IT support at ext. 1234</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            template = Template(html_template)
            html_content = template.render(
                visitor_name=visitor_data.get('full_name', ''),
                company=visitor_data.get('company', ''),
                visit_date=visitor_data.get('visit_date', ''),
                visit_time_start=visitor_data.get('visit_time_start', ''),
                visit_time_end=visitor_data.get('visit_time_end', ''),
                purpose=visitor_data.get('purpose', ''),
                approval_url=approval_url
            )
            
            return self._send_email(
                to_email=host_data.get('email'),
                subject=subject,
                html_content=html_content
            )
            
        except Exception as e:
            logger.error(f"Failed to send host approval email: {e}")
            return {'success': False, 'error': str(e)}
    
    def send_approval_notification_email(self, visitor_data: Dict[str, Any], 
                                       host_data: Dict[str, Any], 
                                       approval_status: str) -> Dict[str, Any]:
        """Send approval notification email to visitor"""
        try:
            if approval_status == 'approved':
                subject = "Visit Approved - Confirmation"
                color = '#28a745'
                status_text = "Approved"
                message = "Your visit has been approved. Please proceed to the reception desk at your scheduled time."
            else:
                subject = "Visit Rejected - Update"
                color = '#dc3545'
                status_text = "Rejected"
                message = "Your visit request has been rejected. Please contact your host for more information."
            
            html_template = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Visit {status_text}</title>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: {color}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0 0; }}
                    .content {{ background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }}
                    .status-box {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }}
                    .footer {{ background: #f1f3f4; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #666; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Visit {status_text}</h1>
                    <p>Your visit request has been processed</p>
                    </div>
                    
                    <div class="content">
                        <div class="status-box">
                            <h2>Status: {status_text}</h2>
                            <p>{message}</p>
                        </div>
                        
                        <div style="margin: 20px 0;">
                            <h3>Visit Details:</h3>
                            <ul>
                                <li><strong>Date:</strong> {visitor_data.get('visit_date', '')}</li>
                                <li><strong>Time:</strong> {visitor_data.get('visit_time_start', '')} - {visitor_data.get('visit_time_end', '')}</li>
                                <li><strong>Host:</strong> {host_data.get('full_name', '')}</li>
                                <li><strong>Purpose:</strong> {visitor_data.get('purpose', '')}</li>
                            </ul>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>For questions about your visit, please contact your host directly.</p>
                        <p>For technical support, contact IT support at ext. 1234</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            template = Template(html_template)
            html_content = template.render(
                color=color,
                status_text=status_text,
                message=message,
                visitor_name=visitor_data.get('full_name', ''),
                visit_date=visitor_data.get('visit_date', ''),
                visit_time_start=visitor_data.get('visit_time_start', ''),
                visit_time_end=visitor_data.get('visit_time_end', ''),
                host_name=host_data.get('full_name', ''),
                purpose=visitor_data.get('purpose', '')
            )
            
            return self._send_email(
                to_email=visitor_data.get('email'),
                subject=subject,
                html_content=html_content
            )
            
        except Exception as e:
            logger.error(f"Failed to send approval notification email: {e}")
            return {'success': False, 'error': str(e)}
    
    def send_overstay_alert_email(self, visitor_data: Dict[str, Any], 
                                   host_data: Dict[str, Any], 
                                   hours_overdue: float) -> Dict[str, Any]:
        """Send overstay alert email to host"""
        try:
            subject = f"URGENT: Visitor Overstay Alert - {visitor_data['full_name']}"
            
            html_template = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Visitor Overstay Alert</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .alert { background: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0 0; }
                    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
                    .info-box { background: white; padding: 20px; border-left: 4px solid #dc3545; margin: 20px 0; }
                    .btn { display: inline-block; padding: 12px 24px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
                    .footer { background: #f1f3f4; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="alert">
                        <h1>⚠️ OVERSTAY ALERT</h1>
                        <p>A visitor has exceeded their allowed visit time</p>
                    </div>
                    
                    <div class="content">
                        <div class="info-box">
                            <h2>Visitor Information</h2>
                            <div><strong>Name:</strong> {visitor_name}</div>
                            <div><strong>Company:</strong> {company}</div>
                            <div><strong>Check-in Time:</strong> {check_in_time}</div>
                            <div><strong>Hours Overdue:</strong> {hours_overdue:.1f} hours</div>
                            <div><strong>Contact:</strong> {phone || email}</div>
                        </div>
                        
                        <div style="margin: 20px 0;">
                            <h3>Required Action:</h3>
                            <p>Please arrange for the visitor to check out immediately.</p>
                            <p>If the visitor cannot be located, contact security.</p>
                            <div style="text-align: center; margin: 20px 0;">
                                <a href="tel:SECURITY" class="btn">Contact Security</a>
                            </div>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>This is an automated alert. Please take immediate action.</p>
                        <p>For security assistance, call Security at ext. 5555</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            template = Template(html_template)
            html_content = template.render(
                visitor_name=visitor_data.get('full_name', ''),
                company=visitor_data.get('company', ''),
                check_in_time=visitor_data.get('check_in_time', ''),
                hours_overdue=hours_overdue,
                phone=visitor_data.get('phone', ''),
                email=visitor_data.get('email', '')
            )
            
            return self._send_email(
                to_email=host_data.get('email'),
                subject=subject,
                html_content=html_content
            )
            
        except Exception as e:
            logger.error(f"Failed to send overstay alert email: {e}")
            return {'success': False, 'error': str(e)}
    
    def send_reminder_email(self, visitor_data: Dict[str, Any], 
                               host_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send reminder email for upcoming visit"""
        try:
            subject = f"Reminder: Your Visit Tomorrow - {visitor_data['full_name']}"
            
            html_template = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Visit Reminder</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #17a2b8; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0 0; }
                    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
                    .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    .footer { background: #f1f3f4; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Visit Reminder</h1>
                        <p>Your visit is scheduled for tomorrow</p>
                    </div>
                    
                    <div class="content">
                        <div class="info-box">
                            <h2>Visit Details</h2>
                            <div><strong>Date:</strong> {visit_date}</div>
                            <div><strong>Time:</strong> {visit_time_start} - {visit_time_end}</div>
                            <div><strong>Host:</strong> {host_name}</div>
                            <div><strong>Purpose:</strong> {purpose}</div>
                            <div><strong>Location:</strong> {area || 'Reception'}</div>
                            <div><strong>QR Code:</strong> {qr_code}</div>
                        </div>
                        
                        <div style="margin: 20px 0;">
                            <h3>What to Bring:</h3>
                            <ul>
                                <li>Valid photo ID</li>
                                <li>Your QR code (this email or mobile app)</li>
                                <li>Any required safety equipment</li>
                            </ul>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>For questions, please contact your host: {host_email}</p>
                        <p>For technical support, contact IT support at ext. 1234</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            template = Template(html_template)
            html_content = template.render(
                visit_date=visitor_data.get('visit_date', ''),
                visit_time_start=visitor_data.get('visit_time_start', ''),
                visit_time_end=visitor_data.get('visit_time_end', ''),
                host_name=host_data.get('full_name', ''),
                host_email=host_data.get('email', ''),
                purpose=visitor_data.get('purpose', ''),
                area=visitor_data.get('area_name', ''),
                qr_code=visitor_data.get('qr_code', '')
            )
            
            return self._send_email(
                to_email=visitor_data.get('email'),
                subject=subject,
                html_content=html_content
            )
            
        except Exception as e:
            logger.error(f"Failed to send reminder email: {e}")
            return {'success': False, 'error': str(e)}
    
    def _send_email(self, to_email: str, subject: str, 
                     html_content: str, 
                     attachments: Optional[List] = None) -> Dict[str, Any]:
        """Send email using SMTP"""
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            
            # Attach HTML content
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)
            
            # Add attachments if provided
            if attachments:
                for attachment in attachments:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(attachment['content'])
                    encoders.encode_base64(part)
                    part.add_header(
                        'Content-Disposition',
                        f'attachment; filename="{attachment["filename"]}"'
                    )
                    msg.attach(part)
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=10) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                text = msg.as_string()
                server.sendmail(self.from_email, to_email, text)
                server.quit()
            
            logger.info(f"Email sent successfully to {to_email}")
            return {'success': True}
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return {'success': False, 'error': str(e)}


# Email templates for different visitor notifications
class VisitorEmailTemplates:
    """Predefined email templates for visitor management"""
    
    @staticmethod
    def get_registration_template():
        """Get visitor registration email template"""
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Visitor Registration Confirmation</title>
        </head>
        <body style="font-family: Arial, sans-serif;">
            <h2>Visitor Registration Confirmed</h2>
            <p>Your visit has been registered successfully.</p>
            <p>Visit Details:</p>
            <ul>
                <li>Date: {{visit_date}}</li>
                <li>Time: {{visit_time_start}} - {{visit_time_end}}</li>
                <li>Host: {{host_name}}</li>
                <li>Purpose: {{purpose}}</li>
            </ul>
            <p>QR Code: {{qr_code}}</p>
        </body>
        </html>
        """
    
    @staticmethod
    def get_approval_template():
        """Get host approval request template"""
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Visitor Approval Request</title>
        </head>
        <body style="font-family: Arial, sans-serif;">
            <h2>Visitor Approval Required</h2>
            <p>Please review and approve the following visitor request:</p>
            <p>Visitor: {{visitor_name}}</p>
            <p>Visit Date: {{visit_date}}</p>
            <p>Approve: {{approve_url}}?action=approve</p>
            <p>Reject: {{approve_url}}?action=reject</p>
        </body>
        </html>
        """


class ReportEmailService:
    """Email service for report scheduling and distribution"""
    
    def __init__(self, db: Session):
        self.db = db
        self.smtp_server = getattr(settings, 'SMTP_SERVER', 'localhost')
        self.smtp_port = getattr(settings, 'SMTP_PORT', 587)
        self.smtp_username = getattr(settings, 'SMTP_USERNAME', '')
        self.smtp_password = getattr(settings, 'SMTP_PASSWORD', '')
        self.smtp_use_tls = getattr(settings, 'SMTP_USE_TLS', True)
        self.from_email = getattr(settings, 'FROM_EMAIL', 'noreply@pob-system.com')
        self.from_name = getattr(settings, 'FROM_NAME', 'POB Report System')
    
    def send_report_email(self, recipients: Dict[str, List], 
                          report_name: str, 
                          file_path: str, 
                          format: str,
                          period_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Send report email to recipients"""
        try:
            # Get company information for branding
            company = self.db.query(BaseCompany).first()
            company_name = company.company_name if company else "Apex POB"
            company_logo = company.logo_path if company and company.logo_path else None
            
            # Prepare recipient list
            to_emails = recipients.get('emails', [])
            
            if not to_emails:
                return {'success': False, 'error': 'No recipients specified'}
            
            # Prepare email content
            subject = f"{report_name} - {datetime.now().strftime('%Y-%m-%d')}"
            
            # Create HTML template with company branding
            html_template = self._get_report_email_template(company_name, company_logo)
            
            template = Template(html_template)
            html_content = template.render(
                company_name=company_name,
                report_name=report_name,
                generated_date=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                format=format.upper(),
                period_info=period_info or {},
                file_size=self._get_file_size(file_path)
            )
            
            # Prepare attachment
            attachment = {
                'filename': f"{report_name}.{format}",
                'content': self._read_file_bytes(file_path)
            }
            
            # Send email to all recipients
            results = []
            for email in to_emails:
                result = self._send_email(
                    to_email=email,
                    subject=subject,
                    html_content=html_content,
                    attachments=[attachment]
                )
                results.append({'email': email, 'result': result})
            
            return {
                'success': True,
                'sent_count': len(results),
                'recipients': to_emails,
                'results': results
            }
            
        except Exception as e:
            logger.error(f"Failed to send report email: {e}")
            return {'success': False, 'error': str(e)}
    
    def _get_report_email_template(self, company_name: str, company_logo: Optional[str], period_info: Optional[str] = None) -> str:
        """Get report email template with company branding"""
        logo_html = ""
        if company_logo:
            logo_html = f'<img src="{company_logo}" alt="{company_name}" style="max-height: 60px;">'
        period_row = f'<div><strong>Period:</strong> {period_info}</div>' if period_info else ""

        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Automated Report</title>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: #2c3e50; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0 0; }}
                .content {{ background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }}
                .logo {{ margin-bottom: 20px; }}
                .report-info {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }}
                .footer {{ background: #ecf0f1; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #7f8c8d; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">{logo_html}</div>
                    <h1>Automated Report</h1>
                    <p>{company_name}</p>
                </div>
                
                <div class="content">
                    <div class="report-info">
                        <h2>{{report_name}}</h2>
                        <div><strong>Generated:</strong> {{generated_date}}</div>
                        <div><strong>Format:</strong> {{format}}</div>
                        {period_row}
                        <div><strong>File Size:</strong> {{file_size}}</div>
                    </div>
                    
                    <p>This report was generated automatically and is attached to this email.</p>
                </div>
                
                <div class="footer">
                    <p>This is an automated email from the {company_name} Apex POB.</p>
                    <p>For questions about this report, contact your administrator.</p>
                </div>
            </div>
        </body>
        </html>
        """
    
    def _get_file_size(self, file_path: str) -> str:
        """Get human-readable file size"""
        try:
            import os
            size_bytes = os.path.getsize(file_path)
            
            if size_bytes == 0:
                return "0 bytes"
            
            size_names = ["bytes", "KB", "MB", "GB", "TB"]
            i = 0
            while size_bytes >= 1024 and i < len(size_names) - 1:
                size_bytes /= 1024.0
                i += 1
            
            return f"{size_bytes:.1f} {size_names[i]}"
        except Exception as e:
            return "Unknown"
    
    def _read_file_bytes(self, file_path: str) -> bytes:
        """Read file as bytes"""
        try:
            with open(file_path, 'rb') as f:
                return f.read()
        except Exception as e:
            logger.error(f"Failed to read file {file_path}: {e}")
            return b""
    
    def _send_email(self, to_email: str, subject: str, 
                     html_content: str, 
                     attachments: Optional[List] = None) -> Dict[str, Any]:
        """Send email using SMTP"""
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            
            # Attach HTML content
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)
            
            # Add attachments if provided
            if attachments:
                for attachment in attachments:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(attachment['content'])
                    encoders.encode_base64(part)
                    part.add_header(
                        'Content-Disposition',
                        f'attachment; filename="{attachment["filename"]}"'
                    )
                    msg.attach(part)
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=10) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                text = msg.as_string()
                server.sendmail(self.from_email, to_email, text)
                server.quit()
            
            logger.info(f"Email sent successfully to {to_email}")
            return {'success': True}
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return {'success': False, 'error': str(e)}
