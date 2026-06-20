# SeamlessHR Integration — Deep Analysis

**Scope:** `services/seamlesshr_service.py`, `api/hr_integration.py`, the
`_seamlesshr_nightly_sync_loop` in `main.py`, `models/integrations.py`, and the ADMS
ingestion path that feeds `iclock_transaction`.

**Bottom line:** The transport/plumbing is well-built (async httpx, batching, sync logging,
config-driven, admin-gated). But the **attendance data it sends to payroll is computed from
the wrong source by a naive algorithm**, and there is **no idempotency** — the two together
mean this integration can over-pay and double-pay offshore personnel. The same defects exist
verbatim in the Business Central integration, which pushes to actual finance.

These are **payroll-accuracy / money** bugs, not crashes — which makes them more dangerous,
because they fail silently and look successful in `hr_sync_log`.

---

## 🔴 HIGH — Payroll Correctness

### SHR-1. Access-control door swipes are sent to payroll as work hours

**Files:** `seamlesshr_service.py:114-124` (the query), `adms_protocol.py:371-399` (the ingest).

`_build_attendance_records()` pulls **every** `iclock_transaction` row for the day:

```sql
SELECT t.emp_code, t.punch_time, t.punch_state
FROM iclock_transaction t
WHERE t.punch_time::date = :d ...
```

But `iclock_transaction` is **not** a pure timeclock log. The ADMS handler writes a T&A row
for **ACCESS_ENTRY / ACCESS_EXIT readers too** (door swipes), with `punch_state` forced to
0/1:

```python
# adms_protocol.py — for ACCESS_ENTRY/EXIT readers:
txn = IClockTransaction(emp_code=..., punch_state=forced_state, ...)  # 0=entry, 1=exit
db.add(txn)
```

The terminal model even has a `reader_purpose` column (`ATTENDANCE | ACCESS_ENTRY |
ACCESS_EXIT`) precisely to distinguish them — **but the SeamlessHR builder never filters on
it.** So a worker who badges through accommodation, galley, and module doors all day produces
`iclock_transaction` rows that the builder reads as clock-in/clock-out:

- `clock_in`  = earliest door swipe (e.g. 06:00, entering the accommodation block)
- `clock_out` = latest door swipe (e.g. 22:40, leaving the rec room)
- `total_minutes` = ~16 h — regardless of the actual 12 h shift.

**Impact:** Systematic over-statement of hours on any site that uses access-control readers —
which is every site (this *is* an access-control/POB product). For payroll this is direct
financial loss. It also violates the project's own rule (memory: *"Zones = access control /
POB only; Areas = T&A; never mix them"*) — the builder mixes them.

**Correct source:** The codebase already has `attendance_calculation_service`, which respects
shifts, timetables, breaks, `reader_purpose`, and cross-midnight rules. The HR/BC exporters
should send the **computed daily attendance** from that engine, not raw punches.

---

### SHR-2. No idempotency — a re-run or partial retry double-posts attendance

**File:** `seamlesshr_service.py:176-264`.

`push_attendance()` builds records and POSTs them. Nothing records *which* records were already
sent: no idempotency key in the payload, no `synced_at` marker on `iclock_transaction`, no
unique `(employee, date)` guard. Consequences:

- Manual re-run of a date (`POST /sync` with the same `sync_date`) sends the whole day again.
- A `partial` sync (some batches failed) re-sends **all** batches when retried (see SHR-7).
- A backend restart near the sync minute can fire the nightly run twice (SHR-8).

If SeamlessHR does not itself dedupe on `(employee_id, date, source)`, every re-send creates a
**duplicate clock record → duplicate payroll hours.** The `source: "POB_BIOMETRIC"` field is the
only dedup hint, and it is not a key.

**Fix:** Add an idempotency key per record (e.g. `f"{emp}-{date}"`) and send it in a header/field
SeamlessHR can dedupe on; and/or stamp exported rows so the same `(emp, date)` is never built
twice.

---

### SHR-3. Cross-midnight / night shifts are mis-attributed

**File:** `seamlesshr_service.py:114-171`.

