#!/usr/bin/env python3
"""
Generate bcrypt hash for admin123
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

try:
    from app.core.security import get_password_hash
    
    password = "admin123"
    hashed = get_password_hash(password)
    
    print(f"Password: {password}")
    print(f"Bcrypt Hash: {hashed}")
    
    # Test verification
    from app.core.security import verify_password
    is_valid = verify_password(password, hashed)
    print(f"Verification test: {'PASS' if is_valid else 'FAIL'}")
    
    # SQL update command
    print(f"\nSQL Update Command:")
    print(f"UPDATE users SET hashed_password = '{hashed}' WHERE username = 'admin';")
    
except ImportError as e:
    print(f"Import error: {e}")
    print("Creating basic bcrypt hash...")
    
    import bcrypt
    password = "admin123"
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    print(f"Password: {password}")
    print(f"Bcrypt Hash: {hashed}")
    
    # Test verification
    is_valid = bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    print(f"Verification test: {'PASS' if is_valid else 'FAIL'}")
    
    # SQL update command
    print(f"\nSQL Update Command:")
    print(f"UPDATE users SET hashed_password = '{hashed}' WHERE username = 'admin';")
