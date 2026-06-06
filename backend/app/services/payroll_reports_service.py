"""
BioTime 9.5 Payroll Reports Service with POB Extensions
Comprehensive reporting and analytics for payroll operations
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, date, timedelta
from decimal import Decimal
import logging
import io
import csv
try:
    import xlsxwriter
    _XLSXWRITER_AVAILABLE = True
except ImportError:
    xlsxwriter = None  # type: ignore
    _XLSXWRITER_AVAILABLE = False
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, case, extract

from ..models.payroll import (
    PaySalary, PaySalaryItem, PayPeriod, PayStructure, PayLoan,
    PayZoneAllowance, PayContractorRate
)
from ..models.personnel import Personnel
from ..models.department import Department
from ..models.position import Position
from ..models.zone import Zone

logger = logging.getLogger(__name__)


class PayrollReportsService:
    """Comprehensive payroll reporting service"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def generate_salary_summary_report(self, period_id: int, group_by: str = "department") -> Dict[str, Any]:
        """
        Generate salary summary report
        
        Args:
            period_id: Pay period ID
            group_by: Grouping option (department, position, employee_type)
            
        Returns:
            Dict with report data
        """
        try:
            # Get salaries for the period
            salaries = self.db.query(PaySalary).filter(PaySalary.period_id == period_id).all()
            
            if not salaries:
                return {
                    "period_id": period_id,
                    "group_by": group_by,
                    "total_employees": 0,
                    "total_gross_salary": 0,
                    "total_net_salary": 0,
                    "total_deductions": 0,
                    "breakdown": []
                }
            
            # Group data based on grouping option
            grouped_data = {}
            
            for salary in salaries:
                group_key = self._get_group_key(salary, group_by)
                
                if group_key not in grouped_data:
                    grouped_data[group_key] = {
                        "group_name": group_key,
                        "count": 0,
                        "gross_salary": 0,
                        "net_salary": 0,
                        "deductions": 0,
                        "basic_salary": 0,
                        "ot_amount": 0,
                        "allowances": 0,
                        "employees": []
                    }
                
                grouped_data[group_key]["count"] += 1
                grouped_data[group_key]["gross_salary"] += salary.gross_salary
                grouped_data[group_key]["net_salary"] += salary.net_salary
                grouped_data[group_key]["deductions"] += salary.total_deductions
                grouped_data[group_key]["basic_salary"] += salary.basic_salary or 0
                
                # Get OT amount from salary items
                ot_item = next((item for item in salary.items if item.item_name == "OT"), None)
                grouped_data[group_key]["ot_amount"] += ot_item.item_value if ot_item else 0
                
                # Get allowances (non-basic earnings)
                allowance_items = [item for item in salary.items 
                                  if item.item_type.value == "earning" and item.item_name != "Basic"]
                grouped_data[group_key]["allowances"] += sum(item.item_value for item in allowance_items)
                
                # Add employee details
                grouped_data[group_key]["employees"].append({
                    "id": salary.emp_id,
                    "name": salary.employee.full_name,
                    "badge_id": salary.employee.badge_id,
                    "gross_salary": salary.gross_salary,
                    "net_salary": salary.net_salary
                })
            
            # Calculate totals
            total_employees = len(salaries)
            total_gross = sum(salary.gross_salary for salary in salaries)
            total_net = sum(salary.net_salary for salary in salaries)
            total_deductions = sum(salary.total_deductions for salary in salaries)
            
            # Convert to list and sort
            breakdown = list(grouped_data.values())
            breakdown.sort(key=lambda x: x["gross_salary"], reverse=True)
            
            return {
                "period_id": period_id,
                "group_by": group_by,
                "total_employees": total_employees,
                "total_gross_salary": float(total_gross),
                "total_net_salary": float(total_net),
                "total_deductions": float(total_deductions),
                "average_gross": float(total_gross / total_employees) if total_employees > 0 else 0,
                "average_net": float(total_net / total_employees) if total_employees > 0 else 0,
                "breakdown": breakdown
            }
            
        except Exception as e:
            logger.error(f"Error generating salary summary report: {str(e)}")
            raise
    
    def generate_zone_cost_report(self, period_id: int) -> Dict[str, Any]:
        """
        Generate POB zone cost report
        
        Args:
            period_id: Pay period ID
            
        Returns:
            Dict with zone cost breakdown
        """
        try:
            # Get salaries with zone data
            salaries = self.db.query(PaySalary).filter(
                PaySalary.period_id == period_id,
                PaySalary.zone_hours > 0
            ).all()
            
            if not salaries:
                return {
                    "period_id": period_id,
                    "total_employees_with_zone_work": 0,
                    "total_zone_hours": 0,
                    "total_zone_cost": 0,
                    "zone_breakdown": []
                }
            
            # Get zone allowance rates
            zone_allowances = {}
            allowances = self.db.query(PayZoneAllowance).filter(
                PayZoneAllowance.is_active == True
            ).all()
            
            for allowance in allowances:
                if allowance.area_id not in zone_allowances:
                    zone_allowances[allowance.area_id] = []
                zone_allowances[allowance.area_id].append(allowance)
            
            # Group by zone
            zone_data = {}
            total_zone_cost = 0
            
            for salary in salaries:
                # Get zone breakdown from attendance data (simplified)
                zone_hours = salary.zone_hours or 0
                night_hours = salary.night_hours or 0
                hazard_days = salary.hazard_days or 0
                
                # Calculate zone cost (simplified - would need actual zone mapping)
                zone_cost = zone_hours * 50  # Basic zone rate
                zone_cost += night_hours * 25  # Night shift premium
                zone_cost += hazard_days * 100  # Hazard premium
                
                if zone_hours > 0:
                    zone_key = f"Zone_{salary.emp_id}"  # Simplified - would use actual zone
                    
                    if zone_key not in zone_data:
                        zone_data[zone_key] = {
                            "zone_name": zone_key,
                            "employees": [],
                            "total_hours": 0,
                            "night_hours": 0,
                            "hazard_days": 0,
                            "total_cost": 0
                        }
                    
                    zone_data[zone_key]["employees"].append({
                        "emp_id": salary.emp_id,
                        "emp_name": salary.employee.full_name,
                        "zone_hours": zone_hours,
                        "night_hours": night_hours,
                        "hazard_days": hazard_days,
                        "zone_cost": zone_cost
                    })
                    
                    zone_data[zone_key]["total_hours"] += zone_hours
                    zone_data[zone_key]["night_hours"] += night_hours
                    zone_data[zone_key]["hazard_days"] += hazard_days
                    zone_data[zone_key]["total_cost"] += zone_cost
                    total_zone_cost += zone_cost
            
            return {
                "period_id": period_id,
                "total_employees_with_zone_work": len(salaries),
                "total_zone_hours": sum(salary.zone_hours for salary in salaries),
                "total_night_hours": sum(salary.night_hours for salary in salaries),
                "total_hazard_days": sum(salary.hazard_days for salary in salaries),
                "total_zone_cost": float(total_zone_cost),
                "zone_breakdown": list(zone_data.values())
            }
            
        except Exception as e:
            logger.error(f"Error generating zone cost report: {str(e)}")
            raise
    
    def generate_contractor_vs_staff_report(self, period_id: int) -> Dict[str, Any]:
        """
        Generate contractor vs staff cost comparison report
        
        Args:
            period_id: Pay period ID
            
        Returns:
            Dict with contractor vs staff breakdown
        """
        try:
            # Get all salaries for the period
            salaries = self.db.query(PaySalary).filter(PaySalary.period_id == period_id).all()
            
            # Separate staff and contractors
            staff_salaries = []
            contractor_salaries = []
            
            for salary in salaries:
                if salary.contractor_flag:
                    contractor_salaries.append(salary)
                else:
                    staff_salaries.append(salary)
            
            # Calculate staff metrics
            staff_metrics = self._calculate_group_metrics(staff_salaries)
            contractor_metrics = self._calculate_group_metrics(contractor_salaries)
            
            return {
                "period_id": period_id,
                "staff": {
                    "count": len(staff_salaries),
                    "total_cost": staff_metrics["total_cost"],
                    "average_cost": staff_metrics["average_cost"],
                    "total_hours": staff_metrics["total_hours"],
                    "average_rate": staff_metrics["average_rate"],
                    "breakdown_by_department": staff_metrics["dept_breakdown"]
                },
                "contractors": {
                    "count": len(contractor_salaries),
                    "total_cost": contractor_metrics["total_cost"],
                    "average_cost": contractor_metrics["average_cost"],
                    "total_hours": contractor_metrics["total_hours"],
                    "average_rate": contractor_metrics["average_rate"],
                    "breakdown_by_vendor": contractor_metrics["vendor_breakdown"]
                },
                "comparison": {
                    "cost_difference": staff_metrics["total_cost"] - contractor_metrics["total_cost"],
                    "cost_ratio": staff_metrics["total_cost"] / contractor_metrics["total_cost"] if contractor_metrics["total_cost"] > 0 else 0,
                    "headcount_ratio": len(staff_salaries) / len(contractor_salaries) if len(contractor_salaries) > 0 else 0
                }
            }
            
        except Exception as e:
            logger.error(f"Error generating contractor vs staff report: {str(e)}")
            raise
    
    def generate_item_wise_report(self, period_id: int) -> Dict[str, Any]:
        """
        Generate item-wise payroll breakdown report
        
        Args:
            period_id: Pay period ID
            
        Returns:
            Dict with item-wise breakdown
        """
        try:
            # Get all salary items for the period
            salary_items = self.db.query(PaySalaryItem).join(PaySalary).filter(
                PaySalary.period_id == period_id
            ).all()
            
            # Group by item name
            item_data = {}
            
            for item in salary_items:
                item_name = item.item_name
                
                if item_name not in item_data:
                    item_data[item_name] = {
                        "item_name": item_name,
                        "item_type": item.item_type.value,
                        "total_amount": 0,
                        "count": 0,
                        "average_amount": 0,
                        "min_amount": float('inf'),
                        "max_amount": 0,
                        "employees": []
                    }
                
                item_data[item_name]["total_amount"] += item.item_value
                item_data[item_name]["count"] += 1
                item_data[item_name]["min_amount"] = min(item_data[item_name]["min_amount"], item.item_value)
                item_data[item_name]["max_amount"] = max(item_data[item_name]["max_amount"], item.item_value)
                
                # Add employee detail (sample)
                if len(item_data[item_name]["employees"]) < 5:
                    item_data[item_name]["employees"].append({
                        "emp_name": item.salary.employee.full_name,
                        "amount": float(item.item_value)
                    })
            
            # Calculate averages and clean up
            for item_name, data in item_data.items():
                data["average_amount"] = data["total_amount"] / data["count"]
                if data["min_amount"] == float('inf'):
                    data["min_amount"] = 0
                data["total_amount"] = float(data["total_amount"])
                data["average_amount"] = float(data["average_amount"])
                data["min_amount"] = float(data["min_amount"])
                data["max_amount"] = float(data["max_amount"])
            
            # Sort by total amount
            breakdown = sorted(item_data.values(), key=lambda x: x["total_amount"], reverse=True)
            
            # Calculate totals
            total_earnings = sum(item["total_amount"] for item in breakdown if item["item_type"] == "earning")
            total_deductions = sum(item["total_amount"] for item in breakdown if item["item_type"] == "deduction")
            
            return {
                "period_id": period_id,
                "total_items": len(breakdown),
                "total_earnings": total_earnings,
                "total_deductions": total_deductions,
                "net_total": total_earnings - total_deductions,
                "breakdown": breakdown
            }
            
        except Exception as e:
            logger.error(f"Error generating item-wise report: {str(e)}")
            raise
    
    def generate_variance_report(self, period_id: int, compare_period_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Generate variance report comparing periods
        
        Args:
            period_id: Current period ID
            compare_period_id: Comparison period ID (optional)
            
        Returns:
            Dict with variance analysis
        """
        try:
            # Get current period data
            current_data = self._get_period_summary(period_id)
            
            if not compare_period_id:
                # Compare with previous period
                compare_period = self.db.query(PayPeriod).filter(
                    PayPeriod.end_date < current_data["period"]["end_date"]
                ).order_by(PayPeriod.end_date.desc()).first()
                
                if compare_period:
                    compare_data = self._get_period_summary(compare_period.id)
                else:
                    compare_data = None
            else:
                compare_data = self._get_period_summary(compare_period_id)
            
            if not compare_data:
                return {
                    "period_id": period_id,
                    "comparison_period_id": None,
                    "message": "No comparison data available"
                }
            
            # Calculate variances
            variance_data = {
                "period_id": period_id,
                "current_period": current_data["period"],
                "comparison_period": compare_data["period"],
                "variances": {
                    "employee_count": {
                        "current": current_data["employee_count"],
                        "previous": compare_data["employee_count"],
                        "difference": current_data["employee_count"] - compare_data["employee_count"],
                        "percentage": self._calculate_percentage_change(
                            current_data["employee_count"], compare_data["employee_count"]
                        )
                    },
                    "total_gross": {
                        "current": float(current_data["total_gross"]),
                        "previous": float(compare_data["total_gross"]),
                        "difference": float(current_data["total_gross"] - compare_data["total_gross"]),
                        "percentage": self._calculate_percentage_change(
                            current_data["total_gross"], compare_data["total_gross"]
                        )
                    },
                    "total_net": {
                        "current": float(current_data["total_net"]),
                        "previous": float(compare_data["total_net"]),
                        "difference": float(current_data["total_net"] - compare_data["total_net"]),
                        "percentage": self._calculate_percentage_change(
                            current_data["total_net"], compare_data["total_net"]
                        )
                    },
                    "average_gross": {
                        "current": float(current_data["average_gross"]),
                        "previous": float(compare_data["average_gross"]),
                        "difference": float(current_data["average_gross"] - compare_data["average_gross"]),
                        "percentage": self._calculate_percentage_change(
                            current_data["average_gross"], compare_data["average_gross"]
                        )
                    }
                }
            }
            
            return variance_data
            
        except Exception as e:
            logger.error(f"Error generating variance report: {str(e)}")
            raise
    
    def export_bank_sheet(self, period_id: int, bank_code: Optional[str] = None, 
                         format: str = "csv") -> Dict[str, Any]:
        """
        Export bank sheet in specified format
        
        Args:
            period_id: Pay period ID
            bank_code: Optional bank code for specific format
            format: Export format (csv, xlsx)
            
        Returns:
            Dict with export data
        """
        try:
            # Get approved salaries for the period
            salaries = self.db.query(PaySalary).filter(
                PaySalary.period_id == period_id,
                PaySalary.calc_status == "approved"
            ).all()
            
            if not salaries:
                return {
                    "success": False,
                    "error": "No approved salaries found for period",
                    "data": None
                }
            
            # Prepare bank data
            bank_data = []
            for salary in salaries:
                emp = salary.employee
                bank_data.append({
                    "emp_code": emp.badge_id or "",
                    "emp_name": emp.full_name or "",
                    "account_no": getattr(emp, 'bank_account', ''),  # Would need to add to Personnel model
                    "bank_name": getattr(emp, 'bank_name', 'Standard Bank'),  # Would need to add to Personnel model
                    "net_pay": salary.net_salary
                })
            
            # Generate export
            if format.lower() == "csv":
                export_data = self._generate_csv_export(bank_data)
            elif format.lower() == "xlsx":
                export_data = self._generate_xlsx_export(bank_data)
            else:
                raise ValueError(f"Unsupported export format: {format}")
            
            return {
                "success": True,
                "format": format,
                "period_id": period_id,
                "record_count": len(bank_data),
                "total_amount": sum(item["net_pay"] for item in bank_data),
                "data": export_data
            }
            
        except Exception as e:
            logger.error(f"Error exporting bank sheet: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "data": None
            }
    
    def _get_group_key(self, salary: PaySalary, group_by: str) -> str:
        """Get grouping key for salary based on group_by option"""
        if group_by == "department":
            return salary.employee.department or "Unknown"
        elif group_by == "position":
            return salary.employee.position or "Unknown"
        elif group_by == "employee_type":
            return salary.employee.personnel_type or "Unknown"
        else:
            return "Unknown"
    
    def _calculate_group_metrics(self, salaries: List[PaySalary]) -> Dict[str, Any]:
        """Calculate metrics for a group of salaries"""
        if not salaries:
            return {
                "total_cost": 0,
                "average_cost": 0,
                "total_hours": 0,
                "average_rate": 0,
                "dept_breakdown": {},
                "vendor_breakdown": {}
            }
        
        total_cost = sum(salary.net_salary for salary in salaries)
        total_hours = sum(salary.work_hours for salary in salaries)
        
        # Department breakdown
        dept_breakdown = {}
        vendor_breakdown = {}
        
        for salary in salaries:
            dept = salary.employee.department or "Unknown"
            if dept not in dept_breakdown:
                dept_breakdown[dept] = {"count": 0, "cost": 0}
            dept_breakdown[dept]["count"] += 1
            dept_breakdown[dept]["cost"] += salary.net_salary
            
            # Vendor breakdown for contractors
            if hasattr(salary.employee, 'vendor_id') and salary.employee.vendor_id:
                vendor = getattr(salary.employee, 'vendor_name', f"Vendor_{salary.employee.vendor_id}")
                if vendor not in vendor_breakdown:
                    vendor_breakdown[vendor] = {"count": 0, "cost": 0}
                vendor_breakdown[vendor]["count"] += 1
                vendor_breakdown[vendor]["cost"] += salary.net_salary
        
        return {
            "total_cost": float(total_cost),
            "average_cost": float(total_cost / len(salaries)),
            "total_hours": float(total_hours),
            "average_rate": float(total_cost / total_hours) if total_hours > 0 else 0,
            "dept_breakdown": dept_breakdown,
            "vendor_breakdown": vendor_breakdown
        }
    
    def _get_period_summary(self, period_id: int) -> Dict[str, Any]:
        """Get summary data for a period"""
        salaries = self.db.query(PaySalary).filter(PaySalary.period_id == period_id).all()
        period = self.db.query(PayPeriod).filter(PayPeriod.id == period_id).first()
        
        if not salaries or not period:
            return {}
        
        total_gross = sum(salary.gross_salary for salary in salaries)
        total_net = sum(salary.net_salary for salary in salaries)
        
        return {
            "period": {
                "id": period.id,
                "name": period.period_name,
                "start_date": period.start_date.isoformat(),
                "end_date": period.end_date.isoformat()
            },
            "employee_count": len(salaries),
            "total_gross": total_gross,
            "total_net": total_net,
            "average_gross": total_gross / len(salaries),
            "average_net": total_net / len(salaries)
        }
    
    def _calculate_percentage_change(self, current: float, previous: float) -> float:
        """Calculate percentage change between two values"""
        if previous == 0:
            return 0 if current == 0 else 100
        return ((current - previous) / previous) * 100
    
    def _generate_csv_export(self, data: List[Dict[str, Any]]) -> str:
        """Generate CSV export data"""
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(["Emp Code", "Name", "Account No", "Bank", "Net Pay"])
        
        # Write data rows
        for row in data:
            writer.writerow([
                row["emp_code"],
                row["emp_name"],
                row["account_no"],
                row["bank_name"],
                row["net_pay"]
            ])
        
        return output.getvalue()
    
    def _generate_xlsx_export(self, data: List[Dict[str, Any]]) -> bytes:
        """Generate XLSX export data"""
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output)
        
        # Create worksheet
        worksheet = workbook.add_worksheet('Bank Sheet')
        
        # Define formats
        header_format = workbook.add_format({'bold': True, 'bg_color': '#4F81BD', 'font_color': 'white'})
        money_format = workbook.add_format({'num_format': '#,##0.00'})
        
        # Write headers
        headers = ["Emp Code", "Name", "Account No", "Bank", "Net Pay"]
        for col, header in enumerate(headers):
            worksheet.write(0, col, header, header_format)
        
        # Write data rows
        for row_num, row_data in enumerate(data, start=1):
            worksheet.write(row_num, 0, row_data["emp_code"])
            worksheet.write(row_num, 1, row_data["emp_name"])
            worksheet.write(row_num, 2, row_data["account_no"])
            worksheet.write(row_num, 3, row_data["bank_name"])
            worksheet.write(row_num, 4, row_data["net_pay"], money_format)
        
        # Auto-adjust column widths
        worksheet.set_column(0, 0, 12)  # Emp Code
        worksheet.set_column(1, 1, 30)  # Name
        worksheet.set_column(2, 2, 20)  # Account No
        worksheet.set_column(3, 3, 20)  # Bank
        worksheet.set_column(4, 4, 15)  # Net Pay
        
        workbook.close()
        return output.getvalue()
