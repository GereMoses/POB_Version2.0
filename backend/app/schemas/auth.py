from typing import Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime


class TokenUser(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    is_superuser: bool
    is_global_admin: bool = False
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: Optional[TokenUser] = None


class TokenData(BaseModel):
    email: Optional[str] = None


class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    is_superuser: bool
    is_verified: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True
