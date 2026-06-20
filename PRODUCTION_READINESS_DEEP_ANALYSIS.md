# POB System v2.0 — DEEP Production Readiness Analysis (Round 2)

> Second-pass audit, performed **after** the 14 Phase-1 fixes were applied. This pass
> traced actual code paths (auth token lifecycle, WebSocket manager internals, rate-limiter
> middleware ordering, dynamic SQL construction, mustering concurrency primitives) rather
> than scanning for the obvious. It surfaces **7 new defects** the first pass missed — two
> of them are auth/security issues of real consequence — and **confirms 4 strengths** that
> deeper reading actually validated.

**Date:** 2026-06-20
**Scope:** `backend/app/core/*`, `services/mustering_service.py`, `services/emergency_service.py`,
`api/auth.py`, dynamic-SQL endpoints, `core/websocket.py`, middleware stack ordering.

---

## Revised Verdict

Phase-1 closed the *loud* safety bugs (fire-mode bypass, mock sirens, drill TypeError, Redis
password, WS auth). This deeper pass shows the **authentication layer** has two quieter but
more serious holes, and the **rate-limiting layer is largely decorative**. None are
showstoppers individually, but for "the biggest oil & gas operator in the world" the auth
findings (D2, D3) should block go-live just like the Phase-1 set did.

**Adjusted score: 71/100** (up from 67 after Phase-1 fixes, then held down by D2/D3/D4).

---

## NEW FINDINGS

### 🔴 D2 — Password-reset token is accepted as a full API access token (auth bypass)

**Files:** `core/security.py:131-148` (mint), `core/dependencies.py:31-69` (accept),
`core/security.py:61-107` (`verify_token`).

- `create_password_reset_token()` mints a JWT containing only `{sub: email, exp, nbf}` —
  **no `type` claim, no `jti`.**
- `get_current_user()` rejects a token only if `type == "refresh"` or `mfa_pending` is set.
  A reset token has neither, so it passes; `sub` is the email, and user lookup is by email →
  a fully authenticated session.
- The **WebSocket auth we just added in Phase-1** (`verify_token(token, "access")`) has the
  same gap — it only rejects `type == "refresh"`. A reset token passes there too.

**Impact:** A 24-hour password-reset link (emailed, so it travels through mail servers, can be
forwarded, can land in `Referer` headers and proxy logs) doubles as a bearer token for the
entire API. Because there is no `jti`, it **cannot be revoked** and **remains valid even after
the password is changed**. That is silent account takeover without ever resetting the password.

**Fix:** Use an allowlist, not a denylist, for token type:
```python
# create_password_reset_token: add "type": "password_reset"
# get_current_user AND verify_token:
if payload.get("type") != "access":
    raise credentials_exception
```

---

### 🔴 D3 — App-layer rate limiter is effectively off for auth, and IP-spoofable

**Files:** `core/rate_limiter.py:159-173`, `main.py:277-282`, `config.py:90-93`.

Three compounding problems:

1. **Auth limit is dead config.** `add_rate_limit_middleware()` hardcodes `calls=1000,
   period=60` and there is no per-path rule. `RATE_LIMIT_AUTH_REQUESTS = 10 / 300s` in
   `config.py` is **never referenced anywhere**. The login endpoint gets 1000 req/min/client
   at the app layer.
2. **User-scoping never triggers.** `_get_client_id()` keys on `request.state.user`, but the
   rate-limit middleware is added *after* (i.e. runs *outside*) `RBACMiddleware`, which is what
   sets `request.state.user`. So the limiter is always IP-based.
3. **IP is attacker-controlled.** The IP comes from the first token of `X-Forwarded-For` with
   no trusted-proxy validation. An attacker who rotates `X-Forwarded-For: <random>` on each
   request lands in a fresh bucket every time → the limiter is bypassed entirely.

The only real backstop is nginx `limit_req` + the login lockout (D4). The Python limiter is
security theatre.

**Fix:** Derive client IP only from the trusted proxy hop (`X-Real-IP` set by *your* nginx,
not the client). Apply the auth-specific limit to `/api/auth/*`. Or delete the app limiter and
rely on nginx + lockout, and stop advertising it as a control.

---

### 🟠 D1 — WebSocket `ConnectionManager.disconnect()` is async but called without `await` → connection/memory leak

