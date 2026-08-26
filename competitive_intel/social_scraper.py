"""
Social media scraper: Instagram public profiles + Google Play + App Store reviews.
"""

import os, re, json, time
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

# ── Instagram accounts per brand ─────────────────────────────
INSTAGRAM_ACCOUNTS = {
    # Mobile competitors
    "xl":      {"handle": "xlaxiata",         "brand": "XL",      "segment": "mass",     "role": "competitor", "brand_type": "mobile"},
    "ioh":     {"handle": "im3ooredoo",        "brand": "IOH",     "segment": "mass",     "role": "competitor", "brand_type": "mobile"},
    "smartxl": {"handle": "axisid",            "brand": "SmartXL", "segment": "youth",    "role": "competitor", "brand_type": "mobile"},
    "tri":     {"handle": "tri.indonesia",     "brand": "Tri",     "segment": "youth",    "role": "competitor", "brand_type": "mobile"},
    # Mobile telkomsel
    "simpati": {"handle": "telkomsel",         "brand": "SIMPATI", "segment": "mass",     "role": "telkomsel",  "brand_type": "mobile"},
    "byu":     {"handle": "byutelkomsel",      "brand": "byU",     "segment": "youth",    "role": "telkomsel",  "brand_type": "mobile"},
    "halo":    {"handle": "telkomsel",         "brand": "Halo",    "segment": "premium",  "role": "telkomsel",  "brand_type": "mobile"},
    # Fixed competitors
    "myrepublic": {"handle": "myrepublicindonesia", "brand": "MyRepublic", "segment": "home", "role": "competitor", "brand_type": "fixed"},
    "iconnet":    {"handle": "iconnetid",           "brand": "Icon Net",   "segment": "home", "role": "competitor", "brand_type": "fixed"},
    "biznet":     {"handle": "biznetnetworks",      "brand": "BizNet",     "segment": "home", "role": "competitor", "brand_type": "fixed"},
    # Fixed telkomsel
    "indihome": {"handle": "indihomeid",  "brand": "IndiHome", "segment": "home",     "role": "telkomsel", "brand_type": "fixed"},
    "eznet":    {"handle": "telkomsel",   "brand": "EZnet",    "segment": "business", "role": "telkomsel", "brand_type": "fixed"},
}

# ── Google Play app IDs ───────────────────────────────────────
PLAY_STORE_APPS = {
    "xl":       {"app_id": "com.xl.xlaxiata",           "brand": "XL",      "segment": "mass",     "role": "competitor", "brand_type": "mobile"},
    "ioh":      {"app_id": "com.indosat.im3",           "brand": "IOH",     "segment": "mass",     "role": "competitor", "brand_type": "mobile"},
    "smartxl":  {"app_id": "com.axis.internet",         "brand": "SmartXL", "segment": "youth",    "role": "competitor", "brand_type": "mobile"},
    "tri":      {"app_id": "com.tri.mybusiness",        "brand": "Tri",     "segment": "youth",    "role": "competitor", "brand_type": "mobile"},
    "telkomsel":{"app_id": "com.telkomsel.telkonselmobile", "brand": "SIMPATI","segment": "mass",  "role": "telkomsel",  "brand_type": "mobile"},
    "byu":      {"app_id": "id.byu",                    "brand": "byU",     "segment": "youth",    "role": "telkomsel",  "brand_type": "mobile"},
    "indihome": {"app_id": "com.telkom.indihome",       "brand": "IndiHome","segment": "home",     "role": "telkomsel",  "brand_type": "fixed"},
}

# ── App Store app IDs ─────────────────────────────────────────
APP_STORE_APPS = {
    "xl":       {"app_id": "1440745062", "brand": "XL",      "segment": "mass",  "role": "competitor", "brand_type": "mobile"},
    "ioh":      {"app_id": "1477268819", "brand": "IOH",     "segment": "mass",  "role": "competitor", "brand_type": "mobile"},
    "telkomsel":{"app_id": "406079114",  "brand": "SIMPATI", "segment": "mass",  "role": "telkomsel",  "brand_type": "mobile"},
    "byu":      {"app_id": "1513789163", "brand": "byU",     "segment": "youth", "role": "telkomsel",  "brand_type": "mobile"},
    "indihome": {"app_id": "1454824027", "brand": "IndiHome","segment": "home",  "role": "telkomsel",  "brand_type": "fixed"},
}

REGIONS = [
    "kalimantan","balikpapan","samarinda","banjarmasin","pontianak","palangkaraya",
    "sulawesi","makassar","manado","palu","kendari","gorontalo",
    "maluku","ambon","ternate","sorong",
    "papua","jayapura","timika","merauke","manokwari",
]

def detect_regions(text):
    tl = text.lower()
    return list(set(r for r in REGIONS if r in tl))

NEG_KW = ["lambat","lemot","gangguan","mati","tidak bisa","buruk","kecewa","jelek","error","down","masalah","parah","boros","mahal","susah"]
POS_KW = ["bagus","cepat","stabil","puas","mantap","recommended","oke","baik","lancar","senang","hemat","murah","gratis","keren","luar biasa"]

def detect_sentiment(text):
    tl = text.lower()
    neg = sum(1 for k in NEG_KW if k in tl)
    pos = sum(1 for k in POS_KW if k in tl)
    if neg > pos: return "negative"
    if pos > neg: return "positive"
    return "neutral"


