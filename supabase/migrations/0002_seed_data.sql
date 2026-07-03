insert into categories (slug, name, icon, sort_order) values
  ('cruises', 'Cruises', '🚢', 1),
  ('flights', 'Flights', '✈️', 2),
  ('vacation-packages', 'Vacation Packages', '🧳', 3),
  ('all-inclusive', 'All-Inclusive', '🏝️', 4),
  ('hotels', 'Hotels', '🏨', 5);

insert into items (category_id, name, subtitle, provider, base_price, volatility)
select c.id, v.name, v.subtitle, v.provider, v.base_price, v.volatility
from (values
  ('cruises','Caribbean 7-Night','Icon of the Seas · Miami round-trip','Royal Caribbean',1499.00,0.020),
  ('cruises','Mediterranean 10-Night','World Europa · Rome round-trip','MSC Cruises',2199.00,0.018),
  ('cruises','Alaska 7-Night','Bliss · Seattle round-trip','Norwegian',1299.00,0.022),
  ('cruises','Bahamas 4-Night','Celebration · Miami round-trip','Carnival',649.00,0.030),
  ('cruises','Hawaii 15-Night','Pride of America · Honolulu round-trip','Norwegian',3499.00,0.015),
  ('cruises','Transatlantic 14-Night','Queen Mary 2 · Southampton to NYC','Cunard',2899.00,0.014),
  ('cruises','Greek Isles 8-Night','Beyond · Rome round-trip','Celebrity',1899.00,0.019),
  ('flights','JFK to LHR Round Trip','Economy','Delta',612.00,0.025),
  ('flights','LAX to NRT Round Trip','Economy','ANA',899.00,0.022),
  ('flights','ORD to CUN Round Trip','Economy','United',344.00,0.035),
  ('flights','SFO to SYD Round Trip','Economy','Qantas',1350.00,0.020),
  ('flights','MIA to GRU Round Trip','Economy','LATAM',588.00,0.028),
  ('flights','JFK to CDG Round Trip','Business','Air France',3299.00,0.017),
  ('flights','ATL to HNL Round Trip','Economy','Delta',712.00,0.024),
  ('vacation-packages','Cancun 5-Night','Air + Hotel Package','Apple Vacations',1189.00,0.022),
  ('vacation-packages','Punta Cana 6-Night','All-Inclusive Air + Hotel','Funjet',1549.00,0.020),
  ('vacation-packages','Orlando 4-Night','Theme Park Package','Disney Getaways',999.00,0.018),
  ('vacation-packages','Las Vegas 3-Night','Air + Hotel + Show','Vegas.com',749.00,0.026),
  ('vacation-packages','Costa Rica 7-Night','Adventure Package','GO Vacation',2199.00,0.019),
  ('vacation-packages','Italy 9-Night','Rome, Florence & Venice Package','Trafalgar',2899.00,0.016),
  ('all-inclusive','Riviera Maya 7-Night','Moon Palace Cancun','Palace Resorts',2249.00,0.017),
  ('all-inclusive','Jamaica 7-Night','Sandals Montego Bay','Sandals',3199.00,0.015),
  ('all-inclusive','Punta Cana 7-Night','Hard Rock Hotel & Casino','Hard Rock',2599.00,0.018),
  ('all-inclusive','Turks & Caicos 7-Night','Beaches Turks & Caicos','Beaches',3899.00,0.014),
  ('all-inclusive','Los Cabos 7-Night','Secrets Puerto Los Cabos','Secrets Resorts',2799.00,0.016),
  ('all-inclusive','Aruba 7-Night','Riu Palace Antillas','RIU Hotels',2399.00,0.017),
  ('hotels','Marriott Marquis Times Square','Nightly Rate','Marriott',389.00,0.030),
  ('hotels','Bellagio Las Vegas','Nightly Rate','MGM Resorts',279.00,0.032),
  ('hotels','Ritz-Carlton Maui','Nightly Rate','Ritz-Carlton',899.00,0.020),
  ('hotels','The Plaza New York','Nightly Rate','Fairmont',749.00,0.021),
  ('hotels','Aman Tokyo','Nightly Rate','Aman',1299.00,0.016),
  ('hotels','W South Beach Miami','Nightly Rate','Marriott',459.00,0.027)
) as v(cat_slug, name, subtitle, provider, base_price, volatility)
join categories c on c.slug = v.cat_slug;

insert into price_ticks (item_id, price, change_amount, change_pct, ts)
select id, base_price, 0, 0, now() - interval '25 hours' from items;
