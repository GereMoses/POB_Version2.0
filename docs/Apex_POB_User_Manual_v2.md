---
title: "Apex POB — User Manual"
subtitle: "Personnel-On-Board, Access Control & Emergency Mustering Platform"
author: "Marconi.ng EPC Limited"
date: "Version 2.0 — July 2026"
---

# Apex POB — User Manual

**Personnel-On-Board · Access Control · Emergency Mustering**
Prepared for **Marconi.ng EPC Limited**
Version 2.0 · July 2026

---

## About this manual

This manual describes how to use **Apex POB**, the platform that tells you **exactly who is on site at any moment** — for safety (emergency mustering), security (access control) and workforce attendance — across multiple, geographically distributed locations whose biometric readers connect over the internet/4G.

It covers the modules that are **in the agreed scope of work**. Human-resources functions such as leave and payroll are handled in **SeamlessHR** (the HR system of record) and are therefore not covered here; Apex POB integrates with SeamlessHR so that employee records flow in and attendance flows out automatically.

**Who should read this**

| Role | Primary modules |
|---|---|
| OIM / Site manager | POB Dashboard, Zones, Reports |
| HSE / Safety officer | Mustering & Emergency, Reports |
| Security | Access Control, Visitor Management, Devices |
| Time & Attendance officer | Attendance, Personnel |
| System administrator | Devices, Users & Roles, Settings, Integrations, Database |

---

## Table of contents

1. Introduction & key concepts
2. Getting started (access, login, two-factor, navigation)
3. POB Dashboard
4. Zones & Live Map
5. Personnel & Departments
6. Devices (ADMS Readers)
7. Access Control
8. Time & Attendance
9. Mustering & Emergency
10. Visitor Management
11. Reports, Analytics & Custom Report Builder
12. Integrations (Business Central & SeamlessHR)
13. Administration & Security
14. Appendix — roles, glossary, troubleshooting

---

## 1. Introduction & key concepts

Apex POB is an enterprise **Personnel-On-Board (POB)** platform built around **ZKTeco biometric readers**. Readers at each site read a person's fingerprint/face/card and send that "punch" to the central Apex POB server. From that stream of punches, Apex POB maintains a live picture of who is present, where they are, and — during an emergency — who has reached safety.

A few terms used throughout:

- **POB (Personnel On Board)** — the people currently checked in on site.
- **Punch / transaction** — a single read at a reader (a check-in, check-out, access, or muster event).
- **Reader / device / terminal** — a ZKTeco unit. Each reader has a **purpose**: *Attendance*, *Access-Entry*, *Access-Exit*, or *Mustering*.
- **Zone** — a defined area (e.g., an offshore platform, a building, a muster point). A person is counted in exactly one zone based on their latest punch.
- **Muster point** — the safe area people evacuate **to** during an emergency; its headcount is what confirms who is safe.
- **ADMS** — the protocol readers use to *push* data to the server over the internet/4G (no site-to-site VPN needed).

**How data flows**

```
ZKTeco readers  ──(ADMS push over 4G)──▶  Apex POB server  ──▶  Web app (browser, desktop & mobile)
   employee records ◀── SeamlessHR (HR master)      attendance ──▶ SeamlessHR / Business Central
```

---

## 2. Getting started

### 2.1 Accessing the system

Open a web browser (Chrome, Edge, or Safari — desktop or mobile) and go to the address provided by your administrator, for example:

- On the office/site network: `https://<server-ip>`
- Remotely (via secure tunnel): `https://<your-company-hostname>`

> **Tip:** If you see a certificate warning on the internal IP address, that is expected for the on-site address; choose **Advanced → Proceed**. The remote hostname uses a fully trusted certificate.

### 2.2 Logging in

1. Enter your **username** and **password**.
2. Click **Sign in**.
3. If two-factor authentication (2FA) is enabled on your account, you will be asked for a **6-digit code** from your authenticator app — enter it and continue.

