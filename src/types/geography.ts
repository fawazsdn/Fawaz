/**
 * Saudi Arabia geographic hierarchy: Country → Region → City/Governorate →
 * Neighborhood/District. These types are the frontend's contract for
 * location data — see `src/services/geography/` for how they're served
 * today (from a static, pre-processed dataset) and
 * `scripts/import-saudi-geography.mjs` for where the data comes from.
 *
 * IDs are stable and derived from the source's own numeric ids
 * ("sa-region-1", "sa-city-31", "sa-district-10500031009", ...) — never
 * array indexes — so they survive re-imports and match 1:1 with a future
 * backend's primary keys.
 *
 * Future backend mapping (see README "Saudi Geography" section):
 *   SaudiRegion       -> regions table
 *   SaudiCity         -> cities table
 *   SaudiNeighborhood -> neighborhoods table
 *   (hasBoundary / boundary geometry, when added) -> neighborhood_boundaries
 *   A resident's chosen neighborhood                -> neighborhood_memberships
 */

/** Where an imported location record came from, for traceability. */
export interface SourceMetadata {
  /** Short identifier for the origin dataset, e.g. "address.gov.sa". */
  source?: string;
  /** The source's own id for this record (kept as a string). */
  sourceId?: string;
  /** ISO date the source snapshot was imported/updated, when known. */
  sourceUpdatedAt?: string;
}

export interface SaudiRegion extends SourceMetadata {
  id: string;
  nameAr: string;
  nameEn: string;
  /** Saudi Post region code, e.g. "RD" for Riyadh, when available. */
  code?: string;
  centerLat?: number;
  centerLng?: number;
  /** The region's capital city, if known. */
  capitalCityId?: string;
  population?: number;
}

export interface SaudiCity extends SourceMetadata {
  id: string;
  regionId: string;
  nameAr: string;
  nameEn: string;
  centerLat?: number;
  centerLng?: number;
}

export interface SaudiNeighborhood extends SourceMetadata {
  id: string;
  cityId: string;
  regionId: string;
  nameAr: string;
  nameEn: string;
  /**
   * Approximate center — a centroid computed from the source's official
   * district boundary polygon, not an independently surveyed point. Good
   * enough for a map pin; not precise enough for anything geofencing-grade.
   */
  centerLat?: number;
  centerLng?: number;
  /**
   * True when the source has a real boundary polygon for this district
   * (stripped from the shipped dataset to keep the bundle small — see the
   * import script). A future map screen can re-fetch/store boundaries
   * keyed by `id` without changing this model.
   */
  hasBoundary?: boolean;
}

/** A flattened, resolved location — what most of the app actually wants. */
export interface ResolvedLocation {
  region: SaudiRegion;
  city: SaudiCity;
  neighborhood?: SaudiNeighborhood;
}

/** A single hit from GeographyService.search(), with its resolved parents. */
export interface GeographySearchResult {
  kind: 'city' | 'neighborhood';
  city: SaudiCity;
  region: SaudiRegion;
  neighborhood?: SaudiNeighborhood;
  /** Which field(s) the query matched, for lightweight result labeling. */
  matchedOn: ('neighborhoodAr' | 'neighborhoodEn' | 'cityAr' | 'cityEn' | 'regionAr' | 'regionEn')[];
}

/**
 * A resident-submitted "my neighborhood isn't listed" suggestion. Stored
 * locally only in this frontend-only build — the future backend turns this
 * into a moderation queue that can promote a suggestion into a real
 * SaudiNeighborhood row (or reject it) rather than trusting it directly.
 */
export interface NeighborhoodSuggestion {
  id: string;
  regionId: string;
  cityId: string;
  neighborhoodNameAr: string;
  neighborhoodNameEn?: string;
  note?: string;
  submittedByUserId: string;
  createdAt: string;
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected';
}
