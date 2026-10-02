#!/usr/bin/env python3
"""Fetch SodaStream IL store locations from Storepoint and write a cleaned snapshot.

The site loads this live; the snapshot is a fallback if the live API is down.
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

API = "https://api.storepoint.co/v1/15ce68d4f2ed11/locations"
OUT = Path(__file__).resolve().parent.parent / "data" / "stores.json"


def clean(s):
    return re.sub(r"\s+", " ", s or "").strip()


def main():
    req = urllib.request.Request(API, headers={"User-Agent": "sodastream-map"})
    with urllib.request.urlopen(req, timeout=60) as r:
        payload = json.load(r)
    locs = payload["results"]["locations"]
    stores = [
        {
            "id": l["id"],
            "name": clean(l["name"]),
            "chain": clean(l["description"]),
            "address": clean(l["streetaddress"]),
            "phone": clean(l["phone"]),
            "lat": round(float(l["loc_lat"]), 6),
            "lng": round(float(l["loc_long"]), 6),
        }
        for l in locs
        if l.get("loc_lat") and l.get("loc_long")
    ]
    if len(stores) < 100:
        sys.exit(f"Suspiciously few stores ({len(stores)}); not overwriting snapshot")
    stores.sort(key=lambda s: s["id"])
    OUT.write_text(json.dumps(stores, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {len(stores)} stores to {OUT}")


if __name__ == "__main__":
    main()
