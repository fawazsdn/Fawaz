-- Haratna hosted staging: synthetic geography (no production data).
-- Run ONLY on the staging project, after its schema is loaded. Every row is marked
-- source = 'synthetic' so the staging tool can check it is not talking to production
-- (production's regions all come from real datasets).
--
-- 1 region, 2 cities, 4 neighborhoods with small square boundaries (about 1 km).
begin;

do $$ begin
  if exists (select 1 from public.regions where source <> 'synthetic') then
    raise exception 'non-synthetic geography present: this is not an empty staging project, stop';
  end if;
end $$;

insert into public.regions (id, code, name_ar, name_en, center_lat, center_lng, source, source_id)
values ('stg-r1', 'STG', 'منطقة تجريبية', 'Staging Region', 24.700, 46.700, 'synthetic', 'stg-r1')
on conflict (id) do nothing;

insert into public.cities (id, region_id, name_ar, name_en, center_lat, center_lng, source, source_id) values
  ('stg-c1', 'stg-r1', 'مدينة أ', 'Test City A', 24.700, 46.700, 'synthetic', 'stg-c1'),
  ('stg-c2', 'stg-r1', 'مدينة ب', 'Test City B', 24.900, 46.900, 'synthetic', 'stg-c2')
on conflict (id) do nothing;

insert into public.neighborhoods (id, city_id, region_id, name_ar, name_en, center_lat, center_lng, source, source_id,
                                  boundary_geom, boundary_source, boundary_updated_at)
select n.id, n.city, 'stg-r1', n.ar, n.en, n.lat, n.lng, 'synthetic', n.id,
       ('SRID=4326;POLYGON((' || (n.lng - 0.005) || ' ' || (n.lat - 0.005) || ',' || (n.lng + 0.005) || ' ' || (n.lat - 0.005) || ','
         || (n.lng + 0.005) || ' ' || (n.lat + 0.005) || ',' || (n.lng - 0.005) || ' ' || (n.lat + 0.005) || ','
         || (n.lng - 0.005) || ' ' || (n.lat - 0.005) || '))')::extensions.geography,
       'synthetic', now()
from (values
  ('stg-n1', 'stg-c1', 'حي ١', 'Test Neighborhood 1', 24.700, 46.700),
  ('stg-n2', 'stg-c1', 'حي ٢', 'Test Neighborhood 2', 24.720, 46.720),
  ('stg-n3', 'stg-c2', 'حي ٣', 'Test Neighborhood 3', 24.900, 46.900),
  ('stg-n4', 'stg-c2', 'حي ٤', 'Test Neighborhood 4', 24.920, 46.920)
) as n(id, city, ar, en, lat, lng)
on conflict (id) do nothing;

update public.regions set capital_city_id = 'stg-c1' where id = 'stg-r1';
commit;
