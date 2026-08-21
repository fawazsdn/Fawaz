import regionsData from '@/data/saudi/regions.json';
import citiesData from '@/data/saudi/cities.json';
import neighborhoodsData from '@/data/saudi/neighborhoods.json';
import type { GeographySearchResult, SaudiCity, SaudiNeighborhood, SaudiRegion } from '@/types/geography';
import { normalizeForSearch } from '@/utils/searchNormalize';
import { useStore } from '@/store/useStore';
import type { GeographyService } from './GeographyService';

const regions = regionsData as SaudiRegion[];
const cities = citiesData as SaudiCity[];
const neighborhoods = neighborhoodsData as SaudiNeighborhood[];

// ---------------------------------------------------------------------------
// Lazy, memoized lookup indices. Built once on first use (not at import
// time) so app startup never pays for indexing a dataset the user might
// not touch this session, and never rebuilt per keystroke/render.
// ---------------------------------------------------------------------------

let regionById: Map<string, SaudiRegion> | null = null;
let cityById: Map<string, SaudiCity> | null = null;
let neighborhoodById: Map<string, SaudiNeighborhood> | null = null;
let citiesByRegion: Map<string, SaudiCity[]> | null = null;
let neighborhoodsByCity: Map<string, SaudiNeighborhood[]> | null = null;

function ensureLookupIndices() {
  if (regionById) return;
  regionById = new Map(regions.map((r) => [r.id, r]));
  cityById = new Map(cities.map((c) => [c.id, c]));
  neighborhoodById = new Map(neighborhoods.map((n) => [n.id, n]));

  citiesByRegion = new Map();
  for (const city of cities) {
    const list = citiesByRegion.get(city.regionId) ?? [];
    list.push(city);
    citiesByRegion.set(city.regionId, list);
  }
  for (const list of citiesByRegion.values()) list.sort((a, b) => a.nameEn.localeCompare(b.nameEn));

  neighborhoodsByCity = new Map();
  for (const n of neighborhoods) {
    const list = neighborhoodsByCity.get(n.cityId) ?? [];
    list.push(n);
    neighborhoodsByCity.set(n.cityId, list);
  }
  for (const list of neighborhoodsByCity.values()) list.sort((a, b) => a.nameEn.localeCompare(b.nameEn));
}

interface SearchIndexEntry {
  kind: 'city' | 'neighborhood';
  city: SaudiCity;
  region: SaudiRegion;
  neighborhood?: SaudiNeighborhood;
  normOwnAr: string;
  normOwnEn: string;
  normCityAr: string;
  normCityEn: string;
  normRegionAr: string;
  normRegionEn: string;
}

let searchIndex: SearchIndexEntry[] | null = null;

function ensureSearchIndex(): SearchIndexEntry[] {
  if (searchIndex) return searchIndex;
  ensureLookupIndices();
  const index: SearchIndexEntry[] = [];

  for (const city of cities) {
    const region = regionById!.get(city.regionId);
    if (!region) continue;
    index.push({
      kind: 'city',
      city,
      region,
      normOwnAr: normalizeForSearch(city.nameAr),
      normOwnEn: normalizeForSearch(city.nameEn),
      normCityAr: normalizeForSearch(city.nameAr),
      normCityEn: normalizeForSearch(city.nameEn),
      normRegionAr: normalizeForSearch(region.nameAr),
      normRegionEn: normalizeForSearch(region.nameEn),
    });
  }

  for (const n of neighborhoods) {
    const city = cityById!.get(n.cityId);
    const region = regionById!.get(n.regionId);
    if (!city || !region) continue;
    index.push({
      kind: 'neighborhood',
      city,
      region,
      neighborhood: n,
      normOwnAr: normalizeForSearch(n.nameAr),
      normOwnEn: normalizeForSearch(n.nameEn),
      normCityAr: normalizeForSearch(city.nameAr),
      normCityEn: normalizeForSearch(city.nameEn),
      normRegionAr: normalizeForSearch(region.nameAr),
      normRegionEn: normalizeForSearch(region.nameEn),
    });
  }

  searchIndex = index;
  return index;
}

