"""
Temporary auth endpoint to test login without model issues
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.core.security import create_access_token, verify_password
from app.core.config import settings
from datetime import timedelta

router = APIRouter()

@router.post("/login")
async def temp_login(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
):
    """Temporary login endpoint using raw SQL"""
    try:
        # Query user directly with SQL
        query = text("""
            SELECT id, username, email, hashed_password, is_active, is_superuser 
            FROM users 
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
        
        user_id, username, email, hashed_password, is_active, is_superuser = user_data
        
        if not is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user"
            )
        
        # Verify password
        if not verify_password(form_data.password, hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": email}, expires_delta=access_token_expires
        )
        
        # Update last login
        update_query = text("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = :user_id")
        db.execute(update_query, {"user_id": user_id})
        db.commit()
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": {
                "id": user_id,
                "username": username,
                "email": email,
                "is_superuser": is_superuser
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Temp login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )
