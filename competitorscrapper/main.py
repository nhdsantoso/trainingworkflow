"""
Entry point: scrape → parse → generate PowerPoint.
Usage:
    pip install -r requirements.txt
    cp .env.example .env   # add your FIRECRAWL_API_KEY
    python main.py
"""

import sys, json, os
from scraper       import scrape_all, save_json
from ppt_generator import generate


def main():
    # ── Step 1: Scrape ──────────────────────────────────────
    print("=" * 60)
    print("  XL vs Telkomsel Competitive Scraper")
    print("=" * 60)

    json_path = "scraped_data.json"

    # Allow re-using cached data with --cached flag
    if "--cached" in sys.argv and os.path.exists(json_path):
        print(f"\n[INFO] Loading cached data from {json_path}")
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = scrape_all()
        save_json(data, json_path)

    # ── Step 2: Summary ─────────────────────────────────────
    print("\n[SUMMARY]")
    for key, products in data.items():
        bucket_counts = {}
        for p in products:
            b = p.get("bucket") or "out_of_range"
            bucket_counts[b] = bucket_counts.get(b, 0) + 1
        print(f"  {key:25s}: {len(products):3d} products  {bucket_counts}")

    # ── Step 3: Generate PPT ─────────────────────────────────
    out_path = generate(data, "XL_vs_Telkomsel_Comparison.pptx")
    print(f"\n✅  Done! Open: {out_path}")


if __name__ == "__main__":
    main()
