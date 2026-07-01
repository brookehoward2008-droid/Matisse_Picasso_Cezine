create extension if not exists pg_cron with schema pg_catalog;

create or replace function simulate_price_ticks() returns void as $$
declare
  r record;
  last_price numeric;
  new_price numeric;
  move numeric;
begin
  for r in select id, base_price, volatility from items loop
    select price into last_price from price_ticks where item_id = r.id order by ts desc limit 1;
    if last_price is null then
      last_price := r.base_price;
    end if;
    move := last_price * (random() - 0.5) * r.volatility * 2;
    new_price := last_price + move;
    new_price := greatest(r.base_price * 0.6, least(r.base_price * 1.6, new_price));
    insert into price_ticks(item_id, price, change_amount, change_pct, ts)
    values (
      r.id,
      round(new_price, 2),
      round(new_price - last_price, 2),
      case when last_price > 0 then round((new_price - last_price) / last_price * 100, 3) else 0 end,
      now()
    );
  end loop;
end;
$$ language plpgsql security definer;

-- backfill ~2 days of hourly history so charts have shape on first load
do $$
declare
  r record;
  step_price numeric;
  h int;
  move numeric;
  tick_time timestamptz;
begin
  for r in select id, base_price, volatility from items loop
    step_price := r.base_price;
    for h in reverse 48..1 loop
      move := step_price * (random() - 0.5) * r.volatility * 2;
      step_price := greatest(r.base_price * 0.6, least(r.base_price * 1.6, step_price + move));
      tick_time := now() - (h || ' hours')::interval;
      insert into price_ticks(item_id, price, change_amount, change_pct, ts)
      values (r.id, round(step_price, 2), round(move, 2),
              case when step_price - move > 0 then round(move / (step_price - move) * 100, 3) else 0 end,
              tick_time);
    end loop;
  end loop;
end $$;

create or replace function check_alerts() returns trigger as $$
begin
  update alerts
  set active = false, triggered_at = now()
  where item_id = new.item_id
    and active
    and (
      (direction = 'above' and new.price >= target_price) or
      (direction = 'below' and new.price <= target_price)
    );
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_check_alerts
after insert on price_ticks
for each row execute function check_alerts();

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
  coalesce(day_ago.price, i.base_price) as price_24h_ago,
  round(lt.price - coalesce(day_ago.price, i.base_price), 2) as change_24h_amount,
  case when coalesce(day_ago.price, i.base_price) > 0
    then round((lt.price - coalesce(day_ago.price, i.base_price)) / coalesce(day_ago.price, i.base_price) * 100, 3)
    else 0 end as change_24h_pct
from items i
join categories c on c.id = i.category_id
left join lateral (
  select price, ts from price_ticks where item_id = i.id order by ts desc limit 1
) lt on true
left join lateral (
  select price from price_ticks
  where item_id = i.id and ts <= now() - interval '24 hours'
  order by ts desc limit 1
) day_ago on true;

grant select on v_ticker to anon, authenticated;

select cron.schedule('simulate-price-ticks', '*/1 * * * *', $$select simulate_price_ticks();$$);
