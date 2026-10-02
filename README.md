# SodaStream gas exchange finder (Israel)

A lightweight replacement for https://sodastream.co.il/pages/store-locator:
find the nearest SodaStream CO₂ exchange points, sorted by distance, on a map.

- Hebrew (default) / English
- "Find near me" (GPS) or tap the map to pick a point
- Text filter by city, chain or address
- Per store: **Google Maps** (place page — hours, reviews), **Navigate**
  (Android app chooser via `geo:`; Google Maps directions elsewhere), **Call**
- Installable to the home screen; works offline with the last loaded list

Plain static files, no build step: `index.html`, `app.js`, `style.css`,
`sw.js`, `manifest.webmanifest`, `data/stores.json`.

## Data

`data/stores.json` is a cleaned snapshot of SodaStream's Storepoint feed
(see [API.md](API.md)). `scripts/fetch_stores.py` regenerates it and the
`Refresh store list` GitHub Action runs it daily, committing only when it changes.

## Run locally

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Hosting (GitHub Pages)

The repo must be public (or on a paid plan). Settings → Pages → Build and deployment →
Source: *Deploy from a branch* → pick the branch and `/ (root)`.
