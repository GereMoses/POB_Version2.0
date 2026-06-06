#!/usr/bin/env python3

import sys
import os
sys.path.append('/app')

def investigate_jwt():
    print("=== JWT AUTHENTICATION INVESTIGATION ===\n")
    
    # 1. Check environment variables
    print("1. ENVIRONMENT VARIABLES:")
    env_secret_key = os.getenv('SECRET_KEY')
    print(f"   ENV SECRET_KEY: {repr(env_secret_key)}")
    print(f"   ENV SECRET_KEY length: {len(env_secret_key) if env_secret_key else 'None'}")
    
    # 2. Check settings
    print("\n2. SETTINGS CONFIG:")
    try:
        from app.core.config import settings
        print(f"   settings.SECRET_KEY: {repr(settings.SECRET_KEY)}")
        print(f"   settings.SECRET_KEY length: {len(settings.SECRET_KEY)}")
        print(f"   settings.ALGORITHM: {settings.ALGORITHM}")
        print(f"   settings.ENVIRONMENT: {settings.ENVIRONMENT}")
    except Exception as e:
        print(f"   Error loading settings: {e}")
        return
    
    # 3. Test JWT creation
    print("\n3. JWT CREATION TEST:")
    try:
        from app.core.security import create_access_token, verify_token
        
        test_data = {"sub": "admin@pob.com"}
        token = create_access_token(test_data)
        print(f"   Created token: {token}")
        print(f"   Token length: {len(token)}")
        
        # 4. Test JWT verification
        print("\n4. JWT VERIFICATION TEST:")
        try:
            verified_email = verify_token(token)
            print(f"   ✅ Verification SUCCESS: {verified_email}")
        except Exception as e:
            print(f"   ❌ Verification FAILED: {e}")
            print(f"   Error type: {type(e).__name__}")
            
            # Try manual decode
            print("\n5. MANUAL JWT DECODE:")
            try:
                import jwt
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
                print(f"   Manual decode payload: {payload}")
                print(f"   Payload sub: {payload.get('sub')}")
                print(f"   Payload type: {payload.get('type')}")
                print(f"   Payload exp: {payload.get('exp')}")
            except Exception as decode_error:
                print(f"   Manual decode FAILED: {decode_error}")
                
    except Exception as e:
        print(f"   JWT creation failed: {e}")
    
    # 6. Test login endpoint
    print("\n6. LOGIN ENDPOINT TEST:")
    try:
        from app.core.security import verify_password
        from app.core.database import get_db
        from sqlalchemy import text
        
        # Get database session
        db = next(get_db())
        
        # Check admin user
        query = text("SELECT username, hashed_password, is_active FROM users WHERE username = 'admin'")
        result = db.execute(query)
        user_data = result.fetchone()
        
        if user_data:
            username, hashed_password, is_active = user_data
            print(f"   Admin user found: {username}")
            print(f"   Is active: {is_active}")
            print(f"   Password hash exists: {bool(hashed_password)}")
            
            # Test password verification
            try:
                is_valid = verify_password("admin123", hashed_password)
                print(f"   Password verification: {'✅ SUCCESS' if is_valid else '❌ FAILED'}")
            except Exception as pw_error:
                print(f"   Password verification error: {pw_error}")
        else:
            print("   ❌ No admin user found")
            
        db.close()
        
    except Exception as e:
        print(f"   Login test failed: {e}")
    
    print("\n=== INVESTIGATION COMPLETE ===")

if __name__ == "__main__":
    investigate_jwt()
