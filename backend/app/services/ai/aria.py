"""
ARIA — internal knowledge engine
Intent matching → live DB queries → smart response formatters.
Covers every module in the Apex POB.
"""

import json
import re
import logging
from datetime import date, timedelta
from typing import AsyncGenerator, Optional
from sqlalchemy.orm import Session

from .tools import execute_tool

logger = logging.getLogger(__name__)

PROVIDER_INFO = {"provider": "ARIA Internal", "model": "knowledge-base", "free": True}

MONTH_NAMES = {
    'january':'01','february':'02','march':'03','april':'04',
    'may':'05','june':'06','july':'07','august':'08',
    'september':'09','october':'10','november':'11','december':'12',
    'jan':'01','feb':'02','mar':'03','apr':'04','jun':'06',
    'jul':'07','aug':'08','sep':'09','oct':'10','nov':'11','dec':'12',
}


def _extract_date_range(text: str) -> dict:
    """
    Parse a date or date range from natural language.
    Returns {'start_date': 'YYYY-MM-DD', 'end_date': 'YYYY-MM-DD'}.
    """
    t   = text.lower()
    today = date.today()

    def _make(d: date) -> dict:
        return {'start_date': d.isoformat(), 'end_date': d.isoformat()}
    def _range(s: date, e: date) -> dict:
        return {'start_date': s.isoformat(), 'end_date': e.isoformat()}

    # ── Explicit ranges: "from X to Y" / "between X and Y" ────────────────
    range_m = re.search(
        r'(?:from|between)\s+(.+?)\s+(?:to|and|-)\s+(.+?)(?:\s|$|\?|\.)',
        t, re.IGNORECASE
    )
    if range_m:
        d1 = _parse_single_date(range_m.group(1).strip(), today)
        d2 = _parse_single_date(range_m.group(2).strip(), today)
        if d1 and d2:
            return _range(min(d1,d2), max(d1,d2))

    # ── Month + year: "June 2026" → whole month ───────────────────────────
    import calendar as _cal
    for mon_name, mon_num in MONTH_NAMES.items():
        mm = re.search(rf'\b{mon_name}\s+(\d{{4}})\b', t)
        if mm:
            yr = int(mm.group(1))
            mn = int(mon_num)
            last = _cal.monthrange(yr, mn)[1]
            return _range(date(yr, mn, 1), date(yr, mn, last))

    # ── Last N days ────────────────────────────────────────────────────────
    m = re.search(r'last\s+(\d+)\s+days?', t)
    if m:
        n = int(m.group(1))
        return _range(today - timedelta(days=n-1), today)

    # ── Relative keywords ──────────────────────────────────────────────────
    if re.search(r'\byesterday\b', t):
        return _make(today - timedelta(days=1))
    if re.search(r'\btoday\b', t):
        return _make(today)
    if re.search(r'this week|current week', t):
        start = today - timedelta(days=today.weekday())
        return _range(start, today)
    if re.search(r'last week|previous week', t):
        start = today - timedelta(days=today.weekday() + 7)
        return _range(start, start + timedelta(days=6))
    if re.search(r'this month|current month', t):
        return _range(today.replace(day=1), today)
    if re.search(r'last month|previous month', t):
        first = today.replace(day=1)
        end   = first - timedelta(days=1)
        return _range(end.replace(day=1), end)
    if re.search(r'this year|current year', t):
        return _range(today.replace(month=1, day=1), today)

    # ── Single date ────────────────────────────────────────────────────────
    d = _parse_single_date(t, today)
    if d:
        return _make(d)

    # Default: today
    return _make(today)


def _parse_single_date(text: str, today: date) -> date | None:
    """Try to parse a single date from text. Returns None if unparseable."""
    text = text.strip().lower()

    # YYYY-MM-DD
    m = re.search(r'(\d{4})-(\d{2})-(\d{2})', text)
    if m:
        try: return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError: pass

    # DD/MM/YYYY or MM/DD/YYYY
    m = re.search(r'(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{4})', text)
    if m:
        a, b, yr = int(m.group(1)), int(m.group(2)), int(m.group(3))
        # Try DD/MM/YYYY first (common in oil & gas / non-US contexts)
        for day, mon in [(a, b), (b, a)]:
            try:
                if 1 <= mon <= 12 and 1 <= day <= 31:
                    return date(yr, mon, day)
            except ValueError:
                continue

    # DD/MM (current year)
    m = re.search(r'(\d{1,2})[/\-\.](\d{1,2})(?!\d)', text)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        for day, mon in [(a, b), (b, a)]:
            try:
                if 1 <= mon <= 12 and 1 <= day <= 31:
                    return date(today.year, mon, day)
            except ValueError:
                continue

    # "June 6 2026" / "6 June 2026" / "6th June"
    for mon_name, mon_num in MONTH_NAMES.items():
        m = re.search(rf'(\d{{1,2}})\s*(?:st|nd|rd|th)?\s*{mon_name}\s*(\d{{4}})?', text)
        if m:
            day = int(m.group(1))
            yr  = int(m.group(2)) if m.group(2) else today.year
            try: return date(yr, int(mon_num), day)
            except ValueError: pass
        m = re.search(rf'{mon_name}\s+(\d{{1,2}})\s*(?:st|nd|rd|th)?\s*,?\s*(\d{{4}})?', text)
        if m:
            day = int(m.group(1))
            yr  = int(m.group(2)) if m.group(2) else today.year
            try: return date(yr, int(mon_num), day)
            except ValueError: pass

    return None


# ── Intent detection ──────────────────────────────────────────────────────────

