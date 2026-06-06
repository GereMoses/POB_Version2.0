MASTER PROMPT FOR CODE AGENT: POB_version2.0 Refactor → BioTime Alignment + Mustering + Onboarding + Emergency
Role: You are a senior full-stack engineer + DevOps. You will refactor the existing POB_version2.0 codebase WITHOUT deleting core files, WITHOUT creating duplicate files, and WITHOUT introducing mock/hardcoded data. Goal: production-ready parity with ZKTeco BioTime 9.5 + new modules for Mustering, Personnel Onboarding, Emergency Security. All ZKTeco readers connect via ADMS PUSH protocol.

Current Stack & Constraints

Infra: Docker Compose. Postgres DB. Backend: port 8001. Frontend: port 3000.
Status: ∼80% built but misaligned. Issues: duplicate files/features, wrong API shapes vs BioTime, missing UI tabs/submodules, auth bugs, UI misalignment, some mock data.
Non-negotiables:
Do NOT destroy existing working logic. Refactor in place. Merge duplicates, don’t fork.
Do NOT create mock/hardcoded data. Seed real DB data via migrations/seeders only for testing.
All APIs must match BioTime 9.5 REST + ADMS PUSH semantics.
System goes to production next. Security, RBAC, audit, backups must be correct.
1. Target Architecture & Modules
Replicate BioTime 9.5 structure, then extend:

Code
1. Dashboard: Real-time Monitoring, Attendance Summary, Device Status, Pending Requests, Mustering Headcount, Emergency Banner
2. Personnel: Employee, Department, Position, Area, Resignation, Custom Attributes, Onboarding Checklist, Contractor/Vendor, Document Vault
3. Device: Device List, Area, Device Commands, Real-time Monitor, Firmware, Emergency Devices
4. Attendance: Timetable, Shift, Schedule, Holiday, Leave, Overtime, Attendance Rules, Manual Log, Transaction, Reports
5. Access Control: Time Zone, Access Levels, Door Settings, Real-time Events, Interlock, Anti-passback, Emergency Lockdown
6. Payroll: Salary Structure, Attendance Items, Formula, Calculation, Reports
7. Visitor: Registration, Visit Records, Blacklist, Reports
8. Meeting: Meeting Room, Application, Attenders, Reports
9. MTD: Real-time Monitor, Dashboard, Transaction, Report, Configuration
10. Mustering: Zone, Event, Real-time Headcount, Evacuation Progress, Drill Reports
11. Emergency: Lockdown Trigger, Siren/Strobe Control, Mass Notification WhatsApp/Email, Mustering Mode for Readers
12. System: User & Role, Parameters, Email/WhatsApp Config, Operation Log, DB Backup/Restore, Security Settings, API Tokens
13. Report: Attendance, AC, Personnel, Device, Mustering, Emergency, Audit
14. Mobile/ESS: Geofencing, Leave Apply, Approval, Clock-in, Emergency Check-in

9 lines hidden
2. Database Schema Alignment
Use PostgreSQL. Keep existing tables if names differ, but migrate to BioTime naming where possible. No data loss.

Core BioTime tables to enforce:

SQL
personnel_employee(id serial PK, emp_code varchar(20) UNIQUE NOT NULL, first_name varchar(20), last_name varchar(25) NOT NULL, dept_id int FK, area_id int FK, position_id int FK, hire_date date, birthday date, sex char(1), photo varchar(255), card_no varchar(20), pwd varchar(20), status smallint DEFAULT 0);
personnel_department(id serial PK, dept_code varchar(20), dept_name varchar(50) NOT NULL, parent_id int FK);
personnel_area(id serial PK, area_code varchar(20), area_name varchar(50) NOT NULL);
iclock_terminal(id serial PK, sn varchar(20) UNIQUE NOT NULL, alias varchar(50), ip_address varchar(15), area_id int FK, last_activity timestamp, state smallint, comm_key varchar(20), fw_ver varchar(20));
iclock_transaction(id bigserial PK, emp_code varchar(20) NOT NULL, punch_time timestamp NOT NULL, punch_state smallint, verify_type smallint, work_code int, terminal_sn varchar(20), area_alias varchar(50), upload_time timestamp DEFAULT now());
att_timetable, att_shift, att_schedule, att_leave -- per BioTime
acc_level, acc_userauthorize, acc_door -- AC
auth_user(id serial PK, username varchar(150) UNIQUE NOT NULL, password varchar(128) NOT NULL, is_superuser boolean DEFAULT false, last_login timestamp);
auth_role, auth_permission, base_operationlog

