---
title: "Apex POB — Product Requirements Document (PRD)"
subtitle: "Personnel-On-Board, Access Control & Emergency Mustering Platform"
author: "Apex POB — prepared for Marconi.ng EPC Limited"
date: "As-built, 2026-06"
---

# Apex POB — Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | Apex POB |
| **Operator / Client** | Marconi.ng EPC Limited |
| **Document type** | Product Requirements Document (as-built) |
| **Version** | 2.0 |
| **Status** | In production-readiness |
| **Audience** | Product owners, stakeholders, QA, engineering |

> **About this document.** Apex POB is already built and deployed. This PRD is an
> *as-built* requirements specification: it documents the product's intent, scope and
> functional requirements as actually delivered, to serve as the agreed baseline for
> acceptance, audits, onboarding and future phases. Where a statement is a decision the
> business should ratify rather than a fact of the code, it is marked **[Confirm]**.

---

## 1. Executive summary

Apex POB is an enterprise platform that answers one safety-critical question in real time —
**"exactly who is on site right now, and where?"** — for oil & gas operations whose people
and biometric readers are distributed across multiple locations connected over the internet/4G.

It unifies five concerns that are usually separate systems:

1. **Personnel-On-Board (POB)** headcount and location.
2. **Access control** (who went through which door, when).
3. **Emergency mustering** (fast, accurate roll-call during fire/gas events).
4. **Time & Attendance** (shift-aware hours from biometric punches).
5. **Workforce administration & payroll integration** (HR/finance export).

The platform is delivered as a web application (desktop + mobile) backed by a central server
that ZKTeco biometric readers reach via the ADMS push protocol.

## 2. Problem statement & background

Operators must account for every person on a site at any instant — for emergency response
(mustering), security (access control), and workforce/payroll. Existing approaches fail when:

- Readers are at **remote sites on different mobile networks**, with no site-to-site VPN.
- "Attendance" logs mix **access-control door swipes** with real clock-in/out, inflating hours.
- Headcount is **stale or manual**, which is dangerous during an emergency.
- Attendance must reach **HR/finance systems** without double-paying.

Apex POB addresses these with central ADMS ingestion, a single computed source of attendance,
live real-time dashboards, and idempotent HR/finance integrations.

## 3. Goals & success metrics

| # | Goal | Success metric **[Confirm targets]** |
|---|---|---|
| G1 | Accurate live POB headcount | POB count reflects reality within seconds of a punch |
| G2 | Fast, reliable mustering | Full site roll-call status available in < 1 minute of activation |
| G3 | Correct attendance | Computed hours match shift reality; access swipes excluded |
| G4 | Reliable remote readers | Remote readers stay online via ADMS over 4G; offline detected ≤ 90s |
| G5 | No payroll double-pay | Each employee-day exported at most once to HR/finance |
| G6 | Secure, auditable | All sensitive actions audited; encrypted secrets; TLS; RBAC |

## 4. Personas & roles

| Persona | Needs |
|---|---|
| **OIM / Site Manager** | Live POB, zone occupancy, situational awareness, drill oversight |
| **HSE / Safety Officer** | Mustering, emergency activation, missing-person tracking, compliance |
| **Security Officer** | Access events, door control, visitor management, blacklist |
| **HR / Payroll Officer** | Attendance, departments, payroll, export to BC/SeamlessHR |
| **System Administrator** | Devices/readers, zones, users & roles, integrations, settings |
| **Employee / Visitor** | Badge in/out; visitor self check-in |

Access is governed by **role-based access control (RBAC)**; administrative and integration
functions require admin / global-admin.

## 5. Scope

### In scope
POB dashboard; zone management & live map; mustering & emergency; time & attendance; access
control; device (ADMS) management; personnel & departments; visitor management; payroll &
payslips; reports & analytics (incl. AI assistant); HR/finance integrations (Business Central,
SeamlessHR); user/role administration, MFA, audit; notifications (email/SMS/WhatsApp/push).

### Out of scope **[Confirm]**
Hardware supply/installation of readers; corporate identity provider/SSO federation beyond
what is configured; financial processing inside BC/SeamlessHR (Apex only exports attendance);
native mobile apps (the web app is mobile-responsive).

## 6. Functional requirements

Requirements use IDs `FR-<MODULE>-n`. Each lists intent, representative user story, and
acceptance criteria (AC).

### 6.1 POB Dashboard (FR-POB)
- **FR-POB-1** Show live total Personnel-On-Board with breakdown by Offshore / Onshore / Transit.
- **FR-POB-2** Show today's check-in / check-out flow and a 30-day attendance trend.
- **FR-POB-3** Show per-location and per-zone occupancy and a live activity feed.
- **FR-POB-4** Surface offline-reader and active-emergency alerts.
- *Story:* *As an OIM, I open the dashboard and immediately see how many people are on board and where.*
- *AC:* count updates after a punch without manual refresh; breakdown sums to total; offline readers banner appears when a reader is down.

### 6.2 Zones (FR-ZONE)
- **FR-ZONE-1** CRUD zones (type, capacity, hazard level, GPS coordinates, parent/sub-zones).
- **FR-ZONE-2** Live interactive map plotting each zone at its coordinates with live occupancy.
- **FR-ZONE-3** Card and table views (toggle) with sort/filter; per-zone personnel list.
- **FR-ZONE-4** Assign/remove readers to zones; reset occupancy.
- *AC:* a person is counted in exactly one zone (latest punch); map auto-fits to configured zones.