The single `punch_time::date = :d` filter means a punch only counts on the calendar day it
occurred. For a 22:00→06:00 offshore night shift:

- **Day D sync:** sees the 22:00 check-in but the 06:00 check-out is on day D+1 → `clock_out`
  is `None` or the wrong same-day punch → hours wrong or zero.
- **Day D+1 sync:** sees the 06:00 check-out and treats it as a **check-in** (first punch of
  the day) → a phantom shift starting at 06:00.

Offshore rotations routinely include 12 h nights, so this is not an edge case. The
`attendance_calculation_service` shift logic handles cross-midnight; the raw-punch exporter
does not.

---

## 🟠 MEDIUM

### SHR-4. Timezone: UTC day-boundary + naive wall-clock times
`punch_time` is `timestamptz`; `punch_time::date` is evaluated in the DB session timezone
(UTC). On a non-UTC platform the "day" is cut at UTC midnight, splitting the local workday.
The emitted `clock_in`/`clock_out` are `%H:%M:%S` strings with **no timezone** — SeamlessHR
receives wall-clock times whose day boundary was computed in a different zone. Decide on the
facility timezone and apply it consistently to both the boundary and the emitted times.

### SHR-5. API key stored in plaintext at rest
`hr_integration_config.api_key = Column(String(500))` — plaintext. Masking in `GET /config`
is display-only; anyone with DB read access or a backup file reads the live key. Encrypt with
Fernet (key from env/KMS), decrypt only in `get_config()`. (Same as Round-1 finding C7; the BC
`client_secret` has the same exposure.)

### SHR-6. SSRF + no TLS enforcement on the admin-set base URL
`api_base_url` is fully operator-settable and the **real bearer API key is sent to whatever
URL is configured**, with no validation that it is (a) HTTPS or (b) not a private/link-local
address. A duped or compromised admin can point it at `http://…` (key sent in cleartext) or at
`http://169.254.169.254/…` / internal services (SSRF, with `test_connection` leaking
reachability). Validate scheme == https and reject RFC-1918 / link-local / loopback hosts.

### SHR-7. Partial failure resends the entire day
On `partial` status there is no record of *which* batches failed, so any retry resends all
records — compounding SHR-2. Track per-batch / per-record success and retry only failures.

### SHR-8. Nightly scheduler relies on an exact minute match
**File:** `main.py:583-593`. The loop runs only when `now.hour == sync_h and now.minute ==
sync_m`, checked every 60 s. If a tick is delayed (GC, a blocking call, load) the exact minute
is skipped and **that day's sync never runs**. Conversely, a restart inside that minute can run
it twice (compounds SHR-2). Use a "due and not-yet-run-today" window:
`now >= scheduled_time and last_run_date != today`.

### SHR-9. No retry / backoff / alert on failure
A failed nightly sync simply waits until the next day; there is no retry, no escalation, no
operator notification. For payroll-critical data, a silent multi-day gap is a real risk. (Round-1
H5.) Move to a Celery task with `max_retries` + a critical `sys_notification` on final failure.

---

## 🟡 LOW

- **SHR-10.** `total_minutes` is the gross in→out span with no break deduction — paid breaks if
  SeamlessHR trusts the field.
- **SHR-11.** A worker who forgets to check out gets `clock_out = None` / `total_minutes =
  None` (0 hours) with no anomaly flag — silent under-pay, the inverse of SHR-1.
- **SHR-12.** `get_config()` returns `None` on **any** exception (`except Exception`), so a
  transient DB error is indistinguishable from "not configured" and the sync silently no-ops.
- **SHR-13.** Config save is `DELETE` + `INSERT` in one transaction (OK), but there is no
  unique constraint enforcing the single-row assumption the readers rely on (`LIMIT 1`); a
  stray second row would be silently ignored.

---

## ✅ Strengths (confirmed)

1. **Non-blocking HTTP** — uses a shared `httpx.AsyncClient`, unlike the emergency-notification
   path that blocked the event loop. Good.
