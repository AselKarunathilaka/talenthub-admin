# Bundled Sri Lankan public holiday data

These JSON files are an offline copy of the dataset published by the
[srilanka-holidays](https://github.com/Dilshan-H/srilanka-holidays) project
(MIT licensed, © Dilshan-H), which is the same source that backs
`HOLIDAY_API_URL` (https://srilanka-holidays.vercel.app).

They exist so that calendars and working-day calculations keep marking public
holidays correctly when the upstream API is unreachable (network failure,
expired/blocked API key, rate limit, WAF block, …). `backend/utils/holidayData.js`
reads them; nothing else should read these files directly.

**Shape** — one array per year, entries exactly as published upstream:

```json
{ "uid": "sl_127", "summary": "Duruthu Full Moon Poya Day",
  "categories": ["Public", "Bank", "Poya"],
  "start": "2026-01-03", "end": "2026-01-04" }
```

**Refreshing / adding a year** — download the file for the year from the
upstream repo and drop it in here unchanged:

```bash
curl -sL https://raw.githubusercontent.com/Dilshan-H/srilanka-holidays/main/json/2027.json -o backend/data/holidays/2027.json
```

Years currently bundled: 2024, 2025, 2026. Upstream had not published 2027 at
the time of writing; for any year with no file, the fallback degrades to the
three fixed-date holidays listed in `holidayData.js`.
