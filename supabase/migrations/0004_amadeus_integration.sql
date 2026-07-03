-- Real-data integration for flights + hotels via Amadeus Self-Service APIs.
-- Cruises, vacation packages, and all-inclusive resorts have no viable free
-- real-time pricing API and remain driven by simulate_price_ticks().

alter table items add column if not exists origin_iata text;
alter table items add column if not exists destination_iata text;
alter table items add column if not exists travel_class text not null default 'ECONOMY';
alter table items add column if not exists amadeus_hotel_id text;
alter table items add column if not exists city_iata text;

alter table price_ticks add column if not exists source text not null default 'simulated';

update items set origin_iata = v.origin, destination_iata = v.destination, travel_class = v.class
from (values
  ('JFK to LHR Round Trip','JFK','LHR','ECONOMY'),
  ('LAX to NRT Round Trip','LAX','NRT','ECONOMY'),
  ('ORD to CUN Round Trip','ORD','CUN','ECONOMY'),
  ('SFO to SYD Round Trip','SFO','SYD','ECONOMY'),
  ('MIA to GRU Round Trip','MIA','GRU','ECONOMY'),
  ('JFK to CDG Round Trip','JFK','CDG','BUSINESS'),
  ('ATL to HNL Round Trip','ATL','HNL','ECONOMY')
) as v(name, origin, destination, class)
where items.name = v.name;

update items set city_iata = v.city
from (values
  ('Marriott Marquis Times Square','NYC'),
  ('Bellagio Las Vegas','LAS'),
  ('Ritz-Carlton Maui','OGG'),
  ('The Plaza New York','NYC'),
  ('Aman Tokyo','TYO'),
  ('W South Beach Miami','MIA')
) as v(name, city)
where items.name = v.name;

comment on column items.amadeus_hotel_id is 'Resolved lazily by the fetch-real-prices edge function via the Amadeus Hotel List API (by city_iata + name match), then cached here. Never hardcode guessed IDs.';

-- Holds the Amadeus client id/secret. RLS is enabled with NO policies, so only
-- the service role (used inside the edge function) can read or write it —
-- credentials never need to touch the git repo or client bundle.
create table if not exists integration_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table integration_secrets enable row level security;

drop view v_ticker;

create view v_ticker as
select
  i.id,
  i.category_id,
  c.slug as category_slug,
  c.name as category_name,
  c.icon as category_icon,
  i.name,
  i.subtitle,
  i.provider,
  i.currency,
  i.base_price,
  lt.price as current_price,
  lt.ts as last_updated,
  coalesce(lt.source, 'simulated') as price_source,
  coalesce(day_ago.price, i.base_price) as price_24h_ago,
  round(lt.price - coalesce(day_ago.price, i.base_price), 2) as change_24h_amount,
  case when coalesce(day_ago.price, i.base_price) > 0
    then round((lt.price - coalesce(day_ago.price, i.base_price)) / coalesce(day_ago.price, i.base_price) * 100, 3)
    else 0 end as change_24h_pct
from items i
join categories c on c.id = i.category_id
left join lateral (
  select price, ts, source from price_ticks where item_id = i.id order by ts desc limit 1
) lt on true
left join lateral (
  select price from price_ticks
  where item_id = i.id and ts <= now() - interval '24 hours'
  order by ts desc limit 1
) day_ago on true;

grant select on v_ticker to anon, authenticated;

create extension if not exists pg_net;

-- Runs every 6 hours; no-ops gracefully until integration_secrets has
-- amadeus_client_id / amadeus_client_secret populated.
select cron.schedule(
  'fetch-real-prices',
  '17 */6 * * *',
  $$
  select net.http_post(
    url := '<SUPABASE_PROJECT_URL>/functions/v1/fetch-real-prices',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SUPABASE_ANON_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
