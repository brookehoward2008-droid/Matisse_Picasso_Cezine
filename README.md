# TravelTicker

A stock-market/crypto-style live price tracker for travel: cruises, flights, vacation packages, all-inclusive resorts, and hotels.

## What it does

- Ticker dashboard with category tabs, search, and sorting (name / price / 24h change)
- Live-updating prices with 24h change ($ and %), colored up/down like a stock ticker
- Sparkline trend charts in the table, full price history chart in the item detail view
- Watchlist (star items, filter to "My Watchlist")
- Price alerts ("notify when this drops below $X" / "rises above $X") with a triggered-alerts indicator

## Data source

Cruises, vacation packages, and all-inclusive resorts are driven by a Postgres `pg_cron` job (`simulate_price_ticks`) running every minute in Supabase, which applies a bounded random walk per item based on a per-item volatility setting. No free, real-time API exists for these categories.

Hotels can additionally pull **real quotes** from `kayak-api` on RapidAPI:

- `supabase/functions/fetch-real-prices` is an Edge Function that searches hotels near each tracked property's city (via a Kayak airport-based `placeID`), fuzzy-matches the specific hotel by name in the results, and writes its cheapest offer into `price_ticks` with `source = 'kayak'` (surfaced in the UI as a "Live" badge). It also updates `items.base_price` so the per-minute simulator keeps oscillating around the real anchor price between fetches.
- A `pg_cron` job calls this function every 6 hours.
- The RapidAPI key is never committed to the repo or shipped to the browser — it lives in a Postgres table (`integration_secrets`) with RLS enabled and no policies, so only the edge function's service-role connection can read it. To activate real data, insert your key:
  ```sql
  insert into integration_secrets (key, value) values ('rapidapi_key', 'YOUR_KEY');
  ```
  Until that row exists (or if the RapidAPI plan's request quota is exhausted), the function no-ops/logs per-item errors and everything stays simulated.
- Each hotel item stores a `kayak_place_id` (an airport-based Kayak location ID, resolved manually via `/search-locations` — never guessed) used to scope the hotel search to the right city.
- Flights, cruises, vacation packages, and all-inclusive resorts have no free, real-time price API and stay fully simulated. (Amadeus's Self-Service API portal, which would have covered flights, is shutting down in July 2026 and was dropped — see `0004_amadeus_integration.sql` for the retired attempt.)

## Stack

- Frontend: React + TypeScript + Vite + Tailwind CSS + Recharts
- Backend: Supabase (Postgres, Row Level Security, Realtime, pg_cron)

## Local development

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
npm run dev
```

## Schema

- `categories` — the 5 tracked verticals
- `items` — tracked products (cruise sailings, flight routes, packages, resorts, hotels)
- `price_ticks` — price history / time series per item (what the charts and 24h change are built from)
- `watchlist` — starred items per browser session
- `alerts` — price threshold alerts per browser session; a trigger on `price_ticks` flips `alerts.active` to false and stamps `triggered_at` when a new tick crosses the threshold

There is no login system — a random session id is generated and stored in `localStorage` to scope each browser's watchlist and alerts.
