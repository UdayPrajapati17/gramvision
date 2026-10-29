# PDF export: the dataset summary and its written readings, as a printable page.
from __future__ import annotations

import textwrap
from datetime import datetime
from io import BytesIO

import pandas as pd
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.analytics.analysis import analyze

INK = (0.07, 0.16, 0.14)
MUTED = (0.42, 0.50, 0.48)
TEAL = (0.06, 0.61, 0.51)
MARGIN = 48


class _Page:
    """A tiny cursor that starts a new page before text runs off the bottom."""

    def __init__(self, pdf: canvas.Canvas, height: float):
        self.pdf = pdf
        self.height = height
        self.y = height - 56

    def space(self, amount: float) -> None:
        self.y -= amount

    def need(self, amount: float) -> None:
        if self.y - amount < 56:
            self.pdf.showPage()
            self.y = self.height - 56

    def write(self, text: str, size: int = 10, bold: bool = False, color=INK, leading: float = 14, width: int = 95) -> None:
        self.pdf.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        self.pdf.setFillColorRGB(*color)
        for line in textwrap.wrap(text, width=width) or [""]:
            self.need(leading)
            self.pdf.drawString(MARGIN, self.y, line)
            self.y -= leading

    def rule(self) -> None:
        self.need(12)
        self.pdf.setStrokeColorRGB(0.85, 0.90, 0.88)
        self.pdf.setLineWidth(0.6)
        self.pdf.line(MARGIN, self.y, A4[0] - MARGIN, self.y)
        self.y -= 14


def build_report(title: str, frame: pd.DataFrame, provenance: str, summary: dict | None = None) -> BytesIO:
    summary = summary or analyze(frame)
    stream = BytesIO()
    pdf = canvas.Canvas(stream, pagesize=A4)
    pdf.setTitle(f"GramVision report — {title}")
    page = _Page(pdf, A4[1])

    page.write("GramVision", size=11, bold=True, color=TEAL, leading=16)
    page.write(title[:90], size=20, bold=True, leading=26)
    page.write(
        f"Generated {datetime.utcnow().strftime('%d %B %Y, %H:%M UTC')}   ·   "
        f"{summary['rows']:,} rows   ·   {summary['columns']} columns",
        size=9,
        color=MUTED,
        leading=13,
    )
    page.write(provenance or "User-supplied dataset", size=9, color=MUTED, leading=13)
    page.rule()

    page.write("Overview", size=12, bold=True, leading=18)
    page.write(summary["interpretation"], size=10, color=(0.25, 0.36, 0.33), leading=14)
    page.space(6)

    readings = summary.get("readings") or []
    if readings:
        page.write("What the data shows", size=12, bold=True, leading=18)
        for reading in readings:
            page.write(reading, size=10, color=(0.25, 0.36, 0.33), leading=14)
            page.space(4)

    page.space(4)
    page.write("Data quality", size=12, bold=True, leading=18)
    page.write(f"Duplicate rows: {summary['duplicate_rows']:,}", size=10, leading=14)
    page.write(f"Columns containing blanks: {len(summary['missing'])}", size=10, leading=14)
    if summary["missing"]:
        worst = sorted(summary["missing"].items(), key=lambda item: item[1], reverse=True)[:6]
        page.write(
            "Most blanks: " + ", ".join(f"{name} ({count:,})" for name, count in worst),
            size=9,
            color=MUTED,
            leading=13,
        )

    page.space(8)
    page.write("Numeric columns", size=12, bold=True, leading=18)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.setFillColorRGB(*MUTED)
    page.need(14)
    for label, offset in (("Column", 0), ("Mean", 250), ("Minimum", 330), ("Maximum", 420)):
        pdf.drawString(MARGIN + offset, page.y, label)
    page.y -= 12

    for profile in [p for p in summary.get("profiles", []) if p.get("role") == "measure"][:60]:
        page.need(13)
        pdf.setFont("Helvetica", 8.5)
        pdf.setFillColorRGB(*INK)
        pdf.drawString(MARGIN, page.y, str(profile["name"])[:46])
        pdf.setFillColorRGB(0.33, 0.43, 0.40)
        for value, offset in (
            (profile.get("mean"), 250),
            (profile.get("min"), 330),
            (profile.get("max"), 420),
        ):
            pdf.drawString(MARGIN + offset, page.y, "—" if value is None else f"{value:,.2f}")
        page.y -= 13

    pdf.save()
    stream.seek(0)
    return stream