**File:** `core/websocket.py:60-91`.

- `disconnect()` is `async def`, but it is invoked synchronously in two places:
  `send_personal_message()` (line 66) and `broadcast_to_room()` (line 86). The returned
  coroutine is **never awaited** → `RuntimeWarning: coroutine 'disconnect' was never awaited`,
  and the dead socket is **never removed** from `active_connections` / `user_connections`.
  Under normal client churn both dicts grow unbounded (slow memory leak) and every broadcast
  keeps trying to `send_text()` to already-closed sockets.
- Secondary bug: `disconnect()` mutates the `connections` list while `broadcast_to_room()` is
  iterating the same structures, risking `RuntimeError: list/dict changed size during iteration`
  when a send failure triggers cleanup mid-broadcast.

**Note:** The emergency and mustering modules use their own managers, so the Phase-1 safety
paths are unaffected — but any feature wired to this generic `manager` leaks.

**Fix:** Make `disconnect()` synchronous (it does no real awaiting except the notify-broadcast,
which should be fire-and-forget), iterate over a copied list, and schedule the leave-notice via
`asyncio.create_task()`.

---

### 🟠 D4 — Login: user-enumeration timing oracle + username-only lockout DoS + Redis fail-open

**File:** `api/auth.py:22-71, 112-190`.

- `verify_password` (bcrypt, ~100 ms) runs **only when the user exists**; an unknown username
  returns almost instantly. The response-time difference is a reliable oracle for enumerating
  valid accounts before brute-forcing.
- Lockout is keyed by **username only** (`login_lockout:<username>`), so an attacker who knows a
  username can lock that user out for 15 minutes on demand — a targeted denial-of-service against
  named personnel (e.g. the OIM).
- `_check_lockout` / `_record_failed` depend on Redis and silently no-op on Redis failure →
  during a Redis outage, brute-force is unlimited (compounds D3).

**Fix:** Always run a dummy bcrypt comparison on unknown usernames (constant-time response);
add an IP-scoped lockout counter alongside the username one; emit an alert when the lockout
backend is unreachable.

---

### 🟡 D5 — Security headers: HSTS/CSP/Referrer-Policy missing despite config

**File:** `main.py:262-266`.

`SecurityHeadersMiddleware` emits only `X-Content-Type-Options` and `X-Frame-Options`.
`SECURE_HSTS_SECONDS` exists in `config.py` but is **never applied**. There is no
`Content-Security-Policy` (so no defense against injected/stored XSS), no `Referrer-Policy`,
no `Permissions-Policy`. nginx may add HSTS at the edge, but CSP is absent end-to-end.

**Fix:** Emit `Strict-Transport-Security` from `SECURE_HSTS_SECONDS` when `ENVIRONMENT ==
production`; add a baseline `Content-Security-Policy` and `Referrer-Policy: strict-origin-when-cross-origin`.

---

### 🟡 D6 — Single global advisory-lock id `42` serializes all mustering starts

**File:** `services/mustering_service.py:87-90`.

`pg_try_advisory_xact_lock(42)` uses **one hardcoded constant for the entire mustering
subsystem**. Two genuinely independent muster events (e.g. different platforms or unrelated
zones) can never start concurrently — the second caller is rejected even though there is no real
conflict. Worse, `42` is a magic number: if any other feature ever takes advisory lock 42, the
two silently contend. The lock is correct for *preventing duplicate events*, but it is too
coarse and undocumented.

**Fix:** Derive the lock key from a namespaced hash (e.g. `hashtext('muster:' || :scope_key)`)
so unrelated events don't serialize, and keep a central registry of advisory-lock namespaces.

---

### 🟡 D7 — `end_mustering_event` mixes atomic increments with an absolute overwrite

**File:** `services/mustering_service.py:237-248`.

During an event, counters are updated with atomic server-side increments
(`_adjust_counters`, lines 43-51 — correct). But `end_mustering_event` does a separate
`get_event_headcount()` read and then **absolute-writes** `event.total_safe = headcount[...]`.
A punch that lands between the read and the `commit()` (status is flipped to "completed" in the
same uncommitted transaction) can be clobbered. The window is small and the event is closing,
but mixing increment and overwrite semantics on the same columns is fragile.

