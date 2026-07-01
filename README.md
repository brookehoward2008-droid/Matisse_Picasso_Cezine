# TravelTicker

A stock-market/crypto-style live price tracker for travel: cruises, flights, vacation packages, all-inclusive resorts, and hotels.

## What it does

- Ticker dashboard with category tabs, search, and sorting (name / price / 24h change)
- Live-updating prices with 24h change ($ and %), colored up/down like a stock ticker
- Sparkline trend charts in the table, full price history chart in the item detail view
- Watchlist (star items, filter to "My Watchlist")
- Price alerts ("notify when this drops below $X" / "rises above $X") with a triggered-alerts indicator

## Data source

Prices are driven by a Postgres `pg_cron` job (`simulate_price_ticks`) running every minute in Supabase, which applies a bounded random walk per item based on a per-item volatility setting. This gives a realistic, continuously-moving "market" without depending on paid travel-pricing APIs (which don't really exist in usable form for cruises/vacation packages, and are costly for flights/hotels).

Swapping in real prices later just means replacing what writes into the `price_ticks` table — the schema, frontend, alerts, and watchlist all stay the same.

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
