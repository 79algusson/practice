import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os
import sys


def _get_font():
    """Try to register a Korean-capable font."""
    font_candidates = [
        # Linux
        "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        # Windows
        "C:/Windows/Fonts/malgun.ttf",
        "C:/Windows/Fonts/gulim.ttc",
        # macOS
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
    ]
    # Also check next to executable (bundled font)
    if getattr(sys, "frozen", False):
        base = sys._MEIPASS
    else:
        base = os.path.dirname(os.path.abspath(__file__))
    for name in ["NanumGothic.ttf", "malgun.ttf"]:
        p = os.path.join(base, "fonts", name)
        if os.path.exists(p):
            font_candidates.insert(0, p)

    for path in font_candidates:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont("KoreanFont", path))
                return "KoreanFont"
            except Exception:
                continue
    return "Helvetica"


def generate_pdf(output_path: str, keyword: str, date_str: str, result_text: str):
    font_name = _get_font()

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "KTitle",
        fontName=font_name,
        fontSize=18,
        leading=24,
        alignment=1,
        textColor=colors.HexColor("#2c5f8a"),
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        "KSubtitle",
        fontName=font_name,
        fontSize=12,
        leading=16,
        alignment=1,
        textColor=colors.HexColor("#555555"),
        spaceAfter=4,
    )
    heading_style = ParagraphStyle(
        "KHeading",
        fontName=font_name,
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#2c5f8a"),
        spaceBefore=10,
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "KBody",
        fontName=font_name,
        fontSize=9,
        leading=14,
        spaceAfter=4,
    )
    bold_body_style = ParagraphStyle(
        "KBoldBody",
        fontName=font_name,
        fontSize=10,
        leading=14,
        spaceAfter=3,
    )

    story = []

    # Cover page
    story.append(Spacer(1, 1.5 * cm))
    story.append(Paragraph("논문 검색 결과 보고서", title_style))
    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph(f"검색 키워드: {keyword}", subtitle_style))
    story.append(Paragraph(f"검색 일자: {date_str[:4]}년 {date_str[4:6]}월 {date_str[6:]}일", subtitle_style))
    story.append(Spacer(1, 0.3 * cm))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#2c5f8a")))
    story.append(Spacer(1, 0.5 * cm))

    # Parse and render result text
    lines = result_text.split("\n")
    for line in lines:
        line_stripped = line.strip()
        if not line_stripped:
            story.append(Spacer(1, 0.15 * cm))
            continue
        if line_stripped.startswith("---"):
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")))
            story.append(Spacer(1, 0.1 * cm))
            continue
        # Bold headings like **[1] Title** or **요약**
        if line_stripped.startswith("**") and line_stripped.endswith("**"):
            content = line_stripped[2:-2]
            content = _escape_xml(content)
            story.append(Paragraph(f"<b>{content}</b>", bold_body_style))
        elif "**" in line_stripped:
            # Inline bold
            rendered = _convert_bold(_escape_xml(line_stripped))
            story.append(Paragraph(rendered, body_style))
        else:
            story.append(Paragraph(_escape_xml(line_stripped), body_style))

    doc.build(story)


def _escape_xml(text: str) -> str:
    text = text.replace("&", "&amp;")
    text = text.replace("<", "&lt;")
    text = text.replace(">", "&gt;")
    return text


def _convert_bold(text: str) -> str:
    """Convert **text** markers to <b>text</b> for ReportLab."""
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
