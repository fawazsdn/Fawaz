-- Read-only location helpers backed by the official address.gov.sa district
-- polygons already stored in public.neighborhoods.boundary_geom.
-- Applied to project ckqwziutmqohihrenstz on 2026-10-12.

-- Point-in-polygon: which neighborhood contains this coordinate? Used by
-- "Use my current location" in neighborhood selection (no client-side guess).
create or replace function public.resolve_neighborhood_at(p_lat double precision, p_lng double precision)
returns table (id text, city_id text, region_id text, name_ar text, name_en text)
language sql stable security definer set search_path to '' as $fn$
  select n.id, n.city_id, n.region_id, n.name_ar, n.name_en
    from public.neighborhoods n
   where p_lat between -90 and 90 and p_lng between -180 and 180
     and n.boundary_geom is not null
     and extensions.ST_Contains(n.boundary_geom::extensions.geometry,
                                extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326))
   limit 1;
$fn$;
revoke all on function public.resolve_neighborhood_at(double precision, double precision) from public, anon;
grant execute on function public.resolve_neighborhood_at(double precision, double precision) to authenticated;

-- The neighborhood outline for the map, or null when no authoritative
-- polygon exists (the app then shows "boundary unavailable", never a
-- fabricated circle).
create or replace function public.neighborhood_boundary_geojson(target_neighborhood_id text)
returns jsonb
language sql stable security definer set search_path to '' as $fn$
  select case when n.boundary_geom is null then null
              else jsonb_build_object('source', n.boundary_source,
                                      'geometry', extensions.ST_AsGeoJSON(n.boundary_geom::extensions.geometry, 6)::jsonb) end
    from public.neighborhoods n where n.id = target_neighborhood_id;
$fn$;
revoke all on function public.neighborhood_boundary_geojson(text) from public, anon;
grant execute on function public.neighborhood_boundary_geojson(text) to authenticated;