4 lines hidden
New tables for extensions:

SQL
mustering_zone(id serial PK, name varchar(50) NOT NULL, capacity int, evac_point varchar(100), zone_type smallint);
mustering_event(id bigserial PK, zone_id int FK NOT NULL, event_type smallint, start_time timestamp NOT NULL, end_time timestamp, status smallint, initiated_by int FK);
mustering_log(id bigserial PK, event_id bigint FK NOT NULL, emp_code varchar(20) NOT NULL, check_time timestamp NOT NULL, device_sn varchar(20), status smallint DEFAULT 0); -- 0=missing,1=safe,2=injured
onboarding_task(id serial PK, emp_id int FK NOT NULL, task_name varchar(100) NOT NULL, doc_path varchar(255), status smallint DEFAULT 0, due_date date, approved_by int FK, approved_time timestamp);
emergency_device(id serial PK, terminal_sn varchar(20) FK, device_type smallint, zone_id int FK, status smallint, last_heartbeat timestamp);
Task: Write Alembic/Django migrations to add missing tables/columns. Create FK indexes. Remove duplicate tables by merging data first, then drop.

3. API Structure - Must Match BioTime 9.5 + Extensions
Base: http://backend:8001/api/
Auth: JWT. Endpoint: POST /api-token-auth/ with username, password → {"token": "..."}. All other endpoints require Authorization: JWT <token>.

Implement these BioTime endpoints exactly:

Code
GET    /personnel/api/employees/             ?search=&dept_id=&page=
POST   /personnel/api/employees/             Create/Update employee
GET    /personnel/api/employees/{id}/
DELETE /personnel/api/employees/{id}/
GET    /attendance/api/transactions/         ?emp_code=&start_time=&end_time=
POST   /attendance/api/manual-log/           {emp_code, punch_time, punch_state}
GET    /iclock/api/terminals/                List devices
POST   /iclock/api/terminals/                Add device {sn, alias, ip_address, area_id, comm_key}
POST   /iclock/api/devcmd/                   {sn, cmd: "REBOOT" | "DATA UPDATE USERINFO..." | "CHECK"}
POST   /attendance/api/accrual-balance/      {emp_code, leave_type, balance}

5 lines hidden
ADMS PUSH Endpoints - Device initiated, no auth:

Code
GET  /iclock/cdata?SN={sn}&options={options}     Device posts heartbeat + attendance. Parse and insert into iclock_transaction. Return "OK".
GET  /iclock/getrequest?SN={sn}                  Device polls for commands. Return plain text: "C:1:DATA UPDATE USERINFO PIN=1\tName=John\n" or "NONE".
POST /iclock/devicecmd?SN={sn}                   Device returns command result. Body: "ID=1&Return=0".
New endpoints for POB_version2.0:

Code
POST /mustering/api/events/                      Start mustering: {zone_id, event_type}
GET  /mustering/api/events/{id}/headcount/       Real-time {total, safe, missing, injured}
POST /emergency/api/lockdown/                    {action: "lock_all" | "unlock_all", zones: []}
GET  /onboarding/api/tasks/                      ?emp_id=&status=
POST /onboarding/api/tasks/                      Create task
Rules:

