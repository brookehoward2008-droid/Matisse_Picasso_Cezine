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

Flights and hotels can additionally pull **real quotes** from the Amadeus Self-Service API (free tier):

- `supabase/functions/fetch-real-prices` is an Edge Function that gets an Amadeus OAuth token, fetches live flight offers and hotel offers for the tracked items, and writes them into `price_ticks` with `source = 'amadeus'` (surfaced in the UI as a "Live" badge). It also updates `items.base_price` so the per-minute simulator keeps oscillating around the real anchor price between fetches.
- A `pg_cron` job calls this function every 6 hours (conservative, to stay inside Amadeus's free monthly quota across the ~13 tracked flight/hotel items).
- Amadeus credentials are never committed to the repo or shipped to the browser — they live in a Postgres table (`integration_secrets`) with RLS enabled and no policies, so only the edge function's service-role connection can read them. To activate real data, insert your Amadeus test API key/secret:
  ```sql
  insert into integration_secrets (key, value) values
    ('amadeus_client_id', 'YOUR_KEY'),
    ('amadeus_client_secret', 'YOUR_SECRET');
  ```
  Until these rows exist, the function is a harmless no-op and everything stays simulated.
- Hotel items store a `city_iata` code; the function resolves the actual Amadeus `hotelId` on first run via the Hotel List API and caches it — hotel IDs are never hardcoded/guessed.

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
