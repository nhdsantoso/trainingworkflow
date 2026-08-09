"""
Orchestrator: scrape → save JSON → print summary.

Usage:
    python main.py              # full scrape + save
    python main.py --cached     # skip scrape, load existing data/output.json
"""

import sys
import json
import os

from scraper import scrape_all, save_json

JSON_PATH = "data/output.json"


def summarize(data: dict) -> None:
    """Print per-brand item counts grouped by brand type and role."""
    for brand_type in ("mobile", "fixed"):
        print(f"\n── {brand_type.upper()} ──")
        for role in ("competitor", "telkomsel"):
            items = data.get(brand_type, {}).get(role, [])
            by_brand: dict[str, int] = {}
            for item in items:
                b = item.get("brand", "?")
                by_brand[b] = by_brand.get(b, 0) + 1
            print(f"  [{role}]")
            for brand, count in sorted(by_brand.items()):
                print(f"    {brand:15s}: {count} items")


def main() -> None:
    print("=" * 60)
    print("  Competitive Intelligence Scraper")
    print("  Mobile: XL, IOH, SmartXL, Tri  vs  SIMPATI, byU, Halo")
    print("  Fixed:  MyRepublic, Icon Net, BizNet  vs  IndiHome, EZnet")
    print("  Region: Kalimantan · Sulawesi · Maluku · Papua")
    print("=" * 60)

    if "--cached" in sys.argv and os.path.exists(JSON_PATH):
        print(f"\n[INFO] Using cached: {JSON_PATH}")
        with open(JSON_PATH, encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = scrape_all()
        save_json(data, JSON_PATH)

    summarize(data)
    print(f"\n  Done! Data saved to {JSON_PATH}")
    print("    Open dashboard/index.html in browser to view results.")


if __name__ == "__main__":
    main()