def _detect_intents(text: str) -> list:
    t  = text.lower().strip()
    results = []
    dr = _extract_date_range(text)   # always extract dates — passed to every relevant tool

    # Full briefing
    if re.search(r'brief|daily report|morning report|ops report|full report|operations report', t):
        return [('briefing', dr)]

    # Help
    if re.search(r'\bhelp\b|what can you|what do you|capabilities|what can i ask|commands', t):
        return [('help', {})]

    # On-site / who is present
    if re.search(r'on.?site|who.?s (on|here|present)|check.?in|currently (here|in)|who is here|whos in|who is (now|currently|on)', t):
        dept = _extract_dept(text)
        args = {'department': dept} if dept else {}
        results.append(('get_onsite_personnel', args))

    # Attendance report (detailed — uses att_report table)
    if re.search(r'attendance report|late arrival|work hours|ot minutes|early departure|attendance record|attendance for|punch report', t):
        results.append(('get_att_report', dr))
    # Attendance summary (by department)
    elif re.search(r'attendance|punch|present today|absent|who came|came to work|showed up|check.?in today', t):
        results.append(('get_attendance_summary', dr))

    # Personnel list / all employees
    if re.search(r'all (employees|staff|personnel)|list (of )?(employees|staff|personnel)|employee list|staff list', t):
        dept = _extract_dept(text)
        results.append(('get_personnel_list', {'department': dept} if dept else {}))

    # Search by name
    m = re.search(r'(?:find|search|look for|where is|who is|locate)\s+([A-Za-z][A-Za-z\s]{2,30})(?:\?|$|,|\.)', text, re.IGNORECASE)
    if m:
        q = m.group(1).strip()
        if q.lower() not in ('here', 'now', 'today', 'on site', 'online', 'everyone', 'anybody', 'someone'):
            results.append(('search_personnel', {'query': q}))

    # Departments
    if re.search(r'department|division|team list|org chart|organi', t):
        results.append(('get_departments', {}))

    # Positions / roles / job titles
    if re.search(r'\bposition|positions\b|\brole\b|roles\b|job title|grade level', t):
        results.append(('get_positions', {}))

    # Shifts & schedules
    if re.search(r'\bshift|shifts\b|roster|schedule|working hours|timetable', t):
        results.append(('get_shifts', {}))

    # Holidays / calendar
    if re.search(r'holiday|public holiday|calendar|day off|bank holiday', t):
        results.append(('get_holidays', {}))

    # Attendance exceptions
    if re.search(r'exception|late arrival|early departure|anomal.*attend|attendance.*issue', t):
        results.append(('get_att_exceptions', {}))

    # Overtime
    if re.search(r'overtime|over.?time|ot request|extra hours|ot approval', t):
        results.append(('get_overtime', dr))

    # Leave requests
    if re.search(r'\bleave\b|time off|day off|vacation|annual leave|sick leave|absence request|leave request', t):
        results.append(('get_leave_requests', {'status': 'all', **dr}))

    # Leave balance
    if re.search(r'leave balance|remaining leave|leave days|leave entitle', t):
        results.append(('get_leave_balance', {}))

    # Employment contracts
    if re.search(r'contract|employment contract|probation|job contract', t):
        results.append(('get_employment_contracts', {}))

    # Disciplinary
    if re.search(r'disciplin|misconduct|violation|incident report|case report', t):
        results.append(('get_disciplinary', {}))

    # Performance / appraisals
    if re.search(r'performance|appraisal|kpi|rating|review|goal|assessment', t):
        results.append(('get_performance', {}))

    # Resignations / exits
    if re.search(r'resign|resignation|exit|termination|last working day|handover', t):
        results.append(('get_resignations', {}))

    # Training / certifications
    if re.search(r'training|course|certif|induction|mandatory course|enrollment', t):
        results.append(('get_training', {}))

    # Contractors / permits / vendor compliance
    if re.search(r'contractor|vendor|work permit|permit expir|compliance|medical clearance|background check', t):
        days = _extract_days(t, 60)
        results.append(('get_expiring_items', {'item_type': 'all', 'days': days}))

    # Visitors
    if re.search(r'visitor|guest|visit|pre.?regist|blacklist.*visit', t):
        results.append(('get_visitor_summary', dr))

    # Zones
    if re.search(r'\bzone|zones\b|\barea\b|areas\b|muster point|muster zone|how many zone', t):
        if re.search(r'detail|list all|all zone|show zone', t):
            results.append(('get_zones_detail', {}))
        else:
            results.append(('get_zones_summary', {}))

    # Access control
    if re.search(r'access level|access control|door|authorized|permission.*door|who can access', t):
        results.append(('get_access_control', {}))

    # Areas (personnel areas linked to readers)
    if re.search(r'personnel area|reader area|area list', t):
        results.append(('get_areas', {}))

    # Emergency events
    if re.search(r'emergency|fire mode|lockdown|panic|alarm|evacuat', t):
        results.append(('get_emergency_events', {}))

    # Mustering / drills
    if re.search(r'muster|mustering|drill|headcount|roll.?call|assembly', t):
        results.append(('get_mustering', {}))

    # Devices (all device types)
    if re.search(r'device|biometric|zkteco|scanner|reader|terminal|how many reader|device status', t):
        results.append(('get_devices', {}))

    # Transport / helicopter
    if re.search(r'transport|helicopter|heli|chopper|flight|vessel|schedule.*trip|manifest', t):
        results.append(('get_transport', {}))

    # Meeting rooms / bookings
    if re.search(r'meeting room|conference|board room|room booking|room avail', t):
        results.append(('get_meeting_rooms', {}))

    # POB status
    if re.search(r'\bpob\b|personnel on board|offshore|onshore|manning|rotation|platform', t):
        results.append(('get_pob_status', {}))

    # Notifications / alerts
    if re.search(r'notification|alert|unread|system message|subscription|licence', t):
        results.append(('get_notifications', {}))

    # Security anomalies
    if re.search(r'anomal|security alert|suspicious|unusual access|after.?hour|irregular', t):
        results.append(('get_anomaly_alerts', {**dr, 'use_range': True}))

    # Overview / dashboard (fallback or explicit)
    if re.search(r'overview|dashboard|stats|system status|how many|total|number of|summary', t) or not results:
        results.insert(0, ('get_dashboard_stats', {}))

    # Deduplicate
    seen, unique = set(), []
    for item in results:
        if item[0] not in seen:
            seen.add(item[0])
            unique.append(item)
    return unique


def _extract_dept(text: str) -> str | None:
    m = re.search(r'(?:in|from)\s+([A-Za-z][A-Za-z\s]{2,25}?)(?:\s+department|\s+dept|\s+team|$|\?|,)', text, re.IGNORECASE)
    if m:
        d = m.group(1).strip()
        if d.lower() not in ('the', 'a', 'an', 'on', 'at', 'right', 'now', 'here'):
            return d
    return None


def _extract_days(text: str, default: int) -> int:
    m = re.search(r'(\d+)\s*(?:day|days)', text)
    return int(m.group(1)) if m else default


# ── Response formatters ───────────────────────────────────────────────────────

def _fmt_dashboard(d: dict) -> str:
    lines = ["## 📊 System Overview\n"]
    lines.append(f"| Metric | Value |")
    lines.append(f"|---|---|")
    lines.append(f"| Active Employees | **{d.get('total_employees', 0)}** |")
    lines.append(f"| Today's Punches | **{d.get('punches_today', 0)}** unique · {d.get('checkins_today', 0)} check-ins |")
    lines.append(f"| Visitors On-site | **{d.get('visitors_onsite', 0)}** · {d.get('pending_visitor_approvals', 0)} pending approval |")
    lines.append(f"| Active Contractors | **{d.get('active_contractors', 0)}** |")
    lines.append(f"| Pending Leaves | **{d.get('pending_leaves', 0)}** |")
    lines.append(f"| Readers | **{d.get('readers_online', 0)}/{d.get('total_readers', 0)}** online |")
    lines.append(f"| Devices | **{d.get('devices_online', 0)}/{d.get('total_devices', 0)}** online |")
    lines.append(f"| Departments | **{d.get('total_departments', 0)}** active |")
    lines.append(f"| Active Zones | **{d.get('active_zones', 0)}** |")
    lines.append(f"| Mandatory Courses | **{d.get('mandatory_courses', 0)}** |")

    alerts = []
    if d.get('active_emergencies', 0):
        alerts.append(f"🚨 **{d['active_emergencies']} ACTIVE EMERGENCY** — check emergency module immediately!")
    if d.get('permit_alerts', 0):
        alerts.append(f"⚠️ **{d['permit_alerts']}** contractor permit(s) expiring within 30 days.")
    if d.get('pending_visitor_approvals', 0):
        alerts.append(f"⚠️ **{d['pending_visitor_approvals']}** visitor approval(s) awaiting review.")
    if d.get('readers_online', 0) == 0 and d.get('total_readers', 0) > 0:
        alerts.append(f"⚠️ All **{d['total_readers']}** reader(s) offline — check network/devices.")
    if alerts:
        lines.append("")
        lines.extend(alerts)
    return "\n".join(lines)


