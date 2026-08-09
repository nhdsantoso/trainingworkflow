"""
Firecrawl-based scraper. Crawls all configured URLs, parses them,
and returns structured data grouped by brand type and role.
"""

import os
import json

from firecrawl import V1FirecrawlApp as FirecrawlApp
from dotenv import load_dotenv

from parsers import (
    parse_products,
    parse_promos,
    parse_complaints,
    parse_programs,
    parse_services,
)
from sources import (
    MOBILE_COMPETITORS,
    MOBILE_TELKOMSEL,
    FIXED_COMPETITORS,
    FIXED_TELKOMSEL,
)

load_dotenv()

# Maps brand key → (display_name, segment, brand_type)
SEGMENT_MAP: dict[str, tuple[str, str, str]] = {
    # mobile competitors
    "xl":        ("XL",          "mass",     "mobile"),
    "ioh":       ("IOH",         "mass",     "mobile"),
    "smartxl":   ("SmartXL",     "youth",    "mobile"),
    "tri":        ("Tri",         "youth",    "mobile"),
    # mobile telkomsel
    "simpati":   ("SIMPATI",     "mass",     "mobile"),
    "byu":       ("byU",         "youth",    "mobile"),
    "halo":      ("Halo",        "premium",  "mobile"),
    # fixed competitors
    "myrepublic": ("MyRepublic", "home",     "fixed"),
    "iconnet":   ("Icon Net",    "home",     "fixed"),
    "biznet":    ("BizNet",      "home",     "fixed"),
    # fixed telkomsel
    "indihome":  ("IndiHome",    "home",     "fixed"),
    "eznet":     ("EZnet",       "business", "fixed"),
}

PARSER_MAP = {
    "product":   parse_products,
    "promo":     parse_promos,
    "complaint": parse_complaints,
    "program":   parse_programs,
    "service":   parse_services,
}


def crawl(app: FirecrawlApp, url: str) -> str:
    """
    Scrape a single URL and return markdown text.
    Returns empty string on any error.
    """
    try:
        result = app.scrape_url(url, formats=["markdown"], wait_for=2000, timeout=30000)
        return result.markdown or ""
    except Exception as e:
        print(f"  [WARN] {url}: {e}")
        return ""


def scrape_group(
    app: FirecrawlApp,
    group: dict[str, dict[str, list[str]]],
    is_telkomsel: bool,
) -> list[dict]:
    """
    Scrape all brands in a group dict.

    Args:
        app:           Initialized FirecrawlApp instance.
        group:         Brand → category → [URLs] mapping.
        is_telkomsel:  True if this group is Telkomsel brands.

    Returns:
        Flat list of parsed item dicts.
    """
    all_items: list[dict] = []
    role = "telkomsel" if is_telkomsel else "competitor"

    for brand_key, categories in group.items():
        display_name, segment, brand_type = SEGMENT_MAP[brand_key]
        print(f"\n  [{role.upper()}] {display_name} ({segment})")

        for cat, urls in categories.items():
            parser = PARSER_MAP.get(cat)
            if parser is None:
                print(f"    [SKIP] No parser for category: {cat}")
                continue

            for url in urls:
                print(f"    → [{cat}] {url}")
                md = crawl(app, url)
                if not md:
                    continue

                if cat == "product":
                    # parse_products takes an extra category_type arg
                    items = parser(md, display_name, segment, brand_type)
                else:
                    items = parser(md, display_name, segment)

                for item in items:
                    item["role"] = role
                    item["brand_type"] = brand_type

                print(f"       {len(items)} items extracted")
                all_items.extend(items)

    return all_items


def scrape_all() -> dict:
    """
    Run the full scrape across mobile and fixed brands.

    Returns:
        Nested dict:
        {
            "mobile": {"competitor": [...], "telkomsel": [...]},
            "fixed":  {"competitor": [...], "telkomsel": [...]},
        }

    Raises:
        EnvironmentError: If FIRECRAWL_API_KEY is not set.
    """
    api_key = os.getenv("FIRECRAWL_API_KEY")
    if not api_key:
        raise EnvironmentError("FIRECRAWL_API_KEY not set. Copy .env.example to .env and add your key.")

    app = FirecrawlApp(api_key=api_key)

    print("\n=== MOBILE ===")
    mobile_competitor = scrape_group(app, MOBILE_COMPETITORS, is_telkomsel=False)
    mobile_telkomsel  = scrape_group(app, MOBILE_TELKOMSEL,  is_telkomsel=True)

    print("\n=== FIXED ===")
    fixed_competitor = scrape_group(app, FIXED_COMPETITORS, is_telkomsel=False)
    fixed_telkomsel  = scrape_group(app, FIXED_TELKOMSEL,   is_telkomsel=True)

    return {
        "mobile": {
            "competitor": mobile_competitor,
            "telkomsel":  mobile_telkomsel,
        },
        "fixed": {
            "competitor": fixed_competitor,
            "telkomsel":  fixed_telkomsel,
        },
    }


def save_json(data: dict, path: str = "data/output.json") -> None:
    """
    Serialize data to JSON and write to path.

    Args:
        data: The scraped data dict.
        path: Target file path (directory created if needed).
    """
    os.makedirs(os.path.dirname(path) if os.path.dirname(path) else ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\n[SAVED] {path}")
