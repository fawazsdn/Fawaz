import type { HaratnaMarker, MapCoordinate } from '@/components/HaratnaMap';

export type MarkerGroup = { markers: HaratnaMarker[]; coordinate: MapCoordinate };

export function groupMapMarkers(markers: HaratnaMarker[], latitudeDelta: number, longitudeDelta: number): MarkerGroup[] {
  const valid = markers.filter(
    ({ coordinate: { latitude, longitude } }) =>
      Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180,
  );
  if (latitudeDelta <= 0.001 || longitudeDelta <= 0.001) {
    return valid.map((marker) => ({ markers: [marker], coordinate: marker.coordinate }));
  }
  const cells = new Map<string, HaratnaMarker[]>();
  for (const marker of valid) {
    const { latitude, longitude } = marker.coordinate;
    const key = `${Math.floor(latitude / (latitudeDelta / 10))}:${Math.floor(longitude / (longitudeDelta / 7))}`;
    const group = cells.get(key);
    if (group) group.push(marker);
    else cells.set(key, [marker]);
  }
  return Array.from(cells.values(), (group) => ({
    markers: group,
    coordinate: {
      latitude: group.reduce((sum, marker) => sum + marker.coordinate.latitude, 0) / group.length,
      longitude: group.reduce((sum, marker) => sum + marker.coordinate.longitude, 0) / group.length,
    },
  }));
}
