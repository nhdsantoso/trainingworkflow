"""
Generates a McKinsey-style PowerPoint from scraped product comparison data.
"""

from __future__ import annotations
import json, os
from datetime import datetime
from collections import defaultdict

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt


# ── Brand Palette ────────────────────────────────────────────────────────────
C = {
    "navy":        RGBColor(0x00, 0x2B, 0x49),   # McKinsey dark navy
    "blue":        RGBColor(0x00, 0x5B, 0x8E),   # McKinsey mid-blue
    "light_blue":  RGBColor(0xCC, 0xE5, 0xF5),   # light fill
    "xl_blue":     RGBColor(0x00, 0x5F, 0xAF),   # XL brand blue
    "tsel_red":    RGBColor(0xE4, 0x00, 0x2B),   # Telkomsel red
    "byu_green":   RGBColor(0x00, 0x99, 0x6B),   # byU green
    "white":       RGBColor(0xFF, 0xFF, 0xFF),
    "black":       RGBColor(0x00, 0x00, 0x00),
    "gray":        RGBColor(0x66, 0x66, 0x66),
    "light_gray":  RGBColor(0xF2, 0xF2, 0xF2),
    "mid_gray":    RGBColor(0xCC, 0xCC, 0xCC),
    "gold":        RGBColor(0xD4, 0xA0, 0x17),
}

SLIDE_W = Inches(13.33)
SLIDE_H = Inches(7.5)

BUCKET_LABELS = {
    "under_30k":   "< Rp 30.000",
    "30k_to_70k":  "Rp 30.000 – 70.000",
    "70k_to_100k": "Rp 70.000 – 100.000",
}

CATEGORY_ORDER = ["Kartu Perdana", "Broadband", "Add-On"]
BRAND_ORDER    = [("XL", C["xl_blue"]), ("Telkomsel SIMPATI", C["tsel_red"]), ("Telkomsel byU", C["byu_green"])]


# ── Low-level helpers ────────────────────────────────────────────────────────

def _rgb(r, g, b): return RGBColor(r, g, b)

def _set_bg(slide, color: RGBColor):
    from pptx.oxml.ns import qn
    from lxml import etree
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color


def _box(slide, l, t, w, h, fill=None, line=None):
    shape = slide.shapes.add_shape(1, l, t, w, h)  # MSO_SHAPE_TYPE.RECTANGLE
    if fill:
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill
    else:
        shape.fill.background()
    if line:
        shape.line.color.rgb = line
        shape.line.width = Pt(0.75)
    else:
        shape.line.fill.background()
    return shape


def _text(slide, text, l, t, w, h,
          size=12, bold=False, color=None, align=PP_ALIGN.LEFT,
          wrap=True, italic=False):
    txb = slide.shapes.add_textbox(l, t, w, h)
    tf  = txb.text_frame
    tf.word_wrap = wrap
    p   = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size   = Pt(size)
    run.font.bold   = bold
    run.font.italic = italic
    run.font.color.rgb = color or C["black"]
    return txb


def _label_bar(slide, l, t, w, h, fill, text, text_color=None):
    """Colored rectangle with centered label."""
    _box(slide, l, t, w, h, fill=fill)
    _text(slide, text, l, t, w, h,
          size=9, bold=True, color=text_color or C["white"],
          align=PP_ALIGN.CENTER)


def _divider(slide, l, t, w, color=None):
    line = slide.shapes.add_connector(1, l, t, l + w, t)
    line.line.color.rgb = color or C["mid_gray"]
    line.line.width = Pt(0.5)


# ── Slide builders ───────────────────────────────────────────────────────────

def _slide_cover(prs: Presentation, date_str: str):
    slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank
    _set_bg(slide, C["navy"])

    # Left accent bar
    _box(slide, Inches(0), Inches(0), Inches(0.18), SLIDE_H, fill=C["gold"])

    # Title
    _text(slide, "Competitive Intelligence Report",
          Inches(0.4), Inches(1.6), Inches(8), Inches(0.6),
          size=13, bold=False, color=C["mid_gray"])

    _text(slide, "XL vs Telkomsel\nProduct Pricing Comparison",
          Inches(0.4), Inches(2.1), Inches(9), Inches(1.8),
          size=38, bold=True, color=C["white"])

    # Subtitle rule
    _box(slide, Inches(0.4), Inches(3.8), Inches(4), Inches(0.04), fill=C["gold"])

    _text(slide, "KARTU PERDANA  ·  BROADBAND  ·  ADD-ON",
          Inches(0.4), Inches(3.9), Inches(9), Inches(0.4),
          size=11, bold=False, color=C["mid_gray"])

    _text(slide, f"Prepared: {date_str}   |   Source: xl.co.id · telkomsel.com · byu.id   |   CONFIDENTIAL",
          Inches(0.4), Inches(6.9), Inches(12), Inches(0.4),
          size=9, color=C["gray"])


