"""
Custom Report Builder Service
POB-specific drag-and-drop report builder with dynamic SQL generation
"""

from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
import json
import logging

logger = logging.getLogger(__name__)


class CustomReportBuilderService:
    """Service for building custom reports with drag-drop interface"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_available_tables(self) -> List[Dict[str, Any]]:
        """Get all available tables for custom reports"""
        try:
            inspector = inspect(self.db.bind)
            tables = []
            
            # Define table categories and their tables
            table_categories = {
                'Personnel': [
                    'personnel_employee',
                    'personnel_department',
                    'personnel_position',
                    'personnel_assignment'
                ],
                'Attendance': [
                    'att_report',
                    'att_summary',
                    'att_leave_request',
                    'att_overtime'
                ],
                'Access Control': [
                    'acc_event',
                    'acc_access_level',
                    'acc_door',
                    'acc_card'
                ],
                'Devices': [
                    'device',
                    'device_reader',
                    'device_zone_assignment'
                ],
                'Mustering': [
                    'mustering_event',
                    'mustering_headcount',
                    'mustering_zone'
                ],
                'Emergency': [
                    'emergency_event',
                    'emergency_lockdown',
                    'emergency_drill'
                ],
                'Payroll': [
                    'pay_salary',
                    'pay_deduction',
                    'pay_allowance',
                    'pay_timesheet'
                ],
                'Visitor': [
                    'vis_visit_log',
                    'vis_visitor',
                    'vis_host',
                    'vis_approval'
                ],
                'Meeting': [
                    'mtg_booking',
                    'mtg_room',
                    'mtg_attendance'
                ],
                'MTD': [
                    'mtd_certification',
                    'mtd_safety_training',
                    'mtd_medical'
                ],
                'System': [
                    'system_user',
                    'system_audit_log',
                    'system_operation_log'
                ]
            }
            
            for category, table_names in table_categories.items():
                category_tables = []
                for table_name in table_names:
                    try:
                        columns = inspector.get_columns(table_name)
                        table_info = {
                            'name': table_name,
                            'display_name': table_name.replace('_', ' ').title(),
                            'category': category,
                            'columns': []
                        }
                        
                        for col in columns:
                            column_info = {
                                'name': col['name'],
                                'display_name': col['name'].replace('_', ' ').title(),
                                'type': str(col['type']).upper(),
                                'nullable': col['nullable'],
                                'default': str(col['default']) if col['default'] else None
                            }
                            table_info['columns'].append(column_info)
                        
                        category_tables.append(table_info)
                    except Exception as e:
                        logger.warning(f"Could not inspect table {table_name}: {e}")
                        continue
                
                tables.extend(category_tables)
            
            return tables
            
        except Exception as e:
            logger.error(f"Error getting available tables: {e}")
            return []
    
    def get_table_relationships(self) -> List[Dict[str, Any]]:
        """Get relationships between tables for joins"""
        try:
            # Define common relationships based on foreign keys
            relationships = [
                {
                    'from_table': 'personnel_employee',
                    'from_column': 'department_id',
                    'to_table': 'personnel_department',
                    'to_column': 'id',
                    'join_type': 'LEFT',
                    'relationship': 'many_to_one'
                },
                {
                    'from_table': 'personnel_employee',
                    'from_column': 'position_id',
                    'to_table': 'personnel_position',
                    'to_column': 'id',
                    'join_type': 'LEFT',
                    'relationship': 'many_to_one'
                },
                {
                    'from_table': 'att_report',
                    'from_column': 'employee_id',
                    'to_table': 'personnel_employee',
                    'to_column': 'id',
                    'join_type': 'LEFT',
                    'relationship': 'many_to_one'
                },
                {
                    'from_table': 'acc_event',
                    'from_column': 'employee_id',
                    'to_table': 'personnel_employee',
                    'to_column': 'id',
                    'join_type': 'LEFT',
                    'relationship': 'many_to_one'
                },
                {
                    'from_table': 'vis_visit_log',
                    'from_column': 'visitor_id',
                    'to_table': 'vis_visitor',
                    'to_column': 'id',
                    'join_type': 'LEFT',
                    'relationship': 'many_to_one'
                },
                {
                    'from_table': 'vis_visit_log',
                    'from_column': 'host_id',
                    'to_table': 'vis_host',
                    'to_column': 'id',
                    'join_type': 'LEFT',
                    'relationship': 'many_to_one'
                },
                {
                    'from_table': 'mustering_event',
                    'from_column': 'zone_id',
                    'to_table': 'mustering_zone',
                    'to_column': 'id',
                    'join_type': 'LEFT',
                    'relationship': 'many_to_one'
                },
                {
                    'from_table': 'emergency_event',
                    'from_column': 'zone_id',
                    'to_table': 'mustering_zone',
                    'to_column': 'id',
                    'join_type': 'LEFT',
                    'relationship': 'many_to_one'
                },
                {
                    'from_table': 'pay_salary',
                    'from_column': 'employee_id',
                    'to_table': 'personnel_employee',
                    'to_column': 'id',
                    'join_type': 'LEFT',
                    'relationship': 'many_to_one'
                },
                {
                    'from_table': 'mtg_booking',
                    'from_column': 'room_id',
                    'to_table': 'mtg_room',
                    'to_column': 'id',
                    'join_type': 'LEFT',
                    'relationship': 'many_to_one'
                }
            ]
            
            return relationships
            
        except Exception as e:
            logger.error(f"Error getting table relationships: {e}")
            return []
    
    def generate_sql_query(self, report_config: Dict[str, Any]) -> Tuple[str, List]:
        """
        Generate SQL query from report configuration
        
        Args:
            report_config: Report configuration with tables, columns, filters, etc.
            
        Returns:
            Tuple of (SQL query, parameters)
        """
        try:
            # Extract configuration
            tables = report_config.get('tables', [])
            columns = report_config.get('columns', [])
            filters = report_config.get('filters', [])
            group_by = report_config.get('group_by', [])
            order_by = report_config.get('order_by', [])
            limit = report_config.get('limit', 1000)
            
            if not tables or not columns:
                raise ValueError("Tables and columns are required")
            
            # Build SELECT clause
            select_columns = []
            for col in columns:
                if col.get('aggregate'):
                    # Handle aggregate functions
                    aggregate_func = col['aggregate']
                    column_name = col['name']
                    alias = col.get('alias', column_name)
                    select_columns.append(f"{aggregate_func}({column_name}) AS {alias}")
                else:
                    # Regular column with table prefix
                    table_alias = col.get('table_alias', 't1')
                    column_name = col['name']
                    alias = col.get('alias', column_name)
                    if alias != column_name:
                        select_columns.append(f"{table_alias}.{column_name} AS {alias}")
                    else:
                        select_columns.append(f"{table_alias}.{column_name}")
            
            # Build FROM and JOIN clauses
            from_clause = tables[0]['name']
            table_aliases = {tables[0]['name']: 't1'}
            join_clauses = []
            
            # Add joins for additional tables
            for i, table in enumerate(tables[1:], 2):
                table_name = table['name']
                table_alias = f"t{i}"
                table_aliases[table_name] = table_alias
                
                # Find join condition
                join_condition = table.get('join_condition')
                if join_condition:
                    join_type = table.get('join_type', 'LEFT')
                    join_clauses.append(f"{join_type} JOIN {table_name} {table_alias} ON {join_condition}")
            
            # Build WHERE clause
            where_clauses = []
            parameters = []
            
            for filter_item in filters:
                column = filter_item['column']
                operator = filter_item['operator']
                value = filter_item['value']
                
                # Convert operator to SQL
                sql_operator = self._convert_operator(operator)
                
                # Build condition
                if operator.upper() in ('IN', 'NOT IN'):
                    placeholders = ', '.join(['%s'] * len(value))
                    where_clauses.append(f"{column} {sql_operator} ({placeholders})")
                    parameters.extend(value)
                elif operator.upper() == 'LIKE':
                    where_clauses.append(f"{column} {sql_operator} %s")
                    parameters.append(f"%{value}%")
                elif operator.upper() == 'BETWEEN':
                    where_clauses.append(f"{column} {sql_operator} %s AND %s")
                    parameters.extend([value[0], value[1]])
                else:
                    where_clauses.append(f"{column} {sql_operator} %s")
                    parameters.append(value)
            
            # Build GROUP BY clause
            group_by_clauses = []
            for group_item in group_by:
                table_alias = group_item.get('table_alias', 't1')
                column_name = group_item['name']
                group_by_clauses.append(f"{table_alias}.{column_name}")
            
            # Build ORDER BY clause
            order_by_clauses = []
            for order_item in order_by:
                table_alias = order_item.get('table_alias', 't1')
                column_name = order_item['name']
                direction = order_item.get('direction', 'ASC')
                order_by_clauses.append(f"{table_alias}.{column_name} {direction}")
            
            # Build final query
            query_parts = [f"SELECT {', '.join(select_columns)}"]
            query_parts.append(f"FROM {from_clause} t1")
            
            if join_clauses:
                query_parts.extend(join_clauses)
            
            if where_clauses:
                query_parts.append(f"WHERE {' AND '.join(where_clauses)}")
            
            if group_by_clauses:
                query_parts.append(f"GROUP BY {', '.join(group_by_clauses)}")
            
            if order_by_clauses:
                query_parts.append(f"ORDER BY {', '.join(order_by_clauses)}")
            
            if limit:
                query_parts.append(f"LIMIT {limit}")
            
            query = " ".join(query_parts)
            
            return query, parameters
            
        except Exception as e:
            logger.error(f"Error generating SQL query: {e}")
            raise
    
    def execute_custom_query(self, query: str, parameters: List) -> List[Dict[str, Any]]:
        """Execute custom SQL query safely"""
        try:
            result = self.db.execute(text(query), parameters)
            rows = result.fetchall()
            
            # Convert to list of dictionaries
            data = []
            for row in rows:
                row_dict = dict(zip(row.keys(), row))
                data.append(row_dict)
            
            return data
            
        except Exception as e:
            logger.error(f"Error executing custom query: {e}")
            raise
    
    def preview_report(self, report_config: Dict[str, Any]) -> Dict[str, Any]:
        """Preview custom report with limited data"""
        try:
            # Generate SQL query
            query, parameters = self.generate_sql_query(report_config)
            
            # Execute with limited rows for preview
            preview_config = report_config.copy()
            preview_config['limit'] = 20  # Limit preview to 20 rows
            
            preview_query, preview_params = self.generate_sql_query(preview_config)
            data = self.execute_custom_query(preview_query, preview_params)
            
            # Get column information
            columns = []
            if data:
                for key in data[0].keys():
                    columns.append({
                        'name': key,
                        'display_name': key.replace('_', ' ').title(),
                        'type': 'string'  # Default type, could be enhanced
                    })
            
            return {
                'success': True,
                'data': data,
                'columns': columns,
                'row_count': len(data),
                'query': query
            }
            
        except Exception as e:
            logger.error(f"Error previewing report: {e}")
            return {
                'success': False,
                'error': str(e),
                'data': [],
                'columns': []
            }
    
    def validate_report_config(self, report_config: Dict[str, Any]) -> Dict[str, Any]:
        """Validate report configuration"""
        try:
            errors = []
            warnings = []
            
            # Check required fields
            if not report_config.get('tables'):
                errors.append("At least one table is required")
            
            if not report_config.get('columns'):
                errors.append("At least one column is required")
            
            # Validate tables exist
            available_tables = self.get_available_tables()
            table_names = [t['name'] for t in available_tables]
            
            for table in report_config.get('tables', []):
                if table['name'] not in table_names:
                    errors.append(f"Table '{table['name']}' does not exist")
            
            # Validate columns exist in their tables
            for col in report_config.get('columns', []):
                table_name = col.get('table')
                column_name = col.get('name')
                
                if table_name and column_name:
                    table_info = next((t for t in available_tables if t['name'] == table_name), None)
                    if table_info:
                        column_names = [c['name'] for c in table_info['columns']]
                        if column_name not in column_names:
                            errors.append(f"Column '{column_name}' does not exist in table '{table_name}'")
            
            # Check for potential performance issues
            if report_config.get('limit', 1000) > 10000:
                warnings.append("Large limit may impact performance")
            
            if len(report_config.get('tables', [])) > 5:
                warnings.append("Multiple table joins may impact performance")
            
            return {
                'valid': len(errors) == 0,
                'errors': errors,
                'warnings': warnings
            }
            
        except Exception as e:
            logger.error(f"Error validating report config: {e}")
            return {
                'valid': False,
                'errors': [str(e)],
                'warnings': []
            }
    
    def save_custom_report(self, report_config: Dict[str, Any], 
                         user_id: int, 
                         name: str, 
                         description: str = None) -> Dict[str, Any]:
        """Save custom report configuration"""
        try:
            # Validate configuration
            validation = self.validate_report_config(report_config)
            if not validation['valid']:
                return {
                    'success': False,
                    'errors': validation['errors']
                }
            
            # Save to database (assuming rpt_template table)
            from ..models.report import ReportTemplate
            
            template = ReportTemplate(
                name=name,
                description=description,
                module='custom',
                report_code=f'custom.{name.lower().replace(" ", "_")}',
                config=json.dumps(report_config),
                created_by=user_id,
                is_public=False,
                is_system=False
            )
            
            self.db.add(template)
            self.db.commit()
            self.db.refresh(template)
            
            return {
                'success': True,
                'template_id': template.id,
                'message': 'Custom report saved successfully'
            }
            
        except Exception as e:
            logger.error(f"Error saving custom report: {e}")
            self.db.rollback()
            return {
                'success': False,
                'error': str(e)
            }
    
    def load_custom_report(self, template_id: int, user_id: int) -> Dict[str, Any]:
        """Load saved custom report configuration"""
        try:
            from ..models.report import ReportTemplate
            
            template = self.db.query(ReportTemplate).filter(
                ReportTemplate.id == template_id,
                ReportTemplate.module == 'custom'
            ).first()
            
            if not template:
                return {
                    'success': False,
                    'error': 'Custom report not found'
                }
            
            # Check permissions
            if not self._can_access_template(template, user_id):
                return {
                    'success': False,
                    'error': 'Access denied'
                }
            
            config = json.loads(template.config) if template.config else {}
            
            return {
                'success': True,
                'template': {
                    'id': template.id,
                    'name': template.name,
                    'description': template.description,
                    'config': config
                }
            }
            
        except Exception as e:
            logger.error(f"Error loading custom report: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _convert_operator(self, operator: str) -> str:
        """Convert UI operator to SQL operator"""
        operator_map = {
            'equals': '=',
            'not_equals': '!=',
            'greater_than': '>',
            'less_than': '<',
            'greater_equal': '>=',
            'less_equal': '<=',
            'like': 'LIKE',
            'not_like': 'NOT LIKE',
            'in': 'IN',
            'not_in': 'NOT IN',
            'between': 'BETWEEN',
            'is_null': 'IS NULL',
            'is_not_null': 'IS NOT NULL'
        }
        
        return operator_map.get(operator.lower(), '=')
    
    def _can_access_template(self, template, user_id: int) -> bool:
        """Check if user can access template"""
        # User can access their own templates
        if template.created_by == user_id:
            return True
        
        # Public templates can be accessed by anyone
        if template.is_public:
            return True
        
        return False
    
    def get_aggregate_functions(self) -> List[Dict[str, Any]]:
        """Get available aggregate functions"""
        return [
            {'name': 'COUNT', 'description': 'Count records'},
            {'name': 'SUM', 'description': 'Sum values'},
            {'name': 'AVG', 'description': 'Average values'},
            {'name': 'MIN', 'description': 'Minimum value'},
            {'name': 'MAX', 'description': 'Maximum value'},
            {'name': 'DISTINCT', 'description': 'Distinct values'}
        ]
    
    def get_filter_operators(self) -> List[Dict[str, Any]]:
        """Get available filter operators"""
        return [
            {'name': 'equals', 'description': 'Equals'},
            {'name': 'not_equals', 'description': 'Not equals'},
            {'name': 'greater_than', 'description': 'Greater than'},
            {'name': 'less_than', 'description': 'Less than'},
            {'name': 'greater_equal', 'description': 'Greater than or equal'},
            {'name': 'less_equal', 'description': 'Less than or equal'},
            {'name': 'like', 'description': 'Contains'},
            {'name': 'not_like', 'description': 'Does not contain'},
            {'name': 'in', 'description': 'In list'},
            {'name': 'not_in', 'description': 'Not in list'},
            {'name': 'between', 'description': 'Between'},
            {'name': 'is_null', 'description': 'Is null'},
            {'name': 'is_not_null', 'description': 'Is not null'}
        ]