def _fmt_onsite(d: dict) -> str:
    count = d.get('count', 0)
    if count == 0:
        return "**No personnel currently on-site.**\n\n- It may be outside working hours\n- Biometric devices may be offline\n- No punches recorded today yet"
    people = d.get('personnel', [])
    lines = [f"## 👥 On-site Right Now — {count} person(s)\n"]
    for p in people[:25]:
        name  = p.get('name', 'Unknown')
        dept  = p.get('department') or '—'
        area  = p.get('area') or '—'
        since = (p.get('checked_in_at') or '')[:16]
        lines.append(f"- **{name}** · {dept} · {area} · In: {since[11:] if since else '—'}")
    if count > 25:
        lines.append(f"\n_…and {count - 25} more._")
    return "\n".join(lines)


def _fmt_attendance(d: dict) -> str:
    period = d.get('period', 'today')
    rows   = d.get('by_department', [])
    if not rows:
        return f"**No attendance records for {period}.**\n\nDevices may be offline or no punches recorded yet."
    total = sum(r.get('unique_punches', 0) for r in rows)
    lines = [f"## 📊 Attendance — {period}\n", f"**Total unique personnel:** {total}\n"]
    lines.append("| Department | Unique | Check-ins |")
    lines.append("|---|---|---|")
    for r in rows:
        dept = r.get('department') or 'Unassigned'
        lines.append(f"| {dept} | {r.get('unique_punches',0)} | {r.get('checkins',0)} |")
    return "\n".join(lines)


def _fmt_att_report(d: dict) -> str:
    s      = d.get('stats', {})
    period = d.get('period', 'selected period')
    lines  = [f"## 📋 Attendance Report — {period}\n"]
    lines.append(f"| | Count |")
    lines.append(f"|---|---|")
    lines.append(f"| Total Records | **{s.get('total_records', 0)}** |")
    lines.append(f"| Present | **{s.get('present', 0)}** |")
    lines.append(f"| Late | **{s.get('late', 0)}** |")
    lines.append(f"| Absent | **{s.get('absent', 0)}** |")
    lines.append(f"| Avg Work Time | **{round((s.get('avg_work_minutes') or 0) / 60, 1)}h** |")
    lines.append(f"| Total Late Minutes | **{s.get('total_late_minutes', 0)}** |")
    lines.append(f"| Total OT Minutes | **{s.get('total_ot_minutes', 0)}** |")
    records = d.get('records', [])
    if records:
        lines.append(f"\n**Recent records:**\n")
        for r in records[:10]:
            name   = r.get('name', '?')
            dt     = str(r.get('att_date', ''))[:10]
            status = r.get('status', '?')
            mins   = r.get('work_minutes', 0)
            late   = r.get('late_minutes', 0)
            late_s = f" · ⚠️ {late}m late" if late and late > 0 else ""
            lines.append(f"- **{name}** · {dt} · {status} · {round(mins/60,1)}h worked{late_s}")
    return "\n".join(lines)


def _fmt_pob(d: dict) -> str:
    s       = d.get('summary', {})
    locs    = d.get('locations', [])
    total   = s.get('total_personnel', 0)
    onsite  = s.get('punched_in_today', 0)
    leave   = s.get('on_approved_leave', 0)
    contr   = s.get('contractors_on_assignment', 0)
    pct     = round(onsite / total * 100) if total else 0
    lines   = [f"## 🛢️ Personnel On Board\n"]
    lines.append(f"- **Total Active Personnel:** {total}")
    lines.append(f"- **Punched In Today:** {onsite} ({pct}% manning)")
    lines.append(f"- **On Approved Leave:** {leave}")
    lines.append(f"- **Contractors On Assignment:** {contr}")
    if pct < 70:
        lines.append(f"\n⚠️ Manning at {pct}% — below 70% threshold.")
    if locs:
        lines.append("\n**By location:**")
        for loc in locs:
            lines.append(f"- **{loc.get('location','—')}**: {loc.get('personnel_count',0)} personnel · {(loc.get('status') or '').upper()}")
    return "\n".join(lines)


def _fmt_departments(d: dict) -> str:
    depts = d.get('departments', [])
    if not depts:
        return "No departments found."
    lines = [f"## 🏢 Departments — {d.get('count', 0)} total\n"]
    lines.append("| Department | Type | Status | Personnel | Max |")
    lines.append("|---|---|---|---|---|")
    for dep in depts:
        name    = dep.get('name', '—')
        dtype   = dep.get('department_type', '—')
        status  = 'Active' if dep.get('is_active') else 'Inactive'
        actual  = dep.get('actual_count', 0)
        maxp    = dep.get('max_personnel', '—')
        lines.append(f"| {name} | {dtype} | {status} | {actual} | {maxp} |")
    return "\n".join(lines)


def _fmt_positions(d: dict) -> str:
    pos = d.get('positions', [])
    if not pos:
        return "No positions defined."
    lines = [f"## 💼 Positions — {d.get('count', 0)} total\n"]
    for p in pos:
        safety = " 🔴 *safety critical*" if p.get('is_safety_critical') else ""
        active = "" if p.get('is_active') else " *(inactive)*"
        lines.append(f"- **{p.get('position_name','?')}** ({p.get('position_code','')}) · {p.get('position_type','?')} · {p.get('department','—')}{safety}{active} · {p.get('headcount',0)} staff")
    return "\n".join(lines)


def _fmt_personnel_list(d: dict) -> str:
    people = d.get('personnel', [])
    if not people:
        return "No personnel found."
    lines = [f"## 👤 Personnel List — {d.get('count', 0)} record(s)\n"]
    for p in people:
        last = str(p.get('last_seen') or '')[:16]
        lines.append(f"- **{p.get('name','?')}** (#{p.get('emp_code','?')}) · {p.get('department','—')} · {p.get('position') or '—'} · Last seen: {last or 'Never'}")
    return "\n".join(lines)


def _fmt_search(d: dict, query: str) -> str:
    count = d.get('count', 0)
    if count == 0:
        return f"**No results for _\"{query}\"_.**\n\nTry name, employee code, department, or position."
    lines = [f"## 🔎 Results for \"{query}\" — {count} match(es)\n"]
    for r in d.get('results', []):
        name   = r.get('name', '?')
        emp    = r.get('emp_code', '—')
        dept   = r.get('department') or '—'
        pos    = r.get('position') or '—'
        status = (r.get('status') or '').upper()
        email  = r.get('email') or ''
        last   = str(r.get('last_seen') or '')[:16]
        icon   = '✅' if status == 'ACTIVE' else '⚪'
        lines.append(f"- {icon} **{name}** (#{emp}) · {dept} · {pos}")
        if email: lines.append(f"  📧 {email}")
        if last:  lines.append(f"  🕐 Last seen: {last}")
    return "\n".join(lines)


def _fmt_shifts(d: dict) -> str:
    shifts = d.get('shifts', [])
    if not shifts:
        return "No shifts configured."
    lines = [f"## ⏰ Shifts — {d.get('count', 0)} defined\n"]
    for s in shifts:
        night   = " 🌙 night" if s.get('is_night_shift') else ""
        weekend = " 🗓️ weekend" if s.get('is_weekend_shift') else ""
        active  = "" if s.get('is_active') else " *(inactive)*"
        start   = str(s.get('start_time', ''))[:5]
        end     = str(s.get('end_time', ''))[:5]
        lines.append(f"- **{s.get('name','?')}** ({s.get('shift_code','')}) · {start}–{end} · {s.get('working_hours',0)}h{night}{weekend}{active}")
        lines.append(f"  Days: {s.get('days_of_week','—')} · Grace: {s.get('grace_period_minutes',0)}min")
    return "\n".join(lines)


