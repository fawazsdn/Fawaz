import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';

export type LocateResult =
  | { status: 'ok'; lat: number; lng: number }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'unavailable' };

const TIMEOUT_MS = 15000;

/** One-shot, foreground-only location (asked for only when the user taps). */
export async function locateOnce(): Promise<LocateResult> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') return { status: 'denied', canAskAgain: perm.canAskAgain !== false };
  try {
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
    ]);
    const { latitude, longitude } = pos.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { status: 'unavailable' };
    return { status: 'ok', lat: latitude, lng: longitude };
  } catch {
    return { status: 'unavailable' };
  }
}

/** Server point-in-polygon against official district boundaries; null if outside every known polygon. */
export async function resolveNeighborhoodAt(lat: number, lng: number): Promise<{ id: string; cityId: string; regionId: string } | null> {
  const { data, error } = await supabase.rpc('resolve_neighborhood_at', { p_lat: lat, p_lng: lng });
  if (error) throw error;
  const row = Array.isArray(data) ? (data[0] as { id: string; city_id: string; region_id: string } | undefined) : undefined;
  return row ? { id: row.id, cityId: row.city_id, regionId: row.region_id } : null;
}

export interface BoundaryGeoJSON {
  source: string;
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
}

/** The official outline of a neighborhood, or null when none exists. */
export async function fetchNeighborhoodBoundary(neighborhoodId: string): Promise<BoundaryGeoJSON | null> {
  const { data, error } = await supabase.rpc('neighborhood_boundary_geojson', { target_neighborhood_id: neighborhoodId });
  if (error) throw error;
  return (data as BoundaryGeoJSON | null) ?? null;
}

/** GeoJSON rings -> react-native-maps coordinate arrays (outer rings only). */
export function boundaryToPolygons(b: BoundaryGeoJSON | null): { latitude: number; longitude: number }[][] {
  if (!b) return [];
  const polys = b.geometry.type === 'Polygon' ? [b.geometry.coordinates as number[][][]] : (b.geometry.coordinates as number[][][][]);
  return polys.map((rings) => (rings[0] ?? []).map(([lng, lat]) => ({ latitude: lat, longitude: lng })));
}