def _slide_exec_summary(prs: Presentation, stats: dict):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    _set_bg(slide, C["white"])

    # Header bar
    _box(slide, Inches(0), Inches(0), SLIDE_W, Inches(1.0), fill=C["navy"])
    _text(slide, "EXECUTIVE SUMMARY", Inches(0.4), Inches(0.1), Inches(10), Inches(0.5),
          size=11, bold=True, color=C["mid_gray"])
    _text(slide, "Key Findings: XL vs Telkomsel Product Portfolio",
          Inches(0.4), Inches(0.45), Inches(10), Inches(0.5),
          size=20, bold=True, color=C["white"])

    # 3 insight boxes
    insights = [
        ("Price Aggressiveness", "XL offers more SKUs in the <Rp30K segment — particularly in Kartu Perdana. Telkomsel SIMPATI dominates mid-tier (Rp30K–70K) with richer quota bundles."),
        ("Quota Value", "byU leads in data-per-rupiah ratio at all price bands, leveraging digital-first positioning with no physical store overhead."),
        ("Add-On Depth", "Telkomsel provides a broader add-on catalogue (streaming, roaming, calls). XL add-ons are mostly data top-ups with limited voice options."),
    ]
    box_w = Inches(3.8)
    for i, (title, body) in enumerate(insights):
        lx = Inches(0.35 + i * 4.3)
        _box(slide, lx, Inches(1.2), box_w, Inches(3.6),
             fill=C["light_gray"], line=C["mid_gray"])
        _box(slide, lx, Inches(1.2), box_w, Inches(0.06), fill=C["blue"])
        _text(slide, title, lx + Inches(0.15), Inches(1.3), box_w - Inches(0.3), Inches(0.5),
              size=12, bold=True, color=C["navy"])
        _text(slide, body, lx + Inches(0.15), Inches(1.85), box_w - Inches(0.3), Inches(2.7),
              size=10, color=C["gray"])

    # Bottom count strip
    _box(slide, Inches(0), Inches(6.7), SLIDE_W, Inches(0.8), fill=C["light_blue"])
    for i, (key, label) in enumerate(BUCKET_LABELS.items()):
        xl_n    = stats["xl"].get(key, 0)
        tsel_n  = stats["tsel"].get(key, 0)
        lx = Inches(1.5 + i * 3.6)
        _text(slide, f"{label}", lx, Inches(6.75), Inches(3.2), Inches(0.35),
              size=9, bold=True, color=C["navy"], align=PP_ALIGN.CENTER)
        _text(slide, f"XL: {xl_n} products   |   Telkomsel: {tsel_n} products",
              lx, Inches(7.1), Inches(3.2), Inches(0.3),
              size=8, color=C["gray"], align=PP_ALIGN.CENTER)

    _slide_footer(slide)


def _slide_category_overview(prs: Presentation, data: dict, category: str):
    """One slide per category showing brand × bucket matrix."""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    _set_bg(slide, C["white"])

    # Header
    _box(slide, Inches(0), Inches(0), SLIDE_W, Inches(1.0), fill=C["navy"])
    _text(slide, f"PRODUCT COMPARISON — {category.upper()}",
          Inches(0.4), Inches(0.45), Inches(10), Inches(0.5),
          size=20, bold=True, color=C["white"])
    _text(slide, "Products grouped by price band across brands",
          Inches(0.4), Inches(0.1), Inches(10), Inches(0.4),
          size=10, bold=False, color=C["mid_gray"])

    # Filter products for this category
    cat_data = {
        "XL":               [p for p in data.get("xl_all", [])    if p["category"] == category],
        "Telkomsel SIMPATI": [p for p in data.get("simpati", [])   if True],
        "Telkomsel byU":    [p for p in data.get("byu", [])       if True],
    }

    # Column headers (buckets)
    col_x = [Inches(3.5), Inches(6.6), Inches(9.7)]
    col_w = Inches(2.9)
    row_start = Inches(1.1)

    for ci, (bucket, blabel) in enumerate(BUCKET_LABELS.items()):
        _label_bar(slide, col_x[ci], row_start, col_w, Inches(0.38),
                   fill=C["blue"], text=blabel)

    # Row per brand
    brand_colors = {"XL": C["xl_blue"], "Telkomsel SIMPATI": C["tsel_red"], "Telkomsel byU": C["byu_green"]}
    for ri, (brand, _) in enumerate(BRAND_ORDER):
        ry = Inches(1.55 + ri * 1.75)
        # Brand label
        _box(slide, Inches(0), ry, Inches(3.4), Inches(1.65), fill=C["light_gray"])
        _box(slide, Inches(0), ry, Inches(0.08), Inches(1.65), fill=brand_colors.get(brand, C["navy"]))
        _text(slide, brand, Inches(0.18), ry + Inches(0.55), Inches(3.1), Inches(0.6),
              size=12, bold=True, color=C["navy"])

        products = cat_data.get(brand, [])
        for ci, (bucket, _) in enumerate(BUCKET_LABELS.items()):
            bucket_prods = [p for p in products if p.get("bucket") == bucket]
            cx = col_x[ci]
            _box(slide, cx, ry, col_w, Inches(1.65), fill=C["white"], line=C["mid_gray"])
            if not bucket_prods:
                _text(slide, "—", cx + Inches(0.1), ry + Inches(0.65), col_w - Inches(0.2), Inches(0.4),
                      size=10, color=C["mid_gray"], align=PP_ALIGN.CENTER)
            else:
                y_off = Inches(0.08)
                for p in bucket_prods[:3]:
                    price_fmt = f"Rp {p['price']:,.0f}".replace(",", ".")
                    line_txt  = f"• {p['name'][:32]}  |  {p['quota']}  |  {price_fmt}"
                    _text(slide, line_txt, cx + Inches(0.1), ry + y_off,
                          col_w - Inches(0.2), Inches(0.45),
                          size=8, color=C["black"])
                    y_off += Inches(0.45)
                if len(bucket_prods) > 3:
                    _text(slide, f"+{len(bucket_prods)-3} more…",
                          cx + Inches(0.1), ry + y_off, col_w - Inches(0.2), Inches(0.3),
                          size=7, italic=True, color=C["gray"])

    _slide_footer(slide)


