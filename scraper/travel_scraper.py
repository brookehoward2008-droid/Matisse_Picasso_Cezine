"""
Standalone real-price scraper for TravelTicker.

Writes directly into the same Supabase tables the app already reads
(`items` / `price_ticks`), tagged with source='scraper', so results show up
in the running app with no other changes needed.

This must run somewhere with real, unrestricted internet access (your own
machine, a VM, a scheduled job) -- it will NOT work inside a sandboxed
environment whose network policy blocks consumer travel sites.

One-time setup:
    pip install -r requirements.txt
    crawl4ai-setup          # downloads crawl4ai's managed browser

Usage:
    export SUPABASE_URL="https://xxxx.supabase.co"
    export SUPABASE_SERVICE_ROLE_KEY="..."   # service role key, never the anon key
    python travel_scraper.py targets.json
"""

import asyncio
import json
import os
import re
import sys
from dataclasses import dataclass

from crawl4ai import AsyncWebCrawler, CrawlerRunConfig
from supabase import create_client

PRICE_PATTERN = re.compile(r"\$\s?([\d,]{2,7})(?:\.\d{2})?")


@dataclass
class Target:
    item_name: str
    url: str
    css_selector: str | None = None  # narrow extraction to this region if the site's DOM is known


def load_targets(path: str) -> list[Target]:
    with open(path) as f:
        raw = json.load(f)
    return [Target(**entry) for entry in raw]


def extract_price(markdown_or_html: str) -> float | None:
    """
    Pulls the lowest plausible dollar amount out of scraped content.
    This is a generic fallback -- for real accuracy, prefer passing a
    css_selector on the Target that scopes extraction to the actual price
    element on that specific site (found by inspecting the live DOM,
    which this script's author could not do from a network-restricted
    sandbox -- verify selectors yourself against the real page).
    """
    amounts = [
        float(m.replace(",", ""))
        for m in PRICE_PATTERN.findall(markdown_or_html)
    ]
    plausible = [a for a in amounts if 20 <= a <= 20000]
    return min(plausible) if plausible else None


async def scrape_target(crawler: AsyncWebCrawler, target: Target) -> float | None:
    config = CrawlerRunConfig(css_selector=target.css_selector) if target.css_selector else CrawlerRunConfig()
    result = await crawler.arun(url=target.url, config=config)
    if not result.success:
        print(f"  [{target.item_name}] crawl failed: {result.error_message}")
        return None
    price = extract_price(result.markdown or result.cleaned_html or "")
    if price is None:
        print(f"  [{target.item_name}] no plausible price found on page")
    return price


def record_price(supabase, item_name: str, price: float, currency: str = "USD"):
    item_res = supabase.table("items").select("id, base_price").eq("name", item_name).limit(1).execute()
    if not item_res.data:
        print(f"  [{item_name}] no matching item in Supabase, skipping")
        return
    item = item_res.data[0]
    item_id = item["id"]

    last_tick = (
        supabase.table("price_ticks")
        .select("price")
        .eq("item_id", item_id)
        .order("ts", desc=True)
        .limit(1)
        .execute()
    )
    last_price = last_tick.data[0]["price"] if last_tick.data else price
    change_amount = round(price - last_price, 2)
    change_pct = round((change_amount / last_price) * 100, 3) if last_price else 0

    supabase.table("price_ticks").insert({
        "item_id": item_id,
        "price": round(price, 2),
        "change_amount": change_amount,
        "change_pct": change_pct,
        "source": "scraper",
    }).execute()
    supabase.table("items").update({"base_price": round(price, 2), "currency": currency}).eq("id", item_id).execute()
    print(f"  [{item_name}] recorded ${price:.2f}")


async def main(targets_path: str):
    supabase_url = os.environ["SUPABASE_URL"]
    supabase_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    supabase = create_client(supabase_url, supabase_key)

    targets = load_targets(targets_path)

    async with AsyncWebCrawler() as crawler:
        for target in targets:
            print(f"Scraping {target.item_name} <- {target.url}")
            try:
                price = await scrape_target(crawler, target)
                if price is not None:
                    record_price(supabase, target.item_name, price)
            except Exception as exc:
                print(f"  [{target.item_name}] error: {exc}")


if __name__ == "__main__":
    targets_file = sys.argv[1] if len(sys.argv) > 1 else "targets.json"
    asyncio.run(main(targets_file))
