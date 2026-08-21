import type {
  GeographySearchResult,
  NeighborhoodSuggestion,
  ResolvedLocation,
  SaudiCity,
  SaudiNeighborhood,
  SaudiRegion,
} from '@/types/geography';

/**
 * The frontend's one contract for Saudi location data. Every screen reads
 * location data through this interface — never by importing
 * `src/data/saudi/*.json` directly — so the static dataset backing
 * `MockGeographyService` can be swapped for real API calls against a
 * future `regions` / `cities` / `neighborhoods` backend without touching
 * a single screen.
 */
export interface GeographyService {
  getRegions(): Promise<SaudiRegion[]>;
  getRegion(id: string): Promise<SaudiRegion | undefined>;

  /** Cities within a region, sorted for display. */
  getCities(regionId: string): Promise<SaudiCity[]>;
  getCity(id: string): Promise<SaudiCity | undefined>;

  /** Neighborhoods within a city. Empty for the ~4,400 smaller
   * cities/towns the source has no district-level breakdown for. */
  getNeighborhoods(cityId: string): Promise<SaudiNeighborhood[]>;
  getNeighborhood(id: string): Promise<SaudiNeighborhood | undefined>;

  /** Resolves a region/city/neighborhood id triple into full records. */
  resolveLocation(params: { regionId?: string; cityId?: string; neighborhoodId?: string }): Promise<ResolvedLocation | undefined>;

  /**
   * Searches neighborhood, city, and region names (Arabic + English) at
   * once. Case-insensitive, whitespace-tolerant, and tolerant of common
   * Arabic spelling variants (see src/utils/searchNormalize.ts) — never
   * against the raw un-normalized text. Results are capped by `limit`.
   */
  search(query: string, opts?: { limit?: number }): Promise<GeographySearchResult[]>;

  /** A short list of well-known cities to show as onboarding shortcuts.
   * Shortcuts only — never a substitute for the full dataset. */
  getPopularCities(): Promise<SaudiCity[]>;

  /**
   * Frontend-only demo affordance behind "Use my current location". Finds
   * the nearest city by straight-line distance to each city's center
   * point — a real (if approximate) computation, not a fabricated result.
   * It deliberately does NOT resolve a neighborhood: without real
   * point-in-polygon boundaries loaded, guessing a specific neighborhood
   * from coordinates would be a fake precision this frontend can't back
   * up. A future backend can replace this with real reverse geocoding /
   * point-in-polygon against `neighborhood_boundaries` and additionally
   * resolve the neighborhood.
   */
  resolveApproxCityFromCoordinates(lat: number, lng: number): Promise<ResolvedLocation | undefined>;

  /** "Can't find your neighborhood?" flow — stored locally only; a real
   * backend turns this into a moderation queue. */
  submitNeighborhoodSuggestion(
    input: Omit<NeighborhoodSuggestion, 'id' | 'createdAt' | 'status'>,
  ): Promise<NeighborhoodSuggestion>;
  getNeighborhoodSuggestions(): Promise<NeighborhoodSuggestion[]>;
}
