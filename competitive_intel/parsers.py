"""
Product, promo, complaint, program, and service extractors.
Takes markdown text and returns structured data dicts.
"""

import re

REGIONS = [
    # Kalimantan
    "kalimantan", "balikpapan", "samarinda", "banjarmasin", "pontianak", "palangkaraya",
    # Sulawesi
    "sulawesi", "makassar", "manado", "palu", "kendari", "gorontalo",
    # Maluku
    "maluku", "ambon", "ternate", "sorong",
    # Papua
    "papua", "jayapura", "timika", "merauke", "manokwari",
]


def detect_regions(text: str) -> list[str]:
    """Return list of REGIONS keywords found in text (case-insensitive, deduplicated)."""
    found = []
    tl = text.lower()
    for r in REGIONS:
        if r in tl:
            found.append(r)
    return list(set(found))


def extract_price(text: str) -> int | None:
    """Extract first Rp price found; returns integer or None."""
    m = re.search(r"[Rr][Pp]\.?\s*([\d.,]+)", text)
    if not m:
        return None
    raw = m.group(1).replace(".", "").replace(",", "")
    try:
        return int(raw)
    except ValueError:
        return None


def extract_quota(text: str) -> str | None:
    """Extract first data quota (e.g. '10 GB') or None."""
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(GB|MB|TB)", text, re.IGNORECASE)
    return f"{m.group(1)} {m.group(2).upper()}" if m else None


def extract_validity(text: str) -> str | None:
    """Extract first validity period (hari/bulan/days/months) or None."""
    m = re.search(r"(\d+)\s*(hari|days?|bulan|months?)", text, re.IGNORECASE)
    return f"{m.group(1)} {m.group(2)}" if m else None


def _split_blocks(markdown: str) -> list[str]:
    """Split markdown into logical blocks on list/heading boundaries."""
    return re.split(r"\n(?=[-*#]|\d+\.)", markdown)


def _first_line(block: str, fallback: str = "Unknown") -> str:
    """Return first non-empty line of a block, stripped of leading markers."""
    for line in block.split("\n"):
        stripped = line.strip().lstrip("#-*0123456789. ")
        if stripped:
            return stripped
    return fallback


def parse_products(markdown: str, brand: str, segment: str, category_type: str) -> list[dict]:
    """
    Extract product items (packages with a price) from markdown.

    Args:
        markdown:      Raw markdown text from the scraped page.
        brand:         Display brand name (e.g. "XL").
        segment:       Target segment (e.g. "mass", "youth", "premium", "home", "business").
        category_type: Brand type string (e.g. "mobile", "fixed").

    Returns:
        List of product dicts.
    """
    products = []
    blocks = _split_blocks(markdown)
    for block in blocks:
        price = extract_price(block)
        if price is None:
            continue
        products.append({
            "brand": brand,
            "segment": segment,
            "category": "product",
            "brand_type": category_type,
            "name": _first_line(block)[:80],
            "price": price,
            "quota": extract_quota(block) or "–",
            "validity": extract_validity(block) or "–",
            "regions": detect_regions(block),
            "raw_snippet": block[:300],
        })
    return products


def parse_promos(markdown: str, brand: str, segment: str) -> list[dict]:
    """
    Extract promotional items from markdown.

    Args:
        markdown: Raw markdown text.
        brand:    Display brand name.
        segment:  Target segment.

    Returns:
        List of promo dicts.
    """
    promos = []
    blocks = _split_blocks(markdown)
    keywords = ["promo", "diskon", "cashback", "gratis", "bonus", "hemat", "special", "offer"]
    for block in blocks:
        if len(block.strip()) < 20:
            continue
        if not any(k in block.lower() for k in keywords):
            continue
        promos.append({
            "brand": brand,
            "segment": segment,
            "category": "promo",
            "title": _first_line(block, "Promo")[:100],
            "price": extract_price(block),
            "regions": detect_regions(block),
            "snippet": block[:300],
        })
    return promos


def parse_complaints(markdown: str, brand: str, segment: str) -> list[dict]:
    """
    Extract complaint/review items and classify sentiment from markdown.

    Args:
        markdown: Raw markdown text.
        brand:    Display brand name.
        segment:  Target segment.

    Returns:
        List of complaint dicts with sentiment field.
    """
    complaints = []
    blocks = _split_blocks(markdown)
    neg_kw = ["lambat", "lemot", "gangguan", "mati", "tidak bisa", "buruk",
              "kecewa", "jelek", "error", "down", "masalah"]
    pos_kw = ["bagus", "cepat", "stabil", "puas", "mantap", "recommended",
              "oke", "baik", "lancar"]
    for block in blocks:
        if len(block.strip()) < 20:
            continue
        tl = block.lower()
        neg = sum(1 for k in neg_kw if k in tl)
        pos = sum(1 for k in pos_kw if k in tl)
        if neg == 0 and pos == 0:
            continue
        if neg > pos:
            sentiment = "negative"
        elif pos > neg:
            sentiment = "positive"
        else:
            sentiment = "neutral"
        complaints.append({
            "brand": brand,
            "segment": segment,
            "category": "complaint",
            "title": _first_line(block, "Review")[:100],
            "sentiment": sentiment,
            "regions": detect_regions(block),
            "snippet": block[:300],
        })
    return complaints


def parse_programs(markdown: str, brand: str, segment: str) -> list[dict]:
    """
    Extract loyalty/program items from markdown.

    Args:
        markdown: Raw markdown text.
        brand:    Display brand name.
        segment:  Target segment.

    Returns:
        List of program dicts.
    """
    programs = []
    blocks = _split_blocks(markdown)
    kw = ["poin", "reward", "loyalty", "bundling", "cicilan", "installment",
          "program", "benefit", "privilege"]
    for block in blocks:
        if not any(k in block.lower() for k in kw):
            continue
        if len(block.strip()) < 20:
            continue
        programs.append({
            "brand": brand,
            "segment": segment,
            "category": "program",
            "title": _first_line(block, "Program")[:100],
            "regions": detect_regions(block),
            "snippet": block[:300],
        })
    return programs


def parse_services(markdown: str, brand: str, segment: str) -> list[dict]:
    """
    Extract network/service coverage items from markdown.

    Args:
        markdown: Raw markdown text.
        brand:    Display brand name.
        segment:  Target segment.

    Returns:
        List of service dicts.
    """
    services = []
    blocks = _split_blocks(markdown)
    kw = ["4g", "5g", "lte", "coverage", "jaringan", "kecepatan", "speed",
          "mbps", "gbps", "fiber", "ftth"]
    for block in blocks:
        if not any(k in block.lower() for k in kw):
            continue
        if len(block.strip()) < 20:
            continue
        services.append({
            "brand": brand,
            "segment": segment,
            "category": "service",
            "title": _first_line(block, "Service")[:100],
            "regions": detect_regions(block),
            "snippet": block[:300],
        })
    return services
