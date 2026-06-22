# Apex POB — Integrations (Business Central & SeamlessHR)

> How to configure and **test** the HR/finance integrations. Both push **daily attendance**
> (computed, shift-aware) so HR/finance can process payroll. Both are **admin-only**, store
> credentials **encrypted**, run a **nightly sync**, and are **idempotent** (each employee-day
> is sent at most once → no double-pay).

---

## Shared behaviour
- Configure under **Settings → Integrations** (Business Central / HR Integration).
- Source of truth = computed attendance (`att_report` via `attendance_export.build_daily_attendance`) — door swipes don't inflate hours; cross-midnight shifts handled.
- **Nightly sync** runs automatically for the previous (finalised) day.
- **Idempotency:** each `(employee, date)` is recorded once sent (`bc_synced_records` / `hr_synced_records`); re-runs skip already-sent records. Not-yet-finalised days (today) are skipped by default.
- **Buttons:** *Test Connection*, *Sync Yesterday*, **Force re-sync** (bypasses idempotency to fix a failed/partial sync — may duplicate; use sparingly).
- Every run is recorded in the sync log (visible in the UI status banner: last sync, records sent, time).

---

## Microsoft Business Central

**Auth:** OAuth 2.0 client-credentials (Azure AD / Microsoft Entra ID).
**Endpoint model:** posts `timeRegistrationEntries` per employee-day to the selected company.

### Prerequisites (Azure)
1. In the organisation's Azure tenant, create an **App Registration**.
2. Grant the **Dynamics 365 Business Central** API permission (application permission) and **grant admin consent**.
3. Create a **client secret**.
4. In Business Central, ensure the App Registration is registered and the employees exist (matched by **employee number** = Apex `emp_code`).

### Configure in Apex POB (Settings → BC Integration)
- **Tenant ID**, **Client ID**, **Client Secret**, **Environment** (e.g. `Production`).
- Click **Test Connection** → it authenticates and lists companies → **select your company**.
- Enable the integration.

### Test (do before trusting payroll)
1. **Test Connection** → expect "Connected — N company/companies found".
2. **Sync Yesterday** (or pick a past date) → check the result and the BC `timeRegistrationEntries` for that company.
3. Confirm hours (`quantity`) match expected and that **no duplicate** entries appear on a second run (idempotency).

> Note: Apex sends only standard fields (`employeeNumber`, `date`, `quantity`, `status`). It does **not** send an `idempotencyKey` (BC rejects unknown fields); idempotency is enforced on the Apex side.

---

## SeamlessHR

**Auth:** API key (Bearer or custom header).
**Endpoint model:** posts attendance clock-records in batches.

> ⚠️ The default endpoint paths/payload are based on a common REST pattern and **must be confirmed against SeamlessHR's actual API docs + a sandbox** before trusting payroll output.

### Configure in Apex POB (Settings → HR Integration)
- **API Base URL** (https only — enforced), **API Key**, **Organisation ID** (if required).
- **Auth Header** (usually `Authorization` → Bearer), **Attendance Endpoint**, **Employee Endpoint** (configurable so you can match SeamlessHR's real paths without a code change).
- Enable the integration.

### Test
1. **Test Connection** → hits the employee endpoint; expect HTTP 200. (401 = bad key; 403 = org/permissions; 404 = wrong base URL/path.)
2. **Sync Yesterday** for a past date → confirm SeamlessHR received the records in the expected shape.
3. If the payload/field names differ from SeamlessHR's API, adjust the endpoint config; if the **structure** differs, a small code change in `services/seamlesshr_service.py` may be needed — flag to the dev team.

---

## Security notes
- Credentials are **encrypted at rest** (`core/crypto.py`).
- Outbound URLs are validated: **https-only** + **SSRF guard** (no private/loopback/metadata addresses).
- All sync endpoints require **admin/global-admin**.

## Troubleshooting
| Symptom | Likely cause |
|---|---|
| BC: "Token request failed" | Wrong tenant/client/secret, or admin consent not granted |
| BC: entries rejected (HTTP 400) | Employee number not in BC, or company not selected |
| SeamlessHR: 401/403 | API key or Organisation ID wrong |
| "All records already synced" | Idempotency — already sent; use **Force re-sync** only to correct |
| Nothing sent for today | By design — payroll syncs the **finalised** previous day |
