"""
ARIA knowledge seed — the curated POB corpus.

Each entry: (category, question, answer_markdown, keywords, priority).
`keywords` are extra synonyms/phrasings that should match this entry even when the
words don't appear in the question/answer — this is the "keyword sensitivity" knob.
Edit this list (or INSERT rows at runtime) to grow ARIA's knowledge — no retraining.

seed_all() is idempotent (upsert on category+question), so it is safe to run on every
startup; new entries appear, edited answers refresh, nothing duplicates.
"""

import logging
from sqlalchemy.orm import Session

from . import knowledge_base as kb

logger = logging.getLogger(__name__)

# (category, question, answer, keywords, priority)
SEED = [
    # ── Devices / readers ────────────────────────────────────────────────────
    ("devices",
     "How do remote ZKTeco readers connect to the POB server?",
     ("Remote readers connect over **ADMS push**, not the LAN scanner. The reader "
      "dials the server — the server never scans across the internet. On the device: "
      "**Comm → Cloud Server Setting (ADMS)** → set **Server Address = the public IP**, "
      "**Server Port = 80**, Enable Domain Name = OFF, Cloud Server = ON, then reboot. "
      "The site firewall must allow outbound HTTP (port 80) to that IP. Once it connects "
      "it appears in the device list as PENDING for approval."),
     "remote reader offsite different network adms cloud server push public ip configure connect",
     10),

    ("devices",
     "A reader is up but not coming online on the POB — what do I check?",
     ("If it's a **remote/ADMS** reader and nothing shows in the device list, its packets "
      "aren't reaching the server. Check in order: (1) From a phone on mobile data, open "
      "`http://<public-ip>/iclock/test` — JSON means the server is reachable, a timeout "
      "means the port-forward/firewall (or ISP CGNAT) is the blocker. (2) The reader's "
      "ADMS setting must point at the **public IP on port 80** (not 443, not the private "
      "server IP). (3) The remote site firewall must allow outbound port 80. Watch it land "
      "live with the backend log filtered on the reader's serial number."),
     "reader offline not showing not visible cant see device missing online troubleshoot 0583",
     9),

    ("devices",
     "What is the difference between ADMS, Direct and Controller connection modes?",
     ("**ADMS** — the reader polls the server and commands are queued, delivered on its next "
      "poll (push readers, remote sites). **Direct** — the server opens a ZKLib TCP session "
      "and runs the command immediately (standalone LAN readers with an IP). **Controller** — "
      "InBio/C3 access panels (C3/PULL protocol); POB has no driver for these yet, so generic "
      "commands are refused. Pick ONE mode per reader so commands don't cross planes. Set it "
      "in the Devices page → Connection Mode."),
     "connection mode adms direct controller zklib inbio c3 plane difference",
     8),

    ("devices",
     "Does the Sync All Clocks button work for ADMS or ZKLib readers?",
     ("Both — it routes **per reader**. For a Direct reader it opens a ZKLib TCP session and "
      "sets the clock immediately; for an ADMS reader it queues `SET OPTIONS DateTime=` which "
      "the reader applies on its next poll. A Direct-only reader that can't be reached reports "
      "failure rather than black-holing a queued command."),
     "sync all clocks time button adms zklib direct date time drift",
     5),

    ("devices",
     "What is the difference between an ATTENDANCE reader and an ACCESS reader?",
     ("**ATTENDANCE** readers write Time & Attendance punches (check-in/out for payroll/hours). "
      "**ACCESS_ENTRY / ACCESS_EXIT** readers track zone occupancy and door access; entry/exit "
      "direction is forced so zone counts and muster headcounts are unambiguous. A reader's role "
      "is set by its **reader purpose**."),
     "attendance access entry exit reader purpose role door zone tna t&a",
     4),

    # ── Zones / areas ────────────────────────────────────────────────────────
    ("zones",
     "What is the difference between Zones and Areas?",
     ("**Zones** are for access control and POB/occupancy tracking — who is physically inside a "
      "space right now. **Areas** (personnel_area) are a Time & Attendance grouping linked to "
      "readers for attendance calculation. They are separate concepts — never mix them: a zone is "
      "not an attendance area and vice versa."),
     "zone area personnel area occupancy access control attendance difference mix",
     8),

    ("zones",
     "How does zone occupancy / POB counting work?",
     ("Occupancy is driven by access-reader entry/exit punches. An ENTRY auto-exits the person "
      "from their previous zone (self-correcting missed exits), creates a clock-in record, and "
      "sets their current zone. An EXIT clears it. POB (Personnel On Board) is the live count of "
      "people on site, broadcast to dashboards over WebSocket as punches arrive."),
     "occupancy headcount pob personnel on board count zone live dashboard",
     5),

    # ── Mustering / emergency ────────────────────────────────────────────────
    ("emergency",
     "What is muster mode and how does mustering work?",
     ("During an emergency, designated **muster readers** become assembly points. When someone "
      "punches at a muster reader they're marked SAFE/accounted-for at that point; everyone not "
      "yet accounted-for shows as MISSING. A reader counts as a muster reader if its door has "
      "mustering_mode set, its purpose is MUSTERING, or it's a mustering-type terminal (e.g. a "
      "Horus handheld at a muster point). Make sure muster readers have a zone assigned, or their "
      "punches won't be counted in the muster."),
     "muster mustering drill roll call assembly headcount emergency safe missing evacuation",
     9),

    ("emergency",
     "What is Fire Mode / emergency lockdown?",
     ("Fire/emergency mode triggers doors to fail-safe (unlock for evacuation) or lockdown per "
      "policy, and starts mustering. It is permission-gated — only authorised roles can arm or "
      "clear it. Emergency events (fire unlock, tamper, duress, anti-passback) are logged to the "
      "operation log."),
     "fire mode emergency lockdown evacuation panic alarm unlock duress",
     5),

    # ── Product / capabilities ───────────────────────────────────────────────
    ("general",
     "What is POB / what does POB mean?",
     ("**POB = Personnel On Board** — the live count and roster of people physically present on "
      "site (originally an offshore term). The system tracks POB from access-reader punches and "
      "shows it in real time on the dashboard, broken down by zone."),
     "pob personnel on board meaning offshore onshore manning count what is",
     6),

    ("general",
     "What can ARIA help me with?",
     ("Ask me about live operations — who's on site, attendance, POB, zones, devices/readers, "
      "visitors, mustering, emergencies, transport, meetings, contractors and compliance, leave, "
      "overtime, training, and security anomalies. I read your data live, can explain how the "
      "system works, and can generate downloadable reports with charts. Try: *\"who is on site "
      "now\"*, *\"attendance this week\"*, *\"how do remote readers connect\"*, or *\"generate a "
      "POB report\"*."),
     "help capabilities what can you do commands aria assistant features",
     7),

    ("general",
     "Can ARIA generate a downloadable report with charts?",
     ("Yes — ask for a report (e.g. *\"generate an attendance report for this week\"* or *\"POB "
      "report with charts\"*) and ARIA assembles the data, renders charts, and produces a "
      "downloadable PDF. Reports are also available directly from the Reports page (attendance, "
      "compliance, POB, visitors) in PDF and CSV."),
     "report download pdf chart export generate attendance compliance pob visitors csv",
     6),

    # ── Security / access ────────────────────────────────────────────────────
    ("general",
     "How do I enable two-factor authentication (2FA)?",
     ("2FA/MFA uses TOTP (authenticator app). Enable it from your profile/security settings: scan "
      "the QR code with an authenticator app, then confirm with a 6-digit code. After that, login "
      "requires your password plus the current code."),
     "2fa mfa two factor authentication totp authenticator security login otp",
     3),

    ("visitors",
     "How does the visitor kiosk / visitor check-in work?",
     ("Visitors can be pre-registered or self-register at the kiosk; a host approves the visit, and "
      "the visitor is issued access for the agreed window. Visitor entries/exits are tracked like "
      "personnel so they appear in POB and muster counts. Blacklisted visitors are flagged."),
     "visitor kiosk guest check in pre-register host approval badge self service",
     3),
]


def seed_all(db: Session) -> int:
    """Upsert every seed entry. Idempotent — safe to call on startup. Returns count."""
    kb.ensure_table(db)
    n = 0
    for category, question, answer, keywords, priority in SEED:
        try:
            kb.upsert(category, question, answer, keywords=keywords,
                      source="seed", priority=priority, db=db)
            n += 1
        except Exception as exc:
            db.rollback()
            logger.warning("KB seed skipped %r: %s", question, exc)
    logger.info("ARIA knowledge base seeded: %d entries (total active=%d)", n, kb.count(db))
    return n