### 6.3 Mustering & Emergency (FR-MUS)
- **FR-MUS-1** Activate an emergency from a template (fire/gas), optionally triggering sirens & notifications.
- **FR-MUS-2** Real-time muster roll-call showing Safe vs Missing per muster point.
- **FR-MUS-3** Drill scheduling and post-event reports (response times).
- **FR-MUS-4** Safety alert if a muster reader goes offline during an active event.
- *Story:* *As an HSE officer, on activation I see the live count of who has reached a muster point and who is still missing.*
- *AC:* punches at muster readers update safe/missing within seconds; missing list is accurate to the POB.

### 6.4 Time & Attendance (FR-ATT)
- **FR-ATT-1** Compute shift- and break-aware attendance from biometric punches.
- **FR-ATT-2** Exclude access-control door swipes from worked hours.
- **FR-ATT-3** Attribute cross-midnight/night shifts to the correct business day.
- **FR-ATT-4** Daily attendance views, corrections, and export.

### 6.5 Access Control (FR-ACC)
- **FR-ACC-1** Record door entry/exit events in real time.
- **FR-ACC-2** Configure access levels, anti-passback, zone↔door mapping.
- **FR-ACC-3** Feed zone occupancy from entry/exit readers.

### 6.6 Devices / ADMS (FR-DEV)
- **FR-DEV-1** Auto-register readers on first ADMS contact; show online/offline status.
- **FR-DEV-2** Configure reader purpose (Attendance/Access-Entry/Access-Exit/Mustering), zone, comm key.
- **FR-DEV-3** UI-editable ADMS server address (no restart); per-reader connection mode (adms/direct/both).
- **FR-DEV-4** Remote commands, firmware, network diagnostics.
- *AC:* remote reader set to `adms` stays online on push alone; offline detected within ~90s.

### 6.7 Personnel & Departments (FR-PER)
- **FR-PER-1** CRUD employees with department assignment, photo, badge, contractor/company.
- **FR-PER-2** Department view shows **live personnel count** and member list.
- **FR-PER-3** On-board status maintained automatically from check-in/out.

### 6.8 Visitor Management (FR-VIS)
- **FR-VIS-1** Pre-register visitors; kiosk/desk check-in/out; QR codes; blacklist.
- **FR-VIS-2** Include visitors in mustering where configured.

### 6.9 Payroll (FR-PAY)
- **FR-PAY-1** Attendance-driven payroll and payslip generation; reports.
- **FR-PAY-2** Export attendance to Business Central and SeamlessHR (see 6.11).

### 6.10 Reports & Analytics (FR-RPT)
- **FR-RPT-1** POB / attendance / compliance / mustering reports with PDF/CSV export.
- **FR-RPT-2** AI assistant (ARIA) for natural-language operational queries.

### 6.11 Integrations (FR-INT)
- **FR-INT-1** Business Central: OAuth 2.0; push daily computed attendance as time entries.
- **FR-INT-2** SeamlessHR: configurable REST; push daily attendance clock-records.
- **FR-INT-3** Idempotent export — each (employee, date) sent at most once; admin force/re-sync.
- **FR-INT-4** Test-connection, nightly schedule, and per-sync audit log.

### 6.12 Administration & Security (FR-ADM)
- **FR-ADM-1** User & role management (RBAC); MFA.
- **FR-ADM-2** Settings: branding, ADMS address, integrations, notification channels.
- **FR-ADM-3** Audit log of sensitive actions.

## 7. Non-functional requirements (summary)

Detailed NFRs are specified in the **TRD**. Headlines:

- **Security:** TLS for users; JWT + MFA; RBAC; encrypted secrets; SSRF-guarded integrations; audit.
- **Reliability/Safety:** real-time updates; offline-reader detection; idempotent payroll export.
- **Performance:** dashboards responsive at site scale; live updates within seconds.
- **Availability/DR:** containerised deployment; automated DB backups; monitoring & alerting.
- **Usability:** responsive web UI (desktop + field/mobile).

## 8. Assumptions, dependencies, constraints

- Readers are **ZKTeco** models supporting the **ADMS push** protocol; many connect over 4G.
- A central server is reachable from reader networks (public IP / DDNS + port-forward 80/443).
- Readers push over **HTTP on port 80** (devices generally cannot do TLS).
- BC integration requires an **Azure AD app registration** with Dynamics 365 BC permission. **[Confirm]**
- SeamlessHR payload/endpoints require the vendor's **API documentation + sandbox** to finalise. **[Confirm]**

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Dynamic public IP breaks readers | Use DDNS hostname; UI-editable ADMS address |
| Reader clock drift poisons data | Server time-sync command; implausible-timestamp rejection |
| Double-pay on HR/finance export | Record-level idempotency + finalised-day guard |
| Access swipes inflating hours | Attendance computed from a single, reader-purpose-aware source |
| Vendor API mismatch (SeamlessHR) | Config-driven endpoints; validate against sandbox before go-live |

## 10. Release & phasing **[Confirm]**

- **v2.0 (current):** full module set above, production hardening, BC + SeamlessHR integration scaffolding.
- **Next:** vendor-validated integrations, DDNS/Let's-Encrypt TLS, feature-test-suite restoration, optional native push.

## 11. Acceptance & sign-off

Acceptance is based on the functional requirements above plus the go-live checklist in
`docs/GOLIVE_HANDOVER.md`. A UAT report **[Confirm — to be produced]** should record each
FR as Pass/Fail with evidence, signed by the operator's representative.

## 12. Glossary

| Term | Meaning |
|---|---|
| **POB** | Personnel On Board — people currently on site |
| **ADMS** | ZKTeco push protocol used by readers to send data to the server |
| **Muster** | Emergency assembly / roll-call |
| **Reader purpose** | Role of a reader: Attendance / Access-Entry / Access-Exit / Mustering |
| **RBAC** | Role-Based Access Control |
| **Idempotent** | Re-running a sync does not duplicate records |
| **BC** | Microsoft Dynamics 365 Business Central |
