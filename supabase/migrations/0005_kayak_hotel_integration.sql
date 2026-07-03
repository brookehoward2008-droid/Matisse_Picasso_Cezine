-- Real hotel prices via kayak-api on RapidAPI (Amadeus's self-service portal
-- shut down, so 0004's Amadeus integration is retired; the columns it added
-- are left in place but unused).

alter table items add column if not exists kayak_place_id text;

comment on column items.kayak_place_id is 'Kayak airport-based placeID for kayak-api search-hotels, resolved manually via /search-locations (not guessed).';

update items set kayak_place_id = v.place_id
from (values
  ('Marriott Marquis Times Square','175485'),
  ('The Plaza New York','175485'),
  ('Bellagio Las Vegas','175838'),
  ('Ritz-Carlton Maui','176113'),
  ('W South Beach Miami','174785'),
  ('Aman Tokyo','177900')
) as v(name, place_id)
where items.name = v.name;