def _fmt_holidays(d: dict) -> str:
    holidays = d.get('holidays', [])
    if not holidays:
        return "No upcoming holidays found."
    lines = [f"## 📅 Holidays\n"]
    for h in holidays:
        start = str(h.get('start_date', ''))[:10]
        end   = str(h.get('end_date', ''))[:10]
        name  = h.get('holiday_name', '?')
        active = '' if h.get('is_active') else ' *(inactive)*'
        lines.append(f"- **{name}** · {start} → {end}{active}")
    return "\n".join(lines)


def _fmt_exceptions(d: dict) -> str:
    excs = d.get('exceptions', [])
    if not excs:
        return "✅ No attendance exceptions on record."
    lines = [f"## ⚠️ Attendance Exceptions — {d.get('count', 0)} record(s)\n"]
    for e in excs:
        emp   = e.get('employee', '?')
        dt    = str(e.get('att_date', ''))[:10]
        etype = (e.get('exception_type') or '').replace('_', ' ').title()
        dev   = e.get('deviation_minutes', 0)
        action= e.get('handle_action') or 'Unresolved'
        lines.append(f"- **{emp}** · {dt} · {etype} ({dev} min) · Action: {action}")
    return "\n".join(lines)


def _fmt_overtime(d: dict) -> str:
    s = d.get('stats', {})
    lines = [f"## ⏱️ Overtime Summary\n"]
    lines.append(f"- **Total Records:** {s.get('total', 0)}")
    lines.append(f"- **Approved:** {s.get('approved', 0)}")
    lines.append(f"- **Pending:** {s.get('pending', 0)}")
    lines.append(f"- **Total Hours:** {s.get('total_hours', 0)}h")
    records = d.get('records', [])
    if records:
        lines.append("\n**Recent overtime:**")
        for r in records[:10]:
            emp    = r.get('employee', '?')
            dt     = str(r.get('date', ''))[:10]
            hrs    = r.get('hours_worked', 0)
            status = (r.get('status') or '').upper()
            icon   = '✅' if status == 'APPROVED' else '🕐'
            lines.append(f"- {icon} **{emp}** · {dt} · {hrs}h · {status}")
    return "\n".join(lines)


def _fmt_leave(d: dict) -> str:
    count = d.get('count', 0)
    if count == 0:
        return "**No leave requests found.**"
    lines = [f"## 🗓️ Leave Requests — {count} record(s)\n"]
    for r in d.get('requests', [])[:20]:
        emp    = r.get('employee', '?')
        ltype  = r.get('leave_type') or 'Leave'
        start  = str(r.get('start_date', ''))[:10]
        end    = str(r.get('end_date', ''))[:10]
        days   = r.get('days_count', '')
        status = (r.get('status') or 'unknown').upper()
        icon   = {'APPROVED': '✅', 'REJECTED': '❌'}.get(status, '🕐')
        days_s = f" · {days}d" if days else ""
        lines.append(f"- {icon} **{emp}** · {ltype}{days_s} · {start} → {end} · {status}")
    if count > 20:
        lines.append(f"\n_…and {count - 20} more._")
    return "\n".join(lines)


def _fmt_leave_balance(d: dict) -> str:
    balances = d.get('balances', [])
    if not balances:
        return "No leave balance records found for this year."
    lines = [f"## 📊 Leave Balances — {date.today().year}\n"]
    lines.append("| Employee | Type | Total | Used | Remaining |")
    lines.append("|---|---|---|---|---|")
    for b in balances:
        emp   = b.get('employee', '?')
        ltype = b.get('leave_type', '?')
        total = b.get('total_days', 0)
        used  = b.get('used_days', 0)
        bal   = b.get('balance_days', 0)
        flag  = " ⚠️" if float(bal or 0) <= 0 else ""
        lines.append(f"| {emp} | {ltype} | {total} | {used} | **{bal}**{flag} |")
    return "\n".join(lines)


def _fmt_contracts(d: dict) -> str:
    contracts = d.get('contracts', [])
    if not contracts:
        return "No employment contracts found."
    lines = [f"## 📄 Employment Contracts — {d.get('count', 0)} record(s)\n"]
    for c in contracts:
        emp   = c.get('employee', '?')
        ctype = c.get('contract_type', '?').title()
        title = c.get('job_title', '?')
        start = str(c.get('start_date', ''))[:10]
        end   = str(c.get('end_date', ''))[:10] or 'Open-ended'
        status= (c.get('status') or '').upper()
        icon  = '✅' if status == 'ACTIVE' else '⚫'
        lines.append(f"- {icon} **{emp}** · {title} · {ctype} · {start} → {end} · {status}")
    return "\n".join(lines)


def _fmt_disciplinary(d: dict) -> str:
    cases = d.get('cases', [])
    if not cases:
        return "✅ No disciplinary cases on record."
    lines = [f"## ⚖️ Disciplinary Cases — {d.get('count', 0)} case(s)\n"]
    for c in cases:
        emp     = c.get('employee', '?')
        itype   = (c.get('incident_type') or '').replace('_', ' ').title()
        sev     = (c.get('severity_level') or '').upper()
        status  = (c.get('status') or '').upper()
        dt      = str(c.get('incident_date', ''))[:10]
        icon    = '🔴' if sev == 'MAJOR' else '🟡'
        lines.append(f"- {icon} **{emp}** · {itype} · Severity: {sev} · {dt} · Status: {status}")
        if c.get('description'):
            lines.append(f"  _{c['description']}_")
    return "\n".join(lines)


def _fmt_performance(d: dict) -> str:
    appraisals = d.get('appraisals', [])
    if not appraisals:
        return "No performance appraisals found."
    lines = [f"## 📈 Performance Appraisals — {d.get('count', 0)} record(s)\n"]
    for a in appraisals:
        emp    = a.get('employee', '?')
        score  = a.get('performance_score', '?')
        goals  = a.get('goals_achieved', '?')
        dt     = str(a.get('appraisal_date', ''))[:10]
        status = (a.get('status') or '').upper()
        icon   = '🟢' if float(score or 0) >= 80 else '🟡' if float(score or 0) >= 60 else '🔴'
        lines.append(f"- {icon} **{emp}** · Score: {score}% · Goals: {goals}% · {dt} · {status}")
        if a.get('strengths'):
            lines.append(f"  ✅ {a['strengths']}")
        if a.get('areas_for_improvement'):
            lines.append(f"  📌 {a['areas_for_improvement']}")
    return "\n".join(lines)


def _fmt_resignations(d: dict) -> str:
    resigns = d.get('resignations', [])
    if not resigns:
        return "No resignations on record."
    lines = [f"## 🚪 Resignations — {d.get('count', 0)} record(s)\n"]
    for r in resigns:
        emp    = r.get('employee', '?')
        rtype  = (r.get('resignation_type') or '').title()
        status = (r.get('status') or '').upper()
        lwd    = str(r.get('last_working_day', ''))[:10]
        handover = '✅' if r.get('handover_completed') else '⏳'
        lines.append(f"- **{emp}** · {rtype} · Last day: {lwd} · Status: {status} · Handover: {handover}")
    return "\n".join(lines)


