"""
Entry point.
  python main.py              # scrape websites only
  python main.py --social     # scrape websites + social + reviews
  python main.py --cached     # skip scrape, use existing data/output.json
  python main.py --schedule   # run every 6h (websites + social)
"""

import sys, json, os
from datetime import datetime
from scraper import scrape_all, save_json


def summarize(data):
    for brand_type in ("mobile", "fixed"):
        bd = data.get(brand_type, {})
        print(f"\n── {brand_type.upper()} ──")
        for role in ("competitor", "telkomsel"):
            items = bd.get(role, [])
            by_brand = {}
            for item in items:
                b = item.get("brand", "?")
                by_brand[b] = by_brand.get(b, 0) + 1
            print(f"  [{role}]")
            for brand, count in sorted(by_brand.items()):
                src_counts = {}
                for item in items:
                    if item.get("brand") == brand:
                        s = item.get("source", "website")
                        src_counts[s] = src_counts.get(s, 0) + 1
                src_str = " · ".join(f"{s}:{c}" for s, c in src_counts.items())
                print(f"    {brand:15s}: {count:3d} items  [{src_str}]")


def main():
    print("=" * 60)
    print("  Competitive Intelligence Scraper")
    print("  Mobile: XL, IOH, SmartXL, Tri  vs  SIMPATI, byU, Halo")
    print("  Fixed:  MyRepublic, Icon Net, BizNet  vs  IndiHome, EZnet")
    print("  Region: Kalimantan · Sulawesi · Maluku · Papua")
    print("=" * 60)

    json_path = "data/output.json"

    # ── Schedule mode ────────────────────────────────────────
    if "--schedule" in sys.argv:
        from scheduler import run_loop
        run_loop()
        return

    # ── One-shot scrape ──────────────────────────────────────
    if "--cached" in sys.argv and os.path.exists(json_path):
        print(f"\n[INFO] Using cached: {json_path}")
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = scrape_all()

    # ── Social media ─────────────────────────────────────────
    if "--social" in sys.argv:
        from social_scraper import scrape_social_all
        from scheduler import merge_social_into_data
        social = scrape_social_all()
        data = merge_social_into_data(data, social)

    # ── Save ─────────────────────────────────────────────────
    data["_meta"] = {
        "last_updated": datetime.now().isoformat(),
        "sources": ["website"] + (["instagram", "google_play", "app_store"] if "--social" in sys.argv else []),
    }
    save_json(data, json_path)

    # ── Summary ──────────────────────────────────────────────
    summarize(data)
    print(f"\n  Done! Data saved to {json_path}")
    print("    Open dashboard/index.html in browser to view results.")


if __name__ == "__main__":
    main()