Your accounts and passwords are created by your administrator. Passwords must be strong (minimum 12 characters, mixing upper/lower case, digits and symbols).

### 2.3 Enabling two-factor authentication (recommended)

1. Go to **Settings → Security**.
2. Turn on **Two-Factor Authentication**.
3. Scan the displayed **QR code** with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy).
4. Enter the current 6-digit code to confirm. 2FA is now active; you'll be asked for a code at each login.

> **Important:** Keep your authenticator app safe. If you lose access, an administrator can reset your 2FA so you can re-enrol.

### 2.4 Navigating the app

The **main menu** (left sidebar on desktop, menu button on mobile) gives you the modules your role is allowed to see:

- **Dashboard** — live POB overview
- **Personnel** — employee records & departments
- **Attendance** — time & attendance
- **Zones** — live map & occupancy
- **Mustering** / **Emergency** — safety & roll-call
- **Access Control** — doors & access events
- **Devices** — reader management
- **Visitor** — visitor management
- **Reports** — reports, analytics & custom builder
- **Settings** — administration, users, integrations

The **top bar** shows your name, notifications, and a menu to open your **Profile**, **Settings**, or **Log out**. What you can see and do is governed by your **role** (see §13.1).

---

## 3. POB Dashboard

The Dashboard is your at-a-glance operating picture.

**What it shows**

- **Total Personnel On Board**, with a breakdown by **Offshore / Onshore / Transit**.
- Today's **check-in / check-out** flow and a **30-day attendance trend**.
- **Per-location and per-zone occupancy**.
- A **live activity feed** of recent punches.
- **Alerts** — offline readers and any active emergency.

**How to use it**

- The figures update **automatically** after each punch — no refresh needed.
- Click a zone/location tile to drill into that area's personnel.
- If the **offline-reader** banner appears, a reader has stopped reporting — see §6.4.
- If an **emergency** is active, a prominent banner links you straight to the muster roll-call.

> **Tip:** Keep the Dashboard open on a control-room screen for continuous situational awareness.

---

## 4. Zones & Live Map

Zones represent the physical areas you track — platforms, buildings, decks, or muster points.

### 4.1 Viewing zones

- **Live Map** — an interactive map with a marker per zone showing its **live occupancy**. The map auto-fits to your configured zones.
- **Cards / Table** — toggle between a card grid and a sortable/filterable table. Each shows occupancy, reader count, and last activity.
- Click a zone to see the **people currently in it**.

### 4.2 Creating and editing a zone

1. In **Zones**, click **Add Zone**.
2. Enter **name**, **type** (e.g., Location, Muster Point), **capacity**, **hazard level**, and optional **GPS coordinates** (for the map) and **parent zone** (for sub-zones).
3. Save.

To edit, open the zone and click **Edit**. To remove a zone, use **Delete** (the system safely clears its references first).

### 4.3 Assigning readers to a zone

1. Open the zone → **Readers** tab.
2. Click **Assign Reader** and choose an available reader.
3. Save. Punches at that reader now count towards this zone.

### 4.4 Resetting occupancy

If a zone shows people who have clearly left (e.g., stale check-ins), use **Reset Occupancy** on the zone to check everyone out of it. A system-wide reset and scheduled auto-checkout are also available in **Settings → Database** (see §13.7).

> **Rule:** A person is only ever counted in **one** zone — the one for their **most recent** punch.

---

## 5. Personnel & Departments

> **Note:** When SeamlessHR is connected, **SeamlessHR is the master** for employee records. Employees are pulled into Apex POB and their core details (name, ID, department, status) become **read-only** here; changes made in SeamlessHR reflect automatically. This prevents any mismatch of names or IDs when attendance is sent back to SeamlessHR.

### 5.1 Viewing personnel

- **Personnel** lists all employees with photo, ID/badge, department, contractor/company, and **On-Board** status.
- Use **search** and **filters** (department, status, on-board) to find people.
- Open a person to see their profile, zone history, and attendance.

### 5.2 Adding or editing a person

