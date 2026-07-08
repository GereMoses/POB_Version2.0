# Apex POB — Data Governance & SeamlessHR Integration Design

**Project:** Marconi.NG EPC POB & Mustering (MARC/SA/69/2026)
**Prepared for:** Netcom Africa Limited follow-up review
**Prepared by:** Tekktopia
**Status:** Draft for review · Version 0.2 (adds Appendix A — SeamlessHR API alignment)
**Addresses walkthrough actions:** #2, #3, #4, #5, #8, #15

---

## 1. Purpose

The 7 July walkthrough agreed one governing principle: **SeamlessHR is the single source of truth for employee master data.** Apex POB consumes that data read‑only and only *creates* records for people who do **not** exist in SeamlessHR (contractors, visitors, other third parties).

This document (a) states the master‑data rule precisely, (b) reports the **current implementation status** of the integration honestly, and (c) specifies the target design so the remaining build can be estimated and signed off. It is the prerequisite for Sprint 3.

---

## 2. Current implementation status (as‑built)

State stated plainly per the §5.1 working principle — **implemented / partial / not started**:

| Capability | Status | Evidence in code |
|---|---|---|
| SeamlessHR connector, **config‑driven** (no code change to onboard) | ✅ Implemented | `hr_integration_config.options` (JSONB); connector reads field/endpoint mapping from config |
| Attendance **pull** from SeamlessHR | ✅ Implemented | `seamlesshr_service.py` (`_build_attendance_records`, `_log_sync`) |
| Personnel **sync** scaffolding | 🟡 Partial | `biotime_external_integration.sync_personnel_from_sap()` iterates SHR personnel and syncs |
| Conflict **detection** | 🟡 Partial | a `conflicts[]` list is built during sync |
| Conflict **resolution** | ⚠️ Wrong model | `_resolve_personnel_conflict()` = *"Simple conflict resolution: prefer newer data"* — **last‑write‑wins**, the approach the client **rejected** |
| **Read‑only** enforcement on SHR‑sourced records | 🔴 Not started | employee create/edit is fully open in Apex today |
| **Person‑type at entry** (employee vs contractor vs visitor) | 🔴 Not started | no gate distinguishing SHR vs local persons at creation |
| **Business Central** vendor pool | 🟡 Partial | BC connector exists (`bc_integration_config.options`); not wired as the vendor source of truth |
| Employee code/ID consistency with biometric hardware | ✅ Implemented | `emp_code` is the identity key across personnel, `iclock_transaction`, and device enrolment |

**Bottom line:** the *plumbing* (config‑driven connectors, attendance pull, identity key) exists; the *governance* (read‑only, user‑prompted conflict resolution, three‑pool person creation) does not. That governance is the Sprint‑3 build.

---

## 3. Target architecture — three person pools

Every person in Apex POB originates from exactly one authoritative source, chosen by **person type at entry**:

| Pool | Source of truth | Created / edited in | In Apex POB |
|---|---|---|---|
| **Employees** | SeamlessHR (API) | SeamlessHR only | Read‑only mirror |
| **Vendors / Contractors** | Microsoft Business Central (API) | Business Central only | Read‑only mirror |
| **Visitors & other third parties** | Apex POB (local) | Apex POB | Read/write |

- A **person‑type selector** appears at record creation. Selecting *Employee* or *Vendor* routes to a **lookup/import** from the owning system rather than a blank form. Selecting *Visitor/Other* opens the local form.
- This removes the burden of maintaining employee name/title changes inside Apex POB (§5.1) — those flow in from SHR.

---

## 4. Source‑of‑truth (master‑data) rule

**Rule:** for any field, the **owning system** wins. Apex POB never overwrites an owning system's field.

| Data domain | Owner | Apex POB role |
|---|---|---|
| Employee identity, name, title, department, position, grade | SeamlessHR | Read‑only |
| Employee contract, leave, shifts, schedules, overtime | SeamlessHR | Read‑only (pulled) |
| Departments, positions | SeamlessHR | Read‑only (pulled) |
| Vendor/contractor company & personnel | Business Central | Read‑only |
| Visitors & third parties | Apex POB | Read/write |
| **POB status, on‑board/rotation, mustering, access events, attendance punches** | **Apex POB** | **Read/write (operational domain)** |
| Biometric enrolment (fingerprint/face templates) | Apex POB / device | Read/write |

