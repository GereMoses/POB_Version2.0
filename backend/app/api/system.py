"""
System Module API Endpoints

This module provides comprehensive system administration APIs including:
- Company management
- User management with extensions
- Role and permission management
- System parameters
- Operation logs
- License management
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Query, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone

from ..core.database import get_db
from ..core.rbac import (
    require_permission, require_role, get_current_user_with_permissions,
    check_permission, log_operation
)
from ..services.system_service import get_system_service
from ..models.system import Company
from ..models.user import User

router = APIRouter()

# Pydantic models
class CompanyUpdate(BaseModel):
    company_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    website: Optional[str] = None
    work_days: Optional[str] = None
    timezone: Optional[str] = None
    date_format: Optional[str] = None
    currency: Optional[str] = None
    emergency_contact: Optional[Dict] = None

class UserExtensionUpdate(BaseModel):
    avatar: Optional[str] = None
    language: Optional[str] = None
    two_fa_enabled: Optional[bool] = None
    must_change_pass: Optional[bool] = None
    api_access: Optional[bool] = None

class RoleCreate(BaseModel):
    name: str
    description: str
    level: int = 50
    permissions: List[str] = []

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    level: Optional[int] = None
    is_active: Optional[bool] = None
    permissions: Optional[List[str]] = None

class ParameterUpdate(BaseModel):
    value: str

# Company Management
@router.get("/company")
async def get_company(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Get company information"""
    if not await check_permission("system.config", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    system_service = get_system_service(db)
    company = await system_service.get_company()
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    return JSONResponse(content={"success": True, "data": company})

@router.put("/company")
async def update_company(
    company_data: CompanyUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Update company information"""
    if not await check_permission("system.config", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    system_service = get_system_service(db)
    success = await system_service.update_company(
        company_data.dict(exclude_unset=True),
        updated_by=current_user.username
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update company")
    
    return JSONResponse(content={"success": True, "message": "Company updated successfully"})

# User Management
@router.get("/users")
async def get_users(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None
):
    """Get users with extensions"""
    if not await check_permission("user.view", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    query = db.query(User)
    
    if search:
        query = query.filter(
            or_(
                User.username.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
                User.full_name.ilike(f"%{search}%")
            )
        )
    
    users = query.offset(skip).limit(limit).all()
    
    result = []
    system_service = get_system_service(db)
    
    for user in users:
        user_data = await system_service.get_user_with_extension(user.id)
        if user_data:
            result.append(user_data)
    
    return JSONResponse(content={"success": True, "data": result})

@router.get("/users/{user_id}")
async def get_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Get specific user with extension"""
    if not await check_permission("user.view", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    system_service = get_system_service(db)
    user = await system_service.get_user_with_extension(user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return JSONResponse(content={"success": True, "data": user})

@router.put("/users/{user_id}/extension")
async def update_user_extension(
    user_id: int,
    extension_data: UserExtensionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Update user extension"""
    if not await check_permission("user.update", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    system_service = get_system_service(db)
    success = await system_service.update_user_extension(
        user_id,
        extension_data.dict(exclude_unset=True),
        updated_by=current_user.username
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update user extension")
    
    return JSONResponse(content={"success": True, "message": "User extension updated successfully"})

# Role Management
@router.get("/roles")
async def get_roles(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Get all system roles"""
    if not await check_permission("role.view", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    system_service = get_system_service(db)
    roles = await system_service.get_all_roles()
    
    return JSONResponse(content={"success": True, "data": roles})

@router.post("/roles")
async def create_role(
    role_data: RoleCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Create new role"""
    if not await check_permission("role.create", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    try:
        role = SystemRole(
            name=role_data.name,
            description=role_data.description,
            level=role_data.level,
            created_by=current_user.username
        )
        db.add(role)
        db.commit()
        
        # Add permissions if provided
        if role_data.permissions:
            from ..models.system import SystemRolePermission
            for perm_code in role_data.permissions:
                role_perm = SystemRolePermission(
                    role_id=role.id,
                    permission_code=perm_code,
                    granted_by=current_user.username
                )
                db.add(role_perm)
            db.commit()
        
        return JSONResponse(
            content={"success": True, "message": "Role created successfully"},
            status_code=201
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create role: {str(e)}")

@router.put("/roles/{role_id}")
async def update_role(
    role_id: int,
    role_data: RoleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Update role"""
    if not await check_permission("role.update", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    role = db.query(SystemRole).filter(SystemRole.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.is_system:
        raise HTTPException(status_code=400, detail="Cannot modify system role")
    
    try:
        # Update role fields
        update_data = role_data.dict(exclude_unset=True, exclude={"permissions"})
        for field, value in update_data.items():
            setattr(role, field, value)
        
        role.updated_at = datetime.now(timezone.utc)
        
        # Update permissions if provided
        if role_data.permissions is not None:
            # Remove existing permissions
            from ..models.system import SystemRolePermission
            db.query(SystemRolePermission).filter(
                SystemRolePermission.role_id == role_id
            ).delete()
            
            # Add new permissions
            for perm_code in role_data.permissions:
                role_perm = SystemRolePermission(
                    role_id=role_id,
                    permission_code=perm_code,
                    granted_by=current_user.username
                )
                db.add(role_perm)
        
        db.commit()
        
        # Clear permission cache for all users with this role
        from ..core.rbac import clear_user_permission_cache
        user_assignments = db.query(SystemUserRole).filter(
            SystemUserRole.role_id == role_id,
            SystemUserRole.is_active == True
        ).all()
        
        for assignment in user_assignments:
            clear_user_permission_cache(assignment.user_id)
        
        return JSONResponse(content={"success": True, "message": "Role updated successfully"})
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update role: {str(e)}")

@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Delete role"""
    if not await check_permission("role.delete", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    role = db.query(SystemRole).filter(SystemRole.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete system role")
    
    # Check if role has users assigned
    user_count = db.query(SystemUserRole).filter(
        SystemUserRole.role_id == role_id,
        SystemUserRole.is_active == True
    ).count()
    
    if user_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete role with assigned users")
    
    try:
        # Delete role permissions
        from ..models.system import SystemRolePermission
        db.query(SystemRolePermission).filter(
            SystemRolePermission.role_id == role_id
        ).delete()
        
        # Delete role
        db.delete(role)
        db.commit()
        
        return JSONResponse(content={"success": True, "message": "Role deleted successfully"})
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete role: {str(e)}")

# Permission Management
@router.get("/permissions")
async def get_permissions(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Get all system permissions"""
    if not await check_permission("role.permissions", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    permissions = db.query(SystemPermission).order_by(
        SystemPermission.module, SystemPermission.action
    ).all()
    
    result = []
    for perm in permissions:
        result.append({
            "id": perm.id,
            "code": perm.code,
            "name": perm.name,
            "description": perm.description,
            "module": perm.module,
            "action": perm.action,
            "category": perm.category,
            "is_system": perm.is_system
        })
    
    return JSONResponse(content={"success": True, "data": result})

# System Parameters
@router.get("/parameters")
async def get_parameters(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions),
    module: Optional[str] = None
):
    """Get system parameters"""
    if not await check_permission("system.config", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    system_service = get_system_service(db)
    
    if module:
        parameters = await system_service.get_parameters_by_module(module)
    else:
        all_params = await system_service.get_all_parameters()
        return JSONResponse(content={"success": True, "data": all_params})
    
    return JSONResponse(content={"success": True, "data": parameters})

@router.put("/parameters/{param_key}")
async def update_parameter(
    param_key: str,
    param_data: ParameterUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Update system parameter"""
    if not await check_permission("system.config", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    system_service = get_system_service(db)
    success = await system_service.set_parameter(
        param_key,
        param_data.value,
        updated_by=current_user.username
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Parameter not found")
    
    return JSONResponse(content={"success": True, "message": "Parameter updated successfully"})

# Operation Logs
@router.get("/logs")
async def get_operation_logs(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions),
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    user_id: Optional[int] = None,
    module: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0)
):
    """Get operation logs"""
    if not await check_permission("system.logs", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    system_service = get_system_service(db)
    logs = await system_service.get_operation_logs(
        start_time=start_time,
        end_time=end_time,
        user_id=user_id,
        module=module,
        action=action,
        limit=limit,
        offset=offset
    )
    
    return JSONResponse(content={"success": True, "data": logs})

@router.get("/logs/stats")
async def get_log_stats(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions),
    days: int = Query(30, ge=1, le=365)
):
    """Get operation log statistics"""
    if not await check_permission("system.logs", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    system_service = get_system_service(db)
    stats = await system_service.get_operation_log_stats(days=days)
    
    return JSONResponse(content={"success": True, "data": stats})

# License Management
@router.get("/license")
async def get_license(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Get license information"""
    if not await check_permission("system.license", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.license_service import get_license_service
    license_service = get_license_service(db)
    license_info = await license_service.get_current_license()
    
    if not license_info:
        raise HTTPException(status_code=404, detail="No license found")
    
    return JSONResponse(content={"success": True, "data": license_info})

@router.post("/license/install")
async def install_license(
    license_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Install new license"""
    if not await check_permission("system.license", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.license_service import get_license_service
    license_service = get_license_service(db)
    result = await license_service.install_license(
        license_data["license_key"],
        current_user.username
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return JSONResponse(content=result)

@router.get("/license/compliance")
async def get_license_compliance(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Get license compliance report"""
    if not await check_permission("system.license", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.license_service import get_license_service
    license_service = get_license_service(db)
    report = await license_service.get_license_usage_report()
    
    return JSONResponse(content={"success": True, "data": report})

# Database Backup Management
@router.post("/backup/create")
async def create_backup(
    backup_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Create database backup"""
    if not await check_permission("system.backup", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.backup_service import get_backup_service
    backup_service = get_backup_service(db)
    result = await backup_service.create_manual_backup(
        backup_data.get("backup_name"),
        current_user.username,
        backup_data.get("include_files", True),
        backup_data.get("encrypt", True)
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return JSONResponse(content=result)

@router.get("/backup/list")
async def get_backup_list(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions),
    backup_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000)
):
    """Get backup list"""
    if not await check_permission("system.backup", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.backup_service import get_backup_service
    backup_service = get_backup_service(db)
    backups = await backup_service.get_backup_list(backup_type, status, limit)
    
    return JSONResponse(content={"success": True, "data": backups})

@router.post("/backup/{backup_id}/restore")
async def restore_backup(
    backup_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Restore database from backup"""
    if not await check_permission("system.backup", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.backup_service import get_backup_service
    backup_service = get_backup_service(db)
    result = await backup_service.restore_backup(backup_id, confirm=True)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return JSONResponse(content=result)

@router.delete("/backup/{backup_id}")
async def delete_backup(
    backup_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Delete backup"""
    if not await check_permission("system.backup", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.backup_service import get_backup_service
    backup_service = get_backup_service(db)
    result = await backup_service.delete_backup(backup_id)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return JSONResponse(content=result)

# Email/SMS Template Management
@router.post("/email/templates")
async def create_email_template(
    template_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Create email template"""
    if not await check_permission("system.email", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.email_sms_service import get_email_sms_service
    email_service = get_email_sms_service(db)
    result = await email_service.create_email_template(template_data, current_user.username)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return JSONResponse(content=result)

@router.get("/email/templates")
async def get_email_templates(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions),
    category: Optional[str] = None,
    language: Optional[str] = None
):
    """Get email templates"""
    if not await check_permission("system.email", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.email_sms_service import get_email_sms_service
    email_service = get_email_sms_service(db)
    templates = await email_service.list_email_templates(category, language)
    
    return JSONResponse(content={"success": True, "data": templates})

@router.post("/email/send")
async def send_email(
    email_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Send email"""
    if not await check_permission("system.email", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.email_sms_service import get_email_sms_service
    email_service = get_email_sms_service(db)
    result = await email_service.send_email(
        email_data["to_addresses"],
        email_data["subject"],
        email_data["content"],
        email_data.get("template_name"),
        email_data.get("variables"),
        email_data.get("attachments")
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return JSONResponse(content=result)

# SMS Template Management
@router.post("/sms/templates")
async def create_sms_template(
    template_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Create SMS template"""
    if not await check_permission("system.sms", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.email_sms_service import get_email_sms_service
    sms_service = get_email_sms_service(db)
    result = await sms_service.create_sms_template(template_data, current_user.username)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return JSONResponse(content=result)

@router.post("/sms/send")
async def send_sms(
    sms_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Send SMS"""
    if not await check_permission("system.sms", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.email_sms_service import get_email_sms_service
    sms_service = get_email_sms_service(db)
    result = await sms_service.send_sms(
        sms_data["to_numbers"],
        sms_data["message"],
        sms_data.get("template_name"),
        sms_data.get("variables")
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return JSONResponse(content=result)

# API Key Management
@router.post("/api-keys")
async def create_api_key(
    key_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Create API key"""
    if not await check_permission("system.api_keys", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.api_webhook_service import get_api_webhook_service
    api_service = get_api_webhook_service(db)
    result = await api_service.create_api_key(key_data, current_user.username)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return JSONResponse(content=result)

@router.get("/api-keys")
async def get_api_keys(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Get API keys"""
    if not await check_permission("system.api_keys", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.api_webhook_service import get_api_webhook_service
    api_service = get_api_webhook_service(db)
    api_keys = await api_service.get_api_keys(current_user.username)
    
    return JSONResponse(content={"success": True, "data": api_keys})

@router.put("/api-keys/{key_id}")
async def update_api_key(
    key_id: int,
    key_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Update API key"""
    if not await check_permission("system.api_keys", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.api_webhook_service import get_api_webhook_service
    api_service = get_api_webhook_service(db)
    result = await api_service.update_api_key(key_id, key_data)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return JSONResponse(content=result)

@router.post("/api-keys/{key_id}/revoke")
async def revoke_api_key(
    key_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Revoke API key"""
    if not await check_permission("system.api_keys", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.api_webhook_service import get_api_webhook_service
    api_service = get_api_webhook_service(db)
    result = await api_service.revoke_api_key(key_id)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return JSONResponse(content=result)

# Webhook Management
@router.post("/webhooks")
async def create_webhook(
    webhook_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Create webhook"""
    if not await check_permission("system.webhooks", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.api_webhook_service import get_api_webhook_service
    webhook_service = get_api_webhook_service(db)
    result = await webhook_service.create_webhook(webhook_data, current_user.username)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return JSONResponse(content=result)

@router.get("/webhooks")
async def get_webhooks(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Get webhooks"""
    if not await check_permission("system.webhooks", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.api_webhook_service import get_api_webhook_service
    webhook_service = get_api_webhook_service(db)
    webhooks = await webhook_service.get_webhooks(current_user.username)
    
    return JSONResponse(content={"success": True, "data": webhooks})

@router.post("/webhooks/{webhook_id}/test")
async def test_webhook(
    webhook_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Test webhook"""
    if not await check_permission("system.webhooks", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.api_webhook_service import get_api_webhook_service
    webhook_service = get_api_webhook_service(db)
    result = await webhook_service.test_webhook(webhook_id)
    
    return JSONResponse(content=result)

# SSO/LDAP Configuration
@router.post("/sso/configs")
async def create_sso_config(
    config_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Create SSO configuration"""
    if not await check_permission("system.sso", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.sso_language_service import get_sso_language_service
    sso_service = get_sso_language_service(db)
    result = await sso_service.create_sso_config(config_data, current_user.username)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return JSONResponse(content=result)

@router.get("/sso/configs")
async def get_sso_configs(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Get SSO configurations"""
    if not await check_permission("system.sso", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.sso_language_service import get_sso_language_service
    sso_service = get_sso_language_service(db)
    configs = await sso_service.get_sso_configs()
    
    return JSONResponse(content={"success": True, "data": configs})

# Language Management
@router.get("/languages")
async def get_languages(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Get languages"""
    if not await check_permission("system.languages", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.sso_language_service import get_sso_language_service
    lang_service = get_sso_language_service(db)
    languages = await lang_service.get_languages()
    
    return JSONResponse(content={"success": True, "data": languages})

@router.post("/translations")
async def create_translation(
    translation_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Create translation"""
    if not await check_permission("system.languages", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.sso_language_service import get_sso_language_service
    lang_service = get_sso_language_service(db)
    result = await lang_service.create_translation(translation_data, current_user.username)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return JSONResponse(content=result)

@router.get("/translations")
async def get_translations(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions),
    lang_code: Optional[str] = None,
    context: Optional[str] = None
):
    """Get translations"""
    if not await check_permission("system.languages", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.sso_language_service import get_sso_language_service
    lang_service = get_sso_language_service(db)
    translations = await lang_service.get_translations(lang_code, context)
    
    return JSONResponse(content={"success": True, "data": translations})

# Branding Management
@router.get("/branding")
async def get_branding(
    request: Request,
    db: Session = Depends(get_db)
):
    """Get branding configuration (public endpoint)"""
    from ..services.branding_compliance_service import get_branding_compliance_service
    branding_service = get_branding_compliance_service(db)
    branding = await branding_service.get_branding()
    
    return JSONResponse(content={"success": True, "data": branding})

@router.put("/branding")
async def update_branding(
    branding_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Update branding configuration"""
    if not await check_permission("system.branding", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.branding_compliance_service import get_branding_compliance_service
    branding_service = get_branding_compliance_service(db)
    result = await branding_service.update_branding(branding_data, current_user.username)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return JSONResponse(content=result)

@router.get("/branding/themes")
async def get_branding_themes(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Get branding themes"""
    if not await check_permission("system.branding", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.branding_compliance_service import get_branding_compliance_service
    branding_service = get_branding_compliance_service(db)
    themes = await branding_service.get_branding_themes()
    
    return JSONResponse(content={"success": True, "data": themes})

# Compliance Management
@router.get("/compliance/reports")
async def get_compliance_report(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions),
    report_type: str = "gdpr",
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
):
    """Get compliance report"""
    if not await check_permission("system.compliance", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.branding_compliance_service import get_branding_compliance_service
    compliance_service = get_branding_compliance_service(db)
    report = await compliance_service.get_compliance_report(report_type, start_date, end_date)
    
    return JSONResponse(content={"success": True, "data": report})

@router.get("/compliance/data-access-logs")
async def get_data_access_logs(
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions),
    user_id: Optional[int] = None,
    data_type: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000)
):
    """Get data access logs"""
    if not await check_permission("system.compliance", request):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    from ..services.branding_compliance_service import get_branding_compliance_service
    compliance_service = get_branding_compliance_service(db)
    logs = await compliance_service.get_data_access_logs(user_id, data_type, limit=limit)
    
    return JSONResponse(content={"success": True, "data": logs})

@router.post("/compliance/consents")
async def create_consent_record(
    consent_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_with_permissions)
):
    """Create consent record"""
    from ..services.branding_compliance_service import get_branding_compliance_service
    compliance_service = get_branding_compliance_service(db)
    result = await compliance_service.create_consent_record(
        consent_data["user_id"],
        consent_data["consent_type"],
        consent_data["consent_value"],
        request.client.host,
        request.headers.get("user-agent"),
        consent_data.get("details")
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return JSONResponse(content=result)
