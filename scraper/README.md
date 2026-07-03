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

## Deploying on a schedule with SST

`../infra` has an [SST](https://sst.dev) config that runs this scraper on
AWS Fargate on a `rate(6 hours)` schedule, instead of you keeping a machine
on. It builds `Dockerfile` in this directory into a container task and
wires up a Cron job to invoke it (`../infra/sst.config.ts`). A container
task is used instead of a plain Lambda because crawl4ai bundles a real
Chromium browser, which doesn't fit in Lambda's zip size limits.

This provisions real, billable AWS resources (a VPC, an ECS cluster, a
Fargate task, an EventBridge rule — roughly **$0.02/hour while the task
runs**, a few times a day, per SST's Fargate pricing notes) and requires
your own AWS account/credentials. Nothing here deploys itself; you decide
when to run it.

```bash
# 1. create your real targets file (not committed to git)
cp targets.example.json targets.json
# edit targets.json with real URLs + verified css_selectors

cd ../infra
npm install

# 2. set secrets once (never commit these)
npx sst secret set SupabaseUrl "https://hcraoctteurtaoyvsghu.supabase.co" --stage production
npx sst secret set SupabaseServiceRoleKey "..." --stage production

# 3. deploy (requires AWS credentials configured locally, e.g. via `aws configure`)
npm run deploy
```

To tear it down and stop being billed: `npm run remove`.
