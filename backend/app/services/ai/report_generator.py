"""
ARIA report generator — live data → charts (matplotlib) → downloadable PDF (fpdf2).

Reuses ARIA's existing chart specs (_build_chart) as the single source of truth, so
the same data that draws an in-app recharts chart also draws the PDF chart — one
definition, two renderers. Add a report type by adding a row to REPORTS (and, if the
tool has no chart yet, a case in aria._build_chart).

Fully local: no LLM, no network. Charts render with the headless Agg backend.
"""

import io
import logging
from datetime import date
from typing import Dict, List, Optional, Tuple

import matplotlib
matplotlib.use("Agg")          # headless — no display, safe in a container
import matplotlib.pyplot as plt

from sqlalchemy.orm import Session

from .tools import execute_tool

logger = logging.getLogger(__name__)

# report_type → {title, tools, dated}. `dated` reports take a start/end range.
REPORTS: Dict[str, dict] = {
    "overview":   {"title": "Operations Overview Report",
                   "tools": ["get_dashboard_stats"], "dated": False},
    "attendance": {"title": "Attendance Report",
                   "tools": ["get_attendance_summary"], "dated": True},
    "pob":        {"title": "Personnel On Board (POB) Report",
                   "tools": ["get_pob_status"], "dated": False},
}

REPORT_LABELS = {
    "overview":   "Operations Overview report",
    "attendance": "Attendance report",
    "pob":        "POB report",
}


# ── Chart rendering (matplotlib) ──────────────────────────────────────────────

def _x_field(data: List[dict], key_names: List[str]) -> str:
    """The category field of a bar chart = the first data key that isn't a value series."""
    return next((k for k in data[0].keys() if k not in key_names), list(data[0].keys())[0])


def render_chart_png(spec: Optional[dict]) -> Optional[bytes]:
    """Render an ARIA chart spec (bar | pie | stat_group) to PNG bytes, or None."""
    if not spec:
        return None
    ctype = spec.get("chart_type")
    data = spec.get("data") or []
    if not data:
        return None

    fig, ax = plt.subplots(figsize=(7.0, 3.3), dpi=130)
    try:
        if ctype == "bar":
            keys = spec.get("keys", [])
            key_names = [k["key"] for k in keys]
            xf = _x_field(data, key_names)
            labels = [str(d.get(xf, "")) for d in data]
            xs = list(range(len(labels)))
            n = max(len(keys), 1)
            width = 0.8 / n
            for i, k in enumerate(keys):
                vals = [float(d.get(k["key"], 0) or 0) for d in data]
                ax.bar([x + i * width for x in xs], vals, width=width,
                       label=k.get("name", k["key"]), color=k.get("color"))
            ax.set_xticks([x + width * (n - 1) / 2 for x in xs])
            ax.set_xticklabels(labels, rotation=35, ha="right", fontsize=8)
            if len(keys) > 1:
                ax.legend(fontsize=8, frameon=False)

        elif ctype == "pie":
            vals = [float(d.get("value", 0) or 0) for d in data]
            if sum(vals) <= 0:
                return None
            ax.pie(vals, labels=[d.get("name", "") for d in data],
                   colors=[d.get("color") for d in data],
                   autopct="%1.0f%%", textprops={"fontsize": 8},
                   wedgeprops={"linewidth": 1, "edgecolor": "white"})
            ax.axis("equal")

        elif ctype == "stat_group":
            labels = [d.get("label", "") for d in data]
            vals = [float(d.get("value", 0) or 0) for d in data]
            bars = ax.barh(labels, vals, color=[d.get("color") for d in data])
            ax.invert_yaxis()
            for rect, v in zip(bars, vals):
                ax.text(rect.get_width(), rect.get_y() + rect.get_height() / 2,
                        f"  {int(v)}", va="center", fontsize=8)
        else:
            return None

        ax.set_title(spec.get("title", ""), fontsize=11, fontweight="bold")
        for s in ("top", "right"):
            ax.spines[s].set_visible(False)
        fig.tight_layout()
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight")
        return buf.getvalue()
    except Exception as exc:
        logger.warning("Chart render failed (%s): %s", ctype, exc)
        return None
    finally:
        plt.close(fig)


