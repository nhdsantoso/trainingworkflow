"""
Scheduler: runs scrape_all + scrape_social_all every N hours,
merges results, saves to data/output.json.
"""

import time, json, os, traceback
from datetime import datetime

INTERVAL_HOURS = 6

def merge_social_into_data(data, social_items):
    """
    Merge social/review items into the main data structure.
    Social items have role + brand_type; inject into correct bucket.
    """
    for item in social_items:
        bt   = item.get("brand_type", "mobile")
        role = item.get("role", "competitor")
        bucket = data.setdefault(bt, {}).setdefault(role, [])
        bucket.append(item)
    return data

def run_once():
    from scraper import scrape_all, save_json
    from social_scraper import scrape_social_all

    print(f"\n{'='*60}")
    print(f"  Scheduled Run: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

    try:
        data = scrape_all()
    except Exception as e:
        print(f"[ERROR] Website scrape failed: {e}")
        traceback.print_exc()
        json_path = "data/output.json"
        if os.path.exists(json_path):
            with open(json_path, encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = {"mobile": {"competitor": [], "telkomsel": []}, "fixed": {"competitor": [], "telkomsel": []}}

    try:
        social = scrape_social_all()
        data = merge_social_into_data(data, social)
    except Exception as e:
        print(f"[ERROR] Social scrape failed: {e}")
        traceback.print_exc()

    data["_meta"] = {
        "last_updated": datetime.now().isoformat(),
        "sources": ["website", "instagram", "google_play", "app_store"],
    }
    save_json(data, "data/output.json")
    print(f"\n  Run complete. Next run in {INTERVAL_HOURS} hours.")

def run_loop():
    print(f"[Scheduler] Starting — interval: {INTERVAL_HOURS}h")
    while True:
        run_once()
        time.sleep(INTERVAL_HOURS * 3600)

if __name__ == "__main__":
    import sys
    if "--once" in sys.argv:
        run_once()
    else:
        run_loop()
