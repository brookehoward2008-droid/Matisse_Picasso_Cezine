import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KAYAK_HOST = "kayak-api.p.rapidapi.com";

interface HotelItem {
  id: string;
  name: string;
  kayak_place_id: string;
}

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

async function recordPrice(
  supabase: ReturnType<typeof createClient>,
  itemId: string,
  price: number,
  currency: string,
) {
  const { data: lastTick } = await supabase
    .from("price_ticks")
    .select("price")
    .eq("item_id", itemId)
    .order("ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastPrice = lastTick?.price ?? price;
  const changeAmount = price - lastPrice;
  const changePct = lastPrice > 0 ? (changeAmount / lastPrice) * 100 : 0;

  await supabase.from("price_ticks").insert({
    item_id: itemId,
    price: Math.round(price * 100) / 100,
    change_amount: Math.round(changeAmount * 100) / 100,
    change_pct: Math.round(changePct * 1000) / 1000,
    source: "kayak",
  });

  await supabase.from("items").update({ base_price: Math.round(price * 100) / 100, currency }).eq("id", itemId);
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function findMatchingHotel(results: any[], itemName: string): any | null {
  const target = normalize(itemName);
  const targetWords = target.split(" ").filter((w) => w.length > 3);
  for (const hotel of results) {
    const hotelName = normalize(hotel.localizedHotelName ?? "");
    if (!hotelName) continue;
    const matchCount = targetWords.filter((w) => hotelName.includes(w)).length;
    if (matchCount >= Math.min(2, targetWords.length)) {
      return hotel;
    }
  }
  return null;
}

function cheapestOffer(hotel: any): { price: number; currency: string } | null {
  const providers = hotel.providers ?? [];
  if (providers.length === 0) return null;
  let best = providers[0];
  for (const p of providers) {
    if (p.totalPrice?.price < best.totalPrice?.price) best = p;
  }
  if (!best.totalPrice) return null;
  return { price: best.totalPrice.price, currency: best.totalPrice.currency };
}

async function searchHotels(apiKey: string, placeId: string) {
  const checkin = futureDate(30);
  const checkout = futureDate(31);
  const res = await fetch(`https://${KAYAK_HOST}/search-hotels`, {
    method: "POST",
    headers: {
      "x-rapidapi-host": KAYAK_HOST,
      "x-rapidapi-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      location: placeId,
      checkin,
      checkout,
      adults: "2",
      rooms: 1,
      childAges: [],
      searchMetaData: { pageNumber: 1, priceMode: "total" },
    }),
  });
  if (!res.ok) {
    throw new Error(`search-hotels failed (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  if (json.success === false || !json.data) {
    throw new Error(`search-hotels returned no data: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json.data.results ?? [];
}

Deno.serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: secrets } = await supabase
    .from("integration_secrets")
    .select("key, value")
    .eq("key", "rapidapi_key");

  const apiKey = secrets?.find((s) => s.key === "rapidapi_key")?.value;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ ok: false, message: "rapidapi_key not configured in integration_secrets yet" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const results: Record<string, unknown>[] = [];

  const { data: hotelItems } = await supabase
    .from("items")
    .select("id, name, kayak_place_id")
    .not("kayak_place_id", "is", null);

  for (const item of (hotelItems ?? []) as HotelItem[]) {
    try {
      const hotelResults = await searchHotels(apiKey, item.kayak_place_id);
      const match = findMatchingHotel(hotelResults, item.name);
      if (!match) {
        results.push({ item: item.name, ok: false, error: "no matching hotel found in results page" });
        continue;
      }
      const offer = cheapestOffer(match);
      if (!offer) {
        results.push({ item: item.name, ok: false, error: "matched hotel had no priced offers" });
        continue;
      }
      await recordPrice(supabase, item.id, offer.price, offer.currency);
      results.push({ item: item.name, ok: true, matchedName: match.localizedHotelName, price: offer.price, currency: offer.currency });
    } catch (err) {
      results.push({ item: item.name, ok: false, error: String(err) });
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
