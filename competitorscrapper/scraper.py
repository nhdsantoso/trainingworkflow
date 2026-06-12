"""
Scrapes XL, SIMPATI, and byU product pages using Firecrawl,
then parses pricing/quota data into structured dicts.
"""

import os, re, json
from firecrawl import V1FirecrawlApp as FirecrawlApp
from dotenv import load_dotenv

load_dotenv()

# ── Target URLs ──────────────────────────────────────────────────────────────
TARGETS = {
    "xl_kartu_perdana": [
        "https://www.xl.co.id/id/produk/kartu-perdana",
        "https://www.xl.co.id/id/produk/paket-data",
    ],
    "xl_broadband": [
        "https://www.xl.co.id/id/produk/xl-home",
        "https://www.xl.co.id/id/produk/broadband",
    ],
    "xl_addon": [
        "https://www.xl.co.id/id/produk/add-on",
        "https://www.xl.co.id/id/produk/paket-tambahan",
    ],
    "simpati": [
        "https://www.telkomsel.com/produk/kartu/simpati",
        "https://www.telkomsel.com/paket/internet",
    ],
    "byu": [
        "https://www.byu.id/",
        "https://www.byu.id/paket",
    ],
}

PRICE_BUCKETS = {
    "under_30k":   (0,     29_999),
    "30k_to_70k":  (30_000, 69_999),
    "70k_to_100k": (70_000, 99_999),
}


def _crawl(app: FirecrawlApp, url: str) -> str:
    """Return markdown content of a single URL."""
    try:
        result = app.scrape_url(
            url,
            formats=["markdown"],
            wait_for=2000,
            timeout=30000,
        )
        return result.markdown or ""
    except Exception as e:
        print(f"  [WARN] Failed to scrape {url}: {e}")
        return ""


def _extract_price(text: str) -> int | None:
    """Parse first Rp price found in text → integer."""
    # Matches: Rp 25.000 / Rp25000 / 25.000 / 25,000
    pattern = r"[Rr][Pp]\.?\s*([\d.,]+)"
    m = re.search(pattern, text)
    if not m:
        return None
    raw = m.group(1).replace(".", "").replace(",", "")
    try:
        return int(raw)
    except ValueError:
        return None


def _extract_quota(text: str) -> str | None:
    """Parse quota string e.g. '5 GB', '10GB', '500 MB'."""
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(GB|MB|TB)", text, re.IGNORECASE)
    return f"{m.group(1)} {m.group(2).upper()}" if m else None


def _extract_validity(text: str) -> str | None:
    """Parse validity e.g. '30 hari', '7 days'."""
    m = re.search(r"(\d+)\s*(hari|days?|bulan|months?)", text, re.IGNORECASE)
    return f"{m.group(1)} {m.group(2)}" if m else None


def _parse_products(markdown: str, brand: str, category: str) -> list[dict]:
    """
    Heuristic block parser: splits markdown on price mentions,
    extracts product name / price / quota / validity per block.
    """
    products = []
    # Split on bullet points or heading-like lines
    blocks = re.split(r"\n(?=[-*#]|\d+\.)", markdown)
    for block in blocks:
        price = _extract_price(block)
        if price is None:
            continue
        quota    = _extract_quota(block)
        validity = _extract_validity(block)
        # Product name: first non-empty line of block (strip markdown symbols)
        name_line = next(
            (l.strip().lstrip("#-*0123456789. ") for l in block.split("\n") if l.strip()),
            "Unknown Product",
        )
        name_line = name_line[:80]
        products.append({
            "brand":    brand,
            "category": category,
            "name":     name_line,
            "price":    price,
            "quota":    quota or "–",
            "validity": validity or "–",
            "bucket":   _bucket(price),
        })
    return products


def _bucket(price: int) -> str | None:
    for label, (lo, hi) in PRICE_BUCKETS.items():
        if lo <= price <= hi:
            return label
    return None  # outside tracked range


def scrape_all() -> dict[str, list[dict]]:
    """
    Main entry point. Returns:
    {
      "xl_kartu_perdana": [...],
      "xl_broadband":     [...],
      "xl_addon":         [...],
      "simpati":          [...],
      "byu":              [...],
    }
    """
    api_key = os.getenv("FIRECRAWL_API_KEY")
    if not api_key:
        raise EnvironmentError("FIRECRAWL_API_KEY not set in environment / .env file")

    app = FirecrawlApp(api_key=api_key)
    results: dict[str, list[dict]] = {}

    BRAND_MAP = {
        "xl_kartu_perdana": ("XL",       "Kartu Perdana"),
        "xl_broadband":     ("XL",       "Broadband"),
        "xl_addon":         ("XL",       "Add-On"),
        "simpati":          ("Telkomsel","SIMPATI"),
        "byu":              ("Telkomsel","byU"),
    }

    for key, urls in TARGETS.items():
        brand, category = BRAND_MAP[key]
        print(f"\n[SCRAPING] {brand} – {category}")
        all_products: list[dict] = []
        for url in urls:
            print(f"  → {url}")
            md = _crawl(app, url)
            products = _parse_products(md, brand, category)
            print(f"     Found {len(products)} products")
            all_products.extend(products)

        # Deduplicate by name
        seen = set()
        deduped = []
        for p in all_products:
            if p["name"] not in seen:
                seen.add(p["name"])
                deduped.append(p)

        results[key] = deduped

    return results


def save_json(data: dict, path: str = "scraped_data.json"):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\n[SAVED] {path}")


if __name__ == "__main__":
    data = scrape_all()
    save_json(data)
    total = sum(len(v) for v in data.values())
    print(f"\nTotal products scraped: {total}")
