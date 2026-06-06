"""
BioTime 9.5 Compatible Authentication API
Implements JWT authentication and RBAC system matching BioTime standards
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from typing import Optional, List

from app.core.config import settings
from app.core.database import get_db
from app.models.biotime_models import AuthUser, BaseOperationLog

# Router
router = APIRouter()

# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Settings — single source of truth from settings (same key used by core/security.py)
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours

# Pydantic Models
class TokenRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict

class TokenRefreshRequest(BaseModel):
    token: str

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_superuser: bool = False

class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_superuser: bool
    is_active: bool
    last_login: Optional[datetime] = None
    created_at: datetime

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

# Helper Functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash password"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> dict:
    """Decode JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> AuthUser:
    """Get current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = decode_token(credentials.credentials)
        if payload is None:
            raise credentials_exception
        
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(AuthUser).filter(AuthUser.username == username).first()
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user"
        )
    
    return user

def log_operation(
    db: Session,
    user_id: int,
    action: str,
    table_name: Optional[str] = None,
    record_id: Optional[int] = None,
    old_values: Optional[str] = None,
    new_values: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
):
    """Log operation to audit trail"""
    log_entry = BaseOperationLog(
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
        user_agent=user_agent
    )
    db.add(log_entry)
    db.commit()

# API Endpoints

@router.post("/api-token-auth/", response_model=TokenResponse)
async def login(
    request: TokenRequest,
    db: Session = Depends(get_db)
):
    """
    Authenticate user and return JWT token
    BioTime compatible endpoint: POST /api-token-auth/
    """
    # Authenticate user
    user = db.query(AuthUser).filter(AuthUser.username == request.username).first()
    
    if not user or not verify_password(request.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is disabled"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id},
        expires_delta=access_token_expires
    )
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Log login operation
    log_operation(
        db=db,
        user_id=user.id,
        action="LOGIN",
        table_name="auth_user",
        record_id=user.id,
        new_values=f"last_login: {user.last_login}"
    )
    
    return TokenResponse(
        token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_superuser": user.is_superuser
        }
    )

@router.post("/api-token-refresh/", response_model=TokenResponse)
async def refresh_token(
    request: TokenRefreshRequest,
    db: Session = Depends(get_db)
):
    """
    Refresh JWT token
    BioTime compatible endpoint: POST /api-token-refresh/
    """
    payload = decode_token(request.token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    username = payload.get("sub")
    user = db.query(AuthUser).filter(AuthUser.username == username).first()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Create new access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id},
        expires_delta=access_token_expires
    )
    
    return TokenResponse(
        token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_superuser": user.is_superuser
        }
    )

@router.get("/auth/me/", response_model=UserResponse)
async def get_current_user_info(
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Get current user information
    BioTime compatible endpoint: GET /auth/me/
    """
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        is_superuser=current_user.is_superuser,
        is_active=current_user.is_active,
        last_login=current_user.last_login,
        created_at=current_user.created_at
    )

@router.post("/auth/change-password/")
async def change_password(
    request: PasswordChangeRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Change user password
    BioTime compatible endpoint: POST /auth/change-password/
    """
    # Verify current password
    if not verify_password(request.current_password, current_user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Hash new password
    new_password_hash = get_password_hash(request.new_password)
    
    # Update password
    current_user.password = new_password_hash
    db.commit()
    
    # Log password change
    log_operation(
        db=db,
        user_id=current_user.id,
        action="PASSWORD_CHANGE",
        table_name="auth_user",
        record_id=current_user.id
    )
    
    return {"message": "Password changed successfully"}

@router.post("/auth/logout/")
async def logout(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Logout user (client-side token removal)
    BioTime compatible endpoint: POST /auth/logout/
    """
    # Log logout operation
    log_operation(
        db=db,
        user_id=current_user.id,
        action="LOGOUT",
        table_name="auth_user",
        record_id=current_user.id
    )
    
    return {"message": "Logged out successfully"}

@router.get("/auth/users/", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 50,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all users (admin only)
    BioTime compatible endpoint: GET /auth/users/
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    users = db.query(AuthUser).offset(skip).limit(limit).all()
    return [
        UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            is_superuser=user.is_superuser,
            is_active=user.is_active,
            last_login=user.last_login,
            created_at=user.created_at
        )
        for user in users
    ]

@router.post("/auth/users/", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create new user (admin only)
    BioTime compatible endpoint: POST /auth/users/
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Check if username already exists
    existing_user = db.query(AuthUser).filter(AuthUser.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = AuthUser(
        username=user_data.username,
        password=hashed_password,
        email=user_data.email,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        is_superuser=user_data.is_superuser,
        is_active=True
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Log user creation
    log_operation(
        db=db,
        user_id=current_user.id,
        action="CREATE_USER",
        table_name="auth_user",
        record_id=new_user.id,
        new_values=f"username: {new_user.username}"
    )
    
    return UserResponse(
        id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        first_name=new_user.first_name,
        last_name=new_user.last_name,
        is_superuser=new_user.is_superuser,
        is_active=new_user.is_active,
        last_login=new_user.last_login,
        created_at=new_user.created_at
    )