**Fix:** Compute the final headcount in a single `UPDATE ... FROM (SELECT ...)` under the same
transaction, or re-read counts after the status flip is committed.

---

## STRENGTHS CONFIRMED ON DEEPER READ (balance)

These looked risky from a grep but are actually well-built — worth recording so they aren't
"fixed" into a regression:

1. **Dynamic SQL is not injectable.** `settings.py:198-206`, `roles.py:178-187`,
   `device_management.py:656-669` all build `SET`/table/column fragments from **code-defined
   allowlists** (literal field names) with **bound `:params`** for values. This is good
   discipline. Recommend extracting a shared `_safe_set_clause(allowed_fields, body)` helper so
   the next developer can't accidentally interpolate a user-supplied key.
2. **Login lockout exists** (5 attempts / 15-min, Redis-backed) — stronger than the Round-1
   write-up implied. D4 refines it rather than contradicting it.
3. **File upload is path-traversal-safe** — `file_upload.py` validates extension against an
   allowlist and stores under a **server-generated** name (`{personnel_id}_{uuid}{ext}`); the
   user filename is never used for the on-disk path.
4. **Rate-limiter Lua `INCR`+`EXPIRE` is genuinely atomic** (`rate_limiter.py:60-66`) — no
   TTL-less-key race. The *design* of the counter is sound; only its *wiring* (D3) is broken.

---

## Priority of New Findings

| # | Finding | Severity | Effort | Gate go-live? | Status |
|---|---|---|---|---|---|
| D2 | Reset token usable as access token | 🔴 Critical | 30 min | **Yes** | ✅ Fixed |
| D3 | Rate limiter off for auth + spoofable | 🔴 High | 1–2 hr | **Yes** | ✅ Fixed |
| D1 | WS disconnect() never awaited (leak) | 🟠 High | 1 hr | Recommended | ✅ Fixed |
| D4 | Login enumeration + lockout DoS | 🟠 Med-High | 1–2 hr | Recommended | ✅ Fixed |
| D5 | HSTS/CSP headers missing | 🟡 Medium | 1 hr | First week | ✅ Fixed |
| D6 | Global advisory-lock 42 | 🟡 Medium | 2 hr | First sprint | ⚠️ Downgraded* |
| D7 | end-event counter overwrite race | 🟡 Low-Med | 1 hr | First sprint | ✅ Fixed |

\* **D6 downgraded after deeper inspection:** the system intentionally enforces a single
active mustering event at a time, which makes the global advisory lock *correct*, not buggy.
There is also only one advisory lock in the entire codebase (no collision). Action taken:
named the magic constant `_MUSTER_START_LOCK_ID = 42` with a registry comment so no future
code reuses it. No behavioural change.

---

## IMPLEMENTATION LOG (Phase-1b — all applied 2026-06-20)

| # | Change | Files |
|---|---|---|
| D2 | Reset token now carries `type=password_reset`; both biotime tokens stamped `type=access`; `verify_token` + `get_current_user` + `/auth/refresh` enforce a **type allowlist** (only `access` authenticates) | `core/security.py`, `core/dependencies.py`, `api/biotime_auth.py`, `api/auth.py` |
| D3 | Per-path **auth rate limit** wired from `RATE_LIMIT_AUTH_*`; client IP now from **X-Real-IP / rightmost XFF** (spoof-resistant); general limit kept at proven 1000/min | `core/rate_limiter.py` |
| D1 | `ConnectionManager.disconnect()` made **synchronous** (was async-never-awaited → leak); iterate over list copies; leave-notice is fire-and-forget | `core/websocket.py` |
| D4 | Dummy-bcrypt on unknown users (**timing-oracle** defense); **per-IP** lockout added alongside username; Redis-down now logs `ERROR` instead of silent fail | `api/auth.py` |
| D5 | **HSTS** (production, from `SECURE_HSTS_SECONDS`) + baseline **CSP** now emitted | `main.py` |
| D6 | Magic `42` → named `_MUSTER_START_LOCK_ID` + advisory-lock registry comment | `services/mustering_service.py` |
| D7 | `end_mustering_event` now **commits the status flip first**, then computes/persists the final headcount — closes the punch-overwrite window | `services/mustering_service.py` |

All eight modified files pass `ast.parse`. Regression tests added in
`backend/tests/test_auth_hardening.py` (D2 + D3 + D4).