- If SeamlessHR is **not** the master, click **Add Personnel**, complete the form (name, employee code, department, photo, badge, contractor/company), and save.
- If SeamlessHR **is** the master, add/edit employees in SeamlessHR; they appear here automatically. Fields sourced from SeamlessHR are marked read-only.

### 5.3 Departments

- **Departments** show a **live personnel count** and the member list.
- On-board status is maintained **automatically** from check-in/out — no manual update needed.

---

## 6. Devices (ADMS Readers)

The Devices module manages the ZKTeco readers across all your sites.

### 6.1 Reader status

Each reader shows **Online / Offline**, last activity, IP, serial number, firmware, assigned zone, and **purpose**. Offline is detected within roughly 90 seconds of a reader going quiet.

### 6.2 Adding / auto-discovering readers

- **Remote readers** connect by pushing over **ADMS** to the server's public address. On first contact they **auto-register** and appear in the list (if auto-registration is enabled).
- **Local readers** on the site LAN can be **auto-discovered** by a network scan, or added manually by IP.

### 6.3 Configuring a reader

Open a reader and set:

- **Purpose** — *Attendance*, *Access-Entry*, *Access-Exit*, or *Mustering*. This determines how its punches are used (e.g., access swipes do **not** inflate worked hours).
- **Zone** — which zone it feeds.
- **Connection mode** — `adms` (push only), `direct` (server polls the reader), or `both`. Remote readers should be set to **adms**.
- **Comm key** and other ADMS settings.

### 6.4 When a reader goes offline

- The Dashboard and Devices list flag it.
- Check power and network at the site; confirm the reader's ADMS server address points to Apex POB.
- Use **Network Diagnostics** (Devices) to verify reachability.
- During an **active emergency**, an offline **muster** reader raises a safety alert.

### 6.5 ADMS server address

Administrators can change the **ADMS server address** the readers report to from **Settings** — no server restart required.

---

## 7. Access Control

Access Control governs and records movement through doors, and feeds zone occupancy.

**What it does**

- Records **door entry/exit events** in real time.
- Supports **access levels**, **anti-passback**, and **zone ↔ door** mapping.
- Entry/exit readers **feed occupancy** so the POB count stays accurate.

**How to use it**

- **Access Events** — a live, filterable log of who went through which door and when.
- **Access Levels** — define which people/groups may open which doors.
- **Zone ↔ Door mapping** — associate controller doors with zones so entries and exits update occupancy correctly.

> Access readers are configured in **Devices** with purpose *Access-Entry* or *Access-Exit*.

---

## 8. Time & Attendance

Attendance turns raw biometric punches into accurate, **shift- and break-aware** working time. Access-control door swipes are **excluded** from worked hours, and cross-midnight/night shifts are attributed to the correct business day.

The module is organised into tabs:

### 8.1 Transactions
The raw punch log — every check-in/out with employee, time, reader, and type. Search and filter by date, person, or device.

### 8.2 Timesheet
Computed daily attendance per employee: check-in, check-out, **worked minutes**, **overtime**, and status. This is the authoritative attendance used for exports.

### 8.3 By Area
Attendance grouped by zone/area — useful for site- or contractor-level views.

### 8.4 Exceptions & Manual Logs
- **Exceptions** — days needing attention (missing punch, unusually short/long, etc.).
- **Manual Logs** — add or correct a punch when a reader was down or a check was missed. Corrections are audited.

### 8.5 Shifts, Schedules & Timetables
Define **when** people are expected to work — the rules that turn punches into meaningful attendance and overtime:
- **Timetables** — a working pattern (start/end, breaks, grace).
- **Shifts** — a named shift built from timetables.
- **Schedules** — assign shifts to people/groups over a date range (including rotational patterns).

### 8.6 Overtime & OT Rules
- **Overtime** — computed automatically as time worked beyond the scheduled shift.
- **OT Rules** — how overtime is calculated and capped.

