"""
Auth-hardening regression tests for the Round-2 deep-analysis fixes:
  D2 — password-reset / wrong-type tokens must NOT authenticate API calls
  D3 — rate limiter: spoof-resistant client IP + per-path auth limit
  D4 — login: dummy-bcrypt timing equalization + IP-aware lockout
"""

import pytest
from unittest.mock import Mock, patch


# ─────────────────────────────────────────────────────────────────────────────
# D2 — token type allowlist
# ─────────────────────────────────────────────────────────────────────────────

class TestTokenTypeAllowlist:
    def test_password_reset_token_carries_type_claim(self):
        from jose import jwt
        from app.core.security import create_password_reset_token
        from app.core.config import settings

        token = create_password_reset_token("user@example.com")
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        assert payload.get("type") == "password_reset", (
            "Reset token must carry type=password_reset so it can't be used as access."
        )

    def test_verify_token_rejects_reset_token_as_access(self):
        from fastapi import HTTPException
        from app.core.security import create_password_reset_token, verify_token

        reset = create_password_reset_token("user@example.com")
        with pytest.raises(HTTPException) as exc:
            verify_token(reset, token_type="access")
        assert exc.value.status_code == 401

    def test_verify_token_rejects_typeless_legacy_token_as_access(self):
        from jose import jwt
        from fastapi import HTTPException
        from app.core.security import verify_token
        from app.core.config import settings

        # A legacy token with a sub but NO type claim must now be rejected.
        legacy = jwt.encode({"sub": "1"}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        with pytest.raises(HTTPException):
            verify_token(legacy, token_type="access")

    def test_verify_token_accepts_genuine_access_token(self):
        from app.core.security import create_access_token, verify_token

        access = create_access_token({"sub": "1"})
        # Should return the subject, not raise.
        assert verify_token(access, token_type="access") == "1"

    def test_biotime_access_token_now_stamped_with_type(self):
        from jose import jwt
        from app.api import biotime_auth

        token = biotime_auth.create_access_token({"sub": "1"})
        payload = jwt.decode(token, biotime_auth.SECRET_KEY, algorithms=[biotime_auth.ALGORITHM])
        assert payload.get("type") == "access", (
            "biotime_auth.create_access_token must stamp type=access for the allowlist."
        )


# ─────────────────────────────────────────────────────────────────────────────
# D3 — rate limiter client IP + auth path
# ─────────────────────────────────────────────────────────────────────────────

class TestRateLimiterClientId:
    def _mw(self):
        from app.core.rate_limiter import RateLimitMiddleware
        return RateLimitMiddleware(app=Mock(), calls=1000, period=60, auth_calls=10, auth_period=300)

    def _req(self, headers, peer="10.0.0.9"):
        r = Mock()
        r.state = Mock(spec=[])  # no .user attribute
        r.headers = headers
        r.client = Mock(host=peer)
        return r

    def test_prefers_x_real_ip(self):
        mw = self._mw()
        cid = mw._get_client_id(self._req({"X-Real-IP": "203.0.113.5",
                                           "X-Forwarded-For": "1.2.3.4, 203.0.113.5"}))
        assert cid == "ip:203.0.113.5"

    def test_uses_rightmost_xff_not_leftmost(self):
        """The spoofable leftmost token must be ignored; rightmost (proxy-appended) used."""
        mw = self._mw()
        cid = mw._get_client_id(self._req({"X-Forwarded-For": "66.66.66.66, 203.0.113.5"}))
        assert cid == "ip:203.0.113.5", "Attacker-controlled left token must not be trusted."

    def test_falls_back_to_peer(self):
        mw = self._mw()
        cid = mw._get_client_id(self._req({}))
        assert cid == "ip:10.0.0.9"

    def test_auth_prefix_detection(self):
        mw = self._mw()
        assert any("/api/auth/login".startswith(p) for p in mw._AUTH_PREFIXES)
        assert any("/api/v1/auth/refresh".startswith(p) for p in mw._AUTH_PREFIXES)
        assert not any("/api/personnel/".startswith(p) for p in mw._AUTH_PREFIXES)


# ─────────────────────────────────────────────────────────────────────────────
# D4 — login hardening helpers
# ─────────────────────────────────────────────────────────────────────────────

class TestLoginHardening:
    def test_dummy_hash_is_a_real_bcrypt_hash(self):
        from app.api.auth import _DUMMY_HASH
        assert _DUMMY_HASH.startswith("$2"), "Dummy hash must be a bcrypt hash for timing parity."

    def test_burn_password_time_does_not_raise(self):
        from app.api.auth import _burn_password_time
        _burn_password_time()  # must be safe to call unconditionally

    def test_client_ip_prefers_real_ip(self):
        from app.api.auth import _client_ip
        req = Mock()
        req.headers = {"X-Real-IP": "198.51.100.7", "X-Forwarded-For": "9.9.9.9, 198.51.100.7"}
        req.client = Mock(host="10.0.0.1")
        assert _client_ip(req) == "198.51.100.7"

    def test_client_ip_rightmost_xff(self):
        from app.api.auth import _client_ip
        req = Mock()
        req.headers = {"X-Forwarded-For": "9.9.9.9, 198.51.100.7"}
        req.client = Mock(host="10.0.0.1")
        assert _client_ip(req) == "198.51.100.7"

    @patch("app.api.auth.get_redis")
    def test_ip_lockout_triggers_after_threshold(self, mock_get_redis):
        """Per-IP failure counter must lock the IP once IP_MAX_ATTEMPTS is hit."""
        from app.api import auth as auth_mod

        r = Mock()
        # username counter low, IP counter at the ceiling
        r.incr.side_effect = [1, auth_mod.IP_MAX_ATTEMPTS]
        mock_get_redis.return_value = r

        auth_mod._record_failed("someuser", ip="203.0.113.9")

        # The IP lockout key must have been set.
        set_keys = [c.args[0] for c in r.set.call_args_list]
        assert any(k.startswith("login_lockout_ip:") for k in set_keys), (
            "Reaching IP_MAX_ATTEMPTS must set an IP-scoped lockout."
        )

    @patch("app.api.auth.get_redis")
    def test_lockout_check_raises_on_ip_lock(self, mock_get_redis):
        import time as _t
        from fastapi import HTTPException
        from app.api import auth as auth_mod

        r = Mock()
        future = str(int(_t.time()) + 600)
        # username key empty, ip key locked
        r.get.side_effect = lambda k: future if k.startswith("login_lockout_ip:") else None
        mock_get_redis.return_value = r

        with pytest.raises(HTTPException) as exc:
            auth_mod._check_lockout("someuser", ip="203.0.113.9")
        assert exc.value.status_code == 429