**Consequence for the audit trail (action #1):** once employees are read‑only, employee‑record *changes* in Apex are driven by the SHR sync. The audit therefore records **sync deltas** (old → new pulled from SHR) plus edits to **local** persons — see §8.

**Locally defined shifts** may exist only as a *supplementary* option layered on top of the SHR‑pulled shifts, never replacing them (§5.1).

---

## 5. Sync model

- **Direction:** pull only. Apex POB never pushes employee master changes back to SHR.
- **Identity key:** `emp_code`, kept identical to SHR **and** to the biometric hardware user id, so attendance and access events reconcile. IDs must not diverge (§5.1).
- **Cadence:** scheduled pull (configurable) + on‑demand "Sync now" from Settings → HR Integration.
- **Lifecycle mapping:**
  - *New in SHR* → create read‑only mirror in Apex; queue biometric enrolment.
  - *Updated in SHR* → update mirror; record audit delta; **do not** prompt (SHR is authoritative).
  - *Removed / deactivated in SHR* → deactivate mirror; auto‑revoke access (aligns with the existing 30‑day contract‑expiry revocation).
- **Import (first load / reconciliation):** this is where **conflict detection** applies — see §6.

---

## 6. Conflict detection & resolution (replaces last‑write‑wins)

The current `_resolve_personnel_conflict()` auto‑prefers newer data. **This is replaced** by user‑prompted resolution on the **import / reconciliation** path (ongoing scheduled syncs remain automatic, SHR‑wins).

**Detection triggers a review when, for a matched person:**
1. one or more mapped fields differ between the existing Apex record and the incoming SHR record; or
2. a probable **duplicate** is detected (same name/DOB/ID but different `emp_code`, or a locally‑created person that matches an SHR employee).

**Resolution UX (import wizard):**
- A **Conflicts** step lists each affected person with a per‑field **old (Apex) vs new (SHR)** comparison.
- For field differences: default selection = SHR value (source of truth), with the reviewer able to confirm or annotate.
- For duplicates: the reviewer **merges** the local record into the SHR employee (preserving the operational history — punches, POB, mustering — under the retained `emp_code`) or marks them as genuinely distinct.
- Nothing is applied until the reviewer confirms; every decision is written to the audit trail (who, when, old → new).

---

## 7. Read‑only enforcement (action #2)

Applied consistently platform‑wide:
- **API layer:** write endpoints for SHR‑sourced entities (employees, leaves, shifts, schedules, overtime, departments, positions) reject mutations on records flagged `source = 'seamlesshr'` (and vendors flagged `source = 'business_central'`). A single source flag per record drives this.
- **UI layer:** forms for those records render read‑only with a "Managed in SeamlessHR" banner and a deep link; the person‑type gate (§3) prevents creating employees locally.
- **Module rationalization (Sprint 1, done):** Payroll, Benefits, MTD and Contractor/Vendor are already hidden from the front end; the routes remain for read‑only back‑end visibility.

---

## 8. Audit trail alignment (action #1)

The audit infrastructure records **who + old → new** per changed field (implemented Sprint 2 on the primary personnel‑edit path via `base_operationlog` / per‑person audit). Under this governance model it must additionally capture:
- **sync deltas** — each field the SHR pull changes, attributed to the sync (actor = "SeamlessHR sync"), and
- **conflict decisions** — the reviewer's per‑field choices at import.

Remaining employee write paths (`update_employee`, status/location endpoints) are wired to the same audit helper as a follow‑up.

---

## 9. Rollout / migration

1. Confirm SHR API access + the **field‑ownership map** (which SHR fields map to which Apex fields).
2. Run a **reconciliation import** against existing Apex employees → resolve conflicts/duplicates via the wizard (§6).
3. Flip resolved employees to `source = 'seamlesshr'` (read‑only).
4. Repeat for vendors against Business Central.
5. Enable scheduled pull; monitor the first cycles from Settings → HR Integration → Sync history.

---

## 10. Open decisions (needed to finalise & estimate)

| # | Decision | Owner | Blocks |
|---|---|---|---|
| D1 | SeamlessHR **sandbox `x-client-id` / `x-client-secret`** to enumerate the full employee schema and confirm the field map (see Appendix A) | Netcom / Client | #2, #4, #5, #15 |
| D2 | Confirm conflict‑resolution UX (per‑field prompt as in §6) | Netcom + Tekktopia | #3 |
| D3 | Which entities are pulled read‑only vs. allowed as local supplements (shifts?) | Client | #2 |
| D4 | Business Central API access for the vendor pool | Netcom / Client | #8 |
| D5 | Duplicate‑match rule (which fields define "same person") | Netcom + Tekktopia | #3 |

---

## 11. Action‑register mapping

| Action | Covered by | Effort (post‑sign‑off) |
|---|---|---|
| #4 Define & document SoT rule + confirm status | This document | Done (doc) |
| #2 Read‑only SHR‑sourced records platform‑wide | §7 | L |
| #3 Conflict‑detection prompt on import | §6 | M–L |
| #5 Restrict local creation to non‑SHR persons + person‑type selector | §3 | M |
| #8 Vendor pool via Business Central | §3, §4 | M–L |
| #15 Connect Contracts to SHR employee data | §4, §5 | M |

---

## Appendix A — SeamlessHR API alignment (researched July 2026)

Sourced from the official SeamlessHR API docs (`docs.seamlesshr.com`). The public reference exposes the endpoints and identity fields but **not the full employee field schema** — a sandbox credential is required to enumerate it (see the checklist at A.6).

### A.1 API facts
| | |
|---|---|
| Base URLs | Production `https://api.seamlesshr.app` · Sandbox `https://api-sandbox.seamlesshr.app` · version prefix `/v1/` |
| Auth | Custom request headers **`x-client-id`** + **`x-client-secret`** (not OAuth / bearer); provisioned by SeamlessHR support |
| Transport | REST / HTTPS, JSON |
| Change feed | **Polling only** — no webhooks documented, and **no "updated-since" filter** (only `date` = *creation* date, plus employment/exit-date ranges) |
| Pagination | `?page=` + `?limit=` (default 10); `q` searches firstname / lastname / employee_code / email |

### A.2 Endpoints we consume
- **Employees:** `GET /v1/employees`, `GET /v1/employees/{id}`, `PUT /v1/employees/{id}`, `…/activate`, `…/deactivate`, `…/exit`
- **HRIS masters (pull read-only):** `GET /v1/departments`, `GET /v1/job-roles` (designations → positions), `GET /v1/contract-types`
- Adjacent groups: `/v1/leave`, `/v1/payroll`, `/v1/performance` (leave is the read-only entity of interest)

### A.3 Identity alignment (the linchpin)
> **SeamlessHR `employee_code` ≡ Apex `emp_code` ≡ ZKTeco device user id.**

If these three agree, the employee table is a clean read-only mirror. If Apex auto-generated its own `emp_code`s for locally-created staff, those become duplicate/merge cases at the reconciliation import (§6, decision D5).

### A.4 Field mapping (SHR → Apex `personnel`)
| SeamlessHR | Source | Apex field | Owner |
|---|---|---|---|
| `employee_code` | /v1/employees | `emp_code` (join key) | SHR |
| `firstname` / `lastname` | /v1/employees | `first_name` / `last_name` | SHR |
| `email`, `phone` | /v1/employees | `email`, `phone` | SHR |
| department | /v1/departments | `department` / `department_id` | SHR |
| job-role / designation | /v1/job-roles | `position` | SHR |
| `employment_date` | /v1/employees | `hire_date` | SHR |
| `exit_status` / `exit_date`, activate/deactivate | /v1/employees + …/exit | `is_active` (+ auto-revoke access) | SHR |
| contract-type | /v1/contract-types | Contracts module | SHR |
| gender, DOB, nationality, ID / passport, grade | /v1/employees/{id} | `nationality`, `id_number`, `passport_number`, … (confirm on probe) | SHR |
| — (not in SHR) | — | `is_onboard`, `current_location`, `current_zone_id`, `pob_since`, `badge_id`, biometric templates, mustering / attendance | **Apex (operational)** |

**Ownership split:** SeamlessHR owns *who they are*; Apex POB owns *where they are and whether they're safe*.

### A.5 Alignment / finetuning actions
1. Add a `source` column to `personnel` (`seamlesshr` / `business_central` / `local`) to drive read-only enforcement (§7) — no such column exists today (`personnel_type` may carry the pool distinction).
2. Pull `departments` + `job-roles` from SHR **before** employees, so Apex stores SHR IDs, not free text.
3. **Verify `emp_code` == device user id** on the ZKTeco readers — the highest-risk item; misalignment breaks attendance reconciliation.
4. Sync engine: full paginated pulls + local diff (no updated-since / webhooks); use `date` / `exit_date` filters to catch new / exited employees.
5. Write to `personnel` and let the existing `sync_personnel_to_employee()` DB trigger mirror to `personnel_employee`.

### A.6 Sandbox-probe checklist (run once credentials arrive — decision D1)
1. Obtain sandbox `x-client-id` / `x-client-secret` from SeamlessHR support.
2. `GET {sandbox}/v1/employees?limit=1` → capture the **full JSON of one employee** and enumerate every field + type.
3. `GET {sandbox}/v1/employees/{id}` → confirm any extra fields on the single-employee object.
4. `GET /v1/departments`, `/v1/job-roles`, `/v1/contract-types` → capture their id / name shapes.
5. Confirm the response envelope + pagination meta (total / last_page).
6. Compare a sample of `employee_code`s against the emp_codes enrolled on the readers.
7. Finalise the §A.4 mapping and populate the connector's `options` JSONB config — no code change needed to onboard (the connector is config-driven).

**Sources:** docs.seamlesshr.com — /reference/introduction, /reference/authentication, /reference/api-structure, /reference/fetch-employees, /llms.txt

---

*End of design — v0.2. Once D1–D5 are answered, this converts into a build plan with firm estimates for Sprint 3.*