def _fmt_training(d: dict) -> str:
    courses     = d.get('courses', [])
    enrollments = d.get('enrollments', [])
    lines = [f"## 🎓 Training & Certifications\n"]
    if courses:
        lines.append(f"### Courses ({len(courses)} total)\n")
        for c in courses:
            mandatory = "🔴 Mandatory" if c.get('is_mandatory') else "Optional"
            enrolled  = c.get('enrollments', 0)
            certified = c.get('certified', 0)
            lines.append(f"- **{c.get('course_name','?')}** ({c.get('course_code','')}) · {mandatory} · {c.get('category','?')} · {c.get('duration_hours',0)}h · {certified}/{enrolled} certified")
    if enrollments:
        lines.append(f"\n### Recent Enrollments\n")
        for e in enrollments[:10]:
            emp    = e.get('employee', '?')
            course = e.get('course_name', '?')
            status = (e.get('status') or '').upper()
            score  = f" · Score: {e.get('score')}%" if e.get('score') else ""
            icon   = '✅' if status == 'CERTIFIED' else '🕐'
            lines.append(f"- {icon} **{emp}** · {course}{score} · {status}")
    return "\n".join(lines)


def _fmt_expiring(d: dict) -> str:
    permits = d.get('work_permits', [])
    medical = d.get('medical_alerts', [])
    if not permits and not medical:
        return "✅ **No compliance alerts.** All permits and clearances are up to date."
    lines = ["## ⚠️ Compliance Alerts\n"]
    if permits:
        lines.append(f"### Work Permits ({len(permits)})\n")
        for p in permits:
            tag = "🔴 EXPIRED" if p.get('status') == 'EXPIRED' else "🟡 EXPIRING"
            expiry = str(p.get('work_permit_expiry', ''))[:10]
            lines.append(f"- {tag} **{p.get('name','?')}** ({p.get('vendor','—')}) · Expires: {expiry}")
    if medical:
        lines.append(f"\n### Medical Clearance Issues ({len(medical)})\n")
        for p in medical:
            lines.append(f"- 🔴 **{p.get('name','?')}** · {p.get('medical_clearance_status','?')}")
    lines.append("\n_Action: notify HR and suspend site access where applicable._")
    return "\n".join(lines)


def _fmt_visitors(d: dict) -> str:
    dt    = d.get('date', '')
    title = f" — {dt}" if dt else ""
    lines = [f"## 🪪 Visitor Summary{title}\n"]
    lines.append(f"- **On-site:** {d.get('on_site', 0)}")
    lines.append(f"- **Checked In ({dt or 'today'}):** {d.get('checked_in_on_date', d.get('checked_in_today', 0))}")
    lines.append(f"- **Pending Approvals:** {d.get('pending_approvals', 0)}")
    lines.append(f"- **Total (all time):** {d.get('total_visitors_ever', 0)}")
    recent = d.get('recent_visitors', [])
    if recent:
        lines.append("\n**Today's visitors:**")
        for v in recent:
            name   = v.get('name', '?')
            checkin = str(v.get('check_in_time', ''))[:16]
            lines.append(f"- **{name}** · In: {checkin[11:] if checkin else '—'}")
    alerts = []
    if d.get('pending_approvals', 0):
        alerts.append(f"⚠️ {d['pending_approvals']} visitor approval(s) need review.")
    if d.get('overstays', 0):
        alerts.append(f"⚠️ {d['overstays']} visitor(s) have overstayed.")
    if d.get('blacklisted', 0):
        alerts.append(f"🚫 {d['blacklisted']} visitor(s) blacklisted — monitor entry points.")
    if alerts:
        lines.append("")
        lines.extend(alerts)
    return "\n".join(lines)


def _fmt_zones(d: dict) -> str:
    lines = [f"## 🗺️ Zones — {d.get('total_zones', 0)} total\n"]
    lines.append(f"- **Active:** {d.get('active_zones', 0)}")
    lines.append(f"- **Inactive:** {d.get('inactive_zones', 0)}")
    by_type = d.get('by_type', [])
    if by_type:
        lines.append("\n**By type:**")
        for t in by_type:
            lines.append(f"- {t.get('zone_type') or 'Unknown'}: {t.get('count', 0)}")
    return "\n".join(lines)


def _fmt_zones_detail(d: dict) -> str:
    zones = d.get('zones', [])
    if not zones:
        return "No zones found."
    lines = [f"## 🗺️ Zones Detail — {d.get('count', 0)} zones\n"]
    lines.append("| Zone | Type | Status | Personnel | Readers |")
    lines.append("|---|---|---|---|---|")
    for z in zones:
        lines.append(f"| {z.get('name','?')} | {z.get('zone_type','?')} | {z.get('status','?')} | {z.get('assigned_personnel',0)} | {z.get('assigned_readers',0)} |")
    return "\n".join(lines)


def _fmt_access_control(d: dict) -> str:
    levels = d.get('access_levels', [])
    doors  = d.get('doors', [])
    lines  = ["## 🔐 Access Control\n"]
    if levels:
        lines.append(f"### Access Levels ({len(levels)})\n")
        for l in levels:
            active = '✅' if l.get('is_active') else '⚫'
            muster = ' *(muster only)*' if l.get('mustering_only') else ''
            lines.append(f"- {active} **{l.get('name','?')}** · {l.get('user_count',0)} users · {l.get('door_count',0)} doors{muster}")
    if doors:
        lines.append(f"\n### Doors ({len(doors)})\n")
        for d_ in doors:
            fire    = ' 🔥 fire-linked' if d_.get('fire_linkage') else ''
            muster  = ' 🏃 muster-mode' if d_.get('mustering_mode') else ''
            reader  = d_.get('reader') or d_.get('ip_address') or '—'
            lines.append(f"- **{d_.get('name','?')}** · Reader: {reader}{fire}{muster}")
    return "\n".join(lines)


def _fmt_areas(d: dict) -> str:
    areas = d.get('areas', [])
    if not areas:
        return "No areas configured."
    lines = [f"## 📍 Personnel Areas — {d.get('count', 0)} area(s)\n"]
    for a in areas:
        lines.append(f"- **{a.get('area_name','?')}** (Code: {a.get('area_code') or '—'}) · {a.get('readers_in_area',0)} reader(s)")
    return "\n".join(lines)


def _fmt_emergency(d: dict) -> str:
    active = d.get('active_count', 0)
    events = d.get('events', [])
    if not events:
        return "✅ No emergency events recorded."
    lines = []
    if active:
        lines.append(f"## 🚨 ACTIVE EMERGENCY — {active} event(s) in progress!\n")
    else:
        lines.append(f"## 🚒 Emergency Events (last 10)\n")
    EVENT_TYPES = {1: 'Fire', 2: 'Lockdown', 3: 'Evacuation', 4: 'Panic'}
    STATUS = {0: '🔴 ACTIVE', 1: '✅ Resolved', 2: '⚫ Cancelled'}
    for e in events:
        etype  = EVENT_TYPES.get(e.get('event_type', 0), 'Unknown')
        status = STATUS.get(e.get('status', 0), '?')
        start  = str(e.get('start_time', ''))[:16]
        end    = str(e.get('end_time', ''))[:16] or 'Ongoing'
        by_    = e.get('initiated_by_name', '?')
        lines.append(f"- {status} **{etype}** · By: {by_} · {start} → {end}")
        if e.get('reason'):
            lines.append(f"  _{e['reason']}_")
    return "\n".join(lines)