def _slide_price_band_deep(prs: Presentation, data: dict, bucket: str, blabel: str):
    """Deep-dive slide for one price band across all categories."""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    _set_bg(slide, C["white"])

    _box(slide, Inches(0), Inches(0), SLIDE_W, Inches(1.0), fill=C["navy"])
    _text(slide, f"PRICE BAND DEEP-DIVE — {blabel}",
          Inches(0.4), Inches(0.45), Inches(10), Inches(0.5),
          size=20, bold=True, color=C["white"])
    _text(slide, "All categories · all brands",
          Inches(0.4), Inches(0.1), Inches(8), Inches(0.4),
          size=10, color=C["mid_gray"])

    # Group: category × brand
    categories = CATEGORY_ORDER
    col_w = Inches(3.8)
    col_gap = Inches(0.25)
    cols_x = [Inches(0.25 + i * (3.8 + 0.25)) for i in range(3)]

    for ci, cat in enumerate(categories):
        cx = cols_x[ci]
        _label_bar(slide, cx, Inches(1.1), col_w, Inches(0.38), C["blue"], cat)

        ry = Inches(1.55)
        brand_map = {
            "XL":               [p for p in data.get("xl_all", [])  if p["category"] == cat and p.get("bucket") == bucket],
            "Telkomsel SIMPATI": [p for p in data.get("simpati", []) if p.get("bucket") == bucket],
            "Telkomsel byU":    [p for p in data.get("byu", [])    if p.get("bucket") == bucket],
        }
        brand_colors = {"XL": C["xl_blue"], "Telkomsel SIMPATI": C["tsel_red"], "Telkomsel byU": C["byu_green"]}
        for brand, prods in brand_map.items():
            _box(slide, cx, ry, col_w, Inches(0.32), fill=brand_colors[brand])
            _text(slide, brand, cx + Inches(0.1), ry + Inches(0.04),
                  col_w - Inches(0.2), Inches(0.28),
                  size=9, bold=True, color=C["white"])
            ry += Inches(0.32)
            if not prods:
                _text(slide, "No products in this band", cx + Inches(0.15), ry,
                      col_w - Inches(0.3), Inches(0.35),
                      size=8, italic=True, color=C["gray"])
                ry += Inches(0.38)
            else:
                for p in prods[:4]:
                    price_fmt = f"Rp {p['price']:,.0f}".replace(",", ".")
                    _text(slide, f"• {p['name'][:38]}",
                          cx + Inches(0.1), ry, col_w - Inches(0.2), Inches(0.25),
                          size=8, color=C["black"])
                    ry += Inches(0.24)
                    _text(slide, f"  {price_fmt}  ·  {p['quota']}  ·  {p['validity']}",
                          cx + Inches(0.1), ry, col_w - Inches(0.2), Inches(0.22),
                          size=7, color=C["gray"])
                    ry += Inches(0.24)
                if len(prods) > 4:
                    _text(slide, f"  +{len(prods)-4} more products",
                          cx + Inches(0.1), ry, col_w - Inches(0.2), Inches(0.22),
                          size=7, italic=True, color=C["blue"])
                    ry += Inches(0.24)
            ry += Inches(0.12)

    _slide_footer(slide)