### 8.7 Holidays & Rules
- **Holidays** — the calendar that affects attendance calculation.
- **Rules** — general attendance rules (rounding, lateness thresholds, etc.).

### 8.8 Contractors & Analytics
- **Contractors** — attendance for contractor/vendor staff, with any compliance alerts.
- **Analytics** — attendance trends and summaries.

> **Where attendance goes:** the computed daily attendance — worked minutes **and** overtime — is exported to SeamlessHR (and/or Business Central) for payroll. See §12.

---

## 9. Mustering & Emergency

This is the safety-critical heart of the platform: fast, accurate roll-call during an emergency.

### 9.1 Activating an emergency

1. Go to **Emergency** (or **Mustering**).
2. Choose a **template** (e.g., Fire, Gas).
3. Optionally trigger **sirens** and **notifications** (email/SMS/WhatsApp/push) to personnel.
4. Confirm activation.

On activation, **all POB personnel are flagged as MISSING** and zone occupancy is reset for the muster — everyone must now confirm safe by punching at a **muster point**.

### 9.2 Running the roll-call

- The **live muster roll-call** shows **Safe vs Missing** per muster point.
- As people punch in at a muster reader, they move from *Missing* to *Safe* within seconds.
- The **Missing list** is accurate to the POB — use it to direct search & rescue.
- A **live muster map** shows headcount per muster point.

### 9.3 During the event

- If a **muster reader goes offline** during an active event, a safety alert is raised — deploy a manual check at that point.
- Marshals can use the mobile view to check people in manually where needed.

### 9.4 Ending & reporting

- End the event when everyone is accounted for.
- A **post-event report** captures response times and the safe/missing timeline — available in **Reports**.

### 9.5 Drills

Schedule **drills** the same way as a live activation; drill results (response times, participation) are recorded for compliance.

> **Golden rule:** the Missing list is only as good as the POB — keep readers online and personnel records current (via SeamlessHR sync).

---

## 10. Visitor Management

Manage non-employee visitors and include them in safety headcounts.

**How to use it**

1. **Pre-register** a visitor (name, company, host, expected date). A **QR code** is generated.
2. On arrival, the visitor **checks in** at the kiosk or security desk (scan QR or look up).
3. On departure, **check out**.
4. **Blacklist** blocks specific individuals from entry.
5. Where configured, visitors are **included in mustering** so no one is missed in an emergency.

---

## 11. Reports, Analytics & Custom Report Builder

### 11.1 Standard reports
From **Reports**, generate **POB**, **attendance**, **compliance**, and **mustering** reports. Each can be filtered by date, site/zone, and department, and **exported to PDF or CSV**.

### 11.2 Custom Report Builder
Build your own reports without technical help:
1. Open **Custom Builder**.
2. Choose the data (tables/fields), add **filters**, grouping and sorting.
3. Preview, then **save** or **export** the report.

Use it for bespoke views your standard reports don't cover (e.g., a specific contractor's hours by zone for a period).

---

## 12. Integrations (Business Central & SeamlessHR)

Apex POB exports **computed daily attendance** to your HR/finance systems automatically and idempotently — each (employee, date) is sent **at most once**, so there is never double-counting.

### 12.1 SeamlessHR (HR system of record)
- **Employees flow in:** the employee master is **pulled from SeamlessHR**; changes there reflect automatically in Apex POB (records are read-only here). This is why names/IDs never conflict on export.
- **Attendance flows out:** daily attendance including **worked minutes and overtime** is pushed to SeamlessHR for payroll.
- **Leave:** on-leave status is read from SeamlessHR so attendance doesn't flag on-leave staff as absent.

### 12.2 Microsoft Business Central
- Connects via **OAuth 2.0**; pushes daily computed attendance as **time entries** to finance.

### 12.3 Managing integrations
In **Settings → HR Integration** (and **Business Central**):
- Enter connection details (base URL, credentials/keys, field mappings) — all editable from the UI, no code changes.
- Use **Test Connection** to verify.
- Review the **per-sync audit log**; run a **manual/force re-sync** if needed.
- A **nightly schedule** performs the routine export automatically.

