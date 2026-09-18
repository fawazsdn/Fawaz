# Neighborhood boundary geometry

`neighborhood_boundaries.json` — real neighborhood boundary polygons for Haratna's
Saudi geography, one entry per neighborhood: `{ "id": "sa-district-<source_id>", "pts": [[lng,lat], ...] }`.

- Source: homaily/Saudi-Arabia-Regions-Cities-and-Districts (GitHub, GPL-2.0),
  `json/districts.json`, itself sourced from Saudi National Address
  (maps.address.gov.sa). Same upstream source already used by
  `scripts/import-saudi-geography.mjs` for the regions/cities/neighborhoods seed data.
- Every one of the 3,732 neighborhoods in this dataset ships a real boundary ring
  in the source (not a centroid, not a generated circle).
- Rings are simplified with the Ramer-Douglas-Peucker algorithm, capped at 32
  vertices per ring, coordinates rounded to 5 decimal places (~1.1m), to keep
  this file a reasonable size to store/fetch while remaining a faithful
  representation of the real boundary shape (911k source points -> 111k).
- Loaded into `public.neighborhoods.boundary_geom` (PostGIS `geography(Polygon,4326)`)
  by a one-time migration that fetches this raw file via the `http` extension and
  parses it server-side — see migration `load_neighborhood_boundary_geometry`.
