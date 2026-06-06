"""
Bulk Personnel Import Service
"""

import pandas as pd
import io
from typing import Dict, Any
from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException, status

from ..models.personnel import Personnel, PersonnelStatus


# Maps lowercase/variant spellings → valid PersonnelStatus enum members
_STATUS_MAP = {
    'active': PersonnelStatus.ACTIVE,
    'inactive': PersonnelStatus.INACTIVE,
    'on_leave': PersonnelStatus.ON_LEAVE,
    'onleave': PersonnelStatus.ON_LEAVE,
    'leave': PersonnelStatus.ON_LEAVE,
    'transit': PersonnelStatus.TRANSIT,
    'in_transit': PersonnelStatus.TRANSIT,
    'offshore': PersonnelStatus.OFFSHORE,
    'onshore': PersonnelStatus.ONSHORE,
}


class BulkImportService:

    # Columns accepted as the unique employee code (first match wins)
    _CODE_COLS = ['emp_code', 'pin', 'badge_id', 'employee_code', 'employee_id']

    async def import_from_excel(self, file: UploadFile, db: Session) -> Dict[str, Any]:
        try:
            contents = await file.read()
            df = pd.read_excel(io.BytesIO(contents))
            return await self._process_dataframe(df, db, file.filename)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Error reading Excel file: {str(e)}")

    async def import_from_csv(self, file: UploadFile, db: Session) -> Dict[str, Any]:
        try:
            contents = await file.read()
            df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
            return await self._process_dataframe(df, db, file.filename)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Error reading CSV file: {str(e)}")

    async def _process_dataframe(self, df: pd.DataFrame, db: Session, filename: str) -> Dict[str, Any]:
        # Normalise column names
        df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')

        # Require at least a name and a code column
        has_code = any(c in df.columns for c in self._CODE_COLS)
        has_name = 'full_name' in df.columns or ('first_name' in df.columns and 'last_name' in df.columns)

        if not has_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File must contain one of: {', '.join(self._CODE_COLS)}"
            )
        if not has_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must contain 'full_name' or both 'first_name' and 'last_name' columns"
            )

        stats = {
            'total_rows': len(df),
            'successful_imports': 0,
            'failed_imports': 0,
            'duplicate_badge_ids': 0,
            'duplicate_emails': 0,
            'errors': [],
        }

        for index, row in df.iterrows():
            try:
                personnel_data = self._build_personnel_data(row, df.columns.tolist())
                self._validate_and_save(personnel_data, db, index, stats)
            except Exception as e:
                db.rollback()
                stats['failed_imports'] += 1
                stats['errors'].append({'row': index + 2, 'error': str(e)})

        return {
            'success': True,
            'filename': filename,
            'statistics': stats,
            'message': (
                f"Import completed: {stats['successful_imports']} successful, "
                f"{stats['failed_imports']} failed"
            ),
        }

    def _build_personnel_data(self, row, columns) -> dict:
        """Extract and normalise a single row into a dict ready for Personnel()."""
        data = {}

        # ── emp_code (required by model) ───────────────────────────────────────
        code = None
        for col in self._CODE_COLS:
            if col in columns and pd.notna(row.get(col)):
                code = str(row[col]).strip()
                break
        if not code:
            raise ValueError("Employee code is empty or missing")
        data['emp_code'] = code

        # ── badge_id (optional, use code col value if column is badge_id) ──────
        if 'badge_id' in columns and pd.notna(row.get('badge_id')):
            data['badge_id'] = str(row['badge_id']).strip() or None

        # ── names ──────────────────────────────────────────────────────────────
        if 'first_name' in columns and 'last_name' in columns:
            data['first_name'] = str(row.get('first_name', '')).strip() or 'Unknown'
            data['last_name']  = str(row.get('last_name',  '')).strip() or '.'
            data['full_name']  = f"{data['first_name']} {data['last_name']}"
        elif 'full_name' in columns and pd.notna(row.get('full_name')):
            full = str(row['full_name']).strip()
            parts = full.split(' ', 1)
            data['first_name'] = parts[0] or 'Unknown'
            data['last_name']  = parts[1] if len(parts) > 1 else '.'
            data['full_name']  = full
        else:
            raise ValueError("No name data found")

        # ── optional text columns ──────────────────────────────────────────────
        SIMPLE_COLS = [
            'company', 'department', 'role', 'position', 'phone', 'address',
            'nationality', 'blood_group', 'medical_conditions',
            'emergency_contact_name', 'emergency_contact_phone',
            'id_number', 'passport_number', 'employment_type', 'personnel_type',
            'current_location',
        ]
        for col in SIMPLE_COLS:
            if col in columns and pd.notna(row.get(col)):
                val = str(row[col]).strip()
                if val:
                    data[col] = val

        # ── email (unique constraint — skip if blank) ──────────────────────────
        if 'email' in columns and pd.notna(row.get('email')):
            val = str(row['email']).strip()
            if val:
                data['email'] = val

        # ── hire_date ──────────────────────────────────────────────────────────
        if 'hire_date' in columns and pd.notna(row.get('hire_date')):
            try:
                data['hire_date'] = pd.to_datetime(row['hire_date']).date()
            except Exception:
                pass  # ignore unparseable dates

        # ── status ────────────────────────────────────────────────────────────
        if 'status' in columns and pd.notna(row.get('status')):
            raw = str(row['status']).strip().lower()
            data['status'] = _STATUS_MAP.get(raw, PersonnelStatus.ACTIVE)

        return data

    def _validate_and_save(self, data: dict, db: Session, index: int, stats: dict):
        # Duplicate emp_code check
        if db.query(Personnel).filter(Personnel.emp_code == data['emp_code']).first():
            stats['duplicate_badge_ids'] += 1
            stats['failed_imports'] += 1
            stats['errors'].append({'row': index + 2, 'error': f"Duplicate emp_code: {data['emp_code']}"})
            return

        # Duplicate badge_id check (only if provided and distinct from emp_code)
        if data.get('badge_id') and data['badge_id'] != data['emp_code']:
            if db.query(Personnel).filter(Personnel.badge_id == data['badge_id']).first():
                stats['duplicate_badge_ids'] += 1
                stats['failed_imports'] += 1
                stats['errors'].append({'row': index + 2, 'error': f"Duplicate badge_id: {data['badge_id']}"})
                return

        # Duplicate email check
        if data.get('email'):
            if db.query(Personnel).filter(Personnel.email == data['email']).first():
                stats['duplicate_emails'] += 1
                stats['failed_imports'] += 1
                stats['errors'].append({'row': index + 2, 'error': f"Duplicate email: {data['email']}"})
                return

        personnel = Personnel(**data)
        db.add(personnel)
        db.commit()
        db.refresh(personnel)
        stats['successful_imports'] += 1

    async def get_import_template(self, format_type: str = "excel") -> bytes:
        template_data = {
            'emp_code':                ['EMP001', 'EMP002', 'EMP003'],
            'full_name':               ['John Doe', 'Jane Smith', 'Bob Johnson'],
            'company':                 ['Company A', 'Company B', 'Company C'],
            'role':                    ['Offshore Engineer', 'Operations Manager', 'Lead Technician'],
            'email':                   ['john.doe@company.com', 'jane.smith@company.com', 'bob.johnson@company.com'],
            'phone':                   ['+2348012345678', '+2348012345679', '+2348012345670'],
            'department':              ['Engineering', 'Operations', 'Maintenance'],
            'position':                ['Senior Engineer', 'Ops Manager', 'Lead Tech'],
            'status':                  ['active', 'active', 'active'],
            'employment_type':         ['EMPLOYEE', 'CONTRACTOR', 'EMPLOYEE'],
            'personnel_type':          ['STAFF', 'CONTRACTOR', 'STAFF'],
            'nationality':             ['Nigerian', 'Nigerian', 'Nigerian'],
            'blood_group':             ['O+', 'A+', 'B+'],
            'hire_date':               ['2023-01-15', '2023-03-20', '2022-11-01'],
            'emergency_contact_name':  ['Mary Doe', 'John Smith', 'Alice Johnson'],
            'emergency_contact_phone': ['+2348087654321', '+2348087654322', '+2348087654323'],
            'medical_conditions':      ['None', 'None', 'Asthma'],
        }

        df = pd.DataFrame(template_data)

        if format_type.lower() == 'excel':
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='Personnel')

                instructions = pd.DataFrame({
                    'Field': list(template_data.keys()),
                    'Required': ['Yes', 'Yes', 'Yes', 'No', 'No', 'No', 'No', 'No', 'No', 'No', 'No', 'No', 'No', 'No', 'No', 'No', 'No'],
                    'Description': [
                        'Unique employee PIN/code — also accepted as badge_id or pin',
                        'Full name (auto-split into first/last if separate columns absent)',
                        'Employer / company name',
                        'Job title / role',
                        'Email address (must be unique)',
                        'Phone number',
                        'Department name',
                        'Position / grade',
                        'active | inactive | on_leave | offshore | onshore | transit',
                        'EMPLOYEE | CONTRACTOR | SUBCONTRACTOR',
                        'STAFF | CONTRACTOR | VISITOR',
                        'Nationality',
                        'Blood group: A+, A-, B+, B-, AB+, AB-, O+, O-',
                        'Hire date (YYYY-MM-DD)',
                        'Emergency contact name',
                        'Emergency contact phone',
                        'Medical conditions or allergies',
                    ],
                })
                instructions.to_excel(writer, index=False, sheet_name='Instructions')

            output.seek(0)
            return output.getvalue()
        else:
            output = io.StringIO()
            df.to_csv(output, index=False)
            return output.getvalue().encode('utf-8')


bulk_import_service = BulkImportService()
