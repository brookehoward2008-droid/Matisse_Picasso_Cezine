# TravelTicker scraper

A standalone `crawl4ai`-based price scraper that writes directly into the
same Supabase tables the deployed app already reads (`items` /
`price_ticks`), tagged with `source: "scraper"`. Once it runs, its results
show up in the live app automatically — no other changes needed.

## Why this is separate from the app

This script needs real, unrestricted outbound internet access to reach
consumer travel sites. It is meant to run on your own machine, a VM, or a
scheduled job — **not** inside any network-restricted sandbox. It was
authored and syntax-checked in one, but never run against a live target
site, since that sandbox's network policy blocks consumer travel domains
outright.

## Setup

```bash
cd scraper
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
crawl4ai-setup   # one-time: downloads crawl4ai's managed browser
```

## Configuration

```bash
export SUPABASE_URL="https://hcraoctteurtaoyvsghu.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="..."   # service role key, never the anon key
```

Get the service role key from the Supabase dashboard (Project Settings ->
API). Keep it out of git and out of the client app — it bypasses Row Level
Security.

## Targets file

Copy `targets.example.json` to `targets.json` and edit it. Each entry:

```json
{
  "item_name": "Bellagio Las Vegas",
  "url": "https://www.kayak.com/hotels/...",
  "css_selector": null
}
```

- `item_name` must exactly match a row in the `items` table (see
  `supabase/migrations/0002_seed_data.sql` for the seeded names), or the
  scraper skips it.
- `url` is the page to crawl.
- `css_selector` is optional. Without it, the scraper regexes the whole
  page for the lowest plausible dollar amount, which is unreliable on
  pages with unrelated prices (ads, fees, other listings). Inspect the
  real page's DOM yourself and scope this to the actual price element —
  the URLs shipped in `targets.example.json` are illustrative and their
  selectors have not been verified against the live site.

## Run

```bash
python travel_scraper.py targets.json
```

Run it on a schedule (cron, GitHub Actions, etc.) to keep prices fresh.
Each run inserts one `price_ticks` row per successfully-scraped target and
updates that item's `base_price`, exactly like the `fetch-real-prices`
edge function does for its own source.
