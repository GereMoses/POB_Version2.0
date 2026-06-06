"""
BioTime 9.5 Payroll Loans and Advances Management Service
Complete loan management with EMI calculations and deductions
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, date, timedelta
from decimal import Decimal
import logging

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from ..models.payroll import (
    PayLoan, PayLoanDeduction, PaySalary, PayPeriod
)
from ..models.personnel import Personnel

logger = logging.getLogger(__name__)


class PayrollLoansService:
    """Comprehensive loans and advances management service"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_loan(self, loan_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new loan/advance application
        
        Args:
            loan_data: Loan application data
            
        Returns:
            Dict with loan creation result
        """
        result = {
            'success': False,
            'loan_id': None,
            'error': None
        }
        
        try:
            # Validate employee
            employee = self.db.query(Personnel).filter(
                Personnel.id == loan_data['emp_id']
            ).first()
            
            if not employee:
                result['error'] = 'Employee not found'
                return result
            
            # Validate loan amount
            if loan_data['loan_amount'] <= 0:
                result['error'] = 'Loan amount must be greater than 0'
                return result
            
            # Validate EMI amount
            if loan_data['emi_amount'] <= 0:
                result['error'] = 'EMI amount must be greater than 0'
                return result
            
            # Validate dates
            start_date = loan_data['start_date']
            end_date = loan_data['end_date']
            
            if isinstance(start_date, str):
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            if isinstance(end_date, str):
                end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            
            if end_date <= start_date:
                result['error'] = 'End date must be after start date'
                return result
            
            # Calculate loan parameters
            loan_amount = Decimal(str(loan_data['loan_amount']))
            emi_amount = Decimal(str(loan_data['emi_amount']))
            interest_rate = Decimal(str(loan_data.get('interest_rate', 0)))
            
            # Calculate number of installments
            months_diff = (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month)
            total_installments = months_diff + 1
            
            # Validate EMI calculation
            min_emi = loan_amount / total_installments
            if emi_amount < min_emi:
                result['error'] = f'EMI amount too low. Minimum EMI: {min_emi:.2f}'
                return result
            
            # Create loan record
            loan = PayLoan(
                emp_id=loan_data['emp_id'],
                loan_type=loan_data.get('loan_type', 'PERSONAL'),
                loan_amount=loan_amount,
                emi_amount=emi_amount,
                interest_rate=interest_rate,
                start_date=start_date,
                end_date=end_date,
                balance=loan_amount,
                status='pending',
                reason=loan_data.get('reason', '')
            )
            
            self.db.add(loan)
            self.db.flush()
            
            # Calculate interest and principal breakdown
            monthly_interest_rate = interest_rate / 100 / 12
            remaining_balance = loan_amount
            
            # Generate EMI schedule (for reference)
            emi_schedule = []
            current_date = start_date
            
            for i in range(total_installments):
                interest_amount = remaining_balance * monthly_interest_rate
                principal_amount = emi_amount - interest_amount
                
                # Ensure principal doesn't exceed remaining balance
                if principal_amount > remaining_balance:
                    principal_amount = remaining_balance
                    interest_amount = emi_amount - principal_amount
                
                remaining_balance -= principal_amount
                
                emi_schedule.append({
                    'installment': i + 1,
                    'date': current_date.strftime('%Y-%m-%d'),
                    'emi_amount': float(emi_amount),
                    'principal_amount': float(principal_amount),
                    'interest_amount': float(interest_amount),
                    'balance': float(remaining_balance)
                })
                
                # Move to next month
                if current_date.month == 12:
                    current_date = current_date.replace(year=current_date.year + 1, month=1)
                else:
                    current_date = current_date.replace(month=current_date.month + 1)
            
            result['success'] = True
            result['loan_id'] = loan.id
            result['emi_schedule'] = emi_schedule
            
            self.db.commit()
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating loan: {str(e)}")
            result['error'] = str(e)
        
        return result
    
    def approve_loan(self, loan_id: int, approved_by: int) -> Dict[str, Any]:
        """
        Approve a loan application
        
        Args:
            loan_id: Loan ID
            approved_by: User ID who approved
            
        Returns:
            Dict with approval result
        """
        result = {
            'success': False,
            'error': None
        }
        
        try:
            loan = self.db.query(PayLoan).filter(PayLoan.id == loan_id).first()
            
            if not loan:
                result['error'] = 'Loan not found'
                return result
            
            if loan.status != 'pending':
                result['error'] = f'Loan cannot be approved. Current status: {loan.status}'
                return result
            
            # Update loan status
            loan.status = 'active'
            loan.approved_by = approved_by
            loan.approved_at = datetime.utcnow()
            
            self.db.commit()
            
            result['success'] = True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error approving loan: {str(e)}")
            result['error'] = str(e)
        
        return result
    
    def process_loan_deductions(self, period_id: int) -> Dict[str, Any]:
        """
        Process loan deductions for a pay period
        
        Args:
            period_id: Pay period ID
            
        Returns:
            Dict with processing results
        """
        result = {
            'success': False,
            'processed': 0,
            'failed': 0,
            'errors': []
        }
        
        try:
            # Get period details
            period = self.db.query(PayPeriod).filter(PayPeriod.id == period_id).first()
            if not period:
                result['errors'].append('Pay period not found')
                return result
            
            # Get active loans
            active_loans = self.db.query(PayLoan).filter(
                PayLoan.status == 'active',
                PayLoan.start_date <= period.end_date,
                PayLoan.end_date >= period.start_date
            ).all()
            
            for loan in active_loans:
                try:
                    # Check if deduction already processed for this period
                    existing = self.db.query(PayLoanDeduction).filter(
                        PayLoanDeduction.loan_id == loan.id,
                        PayLoanDeduction.period_id == period_id
                    ).first()
                    
                    if existing:
                        continue  # Skip already processed
                    
                    # Get salary for this period
                    salary = self.db.query(PaySalary).filter(
                        PaySalary.period_id == period_id,
                        PaySalary.emp_id == loan.emp_id
                    ).first()
                    
                    if not salary:
                        result['errors'].append(f'No salary found for employee {loan.emp_id} in period {period_id}')
                        continue
                    
                    # Calculate deduction amount
                    deduction_amount = min(loan.emi_amount, loan.balance)
                    
                    # Calculate principal and interest
                    monthly_interest_rate = (loan.interest_rate or 0) / 100 / 12
                    interest_amount = loan.balance * monthly_interest_rate
                    principal_amount = deduction_amount - interest_amount
                    
                    # Ensure principal doesn't exceed balance
                    if principal_amount > loan.balance:
                        principal_amount = loan.balance
                        interest_amount = deduction_amount - principal_amount
                    
                    # Create deduction record
                    deduction = PayLoanDeduction(
                        loan_id=loan.id,
                        salary_id=salary.id,
                        period_id=period_id,
                        emp_id=loan.emp_id,
                        emi_amount=deduction_amount,
                        principal_amount=principal_amount,
                        interest_amount=interest_amount,
                        balance_before=loan.balance,
                        balance_after=loan.balance - principal_amount,
                        deduction_date=period.end_date
                    )
                    
                    self.db.add(deduction)
                    
                    # Update loan balance
                    loan.balance -= principal_amount
                    
                    # Check if loan is fully paid
                    if loan.balance <= 0:
                        loan.status = 'completed'
                        loan.balance = 0
                    
                    result['processed'] += 1
                    
                except Exception as e:
                    logger.error(f"Error processing loan {loan.id}: {str(e)}")
                    result['failed'] += 1
                    result['errors'].append(f'Loan {loan.id}: {str(e)}')
            
            self.db.commit()
            result['success'] = True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error processing loan deductions: {str(e)}")
            result['errors'].append(f'Processing error: {str(e)}')
        
        return result
    
    def get_loan_details(self, loan_id: int) -> Dict[str, Any]:
        """
        Get detailed loan information including deduction history
        
        Args:
            loan_id: Loan ID
            
        Returns:
            Dict with loan details
        """
        try:
            loan = self.db.query(PayLoan).filter(PayLoan.id == loan_id).first()
            
            if not loan:
                return {'error': 'Loan not found'}
            
            # Get employee details
            employee = self.db.query(Personnel).filter(Personnel.id == loan.emp_id).first()
            
            # Get deduction history
            deductions = self.db.query(PayLoanDeduction).filter(
                PayLoanDeduction.loan_id == loan_id
            ).order_by(PayLoanDeduction.deduction_date.desc()).all()
            
            # Calculate totals
            total_paid = sum(deduction.emi_amount for deduction in deductions)
            total_principal = sum(deduction.principal_amount for deduction in deductions)
            total_interest = sum(deduction.interest_amount for deduction in deductions)
            
            # Calculate next payment info
            next_payment = None
            if loan.status == 'active' and loan.balance > 0:
                next_payment = {
                    'amount': float(min(loan.emi_amount, loan.balance)),
                    'due_date': self._get_next_payment_date(loan),
                    'remaining_balance': float(loan.balance)
                }
            
            return {
                'id': loan.id,
                'employee': {
                    'id': employee.id,
                    'name': employee.full_name,
                    'badge_id': employee.badge_id,
                    'department': employee.department
                } if employee else None,
                'loan_type': loan.loan_type,
                'loan_amount': float(loan.loan_amount),
                'emi_amount': float(loan.emi_amount),
                'interest_rate': float(loan.interest_rate) if loan.interest_rate else 0,
                'start_date': loan.start_date.isoformat(),
                'end_date': loan.end_date.isoformat(),
                'balance': float(loan.balance),
                'status': loan.status,
                'reason': loan.reason,
                'approved_at': loan.approved_at.isoformat() if loan.approved_at else None,
                'created_at': loan.created_at.isoformat(),
                'totals': {
                    'total_paid': float(total_paid),
                    'total_principal': float(total_principal),
                    'total_interest': float(total_interest),
                    'remaining_balance': float(loan.balance),
                    'progress_percentage': float((total_principal / loan.loan_amount) * 100) if loan.loan_amount > 0 else 0
                },
                'next_payment': next_payment,
                'deduction_history': [
                    {
                        'id': deduction.id,
                        'period_id': deduction.period_id,
                        'amount': float(deduction.emi_amount),
                        'principal': float(deduction.principal_amount),
                        'interest': float(deduction.interest_amount),
                        'balance_before': float(deduction.balance_before),
                        'balance_after': float(deduction.balance_after),
                        'date': deduction.deduction_date.isoformat()
                    }
                    for deduction in deductions
                ]
            }
            
        except Exception as e:
            logger.error(f"Error getting loan details: {str(e)}")
            return {'error': str(e)}
    
    def get_employee_loans(self, emp_id: int, include_completed: bool = False) -> List[Dict[str, Any]]:
        """
        Get all loans for an employee
        
        Args:
            emp_id: Employee ID
            include_completed: Include completed loans
            
        Returns:
            List of employee loans
        """
        try:
            query = self.db.query(PayLoan).filter(PayLoan.emp_id == emp_id)
            
            if not include_completed:
                query = query.filter(PayLoan.status != 'completed')
            
            loans = query.order_by(PayLoan.created_at.desc()).all()
            
            result = []
            for loan in loans:
                # Get total deductions
                total_deducted = self.db.query(func.sum(PayLoanDeduction.emi_amount)).filter(
                    PayLoanDeduction.loan_id == loan.id
                ).scalar() or 0
                
                result.append({
                    'id': loan.id,
                    'loan_type': loan.loan_type,
                    'loan_amount': float(loan.loan_amount),
                    'emi_amount': float(loan.emi_amount),
                    'interest_rate': float(loan.interest_rate) if loan.interest_rate else 0,
                    'balance': float(loan.balance),
                    'status': loan.status,
                    'start_date': loan.start_date.isoformat(),
                    'end_date': loan.end_date.isoformat(),
                    'total_deducted': float(total_deducted),
                    'remaining_amount': float(loan.loan_amount - total_deducted),
                    'progress_percentage': float((total_deducted / loan.loan_amount) * 100) if loan.loan_amount > 0 else 0
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting employee loans: {str(e)}")
            return []
    
    def get_loan_summary(self, emp_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Get loan summary statistics
        
        Args:
            emp_id: Optional employee ID for specific employee summary
            
        Returns:
            Dict with loan summary
        """
        try:
            query = self.db.query(PayLoan)
            
            if emp_id:
                query = query.filter(PayLoan.emp_id == emp_id)
            
            loans = query.all()
            
            summary = {
                'total_loans': len(loans),
                'active_loans': len([l for l in loans if l.status == 'active']),
                'pending_loans': len([l for l in loans if l.status == 'pending']),
                'completed_loans': len([l for l in loans if l.status == 'completed']),
                'total_loan_amount': float(sum(l.loan_amount for l in loans)),
                'total_balance': float(sum(l.balance for l in loans if l.status == 'active')),
                'total_deductible': float(sum(l.emi_amount for l in loans if l.status == 'active')),
                'loan_types': {}
            }
            
            # Group by loan type
            for loan in loans:
                loan_type = loan.loan_type
                if loan_type not in summary['loan_types']:
                    summary['loan_types'][loan_type] = {
                        'count': 0,
                        'total_amount': 0,
                        'active_count': 0,
                        'balance': 0
                    }
                
                summary['loan_types'][loan_type]['count'] += 1
                summary['loan_types'][loan_type]['total_amount'] += loan.loan_amount
                if loan.status == 'active':
                    summary['loan_types'][loan_type]['active_count'] += 1
                    summary['loan_types'][loan_type]['balance'] += loan.balance
            
            return summary
            
        except Exception as e:
            logger.error(f"Error getting loan summary: {str(e)}")
            return {}
    
    def _get_next_payment_date(self, loan: PayLoan) -> str:
        """Calculate next payment date for a loan"""
        today = date.today()
        
        # Find the most recent deduction
        last_deduction = self.db.query(PayLoanDeduction).filter(
            PayLoanDeduction.loan_id == loan.id
        ).order_by(PayLoanDeduction.deduction_date.desc()).first()
        
        if last_deduction:
            # Next payment is one month after last deduction
            next_date = last_deduction.deduction_date
            if next_date.month == 12:
                next_date = next_date.replace(year=next_date.year + 1, month=1)
            else:
                next_date = next_date.replace(month=next_date.month + 1)
        else:
            # No deductions yet, use start date
            next_date = loan.start_date
        
        return next_date.isoformat()
    
    def calculate_emi_schedule(self, loan_amount: float, interest_rate: float, 
                              tenure_months: int, emi_type: str = 'fixed') -> List[Dict[str, Any]]:
        """
        Calculate EMI schedule for a loan
        
        Args:
            loan_amount: Principal amount
            interest_rate: Annual interest rate (%)
            tenure_months: Loan tenure in months
            emi_type: EMI calculation type ('fixed' or 'reducing')
            
        Returns:
            List of EMI schedule
        """
        try:
            principal = Decimal(str(loan_amount))
            monthly_rate = Decimal(str(interest_rate)) / 100 / 12
            
            if emi_type == 'fixed':
                # Fixed EMI calculation
                emi = principal * (1 + (monthly_rate * tenure_months)) / tenure_months
            else:
                # Reducing balance EMI calculation
                if monthly_rate == 0:
                    emi = principal / tenure_months
                else:
                    emi = principal * monthly_rate * (1 + monthly_rate) ** tenure_months / ((1 + monthly_rate) ** tenure_months - 1)
            
            schedule = []
            remaining_balance = principal
            
            for month in range(1, tenure_months + 1):
                interest_amount = remaining_balance * monthly_rate
                principal_amount = emi - interest_amount
                
                # Adjust final payment
                if month == tenure_months:
                    principal_amount = remaining_balance
                    interest_amount = emi - principal_amount
                    remaining_balance = 0
                else:
                    remaining_balance -= principal_amount
                
                schedule.append({
                    'month': month,
                    'emi_amount': float(emi),
                    'principal_amount': float(principal_amount),
                    'interest_amount': float(interest_amount),
                    'balance': float(remaining_balance)
                })
            
            return schedule
            
        except Exception as e:
            logger.error(f"Error calculating EMI schedule: {str(e)}")
            return []
