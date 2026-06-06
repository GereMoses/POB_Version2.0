from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy import text
from typing import Any
import logging

from ..core.database import get_db
from ..core.security import create_access_token, verify_password, get_password_hash
from ..core.config import settings
from ..core.dependencies import get_current_user
# Temporarily bypass User model due to import issues
# from ..models.user import User
from ..schemas.auth import Token, UserCreate, UserResponse
from sqlalchemy import text

router = APIRouter()
logger = logging.getLogger(__name__)


def _get_user_auth_info(db, user_id: int):
    """Return (roles: list[str], permissions: list[str]) for a user."""
    rows = db.execute(text("""
        SELECT DISTINCT r.name AS role_name, p.codename
        FROM auth_user_role ur
        JOIN auth_role r ON r.id = ur.role_id AND r.is_active = true
        LEFT JOIN auth_role_permission rp ON rp.role_id = r.id
        LEFT JOIN auth_permission p ON p.id = rp.permission_id
        WHERE ur.user_id = :uid
    """), {"uid": user_id}).fetchall()
    roles       = list({row.role_name for row in rows if row.role_name})
    permissions = list({row.codename  for row in rows if row.codename})
    return roles, permissions

_FALLBACK_TIMEOUT = 480  # 8 hours default

def _get_session_timeout(db: Session) -> int:
    """Read session_timeout_minutes from att_rules; 0 means 'never' (~1 year)."""
    try:
        row = db.execute(text("SELECT rule_value FROM att_rules WHERE rule_key = 'session_timeout_minutes'")).fetchone()
        mins = int(row.rule_value) if row and row.rule_value else _FALLBACK_TIMEOUT
        return 525960 if mins == 0 else mins  # 0 = never ≈ 1 year
    except Exception:
        return _FALLBACK_TIMEOUT


@router.post("/production-login", response_model=dict)
async def production_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Production-ready login endpoint with robust error handling"""
    try:
        logger.info(f"Login attempt for user: {form_data.username}")
        
        # Query user directly with SQL
        query = text("""
            SELECT id, username, email, password, is_active, is_superuser,
                   COALESCE(is_global_admin, FALSE) AS is_global_admin
            FROM auth_user
            WHERE username = :username OR email = :username
        """)

        result = db.execute(query, {"username": form_data.username})
        user_data = result.fetchone()

        if not user_data:
            logger.warning(f"User not found: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        logger.info(f"User found: {user_data.username}, checking password...")
        
        # Verify password with multiple fallback methods
        password_valid = False
        try:
            password_valid = verify_password(form_data.password, user_data.password)
            logger.info(f"Password verification result: {password_valid}")
        except Exception as bcrypt_error:
            logger.error(f"Bcrypt verification failed: {bcrypt_error}")
            
            # No fallback - strict password verification only
            logger.error(f"Password verification failed for user: {form_data.username}")
        
        if not password_valid:
            logger.warning(f"Invalid password for user: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        if not user_data.is_active:
            logger.warning(f"Inactive user login attempt: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is inactive"
            )
        
        # Create access token using DB-configured timeout
        timeout_mins = _get_session_timeout(db)
        access_token_expires = timedelta(minutes=timeout_mins)
        access_token = create_access_token(
            data={"sub": user_data.username},
            expires_delta=access_token_expires
        )

        logger.info(f"Successful login for user: {user_data.username}")

        roles, permissions = _get_user_auth_info(db, user_data.id)
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": timeout_mins * 60,
            "user": {
                "id": user_data.id,
                "username": user_data.username,
                "email": user_data.email,
                "is_active": user_data.is_active,
                "is_superuser": user_data.is_superuser,
                "is_global_admin": bool(user_data.is_global_admin),
                "roles": roles,
                "permissions": permissions,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Production login error: {type(e).__name__}: {str(e)}")
        logger.error(f"Production login error details: {repr(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login service temporarily unavailable"
        )

@router.post("/simple-login", response_model=dict)
async def simple_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Simple login endpoint for development - bypasses User model"""
    try:
        # Query user directly with SQL
        query = text("""
            SELECT id, username, email, password, is_active, is_superuser,
                   COALESCE(is_global_admin, FALSE) AS is_global_admin
            FROM auth_user
            WHERE username = :username OR email = :username
        """)
        
        result = db.execute(query, {"username": form_data.username})
        user_data = result.fetchone()
        
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Verify password
        if not verify_password(form_data.password, user_data.password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        if not user_data.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is inactive"
            )
        
        # Create access token using DB-configured timeout
        timeout_mins = _get_session_timeout(db)
        access_token_expires = timedelta(minutes=timeout_mins)
        access_token = create_access_token(
            data={"sub": user_data.username},
            expires_delta=access_token_expires
        )

        roles, permissions = _get_user_auth_info(db, user_data.id)
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": timeout_mins * 60,
            "user": {
                "id": user_data.id,
                "username": user_data.username,
                "email": user_data.email,
                "is_active": user_data.is_active,
                "is_superuser": user_data.is_superuser,
                "is_global_admin": bool(user_data.is_global_admin),
                "roles": roles,
                "permissions": permissions,
            }
        }
    except Exception as e:
        logger.error(f"Simple login error: {type(e).__name__}: {str(e)}")
        logger.error(f"Simple login error details: {repr(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login error: {str(e)}"
        )