---

## 13. Administration & Security

Administrator functions live under **Settings**.

### 13.1 Users & Roles
- **Users** — create accounts, set the person's role, activate/deactivate, reset passwords.
- **Roles & Permissions** — role-based access control (RBAC). Each role grants a set of permissions (e.g., `attendance.view`, `mustering.view`); users only see the modules their role allows. Clone a role to create a variant quickly.

### 13.2 Two-Factor Authentication (MFA)
Each user enables 2FA on their own account (§2.3). Administrators can reset a user's 2FA if they lose their authenticator.

### 13.3 Active Sessions
See where you're currently signed in; **revoke** a session to force sign-out on that device.

### 13.4 Audit Log
A full, searchable trail of significant actions (logins, changes, exports) for compliance and investigations.

### 13.5 Company & Branding
Set the operator name and logo (the platform is white-labelled per operator).

### 13.6 Notifications & Email
Configure the channels used for alerts — **Email (SMTP)**, **SMS**, **WhatsApp**, and **push** — and the addresses that receive system alerts. These power emergency notifications and operational alerts.

### 13.7 Database Backup & Maintenance
- **Database Backup** — automated daily backups plus **Backup Now**; **download**, **upload**, **restore** (with an automatic safety backup taken first), and delete backups. Keep off-site copies for disaster recovery.
- **Database** tab — a live **overview** (size, connections, current POB), **auto-checkout / occupancy reset** (instant, or a scheduled daily job that checks out stale entries after *N* days), **maintenance** (optimise/re-index), **data retention** (purge old records after *N* days), and **integrity self-heal** (find and fix stale/orphaned records).

---

## 14. Appendix

### 14.1 Typical roles & what they see

| Role | Sees |
|---|---|
| Administrator | Everything, including Settings, Users, Devices, Integrations, Database |
| OIM / Site manager | Dashboard, Zones, Personnel (view), Reports |
| HSE / Safety | Mustering & Emergency, Reports, Dashboard |
| Security | Access Control, Visitor, Devices, Dashboard |
| T&A officer | Attendance, Personnel (view), Reports |

(Exact visibility depends on the permissions assigned to each role in **Settings → Roles**.)

### 14.2 Glossary

| Term | Meaning |
|---|---|
| POB | Personnel On Board — who is currently on site |
| Punch / transaction | A single read at a reader |
| Reader / device / terminal | A ZKTeco biometric unit |
| Reader purpose | Attendance / Access-Entry / Access-Exit / Mustering |
| Zone | A tracked area; a person is in exactly one zone |
| Muster point | The safe area people evacuate to |
| ADMS | Protocol readers use to push data over the internet/4G |
| Anti-passback | Prevents a badge being re-used to tailgate |
| RBAC | Role-Based Access Control |
| MFA / 2FA | Multi/two-factor authentication |

### 14.3 Troubleshooting

| Symptom | What to check |
|---|---|
| A reader shows **Offline** | Power & network at the site; the reader's ADMS server address; run Network Diagnostics |
| POB count looks **too high** | Stale check-ins — use **Reset Occupancy** on the zone, or **Settings → Database → auto-checkout** |
| A person is **missing** from personnel | Confirm they exist in **SeamlessHR** (the master) and the sync has run |
| **Attendance not reaching** SeamlessHR/BC | Settings → Integrations → **Test Connection**; check the per-sync audit log; **force re-sync** |
| Can't **log in** (asks for a code you don't have) | 2FA is enabled — use your authenticator; if lost, ask an administrator to reset 2FA |

### 14.4 Support

For assistance, contact your Apex POB administrator or the Marconi.ng EPC support contact provided during handover.

---

*End of manual. Apex POB — © Marconi.ng EPC Limited. This document covers the agreed in-scope modules; HR functions (leave, payroll and related) are managed in SeamlessHR.*
