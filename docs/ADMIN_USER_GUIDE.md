# Apex POB — Admin & User Guide

> How to operate Apex POB, module by module. For administrators and day-to-day users.
> Access the system at your deployment URL (e.g. `https://<your-server>`), sign in with
> your username and password (admin sets up accounts; MFA may be required).

---

## Getting started
1. **Sign in** at the deployment URL. First-time admin must change the default password immediately (see Go-Live doc).
2. Top bar shows live status (online/offline), notifications, and your account.
3. Navigation is by module in the sidebar.

## Personnel & Departments
- **Add an employee:** Personnel → New → fill details and **assign a Department** (this sets the department link; the department's headcount updates live).
- **Departments:** Departments shows each department with its **live personnel count** and the list of assigned staff. Counts come from each employee's department assignment.
- **On-board status** is set automatically by biometric check-in/out; you can also check in/out manually on a personnel record.

## Devices (ADMS readers)
- **Add a remote reader:** on the reader's keypad go to **Comm → Cloud Server / ADMS** → set **Server Address** to your server's public address, **Port 80**, **HTTPS/Domain OFF**. It auto-registers and appears under Devices.
- **Approve / assign:** set the reader's **Zone** and **Reader Purpose** (Attendance / Access Entry / Access Exit / Mustering).
- **Connection mode:** remote readers must be **`adms`** (pull-only `direct`/`both` is for same-LAN readers). Wrong mode causes the reader to flap offline.
- **Server address** is editable in the UI (Zones → ADMS settings / Devices → Auto-Register) — no restart needed.

## Zones
- **POB Dashboard tab:** a live interactive map with a marker per zone showing live personnel-on-board; click a marker or tile to drill in. Switch basemap (Light / Street / Satellite, top-right).
- **Zones tab:** card or table view (toggle) of all zones with occupancy, capacity, hazard level; create/edit/delete zones, assign readers.
- **Reset occupancy:** if a zone shows phantom occupants, use Reset Occupancy on that zone.

## Mustering & Emergency
- **Start a muster / emergency:** Emergency → activate the relevant template (fire/gas), which can trigger sirens and notifications and open a live muster.
- **Roll-call:** personnel punch at muster-point readers; the muster board shows **Safe vs Missing** in real time.
- **Drills:** schedule and run drills; reports capture response times.
- Safety alerts fire if a muster reader goes offline during an active event.

## Attendance (T&A)
- Attendance is computed automatically from biometric punches (shift- and break-aware).
- View daily attendance, correct records, and export. Access-control door swipes are not counted as work hours.

## Access Control
- Real-time door events; configure access levels, anti-passback, zone↔door mapping.
- Entry/exit readers feed both access logs and zone occupancy.

## Visitors
- Pre-register visitors, check in/out (kiosk or desk), issue QR codes, manage blacklist. Visitors are included in mustering where configured.

## Reports & Analytics
- Generate POB / attendance / compliance / mustering reports; export PDF/CSV.
- **ARIA** AI assistant answers operational questions across modules.

## Integrations (admin)
- **Business Central** and **SeamlessHR** are configured under **Settings → Integrations**.
- Each has **Test Connection**, a nightly automatic sync, **Sync Yesterday**, and **Force re-sync** (use only to correct a failed/partial sync — it can duplicate).
- Full setup/troubleshooting: `docs/INTEGRATIONS.md`.

## Administration
- **Users & roles:** create accounts in the admin area; assign roles (RBAC controls what each role can see/do); enable MFA.
- **Settings:** branding, ADMS server address, integrations, notification channels (SMTP/SMS).
- **Audit log:** all sensitive actions are recorded.

## Tips & troubleshooting (users)
- **Reader offline?** Check it's powered and its ADMS server/port is correct; confirm `connection_mode = adms` for remote readers.
- **A graph is empty?** Some charts depend on data being captured (e.g., verification-method requires the reader to report verify mode).
- **Hard refresh** (Cmd/Ctrl+Shift+R) after an update to load the latest UI.
