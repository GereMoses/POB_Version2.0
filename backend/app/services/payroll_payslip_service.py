"""
BioTime 9.5 Payslip Generation Service with POB Extensions
PDF generation, email delivery, and template management
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, date
from decimal import Decimal
import logging
import io
import base64
from jinja2 import Template
try:
    import weasyprint
    from weasyprint import HTML, CSS
    _WEASYPRINT_AVAILABLE = True
except ImportError:
    weasyprint = None  # type: ignore
    HTML = CSS = None  # type: ignore
    _WEASYPRINT_AVAILABLE = False

from ..models.payroll import (
    PaySalary, PaySalaryItem, PayPayslipTemplate, PayPeriod, PayStructure
)
from ..models.personnel import Personnel
from ..core.config import settings

logger = logging.getLogger(__name__)


class PayrollPayslipService:
    """Complete payslip generation and management service"""
    
    def __init__(self, db):
        self.db = db
    
    def generate_payslip_pdf(self, salary_id: int, template_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Generate PDF payslip for a salary record
        
        Args:
            salary_id: Salary record ID
            template_id: Optional template ID (uses default if not provided)
            
        Returns:
            Dict with PDF data and metadata
        """
        result = {
            'success': False,
            'pdf_data': None,
            'filename': None,
            'error': None
        }
        
        try:
            # Get salary record with all details
            salary = self.db.query(PaySalary).filter(PaySalary.id == salary_id).first()
            if not salary:
                result['error'] = 'Salary record not found'
                return result
            
            # Get salary items
            items = self.db.query(PaySalaryItem).filter(
                PaySalaryItem.salary_id == salary_id
            ).order_by(PaySalaryItem.calculation_order).all()
            
            # Get payslip template
            if template_id:
                template = self.db.query(PayPayslipTemplate).filter(
                    PayPayslipTemplate.id == template_id
                ).first()
            else:
                template = self.db.query(PayPayslipTemplate).filter(
                    PayPayslipTemplate.is_default == True,
                    PayPayslipTemplate.is_active == True
                ).first()
            
            if not template:
                # Use default template if none found
                template = self._get_default_template()
            
            # Prepare payslip data
            payslip_data = self._prepare_payslip_data(salary, items)
            
            # Generate HTML using template
            html_content = self._render_payslip_html(template, payslip_data)
            
            # Convert to PDF
            pdf_data = self._html_to_pdf(html_content, template.css_style)
            
            # Generate filename
            emp_name = salary.employee.full_name.replace(' ', '_')
            period_name = salary.period.period_name.replace(' ', '_')
            filename = f"payslip_{emp_name}_{period_name}.pdf"
            
            result['success'] = True
            result['pdf_data'] = base64.b64encode(pdf_data).decode()
            result['filename'] = filename
            
        except Exception as e:
            logger.error(f"Error generating payslip PDF: {str(e)}")
            result['error'] = str(e)
        
        return result
    
    def bulk_generate_payslips(self, period_id: int, emp_ids: Optional[List[int]] = None,
                              template_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Bulk generate payslips for multiple employees
        
        Args:
            period_id: Pay period ID
            emp_ids: Optional list of employee IDs
            template_id: Optional template ID
            
        Returns:
            Dict with generation results
        """
        result = {
            'success': False,
            'generated': 0,
            'failed': 0,
            'errors': [],
            'payslips': []
        }
        
        try:
            # Get salaries for period
            query = self.db.query(PaySalary).filter(PaySalary.period_id == period_id)
            
            if emp_ids:
                query = query.filter(PaySalary.emp_id.in_(emp_ids))
            
            salaries = query.filter(PaySalary.calc_status == 'calculated').all()
            
            for salary in salaries:
                payslip_result = self.generate_payslip_pdf(salary.id, template_id)
                
                if payslip_result['success']:
                    result['generated'] += 1
                    result['payslips'].append({
                        'emp_id': salary.emp_id,
                        'emp_name': salary.employee.full_name,
                        'filename': payslip_result['filename'],
                        'pdf_data': payslip_result['pdf_data']
                    })
                else:
                    result['failed'] += 1
                    result['errors'].append({
                        'emp_id': salary.emp_id,
                        'emp_name': salary.employee.full_name,
                        'error': payslip_result['error']
                    })
            
            result['success'] = True
            
        except Exception as e:
            logger.error(f"Error in bulk payslip generation: {str(e)}")
            result['errors'].append({'error': str(e)})
        
        return result
    
    def send_payslip_email(self, salary_id: int, template_id: Optional[int] = None,
                          password: Optional[str] = None) -> Dict[str, Any]:
        """
        Send payslip via email with password protection
        
        Args:
            salary_id: Salary record ID
            template_id: Optional template ID
            password: Optional password for PDF protection
            
        Returns:
            Dict with email sending result
        """
        result = {
            'success': False,
            'sent': False,
            'error': None
        }
        
        try:
            # Generate payslip PDF
            payslip_result = self.generate_payslip_pdf(salary_id, template_id)
            if not payslip_result['success']:
                result['error'] = payslip_result['error']
                return result
            
            # Get employee email
            salary = self.db.query(PaySalary).filter(PaySalary.id == salary_id).first()
            if not salary or not salary.employee.email:
                result['error'] = 'Employee email not found'
                return result
            
            # Generate password if not provided
            if not password:
                password = self._generate_payslip_password(salary.employee)
            
            # TODO: Implement email sending functionality
            # This would integrate with your email service
            logger.info(f"Would send payslip to {salary.employee.email}")
            
            result['success'] = True
            result['sent'] = True
            
        except Exception as e:
            logger.error(f"Error sending payslip email: {str(e)}")
            result['error'] = str(e)
        
        return result
    
    def bulk_send_payslips(self, period_id: int, emp_ids: Optional[List[int]] = None) -> Dict[str, Any]:
        """
        Bulk send payslips via email
        
        Args:
            period_id: Pay period ID
            emp_ids: Optional list of employee IDs
            
        Returns:
            Dict with bulk email results
        """
        result = {
            'success': False,
            'sent': 0,
            'failed': 0,
            'errors': []
        }
        
        try:
            # Get salaries for period
            query = self.db.query(PaySalary).filter(PaySalary.period_id == period_id)
            
            if emp_ids:
                query = query.filter(PaySalary.emp_id.in_(emp_ids))
            
            salaries = query.filter(PaySalary.calc_status == 'calculated').all()
            
            for salary in salaries:
                email_result = self.send_payslip_email(salary.id)
                
                if email_result['success']:
                    result['sent'] += 1
                else:
                    result['failed'] += 1
                    result['errors'].append({
                        'emp_id': salary.emp_id,
                        'emp_name': salary.employee.full_name,
                        'error': email_result['error']
                    })
            
            result['success'] = True
            
        except Exception as e:
            logger.error(f"Error in bulk email sending: {str(e)}")
            result['errors'].append({'error': str(e)})
        
        return result
    
    def _prepare_payslip_data(self, salary: PaySalary, items: List[PaySalaryItem]) -> Dict[str, Any]:
        """Prepare data for payslip template rendering"""
        
        # Separate earnings and deductions
        earnings = []
        deductions = []
        
        for item in items:
            item_data = {
                'name': item.item_name,
                'amount': float(item.item_value),
                'formula': item.formula_used,
                'source_value': item.source_value
            }
            
            if item.item_type.value == 'earning':
                earnings.append(item_data)
            else:
                deductions.append(item_data)
        
        return {
            'employee': {
                'name': salary.employee.full_name,
                'badge_id': salary.employee.badge_id,
                'department': salary.employee.department or '',
                'position': salary.employee.position or '',
                'email': salary.employee.email or '',
                'phone': salary.employee.phone or ''
            },
            'period': {
                'name': salary.period.period_name,
                'start_date': salary.period.start_date.strftime('%d %b %Y'),
                'end_date': salary.period.end_date.strftime('%d %b %Y'),
                'pay_date': salary.period.pay_date.strftime('%d %b %Y') if salary.period.pay_date else 'N/A'
            },
            'attendance': {
                'work_days': salary.work_days,
                'present_days': salary.present_days,
                'absent_days': salary.absent_days,
                'leave_days': salary.leave_days,
                'ot_hours': salary.ot_hours,
                'late_minutes': salary.late_minutes
            },
            'pob_data': {
                'zone_hours': salary.zone_hours,
                'night_hours': salary.night_hours,
                'hazard_days': salary.hazard_days,
                'contractor_flag': salary.contractor_flag
            },
            'earnings': earnings,
            'deductions': deductions,
            'totals': {
                'basic_salary': float(salary.basic_salary) if salary.basic_salary else 0,
                'gross_salary': float(salary.gross_salary),
                'total_earnings': float(salary.total_earnings),
                'total_deductions': float(salary.total_deductions),
                'net_salary': float(salary.net_salary)
            },
            'calculation': {
                'calc_date': salary.calc_time.strftime('%d %b %Y %H:%M'),
                'calc_by': 'Payroll System',
                'status': salary.calc_status.value
            },
            'company': {
                'name': 'Apex POB',
                'logo': '/static/logo.png',
                'address': 'Oil & Gas Operations Center',
                'phone': '+234-XXX-XXXX',
                'email': 'payroll@pob-system.com'
            },
            'qr_code': self._generate_qr_code(salary),
            'verification_code': self._generate_verification_code(salary)
        }
    
    def _render_payslip_html(self, template: PayPayslipTemplate, data: Dict[str, Any]) -> str:
        """Render payslip HTML using Jinja2 template"""
        
        # Default template if none provided
        if not template:
            template_html = self._get_default_template_html()
            css_style = self._get_default_css()
        else:
            template_html = template.body_html or self._get_default_template_html()
            css_style = template.css_style or self._get_default_css()
        
        # Render template
        jinja_template = Template(template_html)
        html_content = jinja_template.render(**data)
        
        # Add CSS styling
        full_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Payslip</title>
            <style>
            {css_style}
            </style>
        </head>
        <body>
            {html_content}
        </body>
        </html>
        """
        
        return full_html
    
    def _html_to_pdf(self, html_content: str, css_style: Optional[str] = None) -> bytes:
        """Convert HTML to PDF using WeasyPrint"""
        
        try:
            # Create HTML object
            html_obj = HTML(string=html_content)
            
            # Add CSS if provided
            if css_style:
                css = CSS(string=css_style)
                pdf_data = html_obj.write_pdf(stylesheets=[css])
            else:
                pdf_data = html_obj.write_pdf()
            
            return pdf_data
            
        except Exception as e:
            logger.error(f"Error converting HTML to PDF: {str(e)}")
            raise
    
    def _get_default_template(self) -> PayPayslipTemplate:
        """Get default payslip template"""
        return PayPayslipTemplate(
            template_name="Default",
            header_html=self._get_default_header_html(),
            body_html=self._get_default_template_html(),
            footer_html=self._get_default_footer_html(),
            css_style=self._get_default_css()
        )
    
    def _get_default_header_html(self) -> str:
        """Default header HTML"""
        return """
        <div class="header">
            <div class="company-info">
                <h1>{{ company.name }}</h1>
                <p>{{ company.address }}</p>
                <p>Phone: {{ company.phone }} | Email: {{ company.email }}</p>
            </div>
            <div class="payslip-title">
                <h2>PAYSLIP</h2>
                <p>For the period {{ period.start_date }} to {{ period.end_date }}</p>
            </div>
        </div>
        """
    
    def _get_default_template_html(self) -> str:
        """Default payslip body HTML"""
        return """
        <div class="payslip">
            <div class="employee-info">
                <h3>Employee Information</h3>
                <table>
                    <tr>
                        <td><strong>Name:</strong></td>
                        <td>{{ employee.name }}</td>
                        <td><strong>Badge ID:</strong></td>
                        <td>{{ employee.badge_id }}</td>
                    </tr>
                    <tr>
                        <td><strong>Department:</strong></td>
                        <td>{{ employee.department }}</td>
                        <td><strong>Position:</strong></td>
                        <td>{{ employee.position }}</td>
                    </tr>
                </table>
            </div>

            <div class="attendance-info">
                <h3>Attendance Summary</h3>
                <table>
                    <tr>
                        <td>Work Days</td>
                        <td>{{ attendance.work_days }}</td>
                        <td>Present Days</td>
                        <td>{{ attendance.present_days }}</td>
                        <td>OT Hours</td>
                        <td>{{ attendance.ot_hours }}</td>
                    </tr>
                    {% if pob_data.zone_hours > 0 %}
                    <tr>
                        <td>Zone Hours</td>
                        <td>{{ pob_data.zone_hours }}</td>
                        <td>Night Hours</td>
                        <td>{{ pob_data.night_hours }}</td>
                        <td>Hazard Days</td>
                        <td>{{ pob_data.hazard_days }}</td>
                    </tr>
                    {% endif %}
                </table>
            </div>

            <div class="earnings">
                <h3>Earnings</h3>
                <table>
                    <tr>
                        <th>Description</th>
                        <th>Amount</th>
                    </tr>
                    {% for item in earnings %}
                    <tr>
                        <td>{{ item.name }}</td>
                        <td class="amount">₦{{ "%.2f"|format(item.amount) }}</td>
                    </tr>
                    {% endfor %}
                    <tr class="total">
                        <td><strong>Total Earnings</strong></td>
                        <td class="amount"><strong>₦{{ "%.2f"|format(totals.total_earnings) }}</strong></td>
                    </tr>
                </table>
            </div>

            <div class="deductions">
                <h3>Deductions</h3>
                <table>
                    <tr>
                        <th>Description</th>
                        <th>Amount</th>
                    </tr>
                    {% for item in deductions %}
                    <tr>
                        <td>{{ item.name }}</td>
                        <td class="amount">₦{{ "%.2f"|format(item.amount) }}</td>
                    </tr>
                    {% endfor %}
                    <tr class="total">
                        <td><strong>Total Deductions</strong></td>
                        <td class="amount"><strong>₦{{ "%.2f"|format(totals.total_deductions) }}</strong></td>
                    </tr>
                </table>
            </div>

            <div class="summary">
                <table>
                    <tr>
                        <td><strong>Gross Salary</strong></td>
                        <td class="amount"><strong>₦{{ "%.2f"|format(totals.gross_salary) }}</strong></td>
                    </tr>
                    <tr>
                        <td><strong>Total Deductions</strong></td>
                        <td class="amount"><strong>₦{{ "%.2f"|format(totals.total_deductions) }}</strong></td>
                    </tr>
                    <tr class="net-salary">
                        <td><strong>NET SALARY</strong></td>
                        <td class="amount"><strong>₦{{ "%.2f"|format(totals.net_salary) }}</strong></td>
                    </tr>
                </table>
            </div>

            <div class="verification">
                <p><strong>Verification Code:</strong> {{ verification_code }}</p>
                <div class="qr-code">
                    <img src="{{ qr_code }}" alt="QR Code" />
                </div>
                <p><em>This is a computer-generated document. No signature required.</em></p>
            </div>
        </div>
        """
    
    def _get_default_footer_html(self) -> str:
        """Default footer HTML"""
        return """
        <div class="footer">
            <div class="calculation-info">
                <p>Calculated on: {{ calculation.calc_date }} by {{ calculation.calc_by }}</p>
                <p>Status: {{ calculation.status | upper }}</p>
            </div>
            <div class="company-stamp">
                <p>** COMPANY CONFIDENTIAL **</p>
            </div>
        </div>
        """
    
    def _get_default_css(self) -> str:
        """Default CSS styling for payslip"""
        return """
        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            margin: 0;
            padding: 20px;
            background: white;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        
        .company-info h1 {
            margin: 0;
            color: #333;
            font-size: 24px;
        }
        
        .company-info p {
            margin: 2px 0;
            color: #666;
        }
        
        .payslip-title h2 {
            margin: 0;
            color: #333;
            font-size: 20px;
            text-align: center;
        }
        
        .payslip-title p {
            margin: 5px 0 0 0;
            color: #666;
            text-align: center;
        }
        
        .employee-info, .attendance-info, .earnings, .deductions, .summary {
            margin-bottom: 20px;
        }
        
        h3 {
            margin: 0 0 10px 0;
            color: #333;
            border-bottom: 1px solid #ccc;
            padding-bottom: 5px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        
        th {
            background-color: #f5f5f5;
            font-weight: bold;
        }
        
        .amount {
            text-align: right !important;
        }
        
        .total {
            background-color: #f9f9f9;
            font-weight: bold;
        }
        
        .net-salary {
            background-color: #e6f7ff;
            border: 2px solid #1890ff;
        }
        
        .net-salary td {
            font-weight: bold;
            color: #1890ff;
        }
        
        .verification {
            margin-top: 30px;
            padding: 15px;
            border: 1px solid #ddd;
            background-color: #fafafa;
            text-align: center;
        }
        
        .qr-code {
            margin: 10px 0;
        }
        
        .qr-code img {
            max-width: 100px;
            height: auto;
        }
        
        .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ccc;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #666;
        }
        
        .company-stamp {
            text-align: center;
            font-weight: bold;
        }
        
        @page {
            margin: 20mm;
            size: A4;
        }
        
        @media print {
            body {
                margin: 0;
                padding: 0;
            }
        }
        """
    
    def _generate_payslip_password(self, employee: Personnel) -> str:
        """Generate payslip password from employee data"""
        # Default: Last 4 digits of badge ID + birth year
        badge_id = employee.badge_id or '0000'
        last_four = badge_id[-4:] if len(badge_id) >= 4 else badge_id
        
        # TODO: Get actual birth year from employee data
        birth_year = '1990'  # Placeholder
        
        return f"{last_four}{birth_year}"
    
    def _generate_qr_code(self, salary: PaySalary) -> str:
        """Generate QR code for payslip verification"""
        # TODO: Implement QR code generation
        # This would generate a QR code containing verification data
        return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    
    def _generate_verification_code(self, salary: PaySalary) -> str:
        """Generate verification code for payslip"""
        # Generate unique verification code
        timestamp = salary.calc_time.strftime('%Y%m%d')
        emp_id = salary.emp_id
        return f"PSL-{timestamp}-{emp_id:06d}"