2. **Batching** (50 records/request) keeps payloads sane.
3. **Audit trail** — every run is logged to `hr_sync_log` with counts and status.
4. **Config-driven** — endpoints/headers stored in DB, updatable without redeploy.
5. **API key masked** in `GET /config` responses (display layer).
6. **Admin-gated** — all endpoints require `is_superuser`/`is_global_admin`.
7. **Bounded** — the scheduler wraps the push in `asyncio.wait_for(..., 120s)`.

---

## ⚠️ Cross-cutting: Business Central shares SHR-1..SHR-4, SHR-7..SHR-9

`business_central_service._build_time_entries()` uses the **same raw-`iclock_transaction`
first/last-punch logic** (`business_central_service.py:220-237`) with the same `punch_time::date`
boundary and no `reader_purpose` filter. Because BC posts to finance/payroll directly, the
fixes below should be applied to **both** exporters — ideally by extracting a single
`build_daily_attendance(db, date)` that reads from `attendance_calculation_service`.

---

## Recommended Fix Order

| # | Fix | Why first | Effort |
|---|---|---|---|
| 1 | **SHR-1** — build from computed attendance (filter `reader_purpose='ATTENDANCE'` at minimum) | Stops over-payment from door swipes | 0.5–1 day |
| 2 | **SHR-2** — idempotency key per `(emp, date)` | Stops double-pay on retry/restart | 0.5 day |
| 3 | **SHR-3 + SHR-4** — shift-aware, timezone-correct day boundary | Correct night-shift hours | 0.5 day |
| 4 | **SHR-6** — https-only + block private IPs on base URL | Prevent key leak / SSRF | 1 hr |
| 5 | **SHR-5** — Fernet-encrypt api_key (and BC secret) | Credentials at rest | 0.5 day |
| 6 | **SHR-8 + SHR-9** — window-based schedule + Celery retry + alert | Reliability | 0.5 day |

**Apply 1–3 to Business Central simultaneously** (shared exporter).

---

## IMPLEMENTATION LOG (applied 2026-06-20)

| # | Status | Change | Files |
|---|---|---|---|
| SHR-1, SHR-3, SHR-4, SHR-10 | ✅ | New shared `build_daily_attendance()` sources from **computed `att_report`** (shift/break/reader_purpose-aware, correct business day). Both exporters now use it instead of raw `iclock_transaction` first/last-punch. | `services/attendance_export.py` (new), `seamlesshr_service.py`, `business_central_service.py` |
| SHR-2 | ✅ | Every exported record carries a stable `pob-{emp}-{date}` **idempotency key** (per-record in SeamlessHR payload, `idempotencyKey` in BC). | both services |
| SHR-5 | ✅ | New `core/crypto.py` Fernet helper (key derived from `SECRET_KEY`, or `INTEGRATION_ENC_KEY`). API key / client secret **encrypted at rest**, decrypted only in `get_config`/`get_bc_config`. **Legacy plaintext is read transparently and upgraded on next save.** | `core/crypto.py` (new), `hr_integration.py`, `bc_integration.py`, both services |
| SHR-6 | ✅ | `validate_integration_base_url()` enforces **https-only** and **blocks private/loopback/link-local/metadata IPs** (SSRF) on SeamlessHR config save. (BC uses fixed Microsoft endpoints — N/A.) | `services/attendance_export.py`, `hr_integration.py` |
| SHR-8 | ✅ | Both nightly loops switched from **exact-minute match → "due-and-not-yet-run-today" window**, seeded from the sync log so restarts don't re-run. A missed tick no longer skips the day; idempotency makes any catch-up safe. | `main.py` |

**Tests:** `backend/tests/test_integration_hardening.py` (crypto round-trip + legacy passthrough,
SSRF/URL rejection, att_report-sourced export, idempotency keys, both payload shapes).
All modified files pass `ast.parse`; crypto + SSRF logic verified standalone.

**Still open (not in this batch):**
- **SHR-7** (retry only failed batches) and **SHR-9** (Celery retry + operator alert on failure)
  — reliability hardening; recommend folding into the Phase-2 Celery migration.
- **SHR-11** (flag forgot-to-checkout anomalies) — now partly mitigated because `att_report`
  marks incomplete days, but no explicit operator alert yet.
- **SHR-12** (`get_config` swallows DB errors as "not configured") — minor; left as-is.