def table_from_chart(spec: Optional[dict]) -> Optional[Tuple[List[str], List[list]]]:
    """Derive a (headers, rows) table from a chart spec, so the chart data also
    appears as exact figures in the PDF."""
    if not spec:
        return None
    ctype = spec.get("chart_type")
    data = spec.get("data") or []
    if not data:
        return None
    if ctype == "bar":
        keys = spec.get("keys", [])
        key_names = [k["key"] for k in keys]
        xf = _x_field(data, key_names)
        headers = [xf.replace("_", " ").title()] + [k.get("name", k["key"]) for k in keys]
        rows = [[d.get(xf, "")] + [d.get(k["key"], 0) for k in keys] for d in data]
        return headers, rows
    if ctype == "pie":
        return ["Category", "Value"], [[d.get("name", ""), d.get("value", 0)] for d in data]
    if ctype == "stat_group":
        return ["Metric", "Value"], [[d.get("label", ""), d.get("value", 0)] for d in data]
    return None


# ── PDF assembly (fpdf2) ──────────────────────────────────────────────────────

def _pdf_table(pdf, headers: List[str], rows: List[list]) -> None:
    usable = 180.0
    w = usable / max(len(headers), 1)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(30, 42, 59)
    pdf.set_text_color(255, 255, 255)
    for h in headers:
        pdf.cell(w, 7, str(h)[:30], border=1, fill=True, align="C")
    pdf.ln()
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(20, 20, 20)
    fill = False
    for row in rows:
        pdf.set_fill_color(245, 247, 250) if fill else pdf.set_fill_color(255, 255, 255)
        for cell in row:
            pdf.cell(w, 6, str(cell)[:32], border=1, fill=True, align="L")
        pdf.ln()
        fill = not fill


def build_report(report_type: str, start: Optional[str], end: Optional[str],
                 db: Session) -> Tuple[bytes, str, str]:
    """Build the PDF. Returns (pdf_bytes, filename, title). Reuses aria._build_chart
    lazily (avoids an import cycle: aria never imports this module)."""
    from .aria import _build_chart  # lazy — break the import cycle

    spec_cfg = REPORTS.get(report_type) or REPORTS["overview"]
    report_type = report_type if report_type in REPORTS else "overview"
    title = spec_cfg["title"]

    args = {}
    subtitle_range = ""
    if spec_cfg["dated"]:
        start = start or date.today().isoformat()
        end = end or start
        args = {"start_date": start, "end_date": end}
        subtitle_range = f"  ·  {start} to {end}"

    from fpdf import FPDF
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Title banner
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_fill_color(30, 42, 59)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 11, title, ln=True, fill=True, align="C")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(110, 110, 110)
    pdf.cell(0, 6, f"Generated {date.today().isoformat()}{subtitle_range}  ·  Apex POB",
             ln=True, align="C")
    pdf.ln(3)
    pdf.set_text_color(0, 0, 0)

    produced_any = False
    for tool in spec_cfg["tools"]:
        result = execute_tool(tool, args, db)
        if not isinstance(result, dict) or "error" in result:
            logger.warning("Report tool %s error: %s", tool,
                           result.get("error") if isinstance(result, dict) else result)
            continue
        spec = _build_chart(tool, result)

        png = render_chart_png(spec)
        if png:
            pdf.image(io.BytesIO(png), x=20, w=170)
            pdf.ln(3)
            produced_any = True

        tbl = table_from_chart(spec)
        if tbl:
            _pdf_table(pdf, tbl[0], tbl[1])
            pdf.ln(3)
            produced_any = True

    if not produced_any:
        pdf.set_font("Helvetica", "", 11)
        pdf.multi_cell(0, 7, "No data available for this report and period.")

    filename = f"{report_type}_report_{date.today().isoformat()}.pdf"
    return bytes(pdf.output()), filename, title
