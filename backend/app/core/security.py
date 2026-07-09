import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Union
from jose import JWTError, jwt
import bcrypt
from fastapi import HTTPException, status
from .config import settings

# Password Hashing - Using bcrypt directly

# JWT Functions
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    jti = str(uuid.uuid4())
    to_encode.update({"exp": expire, "type": "access", "jti": jti})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict):
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    jti = str(uuid.uuid4())
    to_encode.update({"exp": expire, "type": "refresh", "jti": jti})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    # Store refresh jti in Redis so it can be validated as single-use
    try:
        from .redis_client import get_redis_client
        r = get_redis_client()
        ttl = int((expire - now).total_seconds())
        r.setex(f"refresh_jti:{jti}", ttl, "1")
    except Exception:
        pass  # Redis unavailable — token still works, just loses single-use enforcement
    return encoded_jwt

def blacklist_token(jti: str, ttl_seconds: int) -> None:
    """Add a token's jti to the Redis blacklist. Called on logout."""
    try:
        from .redis_client import get_redis_client
        r = get_redis_client()
        r.setex(f"token_blacklist:{jti}", max(ttl_seconds, 1), "1")
    except Exception:
        pass


def _is_blacklisted(jti: str) -> bool:
    try:
        from .redis_client import get_redis_client
        r = get_redis_client()
        return bool(r.exists(f"token_blacklist:{jti}"))
    except Exception:
        return False  # Redis unavailable — fail open


def verify_token(token: str, token_type: str = "access"):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        sub: str = payload.get("sub")
        token_type_check: str = payload.get("type")
        jti: str = payload.get("jti", "")

        if sub is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Strict allowlist: the token's own "type" claim must match the requested
        # type. This rejects refresh tokens used as access tokens AND password-reset
        # tokens (type=password_reset) or any legacy token with no type claim being
        # replayed as a bearer credential.
        if token_type_check != token_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token type for this operation",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Check blacklist (logout / revocation)
        if jti and _is_blacklisted(jti):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Enforce single-use for refresh tokens
        if token_type_check == "refresh" and jti:
            try:
                from .redis_client import get_redis_client
                r = get_redis_client()
                consumed = not r.getdel(f"refresh_jti:{jti}")
                if consumed:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Refresh token already used",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            except HTTPException:
                raise
            except Exception:
                pass  # Redis unavailable — allow refresh

        return sub
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

# Password Functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


# ── Password strength policy ────────────────────────────────────────────────
PASSWORD_MIN_LENGTH = 12

# The most-common weak passwords (lowercased). Defence-in-depth on top of the
# length + character-class rules — blocks the passwords credential-stuffing and
# dictionary attacks try first.
_COMMON_PASSWORDS = {
    "password", "password1", "password12", "password123", "passw0rd", "admin",
    "admin123", "administrator", "welcome", "welcome1", "welcome123", "letmein",
    "qwerty", "qwerty123", "123456", "1234567", "12345678", "123456789", "1234567890",
    "iloveyou", "abc123", "changeme", "secret", "root", "toor", "test123", "pass123",
    "monkey", "dragon", "master", "superman", "trustno1", "login", "starwars",
}


def validate_password_strength(password: str, username: str | None = None) -> None:
    """Raise ValueError if `password` is too weak to store.

    Enforced on every password create/change so an easily-cracked password (a
    short one, a single character class, 'admin123', or one containing the
    username) can never be set — a stolen/guessed password should not be enough
    to reach an account, and this stops the weak ones being chosen in the first
    place. Pair with 2FA for defence in depth.
    """
    if not password or len(password) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"Password must be at least {PASSWORD_MIN_LENGTH} characters long.")
    import re
    classes = sum(bool(re.search(p, password)) for p in (r"[a-z]", r"[A-Z]", r"\d", r"[^A-Za-z0-9]"))
    if classes < 3:
        raise ValueError("Password must include at least 3 of: lowercase, uppercase, number, symbol.")
    low = password.lower()
    if low in _COMMON_PASSWORDS:
        raise ValueError("That password is too common — choose a less predictable one.")
    if "password" in low or "admin" in low:
        raise ValueError("Password must not contain 'password' or 'admin'.")
    if username and len(username) >= 3 and username.lower() in low:
        raise ValueError("Password must not contain your username.")

# Token Validation
def create_password_reset_token(email: str) -> str:
    delta = timedelta(hours=settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS)
    now = datetime.now(timezone.utc)
    expires = now + delta
    exp = expires.timestamp()
    encoded_jwt = jwt.encode(
        # type=password_reset so this token can NEVER be used as an API access
        # token — verify_token / get_current_user only accept type=access.
        {"exp": exp, "nbf": now, "sub": email, "type": "password_reset"},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    return encoded_jwt

def verify_password_reset_token(token: str) -> Optional[str]:
    try:
        decoded_token = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return decoded_token["sub"]
    except JWTError:
        return None