#     db.refresh(user)
#     
#     return user


@router.post("/login", response_model=Token)
async def login(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """Authenticate user and return access token"""
    try:
        # Use raw SQL to find user
        query = text("""
            SELECT id, username, email, password, is_active, is_superuser,
                   first_name, last_name, COALESCE(is_global_admin, FALSE) AS is_global_admin
            FROM auth_user
            WHERE username = :username OR email = :username
        """)
        
        result = db.execute(query, {"username": form_data.username})
        user_data = result.fetchone()
        
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        user_id, username, email, password, is_active, is_superuser, first_name, last_name, is_global_admin = user_data
        
        if not is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user"
            )
        
        # Verify password
        if not verify_password(form_data.password, password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create access token using DB-configured timeout
        timeout_mins = _get_session_timeout(db)
        access_token_expires = timedelta(minutes=timeout_mins)
        access_token = create_access_token(
            data={"sub": email}, expires_delta=access_token_expires
        )

        # Update last login
        update_query = text("UPDATE auth_user SET last_login = CURRENT_TIMESTAMP WHERE id = :user_id")
        db.execute(update_query, {"user_id": user_id})
        db.commit()

        roles, permissions = _get_user_auth_info(db, user_id)
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": timeout_mins * 60,
            "user": {
                "id": user_id,
                "username": username,
                "email": email,
                "is_active": is_active,
                "is_superuser": is_superuser,
                "is_global_admin": bool(is_global_admin),
                "first_name": first_name or username,
                "last_name": last_name or "",
                "roles": roles,
                "permissions": permissions,
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login error: {str(e)}"
        )


@router.get("/me")
async def get_current_user_info(
    current_user = Depends(get_current_user)
) -> Any:
    """Get current user information"""
    try:
        from ..core.database import SessionLocal
        _db = SessionLocal()
        try:
            roles, permissions = _get_user_auth_info(_db, current_user.id)
        finally:
            _db.close()
        return {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "phone": current_user.phone,
            "is_active": current_user.is_active,
            "is_superuser": current_user.is_superuser,
            "is_verified": current_user.is_verified,
            "is_global_admin": bool(getattr(current_user, "is_global_admin", False)),
            "roles": roles,
            "permissions": permissions,
        }
        
    except Exception as e:
        print(f"Get current user error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting user info: {str(e)}"
        )


# @router.post("/logout")
# async def logout(current_user: User = Depends(get_current_user)) -> Any:
#     """Logout user (token invalidation would be handled client-side)"""
#     return {"message": "Successfully logged out"}
