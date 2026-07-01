import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AMADEUS_BASE = "https://test.api.amadeus.com";

interface FlightItem {
  id: string;
  name: string;
  origin_iata: string;
  destination_iata: string;
  travel_class: string;
}

interface HotelItem {
  id: string;
  name: string;
  provider: string;
  city_iata: string;
  amadeus_hotel_id: string | null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

async function getAmadeusToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${AMADEUS_BASE}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    throw new Error(`Amadeus auth failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.access_token as string;
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
    source: "amadeus",
  });

  await supabase.from("items").update({ base_price: Math.round(price * 100) / 100, currency }).eq("id", itemId);
}

async function fetchFlightPrice(token: string, item: FlightItem) {
  const departureDate = futureDate(30);
  const returnDate = futureDate(37);
  const url = new URL(`${AMADEUS_BASE}/v2/shopping/flight-offers`);
  url.searchParams.set("originLocationCode", item.origin_iata);
  url.searchParams.set("destinationLocationCode", item.destination_iata);
  url.searchParams.set("departureDate", departureDate);
  url.searchParams.set("returnDate", returnDate);
  url.searchParams.set("adults", "1");
  url.searchParams.set("travelClass", item.travel_class);
  url.searchParams.set("currencyCode", "USD");
  url.searchParams.set("max", "5");

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Flight Offers Search failed (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  const offers = json.data ?? [];
  if (offers.length === 0) throw new Error("No flight offers returned");

  let best = offers[0];
  for (const offer of offers) {
    if (parseFloat(offer.price.grandTotal) < parseFloat(best.price.grandTotal)) best = offer;
  }
  return { price: parseFloat(best.price.grandTotal), currency: best.price.currency as string };
}

async function resolveHotelId(token: string, item: HotelItem): Promise<string | null> {
  const url = new URL(`${AMADEUS_BASE}/v1/reference-data/locations/hotels/by-city`);
  url.searchParams.set("cityCode", item.city_iata);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Hotel List lookup failed (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  const hotels = (json.data ?? []) as Array<{ hotelId: string; name: string }>;
  if (hotels.length === 0) return null;

  const target = item.name.toLowerCase();
  const providerLower = item.provider.toLowerCase();
  let match = hotels.find((h) => h.name?.toLowerCase().includes(target) || target.includes(h.name?.toLowerCase() ?? ""));
  if (!match) {
    match = hotels.find((h) => h.name?.toLowerCase().includes(providerLower));
  }
  return match ? match.hotelId : null;
}

async function fetchHotelPrice(token: string, hotelId: string) {
  const checkIn = futureDate(30);
  const checkOut = futureDate(31);
  const url = new URL(`${AMADEUS_BASE}/v3/shopping/hotel-offers`);
  url.searchParams.set("hotelIds", hotelId);
  url.searchParams.set("checkInDate", checkIn);
  url.searchParams.set("checkOutDate", checkOut);
  url.searchParams.set("adults", "1");

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Hotel Search failed (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  const hotelResult = (json.data ?? [])[0];
  const offer = hotelResult?.offers?.[0];
  if (!offer) throw new Error("No hotel offers returned");
  return { price: parseFloat(offer.price.total), currency: offer.price.currency as string };
}

Deno.serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: secrets } = await supabase
    .from("integration_secrets")
    .select("key, value")
    .in("key", ["amadeus_client_id", "amadeus_client_secret"]);

  const clientId = secrets?.find((s) => s.key === "amadeus_client_id")?.value;
  const clientSecret = secrets?.find((s) => s.key === "amadeus_client_secret")?.value;

  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ ok: false, message: "Amadeus credentials not configured in integration_secrets yet" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const results: Record<string, unknown>[] = [];

  try {
    const token = await getAmadeusToken(clientId, clientSecret);

    const { data: flightItems } = await supabase
      .from("items")
      .select("id, name, origin_iata, destination_iata, travel_class")
      .not("origin_iata", "is", null)
      .not("destination_iata", "is", null);

    for (const item of (flightItems ?? []) as FlightItem[]) {
      try {
        const { price, currency } = await fetchFlightPrice(token, item);
        await recordPrice(supabase, item.id, price, currency);
        results.push({ item: item.name, ok: true, price, currency });
      } catch (err) {
        results.push({ item: item.name, ok: false, error: String(err) });
      }
      await sleep(300);
    }

    const { data: hotelItems } = await supabase
      .from("items")
      .select("id, name, provider, city_iata, amadeus_hotel_id")
      .not("city_iata", "is", null);

    for (const item of (hotelItems ?? []) as HotelItem[]) {
      try {
        let hotelId = item.amadeus_hotel_id;
        if (!hotelId) {
          hotelId = await resolveHotelId(token, item);
          if (hotelId) {
            await supabase.from("items").update({ amadeus_hotel_id: hotelId }).eq("id", item.id);
          }
        }
        if (!hotelId) throw new Error(`Could not resolve Amadeus hotel id for ${item.name} in ${item.city_iata}`);

        const { price, currency } = await fetchHotelPrice(token, hotelId);
        await recordPrice(supabase, item.id, price, currency);
        results.push({ item: item.name, ok: true, price, currency });
      } catch (err) {
        results.push({ item: item.name, ok: false, error: String(err) });
      }
      await sleep(300);
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err), results }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
