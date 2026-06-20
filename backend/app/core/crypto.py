"""
Field-level secret encryption for integration credentials.

Used to encrypt third-party API keys / client secrets (SeamlessHR, Business Central)
before they are stored in the database, so a DB dump or backup does not leak live
credentials. Symmetric Fernet (AES-128-CBC + HMAC).

Key management
--------------
The Fernet key is derived deterministically from SECRET_KEY (SHA-256 → urlsafe-b64),
so no extra secret needs to be provisioned and all workers agree on the key without a
DB lookup. An explicit INTEGRATION_ENC_KEY (a urlsafe-base64 32-byte Fernet key) may be
set to decouple credential encryption from the JWT signing key — recommended if you ever
rotate SECRET_KEY, since rotating it would otherwise make existing ciphertexts
undecryptable.

Backwards compatibility
-----------------------
Encrypted values are tagged with a constant prefix. `decrypt_secret()` returns any
untagged value unchanged, so existing PLAINTEXT credentials keep working and are
transparently upgraded to ciphertext the next time the config is saved.
"""

import base64
import hashlib
import logging
import os

from cryptography.fernet import Fernet, InvalidToken

from .config import settings

logger = logging.getLogger(__name__)

# Tag identifying values this module produced. Anything without it is treated as
# legacy plaintext by decrypt_secret().
_ENC_PREFIX = "enc:v1:"


def _fernet() -> Fernet:
    """Build the Fernet instance from INTEGRATION_ENC_KEY or a SECRET_KEY-derived key."""
    explicit = os.getenv("INTEGRATION_ENC_KEY", "").strip()
    if explicit:
        return Fernet(explicit.encode())
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()  # 32 bytes
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_secret(plaintext: str) -> str:
    """Encrypt a credential for storage. Empty/None passes through unchanged."""
    if not plaintext:
        return plaintext
    # Idempotent: never double-encrypt an already-tagged value.
    if plaintext.startswith(_ENC_PREFIX):
        return plaintext
    try:
        token = _fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")
        return _ENC_PREFIX + token
    except Exception as e:
        # Never block a config save on a crypto error — fall back to storing as-is,
        # but make the failure loud so it is noticed.
        logger.error("Secret encryption failed, storing UNENCRYPTED: %s", e)
        return plaintext


def decrypt_secret(value: str) -> str:
    """Decrypt a stored credential. Untagged (legacy plaintext) values pass through."""
    if not value or not value.startswith(_ENC_PREFIX):
        return value  # legacy plaintext or empty — return unchanged
    token = value[len(_ENC_PREFIX):]
    try:
        return _fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        logger.error("Secret decryption failed (InvalidToken) — wrong key or corrupted value")
        return ""
    except Exception as e:
        logger.error("Secret decryption error: %s", e)
        return ""


def is_encrypted(value: str) -> bool:
    """True if the value was produced by encrypt_secret()."""
    return bool(value) and value.startswith(_ENC_PREFIX)
