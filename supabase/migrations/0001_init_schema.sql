create extension if not exists pgcrypto;

create table categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  icon text not null,
  sort_order int not null default 0
);

create table items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  subtitle text not null default '',
  provider text not null default '',
  base_price numeric(10,2) not null,
  currency text not null default 'USD',
  volatility numeric(6,4) not null default 0.02,
  created_at timestamptz not null default now()
);
create index items_category_idx on items(category_id);

create table price_ticks (
  id bigint generated always as identity primary key,
  item_id uuid not null references items(id) on delete cascade,
  price numeric(10,2) not null,
  change_amount numeric(10,2) not null default 0,
  change_pct numeric(8,3) not null default 0,
  ts timestamptz not null default now()
);
create index price_ticks_item_ts_idx on price_ticks(item_id, ts desc);

create table watchlist (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  item_id uuid not null references items(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(session_id, item_id)
);
create index watchlist_session_idx on watchlist(session_id);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  item_id uuid not null references items(id) on delete cascade,
  direction text not null check (direction in ('above','below')),
  target_price numeric(10,2) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  triggered_at timestamptz
);
create index alerts_session_idx on alerts(session_id);
create index alerts_item_active_idx on alerts(item_id) where active;

alter table categories enable row level security;
alter table items enable row level security;
alter table price_ticks enable row level security;
alter table watchlist enable row level security;
alter table alerts enable row level security;

create policy "public read categories" on categories for select using (true);
create policy "public read items" on items for select using (true);
create policy "public read price_ticks" on price_ticks for select using (true);

create policy "own watchlist select" on watchlist for select using (true);
create policy "own watchlist insert" on watchlist for insert with check (true);
create policy "own watchlist delete" on watchlist for delete using (true);

create policy "own alerts select" on alerts for select using (true);
create policy "own alerts insert" on alerts for insert with check (true);
create policy "own alerts update" on alerts for update using (true);
create policy "own alerts delete" on alerts for delete using (true);