def _fmt_mustering(d: dict) -> str:
    events = d.get('recent_events', [])
    drills = d.get('recent_drills', [])
    lines  = ["## 🏃 Mustering & Drills\n"]
    if events:
        lines.append(f"### Events (last 10)\n")
        STATUS = {0: '🔵 Pending', 1: '✅ Complete', 2: '🔴 Active', 3: '⚫ Cancelled'}
        for e in events:
            status  = STATUS.get(e.get('status', 0), '?')
            zone    = e.get('zone_name', '?')
            start   = str(e.get('start_time', ''))[:16]
            safe    = e.get('total_safe', 0)
            missing = e.get('total_missing', 0)
            flag    = f" ⚠️ {missing} MISSING" if missing and missing > 0 else ""
            lines.append(f"- {status} **Zone: {zone}** · {start} · Safe: {safe}{flag}")
    if drills:
        lines.append(f"\n### Drill Schedule (recent)\n")
        for d_ in drills:
            zone   = d_.get('zone_name', '?')
            sched  = str(d_.get('scheduled_time', ''))[:16]
            status = d_.get('status', '?')
            done   = '✅' if d_.get('processed') else '🕐'
            lines.append(f"- {done} **{zone}** · Scheduled: {sched} · {status}")
    return "\n".join(lines)


def _fmt_devices(d: dict) -> str:
    stats   = d.get('device_stats', {})
    devices = d.get('devices', [])
    readers = d.get('readers', [])
    lines   = ["## 📡 Devices & Readers\n"]
    lines.append(f"**Devices:** {stats.get('online', 0)}/{stats.get('total', 0)} online")
    if devices:
        lines.append("\n**Device list:**")
        for dv in devices:
            status = dv.get('status', '?')
            icon   = '🟢' if status == 'ONLINE' else '🔴'
            last   = str(dv.get('last_seen', ''))[:10] or '—'
            lines.append(f"- {icon} **{dv.get('name') or dv.get('serial_number','?')}** · {dv.get('device_type','?')} · {dv.get('ip_address','?')} · Last seen: {last}")
    if readers:
        lines.append("\n**Biometric readers (terminals):**")
        for r in readers:
            status = r.get('connectivity', '?')
            icon   = '🟢' if status == 'ONLINE' else '🔴'
            alias  = r.get('alias') or r.get('sn', '?')
            last   = str(r.get('last_activity', ''))[:16] or 'Never'
            lines.append(f"- {icon} **{alias}** · {r.get('ip_address','?')} · Last: {last}")
    return "\n".join(lines)


def _fmt_transport(d: dict) -> str:
    vehicles  = d.get('vehicles', [])
    schedules = d.get('schedules', [])
    TYPES = {1: 'Vessel', 2: 'Boat', 3: 'Helicopter', 4: 'Fixed-wing', 5: 'Bus', 0: 'Other'}
    lines = ["## ✈️ Transport\n"]
    if vehicles:
        lines.append(f"**Vehicles ({len(vehicles)}):**")
        for v in vehicles:
            vtype   = TYPES.get(v.get('type', 0), 'Unknown')
            avail   = '✅ Available' if v.get('is_available') else '🔧 Unavailable'
            maint   = ' (maintenance)' if v.get('is_maintenance_mode') else ''
            lines.append(f"- **{v.get('identifier','?')}** · {vtype} · Cap: {v.get('capacity',0)} · POB: {v.get('current_pob',0)} · {avail}{maint}")
    if schedules:
        lines.append(f"\n**Schedules (recent):**")
        for s in schedules:
            dep    = str(s.get('departure_time', ''))[:16]
            status = (s.get('status') or '').upper()
            lines.append(f"- **{s.get('vehicle','?')}** · {s.get('departure_location','?')} → {s.get('arrival_location','?')} · {dep} · {status}")
    return "\n".join(lines)


def _fmt_meetings(d: dict) -> str:
    rooms    = d.get('rooms', [])
    bookings = d.get('recent_bookings', [])
    lines = ["## 🏛️ Meeting Rooms\n"]
    if rooms:
        lines.append(f"**Rooms ({len(rooms)}):**")
        for r in rooms:
            approval = " *(approval required)*" if r.get('require_approval') else ""
            assembly = " 🏃 *emergency assembly*" if r.get('is_emergency_assembly') else ""
            lines.append(f"- **{r.get('room_name','?')}** · {r.get('location','?')} · Cap: {r.get('capacity',0)} · {r.get('status','?')}{approval}{assembly}")
    if bookings:
        lines.append(f"\n**Recent bookings:**")
        for b in bookings:
            start  = str(b.get('start_time', ''))[:16]
            status = (b.get('status') or '?').upper()
            icon   = '✅' if 'APPROVED' in status or 'COMPLETED' in status else '🕐'
            lines.append(f"- {icon} **{b.get('title','?')}** · {b.get('room_name','?')} · {start} · {status}")
    return "\n".join(lines)


def _fmt_anomalies(d: dict) -> str:
    count = d.get('count', 0)
    if count == 0:
        return "✅ **No anomalies detected** in the selected period."
    lines = [f"## 🔍 Security Anomalies — {count} event(s)\n"]
    for a in d.get('alerts', [])[:15]:
        name  = a.get('name', a.get('emp_code', '?'))
        atype = (a.get('anomaly_type', 'FLAGGED')).replace('_', ' ')
        ptime = str(a.get('punch_time', ''))[:16]
        icon  = '🔴'
        lines.append(f"- {icon} **{name}** · {atype} · {ptime} · Terminal: {a.get('terminal_sn','—')}")
    lines.append("\n_Review with site security._")
    return "\n".join(lines)


def _fmt_notifications(d: dict) -> str:
    unread = d.get('unread', 0)
    notifs = d.get('notifications', [])
    lines  = [f"## 🔔 Notifications — {unread} unread\n"]
    ICONS  = {'warning': '⚠️', 'error': '🔴', 'info': 'ℹ️', 'success': '✅'}
    for n in notifs:
        icon  = ICONS.get(n.get('notification_type', 'info'), '•')
        title = n.get('title', '?')
        msg   = n.get('message', '')[:100]
        prio  = (n.get('priority') or '').upper()
        read  = '' if not n.get('is_read') else ' *(read)*'
        lines.append(f"- {icon} **{title}**{read} · {prio}")
        if msg: lines.append(f"  _{msg}_")
    return "\n".join(lines)


def _fmt_help() -> str:
    return """## 👋 What I can do

I have live access to every module in the Apex POB. Here's what you can ask:

**👥 Personnel & HR**
- *Who is on-site right now?* · *List all employees*
- *Find John Smith* · *Show Engineering department staff*
- *Employment contracts* · *Resignations* · *Performance appraisals* · *Disciplinary cases*

**⏰ Attendance & Time**
- *Today's attendance summary* · *Attendance report last 7 days*
- *Show all shifts* · *Upcoming holidays* · *Attendance exceptions*
- *Overtime records* · *Leave requests* · *Leave balances*

**🛢️ POB & Operations**
- *POB status* · *Manning levels* · *Daily briefing*

**🏗️ Contractors & Compliance**
- *Expired work permits* · *Medical clearance issues* · *Background check status*

**🪪 Visitors**
- *Who are the current visitors?* · *Pending visitor approvals*

**🗺️ Zones & Access**
- *How many zones?* · *Zone detail list* · *Access levels* · *Doors & readers* · *Personnel areas*

**🚒 Emergency & Safety**
- *Any active emergencies?* · *Mustering events* · *Drill schedule*

**📡 Devices & Readers**
- *Device status* · *How many readers online?* · *Reader list*

**✈️ Transport**
- *Transport schedule* · *Helicopter status*

**🎓 Training**
- *Training courses* · *Certifications* · *Enrollment status*

**🏛️ Meetings**
- *Meeting rooms* · *Room bookings*

**📋 Reports**
- *Generate daily briefing*"""


