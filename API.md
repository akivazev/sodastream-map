# SodaStream Israel store locator — data source

The page https://sodastream.co.il/pages/store-locator embeds a third-party
**Storepoint** widget:

```html
<div id="storepoint-container" data-language="hebrew" data-map-id="15ce68d4f2ed11"></div>
<script src="https://cdn.storepoint.co/api/v1/js/15ce68d4f2ed11.js"></script>
```

## Endpoint

```
GET https://api.storepoint.co/v1/15ce68d4f2ed11/locations
```

- No auth, no API key, no special headers.
- `Access-Control-Allow-Origin: *` — callable directly from browser JS.
- `Cache-Control: max-age=60` (CDN-cached).
- Returns **all** locations in one response (~676 records, ~420 KB). No paging.

Response shape:

```json
{ "success": true,
  "results": { "locations": [ ... ], "tags": [], "online_stores": [], "tag_colors": [] } }
```

Location record (only these fields are actually populated):

| field           | example                     | notes                                   |
|-----------------|-----------------------------|-----------------------------------------|
| `id`            | `59173183`                  |                                         |
| `name`          | `אייס קפיטל אשדוד (44)`      | branch name                             |
| `description`   | `ACE`                       | chain name (some have stray whitespace) |
| `streetaddress` | `זבוטינסקי 39, אשדוד`        | street, city                            |
| `phone`         | `08-6225221`                | ~92% populated                          |
| `loc_lat`/`loc_long` | `31.811915` / `34.646803` | all records have coordinates        |

Empty for every record: hours (`monday`…`sunday`), `tags`, `email`, `website`,
socials, `image_url`, `extra*`.

Chain breakdown (top): שופרסל 187, BE 55, רמי לוי 51, גוד פארם 46, טיב טעם 43,
יוחננוף 40, הום סנטר 38, מחסני השוק 55 (two spellings), ...

## Other endpoints seen in the widget JS (not needed)

- `https://api.storepoint.co/v1/15ce68d4f2ed11/kwgeocoder?rq&q_quick=...` — address search
- `https://stats-1.storepoint.co/v1/` — analytics
