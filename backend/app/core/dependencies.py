from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from .database import get_db
from .security import verify_token
from .config import settings
# Temporarily bypass User model due to import issues
# from ..models.user import User
from sqlalchemy import text

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """Get current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        email = verify_token(token)
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    except Exception:
        raise credentials_exception
    
    # Look up user — check auth_user (BioTime primary) first, then users table
    user_data = None
    source = None

    # Try auth_user first (primary user store)
    result = db.execute(text("""
        SELECT id, username, email, NULL AS full_name, NULL AS phone, is_active, is_superuser,
               TRUE AS is_verified, COALESCE(is_global_admin, FALSE) AS is_global_admin
        FROM auth_user
        WHERE email = :email OR username = :email
    """), {"email": email}).fetchone()

    if result:
        user_data = result
        source = "auth_user"
    else:
        # Fallback: users table
        result = db.execute(text("""
            SELECT id, username, email, full_name, phone, is_active, is_superuser, is_verified,
                   COALESCE(is_global_admin, FALSE) AS is_global_admin
            FROM users
            WHERE email = :email OR username = :email
        """), {"email": email}).fetchone()
        if result:
            user_data = result
            source = "users"

    if user_data is None:
        raise credentials_exception

    user_id, username, email, full_name, phone, is_active, is_superuser, is_verified, is_global_admin = (
        user_data.id, user_data.username, user_data.email,
        user_data.full_name if hasattr(user_data, 'full_name') else None,
        user_data.phone if hasattr(user_data, 'phone') else None,
        user_data.is_active, user_data.is_superuser, user_data.is_verified,
        user_data.is_global_admin
    )

    class SimpleUser:
        def __init__(self):
            self.id = user_id
            self.username = username
            self.email = email
            self.full_name = full_name
            self.phone = phone
            self.is_active = is_active
            self.is_superuser = is_superuser
            self.is_verified = is_verified
            self.is_global_admin = is_global_admin
            # Add personnel_id for role permission checks
            self.personnel_id = user_id  # For admin, personnel_id equals user_id
    
    return SimpleUser()


async def get_current_active_user(
    current_user = Depends(get_current_user)
):
    """Get current active user"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


async def get_current_superuser(
    current_user = Depends(get_current_active_user)
):
    """Get current superuser"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user