async def _run_briefing(db: Session) -> str:
    today = date.today().strftime('%A, %d %B %Y')
    parts = [f"# 📋 Daily Operations Briefing — {today}\n"]
    plan = [
        ('get_dashboard_stats',   {}, _fmt_dashboard),
        ('get_pob_status',        {}, _fmt_pob),
        ('get_onsite_personnel',  {}, _fmt_onsite),
        ('get_expiring_items',    {'item_type': 'all', 'days': 30}, _fmt_expiring),
        ('get_visitor_summary',   {}, _fmt_visitors),
        ('get_emergency_events',  {}, _fmt_emergency),
        ('get_anomaly_alerts',    {'days': 1}, _fmt_anomalies),
        ('get_leave_requests',    {'status': 'all'}, _fmt_leave),
    ]
    for tool, args, fmt in plan:
        result = execute_tool(tool, args, db)
        if 'error' not in result:
            parts.append(fmt(result))
            parts.append("")
    parts.append("---\n_Generated by ARIA · POB Operations System_")
    return "\n".join(parts)


# ── Main stream ───────────────────────────────────────────────────────────────

FORMATTERS = {
    'get_dashboard_stats':      _fmt_dashboard,
    'get_onsite_personnel':     _fmt_onsite,
    'get_attendance_summary':   _fmt_attendance,
    'get_att_report':           _fmt_att_report,
    'get_pob_status':           _fmt_pob,
    'get_departments':          _fmt_departments,
    'get_positions':            _fmt_positions,
    'get_personnel_list':       _fmt_personnel_list,
    'get_employment_contracts': _fmt_contracts,
    'get_disciplinary':         _fmt_disciplinary,
    'get_performance':          _fmt_performance,
    'get_resignations':         _fmt_resignations,
    'get_shifts':               _fmt_shifts,
    'get_holidays':             _fmt_holidays,
    'get_att_exceptions':       _fmt_exceptions,
    'get_overtime':             _fmt_overtime,
    'get_leave_requests':       _fmt_leave,
    'get_leave_balance':        _fmt_leave_balance,
    'get_expiring_items':       _fmt_expiring,
    'get_visitor_summary':      _fmt_visitors,
    'get_zones_summary':        _fmt_zones,
    'get_zones_detail':         _fmt_zones_detail,
    'get_access_control':       _fmt_access_control,
    'get_areas':                _fmt_areas,
    'get_emergency_events':     _fmt_emergency,
    'get_mustering':            _fmt_mustering,
    'get_devices':              _fmt_devices,
    'get_transport':            _fmt_transport,
    'get_meeting_rooms':        _fmt_meetings,
    'get_training':             _fmt_training,
    'get_anomaly_alerts':       _fmt_anomalies,
    'get_notifications':        _fmt_notifications,
}


# ── Chart data generators ─────────────────────────────────────────────────────

def _build_chart(tool: str, result: dict) -> dict | None:
    """Return chart payload or None if tool doesn't support charts."""
    try:
        if tool == 'get_attendance_summary':
            rows = result.get('by_department', [])
            if not rows: return None
            return {"chart_type": "bar", "title": "Attendance by Department",
                    "data": [{"dept": (r.get('department') or 'N/A')[:15],
                              "punches": r.get('unique_punches', 0),
                              "checkins": r.get('checkins', 0)} for r in rows[:10]],
                    "keys": [{"key": "punches", "color": "#10b981", "name": "Unique Punches"},
                             {"key": "checkins", "color": "#1677ff", "name": "Check-ins"}]}

        if tool == 'get_dashboard_stats':
            return {"chart_type": "stat_group", "title": "System Overview",
                    "data": [
                        {"label": "Employees", "value": result.get('total_employees', 0), "color": "#10b981"},
                        {"label": "Punches Today", "value": result.get('punches_today', 0), "color": "#1677ff"},
                        {"label": "Visitors", "value": result.get('visitors_onsite', 0), "color": "#f59e0b"},
                        {"label": "Contractors", "value": result.get('active_contractors', 0), "color": "#8b5cf6"},
                        {"label": "Readers Online", "value": result.get('readers_online', 0), "color": "#06b6d4"},
                        {"label": "Active Zones", "value": result.get('active_zones', 0), "color": "#ef4444"},
                    ]}

        if tool == 'get_pob_status':
            s = result.get('summary', {})
            total  = s.get('total_personnel', 0)
            onsite = s.get('punched_in_today', 0)
            leave  = s.get('on_approved_leave', 0)
            other  = max(0, total - onsite - leave)
            if not total: return None
            return {"chart_type": "pie", "title": "Personnel On Board",
                    "data": [{"name": "On-site", "value": onsite, "color": "#10b981"},
                             {"name": "On Leave", "value": leave,  "color": "#f59e0b"},
                             {"name": "Other",    "value": other,  "color": "#94a3b8"}]}

        if tool == 'get_departments':
            depts = result.get('departments', [])
            if not depts: return None
            return {"chart_type": "bar", "title": "Headcount by Department",
                    "data": [{"dept": (d.get('name') or 'N/A')[:12],
                              "count": d.get('actual_count', 0)} for d in depts[:12]],
                    "keys": [{"key": "count", "color": "#10b981", "name": "Personnel"}]}

        if tool == 'get_zones_summary':
            by_type = result.get('by_type', [])
            if not by_type: return None
            COLORS = ["#10b981","#1677ff","#f59e0b","#8b5cf6","#ef4444","#06b6d4","#ec4899"]
            return {"chart_type": "pie", "title": "Zones by Type",
                    "data": [{"name": t.get('zone_type') or 'Unknown', "value": t.get('count', 0),
                              "color": COLORS[i % len(COLORS)]} for i, t in enumerate(by_type)]}

        if tool == 'get_att_report':
            s = result.get('stats', {})
            p = float(s.get('present') or 0)
            l = float(s.get('late') or 0)
            a = float(s.get('absent') or 0)
            if not (p+l+a): return None
            return {"chart_type": "pie", "title": f"Attendance Status — {result.get('period','period')}",
                    "data": [{"name": "Present", "value": int(p), "color": "#10b981"},
                             {"name": "Late",    "value": int(l), "color": "#f59e0b"},
                             {"name": "Absent",  "value": int(a), "color": "#ef4444"}]}

        if tool == 'get_training':
            courses = result.get('courses', [])
            if not courses: return None
            return {"chart_type": "bar", "title": "Training — Enrolled vs Certified",
                    "data": [{"course": (c.get('course_name') or 'N/A')[:14],
                              "enrolled": c.get('enrollments', 0),
                              "certified": c.get('certified', 0)} for c in courses[:10]],
                    "keys": [{"key": "enrolled",  "color": "#1677ff", "name": "Enrolled"},
                             {"key": "certified", "color": "#10b981", "name": "Certified"}]}
    except Exception as e:
        logger.debug(f"Chart build error for {tool}: {e}")
    return None


# ── Follow-up suggestion generators ──────────────────────────────────────────

