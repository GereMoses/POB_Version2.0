# Apex POB — Product Overview

> Stakeholder-facing overview of what **Apex POB** does.
> Apex POB is an enterprise **Personnel-On-Board, access-control and emergency-mustering**
> platform for oil & gas operations, built around ZKTeco biometric readers that connect
> over the internet/4G from sites across the country.
> Deployed for **Marconi.ng EPC Limited**.

---

## What problem it solves
Knowing **exactly who is on site at any moment** — for safety (emergency mustering),
security (access control), and workforce/payroll (attendance) — across multiple,
geographically distributed locations whose readers connect over mobile networks.

## Who uses it
- **OIM / Site managers** — live headcount, zone occupancy, situational awareness
- **HSE / Safety officers** — mustering, emergency response, compliance
- **Security** — access control, door events, visitor management
- **HR / Payroll** — attendance, departments, payroll export to HR/finance systems
- **System administrators** — devices, zones, users/roles, integrations

## Core modules

| Module | What it does |
|---|---|
| **POB Dashboard** | Live "Personnel On Board" headcount, location breakdown (offshore/onshore/transit), today's in/out flow, trends, and a live activity feed. Bento-grid UI with modern charts. |
| **Zones** | Live operational map (interactive, markers per zone showing live occupancy) + zone cards/table, GPS map, and per-zone personnel. |
| **Mustering & Emergency** | Emergency activation (fire/gas), real-time muster roll-call, safe/missing tracking, drills, siren/notification triggers, live muster map. |
| **Attendance (T&A)** | Shift/break-aware attendance computed from biometric punches; daily reports; corrections. |
| **Access Control** | Door/reader entry-exit, real-time access events, anti-passback, access levels, zones↔doors. |
| **Devices (ADMS)** | Auto-discovery and management of ZKTeco readers, online/offline status, ADMS configuration, remote commands, firmware. |
| **Personnel & Departments** | Employee records, department assignment with live headcount, on-board status, photos/badges. |
| **Visitor Management** | Visitor pre-registration, kiosk check-in/out, QR codes, blacklist, mustering inclusion. |
| **Payroll** | Attendance-driven payroll, payslips, reports; export to Business Central / SeamlessHR. |
| **Meetings** | Room booking, check-in/out, equipment. |
| **Reports & Analytics** | POB/attendance/compliance/mustering reports, PDF/CSV export, AI analytics assistant (ARIA). |
| **Integrations** | Microsoft **Business Central** (time entries to finance) and **SeamlessHR** (attendance to payroll). |

## Key capabilities & differentiators
- **Distributed readers over 4G** — readers at remote sites push data to a central server via the ADMS protocol (no site-to-site VPN required).
- **Real-time everything** — live occupancy, mustering and access events stream to the browser over WebSockets.
- **Safety-grade mustering** — fast, accurate roll-call during emergencies with safe/missing status.
- **Accurate, shift-aware attendance** — door swipes don't inflate hours; cross-midnight shifts handled.
- **Enterprise security** — JWT + MFA, role-based access control, encrypted secrets, TLS, full audit trail.
- **HR/Finance integration** — automated, idempotent (no double-pay) export of attendance to Business Central and SeamlessHR.
- **White-labelled** — branded Apex POB, deployed per operator (e.g., Marconi).

## High-level architecture (non-technical)
A central cloud/server runs the application; biometric readers across sites connect to it over the internet/4G; managers and staff use it through a web browser (desktop and mobile) over secure HTTPS. Full technical detail: see `ARCHITECTURE.md` and `docs/TRD_ApexPOB.md` (if produced).

## Status
In production-readiness; deployed for Marconi.ng EPC Limited. Outstanding go-live items and operational details are in `docs/GOLIVE_HANDOVER.md`.
