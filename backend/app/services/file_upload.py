"""
File Upload Service

This service handles file uploads for personnel photos and other documents.
"""

import os
import uuid
import shutil
from typing import Optional
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models.personnel import Personnel
from ..core.config import settings


class FileUploadService:
    """Service for handling file uploads"""
    
    def __init__(self):
        self.upload_dir = "uploads"
        self.personnel_photos_dir = os.path.join(self.upload_dir, "personnel_photos")
        self.max_file_size = 5 * 1024 * 1024  # 5MB
        self.allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif'}
        
        # Create directories if they don't exist
        os.makedirs(self.personnel_photos_dir, exist_ok=True)
    
    async def upload_personnel_photo(
        self, 
        file: UploadFile, 
        personnel_id: int,
        db: Session
    ) -> str:
        """
        Upload personnel photo
        
        Args:
            file: Uploaded file
            personnel_id: Personnel ID
            db: Database session
            
        Returns:
            URL of uploaded photo
            
        Raises:
            HTTPException: If file upload fails
        """
        # Validate file
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided"
            )
        
        # Check file extension
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in self.allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type {file_ext} not allowed. Allowed types: {', '.join(self.allowed_extensions)}"
            )
        
        # Check file size
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to beginning
        
        if file_size > self.max_file_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size too large. Maximum size: {self.max_file_size // (1024*1024)}MB"
            )
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        filename = f"{personnel_id}_{file_id}{file_ext}"
        file_path = os.path.join(self.personnel_photos_dir, filename)
        
        # Save file
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save file: {str(e)}"
            )
        
        # Update personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            # Clean up uploaded file
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Personnel not found"
            )
        
        # Delete old photo if exists
        if personnel.photo_url:
            old_file_path = os.path.join(settings.BASE_DIR, personnel.photo_url)
            if os.path.exists(old_file_path):
                os.remove(old_file_path)
        
        # Update with new photo URL
        personnel.photo_url = f"/uploads/personnel_photos/{filename}"
        db.commit()
        db.refresh(personnel)
        
        return personnel.photo_url
    
    def get_photo_url(self, personnel_id: int, filename: str) -> str:
        """
        Get photo URL for personnel
        
        Args:
            personnel_id: Personnel ID
            filename: Filename
            
        Returns:
            Photo URL
        """
        return f"/uploads/personnel_photos/{filename}"
    
    def delete_personnel_photo(self, personnel_id: int, db: Session) -> bool:
        """
        Delete personnel photo
        
        Args:
            personnel_id: Personnel ID
            db: Database session
            
        Returns:
            True if deleted successfully
        """
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel or not personnel.photo_url:
            return False
        
        # Delete file
        file_path = os.path.join(settings.BASE_DIR, personnel.photo_url)
        if os.path.exists(file_path):
            os.remove(file_path)
        
        # Update personnel record
        personnel.photo_url = None
        db.commit()
        
        return True


# Create singleton instance
file_upload_service = FileUploadService()