FOLLOW_UPS: dict[str, list[str]] = {
    'get_onsite_personnel':   ["Show their attendance history", "Check on-site contractor compliance", "Generate a full POB report"],
    'get_attendance_summary': ["Show detailed attendance report", "Compare with last week", "Check late arrivals"],
    'get_att_report':         ["Show department breakdown", "Check overtime records", "Export attendance exceptions"],
    'get_pob_status':         ["Who is on-site right now?", "Check approved leave today", "Generate daily briefing"],
    'get_departments':        ["List all employees per department", "Show headcount by position", "Check department leave balances"],
    'get_expiring_items':     ["Show all active contractors", "Check medical clearance issues", "Notify compliance team"],
    'get_visitor_summary':    ["Show pending visitor approvals", "Check visitor blacklist", "View today's visitor log"],
    'get_leave_requests':     ["Show leave balances", "Compare leave vs last month", "Check overtime records"],
    'get_anomaly_alerts':     ["Show emergency events", "Check access levels", "View mustering status"],
    'get_devices':            ["Show zone assignments", "Check reader areas", "View access control doors"],
    'get_emergency_events':   ["Check mustering status", "Show panic log", "View emergency plans"],
    'get_mustering':          ["View drill schedule", "Check zone occupancy", "Show emergency events"],
    'get_training':           ["Show pending enrollments", "Check compliance requirements", "View certifications expiring"],
    'get_transport':          ["Show transport manifest", "Check helicopter schedule", "View flight logs"],
    'get_zones_summary':      ["Show zone detail list", "Check access levels", "View zone personnel assignments"],
    'get_dashboard_stats':    ["Who is on-site now?", "Any compliance alerts?", "Generate daily briefing"],
}

def _get_follow_ups(tools_called: list[str]) -> list[str]:
    seen, out = set(), []
    for tool in tools_called:
        for s in FOLLOW_UPS.get(tool, []):
            if s not in seen:
                seen.add(s)
                out.append(s)
    return out[:4]


# ── Comparison query support ──────────────────────────────────────────────────

def _detect_comparison(text: str):
    """
    Detect 'compare X vs Y' patterns. Returns (tool, range_a, range_b) or None.
    """
    t = text.lower()
    if not re.search(r'compar|vs\.?|versus|against|last week vs|this week vs', t):
        return None

    # Extract two date ranges separated by vs/versus/against/compared to
    m = re.search(
        r'(?:compare\s+)?(.+?)\s+(?:vs\.?|versus|against|compared to|vs\s+)\s+(.+?)(?:\s*$|\?|\.)',
        text, re.IGNORECASE
    )
    if not m:
        return None

    range_a = _extract_date_range(m.group(1))
    range_b = _extract_date_range(m.group(2))
    if range_a == range_b:
        return None

    # Determine which tool to use
    if re.search(r'attendance|punch|present', t):
        tool = 'get_att_report'
    elif re.search(r'leave', t):
        tool = 'get_leave_requests'
    elif re.search(r'visitor', t):
        tool = 'get_visitor_summary'
    elif re.search(r'overtime', t):
        tool = 'get_overtime'
    else:
        tool = 'get_att_report'

    return tool, range_a, range_b


def _fmt_comparison(tool: str, a: dict, b: dict, range_a: dict, range_b: dict) -> str:
    pa = range_a.get('start_date', '?')
    pb = range_b.get('start_date', '?')
    lines = [f"## 📊 Comparison: {pa} vs {pb}\n"]

    def _diff(va, vb, label):
        try:
            fa, fb = float(va or 0), float(vb or 0)
            diff = fb - fa
            arrow = "▲" if diff > 0 else ("▼" if diff < 0 else "→")
            color_hint = "⬆️" if diff > 0 else ("⬇️" if diff < 0 else "➡️")
            lines.append(f"- **{label}:** {fa:.0f} → {fb:.0f} {color_hint} ({diff:+.0f})")
        except Exception:
            pass

    if tool == 'get_att_report':
        sa, sb = a.get('stats', {}), b.get('stats', {})
        _diff(sa.get('total_records'), sb.get('total_records'), 'Total records')
        _diff(sa.get('present'), sb.get('present'), 'Present')
        _diff(sa.get('late'), sb.get('late'), 'Late')
        _diff(sa.get('absent'), sb.get('absent'), 'Absent')
        _diff(sa.get('avg_work_minutes'), sb.get('avg_work_minutes'), 'Avg work minutes')
        _diff(sa.get('total_late_minutes'), sb.get('total_late_minutes'), 'Total late minutes')
    elif tool == 'get_leave_requests':
        _diff(a.get('count'), b.get('count'), 'Leave requests')
    elif tool == 'get_visitor_summary':
        _diff(a.get('checked_in_on_date'), b.get('checked_in_on_date'), 'Visitors checked in')
    return "\n".join(lines)


async def aria_stream(
    messages: list,
    db: Session,
    user_context: Optional[dict] = None,
) -> AsyncGenerator[str, None]:

    yield f"data: {json.dumps({'type': 'provider', 'info': PROVIDER_INFO})}\n\n"

    user_msg = ""
    for m in reversed(messages):
        if m.get('role') == 'user':
            user_msg = m.get('content', '').strip()
            break

    if not user_msg:
        yield f"data: {json.dumps({'type': 'text', 'text': 'Please ask me something about your operations.'})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        return

    try:
        # ── Comparison query ──────────────────────────────────────────────
        comp = _detect_comparison(user_msg)
        if comp:
            tool, range_a, range_b = comp
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': tool})}\n\n"
            res_a = execute_tool(tool, range_a, db)
            res_b = execute_tool(tool, range_b, db)
            if 'error' not in res_a and 'error' not in res_b:
                text = _fmt_comparison(tool, res_a, res_b, range_a, range_b)
                yield f"data: {json.dumps({'type': 'text', 'text': text})}\n\n"
                yield f"data: {json.dumps({'type': 'follow_ups', 'items': ['Show full report for each period', 'Compare last month vs this month', 'Generate daily briefing']})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return

        intents = _detect_intents(user_msg)

        if intents == [('help', {})]:
            yield f"data: {json.dumps({'type': 'text', 'text': _fmt_help()})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        if len(intents) == 1 and intents[0][0] == 'briefing':
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': 'get_dashboard_stats'})}\n\n"
            text = await _run_briefing(db)
            yield f"data: {json.dumps({'type': 'text', 'text': text})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        parts = []
        tools_called = []
        for tool, args in intents:
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': tool})}\n\n"
            result = execute_tool(tool, args, db)
            if 'error' in result:
                logger.error(f"Tool {tool} error: {result['error']}")
                continue
            tools_called.append(tool)

            # Emit chart data if available
            chart = _build_chart(tool, result)
            if chart:
                yield f"data: {json.dumps({'type': 'chart_data', 'chart': chart})}\n\n"

            fmt = FORMATTERS.get(tool)
            if fmt:
                if tool == 'search_personnel':
                    parts.append(_fmt_search(result, args.get('query', user_msg)))
                else:
                    parts.append(fmt(result))

        text = "\n\n".join(parts) if parts else \
            "I couldn't find relevant data for that query.\n\nTry asking about personnel, attendance, contractors, visitors, zones, devices, emergency, transport, training, or meetings."

        yield f"data: {json.dumps({'type': 'text', 'text': text})}\n\n"

        # Emit follow-up suggestions
        follow_ups = _get_follow_ups(tools_called)
        if follow_ups:
            yield f"data: {json.dumps({'type': 'follow_ups', 'items': follow_ups})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    except Exception as e:
        logger.error(f"ARIA error: {e}", exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'text': str(e)})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"


async def aria_daily_briefing(db: Session) -> str:
    return await _run_briefing(db)