// Resolved once, lazily, by exact English name against the live dataset —
// shortcuts only, per the product spec: they never gate access to the
// full national dataset, and if a name doesn't resolve it's just skipped.
const POPULAR_CITY_NAMES_EN = ['Riyadh', 'Jeddah', 'Makkah', 'Madinah', 'Dammam', 'Al Khobar', 'Dhahran', 'At Taif', 'Tabuk', 'Abha'];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const mockGeographyService: GeographyService = {
  async getRegions() {
    return [...regions].sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  },

  async getRegion(id) {
    ensureLookupIndices();
    return regionById!.get(id);
  },

  async getCities(regionId) {
    ensureLookupIndices();
    return citiesByRegion!.get(regionId) ?? [];
  },

  async getCity(id) {
    ensureLookupIndices();
    return cityById!.get(id);
  },

  async getNeighborhoods(cityId) {
    ensureLookupIndices();
    return neighborhoodsByCity!.get(cityId) ?? [];
  },

  async getNeighborhood(id) {
    ensureLookupIndices();
    return neighborhoodById!.get(id);
  },

  async resolveLocation({ regionId, cityId, neighborhoodId }) {
    ensureLookupIndices();
    const neighborhood = neighborhoodId ? neighborhoodById!.get(neighborhoodId) : undefined;
    const city = cityId ? cityById!.get(cityId) : neighborhood ? cityById!.get(neighborhood.cityId) : undefined;
    if (!city) return undefined;
    const region = regionById!.get(regionId ?? city.regionId);
    if (!region) return undefined;
    return { region, city, neighborhood };
  },

  async search(query, opts) {
    const limit = opts?.limit ?? 50;
    const q = normalizeForSearch(query);
    if (!q) return [];

    const index = ensureSearchIndex();
    const scored: { entry: SearchIndexEntry; score: number; matchedOn: GeographySearchResult['matchedOn'] }[] = [];

    for (const entry of index) {
      const matchedOn: GeographySearchResult['matchedOn'] = [];
      let score = 0;

      if (entry.normOwnAr.includes(q)) {
        matchedOn.push(entry.kind === 'neighborhood' ? 'neighborhoodAr' : 'cityAr');
        score = Math.max(score, entry.normOwnAr.startsWith(q) ? 100 : 80);
      }
      if (entry.normOwnEn.includes(q)) {
        matchedOn.push(entry.kind === 'neighborhood' ? 'neighborhoodEn' : 'cityEn');
        score = Math.max(score, entry.normOwnEn.startsWith(q) ? 100 : 80);
      }
      if (entry.kind === 'neighborhood') {
        if (entry.normCityAr.includes(q)) {
          matchedOn.push('cityAr');
          score = Math.max(score, 40);
        }
        if (entry.normCityEn.includes(q)) {
          matchedOn.push('cityEn');
          score = Math.max(score, 40);
        }
      }
      if (entry.normRegionAr.includes(q)) {
        matchedOn.push('regionAr');
        score = Math.max(score, 20);
      }
      if (entry.normRegionEn.includes(q)) {
        matchedOn.push('regionEn');
        score = Math.max(score, 20);
      }

      if (matchedOn.length > 0) scored.push({ entry, score, matchedOn });
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(({ entry, matchedOn }) => ({
      kind: entry.kind,
      city: entry.city,
      region: entry.region,
      neighborhood: entry.neighborhood,
      matchedOn,
    }));
  },

  async getPopularCities() {
    ensureLookupIndices();
    const byExactEn = new Map(cities.map((c) => [c.nameEn, c]));
    return POPULAR_CITY_NAMES_EN.map((name) => byExactEn.get(name)).filter((c): c is SaudiCity => !!c);
  },

  async resolveApproxCityFromCoordinates(lat, lng) {
    ensureLookupIndices();
    let nearest: SaudiCity | undefined;
    let nearestDistance = Infinity;
    for (const city of cities) {
      if (city.centerLat == null || city.centerLng == null) continue;
      const d = haversineKm(lat, lng, city.centerLat, city.centerLng);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = city;
      }
    }
    if (!nearest) return undefined;
    const region = regionById!.get(nearest.regionId);
    if (!region) return undefined;
    return { region, city: nearest };
  },

  async submitNeighborhoodSuggestion(input) {
    return useStore.getState().submitNeighborhoodSuggestion(input);
  },

  async getNeighborhoodSuggestions() {
    return useStore.getState().neighborhoodSuggestions;
  },
};