# ── Instagram scraper ─────────────────────────────────────────
def scrape_instagram(max_posts=10):
    """Scrape public Instagram profiles using instaloader."""
    results = []
    try:
        import instaloader
        L = instaloader.Instaloader(
            download_pictures=False,
            download_videos=False,
            download_video_thumbnails=False,
            download_geotags=False,
            download_comments=False,
            save_metadata=False,
            compress_json=False,
            quiet=True,
        )
    except ImportError:
        print("  [WARN] instaloader not installed. Skipping Instagram.")
        return results

    seen_handles = set()
    for key, info in INSTAGRAM_ACCOUNTS.items():
        handle = info["handle"]
        if handle in seen_handles:
            continue
        seen_handles.add(handle)

        print(f"  [Instagram] @{handle} ({info['brand']})")
        try:
            profile = instaloader.Profile.from_username(L.context, handle)
            posts = list(profile.get_posts())
            count = 0
            for post in posts:
                if count >= max_posts:
                    break
                caption = post.caption or ""
                if not caption.strip():
                    continue
                sentiment = detect_sentiment(caption)
                regions = detect_regions(caption)
                # Detect promo vs complaint vs general
                promo_kw = ["promo","diskon","cashback","gratis","bonus","hemat","special","offer","kuota"]
                cat = "promo" if any(k in caption.lower() for k in promo_kw) else "complaint"
                item = {
                    "source":    "instagram",
                    "brand":     info["brand"],
                    "segment":   info["segment"],
                    "role":      info["role"],
                    "brand_type":info["brand_type"],
                    "category":  cat,
                    "handle":    f"@{handle}",
                    "title":     caption[:80].replace("\n", " "),
                    "snippet":   caption[:300].replace("\n", " "),
                    "sentiment": sentiment,
                    "regions":   regions,
                    "likes":     post.likes,
                    "timestamp": post.date_utc.isoformat() if post.date_utc else None,
                    "url":       f"https://www.instagram.com/p/{post.shortcode}/",
                }
                results.append(item)
                count += 1
            time.sleep(2)
        except Exception as e:
            print(f"    [WARN] @{handle}: {e}")

    print(f"  [Instagram] Total: {len(results)} posts")
    return results


# ── Google Play scraper ───────────────────────────────────────
def scrape_play_store(count=50):
    """Scrape Google Play reviews."""
    results = []
    try:
        from google_play_scraper import reviews, Sort
    except ImportError:
        print("  [WARN] google-play-scraper not installed. Skipping Play Store.")
        return results

    for key, info in PLAY_STORE_APPS.items():
        print(f"  [Play Store] {info['brand']} ({info['app_id']})")
        try:
            result, _ = reviews(
                info["app_id"],
                lang="id",
                country="id",
                sort=Sort.NEWEST,
                count=count,
            )
            for r in result:
                content = r.get("content", "") or ""
                sentiment = detect_sentiment(content)
                regions = detect_regions(content)
                results.append({
                    "source":    "google_play",
                    "brand":     info["brand"],
                    "segment":   info["segment"],
                    "role":      info["role"],
                    "brand_type":info["brand_type"],
                    "category":  "complaint",
                    "title":     content[:80].replace("\n", " "),
                    "snippet":   content[:300].replace("\n", " "),
                    "sentiment": sentiment,
                    "regions":   regions,
                    "rating":    r.get("score"),
                    "timestamp": r.get("at").isoformat() if r.get("at") else None,
                    "username":  r.get("userName", ""),
                })
            time.sleep(1)
        except Exception as e:
            print(f"    [WARN] {info['brand']}: {e}")

    print(f"  [Play Store] Total: {len(results)} reviews")
    return results


# ── App Store scraper ─────────────────────────────────────────
def scrape_app_store(count=50):
    """Scrape App Store reviews."""
    results = []
    try:
        from app_store_scraper import AppStore
    except ImportError:
        print("  [WARN] app-store-scraper not installed. Skipping App Store.")
        return results

    for key, info in APP_STORE_APPS.items():
        print(f"  [App Store] {info['brand']} ({info['app_id']})")
        try:
            app = AppStore(country="id", app_name=info["brand"].lower(), app_id=info["app_id"])
            app.review(how_many=count)
            for r in (app.reviews or []):
                content = r.get("review", "") or ""
                sentiment = detect_sentiment(content)
                regions = detect_regions(content)
                results.append({
                    "source":    "app_store",
                    "brand":     info["brand"],
                    "segment":   info["segment"],
                    "role":      info["role"],
                    "brand_type":info["brand_type"],
                    "category":  "complaint",
                    "title":     (r.get("title","") or content[:60]).replace("\n"," "),
                    "snippet":   content[:300].replace("\n"," "),
                    "sentiment": sentiment,
                    "regions":   regions,
                    "rating":    r.get("rating"),
                    "timestamp": r.get("date").isoformat() if r.get("date") else None,
                    "username":  r.get("userName",""),
                })
            time.sleep(1)
        except Exception as e:
            print(f"    [WARN] {info['brand']}: {e}")

    print(f"  [App Store] Total: {len(results)} reviews")
    return results


def scrape_social_all(max_ig_posts=10, max_reviews=50):
    """Run all social scrapers, return combined list."""
    print("\n=== SOCIAL MEDIA & REVIEWS ===")
    ig     = scrape_instagram(max_posts=max_ig_posts)
    play   = scrape_play_store(count=max_reviews)
    appstr = scrape_app_store(count=max_reviews)
    all_items = ig + play + appstr
    print(f"\n[SOCIAL TOTAL] {len(all_items)} items ({len(ig)} IG · {len(play)} Play · {len(appstr)} AppStore)")
    return all_items
