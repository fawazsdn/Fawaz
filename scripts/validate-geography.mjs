#!/usr/bin/env node
/**
 * Validates src/data/saudi/{regions,cities,neighborhoods}.json for
 * structural integrity: duplicate ids, orphan references, missing
 * bilingual names, and duplicate authoritative source ids.
 *
 * This does NOT assert expected counts — the source dataset's actual size
 * is whatever it is; hardcoding counts here would make the check lie the
 * moment the dataset is re-imported and legitimately changes size.
 *
 * Run with: npm run validate:geography
 * Exits non-zero (and prints every problem found) if anything is invalid.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../src/data/saudi');

async function loadJson(name) {
  return JSON.parse(await readFile(path.join(DATA_DIR, `${name}.json`), 'utf8'));
}

function findDuplicates(items, keyFn) {
  const seen = new Map();
  const duplicates = [];
  for (const item of items) {
    const key = keyFn(item);
    if (key == null) continue;
    if (seen.has(key)) duplicates.push(key);
    else seen.set(key, item);
  }
  return [...new Set(duplicates)];
}

async function main() {
  const regions = await loadJson('regions');
  const cities = await loadJson('cities');
  const neighborhoods = await loadJson('neighborhoods');

  const problems = [];

  // -- duplicate ids ------------------------------------------------------
  const dupRegionIds = findDuplicates(regions, (r) => r.id);
  const dupCityIds = findDuplicates(cities, (c) => c.id);
  const dupNeighborhoodIds = findDuplicates(neighborhoods, (n) => n.id);
  if (dupRegionIds.length) problems.push(`Duplicate region ids: ${dupRegionIds.join(', ')}`);
  if (dupCityIds.length) problems.push(`Duplicate city ids: ${dupCityIds.join(', ')}`);
  if (dupNeighborhoodIds.length) problems.push(`Duplicate neighborhood ids: ${dupNeighborhoodIds.join(', ')}`);
  const duplicateIdCount = dupRegionIds.length + dupCityIds.length + dupNeighborhoodIds.length;

  // -- duplicate authoritative source ids (within each collection) --------
  const dupRegionSourceIds = findDuplicates(regions, (r) => r.sourceId);
  const dupCitySourceIds = findDuplicates(cities, (c) => c.sourceId);
  const dupNeighborhoodSourceIds = findDuplicates(neighborhoods, (n) => n.sourceId);
  if (dupRegionSourceIds.length) problems.push(`Duplicate region sourceIds: ${dupRegionSourceIds.join(', ')}`);
  if (dupCitySourceIds.length) problems.push(`Duplicate city sourceIds: ${dupCitySourceIds.join(', ')}`);
  if (dupNeighborhoodSourceIds.length)
    problems.push(`Duplicate neighborhood sourceIds: ${dupNeighborhoodSourceIds.join(', ')}`);

  // -- orphan references ----------------------------------------------------
  const regionIds = new Set(regions.map((r) => r.id));
  const cityIds = new Set(cities.map((c) => c.id));

  const orphanCities = cities.filter((c) => !regionIds.has(c.regionId));
  if (orphanCities.length) problems.push(`Orphan cities (invalid regionId): ${orphanCities.map((c) => c.id).join(', ')}`);

  const orphanNeighborhoodsCity = neighborhoods.filter((n) => !cityIds.has(n.cityId));
  if (orphanNeighborhoodsCity.length)
    problems.push(`Orphan neighborhoods (invalid cityId): ${orphanNeighborhoodsCity.map((n) => n.id).join(', ')}`);

  const orphanNeighborhoodsRegion = neighborhoods.filter((n) => !regionIds.has(n.regionId));
  if (orphanNeighborhoodsRegion.length)
    problems.push(`Orphan neighborhoods (invalid regionId): ${orphanNeighborhoodsRegion.map((n) => n.id).join(', ')}`);

  const orphanNeighborhoodCount = new Set([...orphanNeighborhoodsCity, ...orphanNeighborhoodsRegion].map((n) => n.id)).size;

  // -- missing names --------------------------------------------------------
  for (const [label, list] of [
    ['region', regions],
    ['city', cities],
    ['neighborhood', neighborhoods],
  ]) {
    const missingAr = list.filter((x) => !x.nameAr || !x.nameAr.trim());
    const missingEn = list.filter((x) => !x.nameEn || !x.nameEn.trim());
    if (missingAr.length) problems.push(`${missingAr.length} ${label}(s) missing an Arabic name: ${missingAr.map((x) => x.id).join(', ')}`);
    if (missingEn.length) problems.push(`${missingEn.length} ${label}(s) missing an English name: ${missingEn.map((x) => x.id).join(', ')}`);
  }

  const summary = [
    `Regions: ${regions.length}`,
    `Cities: ${cities.length}`,
    `Neighborhoods: ${neighborhoods.length}`,
    `Orphan cities: ${orphanCities.length}`,
    `Orphan neighborhoods: ${orphanNeighborhoodCount}`,
    `Duplicate IDs: ${duplicateIdCount}`,
  ];

  console.log(summary.join(' / '));

  if (problems.length) {
    console.error('\nVALIDATION FAILED:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  console.log('VALID');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
