#!/usr/bin/env node
/**
 * Imports Saudi Arabia's official regions/cities/districts into
 * src/data/saudi/*.json.
 *
 * Source: "Saudi-Arabia-Regions-Cities-and-Districts" by @homaily
 *   https://github.com/homaily/Saudi-Arabia-Regions-Cities-and-Districts
 *   License: GPL-2.0
 *   The repo states this data is "public data collected from
 *   https://maps.address.gov.sa/" — Saudi Arabia's National Address
 *   platform (Saudi Post / Wasel). It claims all 13 regions, 4581 cities,
 *   and 3732 districts nationwide.
 *
 * This script:
 *   1. Fetches the three raw JSON files (regions/cities/districts), each
 *      keyed by a stable numeric *_id.
 *   2. Validates referential integrity (no orphans, no duplicate ids, no
 *      missing bilingual names) and aborts on failure rather than writing
 *      a silently-broken dataset.
 *   3. Normalizes into our schema (see src/types/geography.ts), assigning
 *      stable prefixed ids ("sa-region-1", "sa-city-31", ...) built from
 *      the source's own numeric ids — never array indexes.
 *   4. Strips the (large) per-district boundary polygons — they inflate
 *      the raw file to 61MB and this app doesn't render real map
 *      boundaries yet (see MapPlaceholder) — but keeps a computed
 *      centroid (mean of the outer boundary ring) for approximate pin
 *      placement, and records `hasBoundary: true` so a future map screen
 *      knows boundary data exists at the source and can be re-fetched.
 *   5. Writes the three trimmed files + prints a coverage summary.
 *
 * Run with: node scripts/import-saudi-geography.mjs
 * Network access to raw.githubusercontent.com is required. To re-run
 * offline against previously-downloaded copies, set:
 *   SAUDI_GEO_REGIONS_FILE / SAUDI_GEO_CITIES_FILE / SAUDI_GEO_DISTRICTS_FILE
 * to local file paths.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SOURCE_NAME = 'address.gov.sa';
const SOURCE_REPO = 'homaily/Saudi-Arabia-Regions-Cities-and-Districts';
const BASE_URL = `https://raw.githubusercontent.com/${SOURCE_REPO}/master/json`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../src/data/saudi');

async function loadJson(name, localPath, url) {
  if (localPath) {
    console.log(`Reading ${name} from local file: ${localPath}`);
    const { readFile } = await import('node:fs/promises');
    return JSON.parse(await readFile(localPath, 'utf8'));
  }
  console.log(`Fetching ${name} from ${url} ...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${name}: HTTP ${res.status}`);
  return res.json();
}

function centroidOfRing(ring) {
  let sumLat = 0;
  let sumLng = 0;
  for (const [lat, lng] of ring) {
    sumLat += lat;
    sumLng += lng;
  }
  return { lat: sumLat / ring.length, lng: sumLng / ring.length };
}

async function main() {
  const [rawRegions, rawCities, rawDistricts] = await Promise.all([
    loadJson('regions.json', process.env.SAUDI_GEO_REGIONS_FILE, `${BASE_URL}/regions.json`),
    loadJson('cities.json', process.env.SAUDI_GEO_CITIES_FILE, `${BASE_URL}/cities.json`),
    loadJson('districts.json', process.env.SAUDI_GEO_DISTRICTS_FILE, `${BASE_URL}/districts.json`),
  ]);

  // ---- Validate the raw source before trusting it ------------------------
  const errors = [];

  const regionIds = new Set(rawRegions.map((r) => r.region_id));
  if (regionIds.size !== rawRegions.length) errors.push('Duplicate region_id in source regions.json');
  for (const r of rawRegions) {
    if (!r.name_ar?.trim() || !r.name_en?.trim()) errors.push(`Region ${r.region_id} missing a bilingual name`);
  }

  const cityIds = new Set(rawCities.map((c) => c.city_id));
  if (cityIds.size !== rawCities.length) errors.push('Duplicate city_id in source cities.json');
  for (const c of rawCities) {
    if (!regionIds.has(c.region_id)) errors.push(`City ${c.city_id} references unknown region_id ${c.region_id}`);
    if (!c.name_ar?.trim() || !c.name_en?.trim()) errors.push(`City ${c.city_id} missing a bilingual name`);
  }

  const districtIds = new Set(rawDistricts.map((d) => d.district_id));
  if (districtIds.size !== rawDistricts.length) errors.push('Duplicate district_id in source districts.json');
  for (const d of rawDistricts) {
    if (!cityIds.has(d.city_id)) errors.push(`District ${d.district_id} references unknown city_id ${d.city_id}`);
    if (!regionIds.has(d.region_id)) errors.push(`District ${d.district_id} references unknown region_id ${d.region_id}`);
    if (!d.name_ar?.trim() || !d.name_en?.trim()) errors.push(`District ${d.district_id} missing a bilingual name`);
  }

  if (errors.length > 0) {
    console.error(`\nSource data failed validation (${errors.length} issue(s)):`);
    for (const e of errors.slice(0, 25)) console.error(` - ${e}`);
    if (errors.length > 25) console.error(` ...and ${errors.length - 25} more`);
    process.exit(1);
  }

  // ---- Normalize -----------------------------------------------------------
  const regions = rawRegions
    .map((r) => ({
      id: `sa-region-${r.region_id}`,
      code: r.code ?? undefined,
      nameAr: r.name_ar,
      nameEn: r.name_en,
      centerLat: r.center?.[0],
      centerLng: r.center?.[1],
      capitalCityId: r.capital_city_id != null ? `sa-city-${r.capital_city_id}` : undefined,
      population: r.population ?? undefined,
      source: SOURCE_NAME,
      sourceId: String(r.region_id),
    }))
    .sort((a, b) => a.nameEn.localeCompare(b.nameEn));

  const cities = rawCities
    .map((c) => ({
      id: `sa-city-${c.city_id}`,
      regionId: `sa-region-${c.region_id}`,
      nameAr: c.name_ar,
      nameEn: c.name_en,
      centerLat: c.center?.[0],
      centerLng: c.center?.[1],
      source: SOURCE_NAME,
      sourceId: String(c.city_id),
    }))
    .sort((a, b) => a.nameEn.localeCompare(b.nameEn));

  const neighborhoods = rawDistricts
    .map((d) => {
      const ring = d.boundaries?.[0];
      const centroid = ring && ring.length > 0 ? centroidOfRing(ring) : undefined;
      return {
        id: `sa-district-${d.district_id}`,
        cityId: `sa-city-${d.city_id}`,
        regionId: `sa-region-${d.region_id}`,
        nameAr: d.name_ar,
        nameEn: d.name_en,
        centerLat: centroid?.lat,
        centerLng: centroid?.lng,
        hasBoundary: !!ring,
        source: SOURCE_NAME,
        sourceId: String(d.district_id),
      };
    })
    .sort((a, b) => a.nameEn.localeCompare(b.nameEn));

  await writeFile(path.join(OUT_DIR, 'regions.json'), JSON.stringify(regions, null, 2) + '\n');
  await writeFile(path.join(OUT_DIR, 'cities.json'), JSON.stringify(cities, null, 2) + '\n');
  await writeFile(path.join(OUT_DIR, 'neighborhoods.json'), JSON.stringify(neighborhoods, null, 2) + '\n');

  const citiesWithDistricts = new Set(neighborhoods.map((n) => n.cityId)).size;

  console.log('\nSaudi Geography Import — summary');
  console.log('================================');
  console.log(`Source: ${SOURCE_REPO} (${SOURCE_NAME}), GPL-2.0`);
  console.log(`Regions:       ${regions.length}`);
  console.log(`Cities:        ${cities.length}`);
  console.log(`Neighborhoods: ${neighborhoods.length}`);
  console.log(`Cities with at least one neighborhood on record: ${citiesWithDistricts} / ${cities.length}`);
  console.log(`(The remaining ${cities.length - citiesWithDistricts} cities/towns have no district-level`);
  console.log(' breakdown in the source — residents there select down to city level.)');
  console.log('\nWrote src/data/saudi/{regions,cities,neighborhoods}.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