No endpoint may return mock data. If no data, return [] or 404.
All timestamps UTC in DB, convert to local in UI.
Pagination: ?page=1&page_size=50. Default 50.
Audit: Every POST/PUT/DELETE writes to base_operationlog.
4. Authentication & Security Fixes
Remove all hardcoded users. Default admin created by migration only if auth_user empty: username admin, force password change on first login.
RBAC: Implement auth_role + auth_permission. Roles: Superuser, Registrar, Dept Manager, Employee ESS, Mustering Officer, Emergency Admin.
Device Auth: Validate SN + comm_key on /iclock/cdata and /getrequest. Reject if mismatch.
JWT: Expire 8h. Add refresh endpoint /api-token-refresh/.
Encrypt backups: base_safesetting must not store plaintext. Use Fernet.
Rate limit ADMS endpoints: 60 req/min per SN to prevent DOS.
CORS: Allow only http://localhost:3000 and prod domain.
5. Frontend UI Alignment
Framework: Assume React/Vue. Port 3000.

Remove duplicate pages/components. If Employee.js and Personnel.js both exist, merge into Personnel/EmployeeList.jsx + EmployeeForm.jsx.
Implement exact tab structure from Section 1. Use nested routes: /personnel/employee, /personnel/department, /device/terminals, /mustering/events.
Dashboard: Add widgets: Device Status pie, Real-time punches table via WebSocket /ws/punches/, Mustering Headcount, Emergency Banner shown when mustering_event.status=active.
Tables: All use server-side pagination, search, sort. No client-side mock arrays.
Forms: Use API schema. Validate before POST. Show backend errors.
Styling: Fix misalignment. Use grid system. Responsive. No em dashes.
6. Docker & Env
docker-compose.yml: Services: db, backend, frontend, nginx. Backend exposes 8001, frontend 3000, nginx 80.
Env vars: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, DJANGO_SECRET_KEY, JWT_SECRET, ADMS_PORT=8081. No secrets in code.
Healthchecks: backend: curl -f http://localhost:8001/api/health/, db: pg_isready.
7. Data Seeding for Testing - No Mock
Create seed.py or Django fixture. Runs only if tables empty. Seeds:

1 Area: "Main Site"
1 Dept: "Operations"
2 Employees: real names, unique emp_code
1 Device: sn="TEST123456", comm_key="0", ip="192.168.1.201"
1 Shift + Timetable
1 Mustering Zone
Do NOT seed attendance. Use device simulator or actual reader.
8. ADMS Device Testing
Configure reader: Menu → COMM → Cloud Server → Server: <docker-host-ip>, Port: 8081 or use nginx proxy 80→8001.
Backend must accept TCP on 8081 or via nginx. Log all /iclock/cdata hits.
Test flow: Device pushes → iclock_transaction row created → WebSocket pushes to Dashboard.
9. Definition of Done
docker-compose up brings all services green.
Can login with admin, JWT works, RBAC enforced.
Can add device via UI, device shows Online after ADMS connect.
Punch on device appears in iclock_transaction < 2s and Dashboard.
All 14 modules visible, no 404, no duplicate menu items.
/api/personnel/api/employees/ matches BioTime response shape.
Start Mustering Event → all readers switch to muster mode → scans populate mustering_log → headcount updates live.
Emergency Lockdown API locks all doors via devcmd.
No console errors, no hardcoded data, no duplicate files.
pytest or equivalent: 90% coverage on API + ADMS endpoints.
Execute plan:
Step 1: Audit repo, list duplicates.
Step 2: DB migrate to target schema.
Step 3: Fix Auth + RBAC.
Step 4: Align APIs to spec.
Step 5: Refactor UI tabs/components.
Step 6: Implement Mustering/Emergency.
Step 7: Seed + test ADMS.
Step 8: Harden + docs.

Output a PR summary of changes, files touched, and test evidence for each DoD item. Do not proceed until you confirm understanding of "no duplicates, no destruction, no mock data".