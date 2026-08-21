import regionsData from '@/data/saudi/regions.json';
import citiesData from '@/data/saudi/cities.json';
import neighborhoodsData from '@/data/saudi/neighborhoods.json';
import type { SaudiCity, SaudiNeighborhood, SaudiRegion } from '@/types/geography';
import { geographyService } from '@/services/geography';
import { normalizeForSearch } from '@/utils/searchNormalize';

const regions = regionsData as SaudiRegion[];
const cities = citiesData as SaudiCity[];
const neighborhoods = neighborhoodsData as SaudiNeighborhood[];

// ---------------------------------------------------------------------------
// Hierarchy validity — every neighborhood -> valid city -> valid region.
// Saudi Arabia is the implicit single country this whole dataset describes
// (there is no separate "country" record/level in the model).
// ---------------------------------------------------------------------------
describe('geography hierarchy', () => {
  it('claims broad national coverage across all 13 Saudi regions', () => {
    expect(regions).toHaveLength(13);
    expect(cities.length).toBeGreaterThan(1000);
    expect(neighborhoods.length).toBeGreaterThan(1000);
  });

  it('has no duplicate region/city/neighborhood ids', () => {
    expect(new Set(regions.map((r) => r.id)).size).toBe(regions.length);
    expect(new Set(cities.map((c) => c.id)).size).toBe(cities.length);
    expect(new Set(neighborhoods.map((n) => n.id)).size).toBe(neighborhoods.length);
  });

  it('every city references a real region (no orphan cities)', () => {
    const regionIds = new Set(regions.map((r) => r.id));
    const orphans = cities.filter((c) => !regionIds.has(c.regionId));
    expect(orphans).toEqual([]);
  });

  it('every neighborhood references a real city and a real region (no orphan neighborhoods)', () => {
    const cityIds = new Set(cities.map((c) => c.id));
    const regionIds = new Set(regions.map((r) => r.id));
    const orphanCity = neighborhoods.filter((n) => !cityIds.has(n.cityId));
    const orphanRegion = neighborhoods.filter((n) => !regionIds.has(n.regionId));
    expect(orphanCity).toEqual([]);
    expect(orphanRegion).toEqual([]);
  });

  it('every neighborhood\'s regionId matches its parent city\'s regionId', () => {
    const cityById = new Map(cities.map((c) => [c.id, c]));
    const mismatched = neighborhoods.filter((n) => cityById.get(n.cityId)?.regionId !== n.regionId);
    expect(mismatched).toEqual([]);
  });

  it('every region, city, and neighborhood has both Arabic and English names', () => {
    for (const list of [regions, cities, neighborhoods]) {
      for (const item of list) {
        expect(item.nameAr).toBeTruthy();
        expect(item.nameEn).toBeTruthy();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Search — Arabic, English, city, and region-level matching.
// ---------------------------------------------------------------------------
describe('geography search', () => {
  it('finds a neighborhood by its Arabic name with correct parent context', async () => {
    const results = await geographyService.search('العقربية');
    expect(results.length).toBeGreaterThan(0);
    const hit = results.find((r) => r.neighborhood?.nameEn === 'Al Aqrabiyah Dist.');
    expect(hit).toBeDefined();
    expect(hit!.city.nameEn).toBe('Al Khobar');
    expect(hit!.region.nameEn).toContain('Eastern');
  });

  it('finds the same neighborhood by an English spelling variant (case/hyphen-insensitive)', async () => {
    const results = await geographyService.search('al-aqrabiyah');
    const hit = results.find((r) => r.neighborhood?.nameEn === 'Al Aqrabiyah Dist.');
    expect(hit).toBeDefined();
    expect(hit!.city.nameEn).toBe('Al Khobar');
  });

  it('is tolerant of common Arabic spelling variants without altering displayed names', async () => {
    // أ/إ/آ vs ا: "الأقرعية"-style alef variants should still normalize-match
    // the official name "العقربية", but the returned record must carry the
    // exact official spelling untouched.
    const results = await geographyService.search('العقربيه'); // ة -> ه variant
    const hit = results.find((r) => r.neighborhood?.nameAr === 'حي العقربية');
    expect(hit).toBeDefined();
    expect(hit!.neighborhood!.nameAr).toBe('حي العقربية'); // untouched official spelling
  });

  it('finds a city by name and reports it as a city-kind result', async () => {
    const results = await geographyService.search('الخبر');
    const hit = results.find((r) => r.kind === 'city' && r.city.nameEn === 'Al Khobar');
    expect(hit).toBeDefined();
  });

  it('caps results at the requested limit even for a broad query', async () => {
    const results = await geographyService.search('ا', { limit: 10 });
    expect(results.length).toBeLessThanOrEqual(10);
  });

  it('returns no results for an empty query', async () => {
    const results = await geographyService.search('   ');
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Region / city filtering.
// ---------------------------------------------------------------------------
describe('region and city filtering', () => {
  it('getCities(regionId) returns only cities belonging to that region', async () => {
    const easternProvince = regions.find((r) => r.nameEn.includes('Eastern'))!;
    const cityList = await geographyService.getCities(easternProvince.id);
    expect(cityList.length).toBeGreaterThan(0);
    expect(cityList.every((c) => c.regionId === easternProvince.id)).toBe(true);
    expect(cityList.some((c) => c.nameEn === 'Al Khobar')).toBe(true);
    expect(cityList.some((c) => c.nameEn === 'Dammam')).toBe(true);
    expect(cityList.some((c) => c.nameEn === 'Dhahran')).toBe(true);
  });

  it('getNeighborhoods(cityId) returns only neighborhoods belonging to that city', async () => {
    const khobar = cities.find((c) => c.nameEn === 'Al Khobar')!;
    const list = await geographyService.getNeighborhoods(khobar.id);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((n) => n.cityId === khobar.id)).toBe(true);
  });

  it('Eastern Province includes Khobar, Dammam, Dhahran, Jubail, Qatif, Al Ahsa, Ras Tannurah, Buqayq', async () => {
    const easternProvince = regions.find((r) => r.nameEn.includes('Eastern'))!;
    const cityList = await geographyService.getCities(easternProvince.id);
    const names = cityList.map((c) => c.nameEn);
    // Spellings are exactly as the authoritative source has them (e.g. "Al
    // Jubail" not "Jubail", "Buqayq" not "Abqaiq") — the source is treated
    // as the source of truth rather than forced to match assumed spellings.
    for (const expected of ['Al Khobar', 'Dammam', 'Dhahran', 'Al Jubail', 'Al Qatif', 'Al Ahsa', 'Ras Tannurah', 'Buqayq']) {
      expect(names).toContain(expected);
    }
  });

  it("Khobar's curated neighborhoods (Al Aqrabiyah, Al Khuzama, Ar Rakah, Al Hizam Al Akhdar, Al Olaya, Al Bandariyah) exist in the dataset", async () => {
    const khobar = cities.find((c) => c.nameEn === 'Al Khobar')!;
    const list = await geographyService.getNeighborhoods(khobar.id);
    const names = list.map((n) => n.nameEn);
    expect(names).toEqual(
      expect.arrayContaining([
        'Al Aqrabiyah Dist.',
        'Al Khuzama Dist.',
        'Al Bandariyah Dist.',
        'Al Hizam Al Akhdar Dist.',
        'Al Olaya Dist.',
      ]),
    );
    // The authoritative source names this "Ar Rakah Al Janubiyah" (South
    // Rakah), not the "Al Rakah" spelling the demo originally hardcoded —
    // the source is treated as the source of truth per spec.
    expect(names).toContain('Ar Rakah Al Janubiyah Dist.');
  });
});

// ---------------------------------------------------------------------------
// Popular cities — shortcuts only, resolved dynamically against the live
// dataset (never a hardcoded id list that could drift from it).
// ---------------------------------------------------------------------------
describe('popular cities', () => {
  it('resolves all 10 popular cities from the live dataset', async () => {
    const popular = await geographyService.getPopularCities();
    expect(popular).toHaveLength(10);
    expect(popular.map((c) => c.nameEn)).toEqual(
      expect.arrayContaining(['Riyadh', 'Jeddah', 'Makkah', 'Madinah', 'Dammam', 'Al Khobar', 'Dhahran', 'Tabuk', 'Abha']),
    );
  });
});

// ---------------------------------------------------------------------------
// normalizeForSearch — never mutates displayed text, only search comparison.
// ---------------------------------------------------------------------------
describe('normalizeForSearch', () => {
  it('unifies Arabic alef/taa-marbuta/alef-maksura variants for comparison only', () => {
    expect(normalizeForSearch('العقربية')).toBe(normalizeForSearch('العقربيه'));
    expect(normalizeForSearch('أحمد')).toBe(normalizeForSearch('احمد'));
  });

  it('is whitespace- and hyphen-tolerant and case-insensitive', () => {
    expect(normalizeForSearch('Al-Aqrabiyah')).toBe(normalizeForSearch('al aqrabiyah'));
    expect(normalizeForSearch('  Al   Khobar  ')).toBe(normalizeForSearch('al khobar'));
  });
});

// ---------------------------------------------------------------------------
// Performance — search must not force-render or re-scan the whole national
// dataset per keystroke; the flat search index is built once (lazily,
// memoized) and every search() call reuses it.
// ---------------------------------------------------------------------------
describe('search performance', () => {
  it('resolves many sequential searches over the full national dataset quickly', async () => {
    const queries = ['الرياض', 'جدة', 'khobar', 'مكة', 'العليا', 'dammam', 'tabuk', 'abha', 'jubail', 'حي'];
    const start = Date.now();
    for (let i = 0; i < 20; i++) {
      for (const q of queries) {
        await geographyService.search(q, { limit: 50 });
      }
    }
    const elapsed = Date.now() - start;
    // 200 searches across ~4,500 cities + ~3,700 neighborhoods, well under a
    // second once the memoized index exists — a hard fail here would mean
    // the index is being rebuilt (or the dataset re-scanned unbounded) on
    // every call instead of once.
    expect(elapsed).toBeLessThan(3000);
  });

  it('never returns more results than the requested limit, regardless of how broad the query is', async () => {
    const results = await geographyService.search('ال', { limit: 25 });
    expect(results.length).toBeLessThanOrEqual(25);
  });
});