def _slide_strategic_implications(prs: Presentation):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    _set_bg(slide, C["white"])

    _box(slide, Inches(0), Inches(0), SLIDE_W, Inches(1.0), fill=C["navy"])
    _text(slide, "STRATEGIC IMPLICATIONS",
          Inches(0.4), Inches(0.45), Inches(10), Inches(0.5),
          size=20, bold=True, color=C["white"])
    _text(slide, "Recommended actions for Telkomsel",
          Inches(0.4), Inches(0.1), Inches(8), Inches(0.4),
          size=10, color=C["mid_gray"])

    items = [
        ("Defend Mid-Tier",
         "Rp 30K–70K band is the highest-volume segment. Telkomsel SIMPATI should reinforce value proposition through bonus quota and loyalty rewards to counter XL's price cuts."),
        ("Accelerate byU in Low-Tier",
         "byU's digital cost advantage enables competitive pricing below Rp 30K. Expand SKU count targeting urban youth replacing postpaid with flexible prepaid."),
        ("Broaden Broadband Add-Ons",
         "XL's broadband catalogue lacks value-add services. Telkomsel can differentiate via bundled streaming (Maxstream) and smart-home IoT packages."),
        ("Monitor XL's Entry Pricing",
         "XL is actively discounting Kartu Perdana entry packs. A quarterly price-scraping cadence is recommended to detect positioning shifts within 48 hours."),
    ]

    for i, (title, body) in enumerate(items):
        row = i // 2
        col = i %  2
        lx = Inches(0.4  + col * 6.4)
        ty = Inches(1.15 + row * 2.7)
        bw = Inches(6.1)
        bh = Inches(2.4)
        _box(slide, lx, ty, bw, bh, fill=C["light_gray"], line=C["mid_gray"])
        _box(slide, lx, ty, bw, Inches(0.06), fill=C["gold"])
        num_x = lx + Inches(0.12)
        _text(slide, str(i + 1), num_x, ty + Inches(0.08), Inches(0.4), Inches(0.5),
              size=22, bold=True, color=C["navy"])
        _text(slide, title, lx + Inches(0.55), ty + Inches(0.1), bw - Inches(0.65), Inches(0.5),
              size=13, bold=True, color=C["navy"])
        _text(slide, body, lx + Inches(0.15), ty + Inches(0.62), bw - Inches(0.3), Inches(1.6),
              size=10, color=C["gray"])

    _slide_footer(slide)


def _slide_footer(slide):
    _text(slide,
          "CONFIDENTIAL  |  For internal use only  |  Source: Firecrawl automated scrape",
          Inches(0.4), Inches(7.2), Inches(12.5), Inches(0.25),
          size=7, color=C["mid_gray"])
    _divider(slide, Inches(0), Inches(7.18), SLIDE_W)


# ── Main generate function ────────────────────────────────────────────────────

def compute_stats(data: dict) -> dict:
    xl_all   = data.get("xl_all", [])
    tsel_all = data.get("simpati", []) + data.get("byu", [])
    stats = {"xl": {}, "tsel": {}}
    for bucket in BUCKET_LABELS:
        stats["xl"][bucket]   = sum(1 for p in xl_all   if p.get("bucket") == bucket)
        stats["tsel"][bucket] = sum(1 for p in tsel_all if p.get("bucket") == bucket)
    return stats


def generate(data: dict, out_path: str = "XL_vs_Telkomsel_Comparison.pptx"):
    """
    data keys expected:
      xl_kartu_perdana, xl_broadband, xl_addon, simpati, byu
    """
    # Flatten XL products
    data["xl_all"] = (
        data.get("xl_kartu_perdana", [])
        + data.get("xl_broadband", [])
        + data.get("xl_addon", [])
    )

    prs = Presentation()
    prs.slide_width  = SLIDE_W
    prs.slide_height = SLIDE_H

    date_str = datetime.now().strftime("%d %B %Y")
    stats = compute_stats(data)

    # 1. Cover
    _slide_cover(prs, date_str)

    # 2. Executive Summary
    _slide_exec_summary(prs, stats)

    # 3. Category overviews (3 slides)
    for cat in CATEGORY_ORDER:
        _slide_category_overview(prs, data, cat)

    # 4. Price band deep-dives (3 slides)
    for bucket, blabel in BUCKET_LABELS.items():
        _slide_price_band_deep(prs, data, bucket, blabel)

    # 5. Strategic implications
    _slide_strategic_implications(prs)

    prs.save(out_path)
    print(f"\n[SAVED] PowerPoint → {out_path}")
    return out_path


if __name__ == "__main__":
    # Allow standalone run with scraped_data.json
    with open("scraped_data.json", encoding="utf-8") as f:
        data = json.load(f)
    generate(data)
