import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import MapView, { Marker, Polygon, type Region } from 'react-native-maps';

import { useTheme } from '@/theme/useTheme';

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export interface HaratnaMarker {
  id: string;
  coordinate: MapCoordinate;
  title: string;
  color: string;
}

export interface HaratnaMapProps {
  center: MapCoordinate;
  /** Initial latitude/longitude span in degrees. */
  delta?: number;
  markers: HaratnaMarker[];
  polygons?: MapCoordinate[][];
  onMarkerPress?: (id: string) => void;
  showsUserLocation?: boolean;
  /** Tap on empty map (used to drop a pin when creating an activity). */
  onMapPress?: (c: MapCoordinate) => void;
  scrollEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export interface HaratnaMapHandle {
  centerOn: (c: MapCoordinate, delta?: number) => void;
}

/**
 * The app's one real map (react-native-maps → Apple Maps on iOS, no API key).
 * Zoom/pan/rotate are native. Only records passed in as `markers` are drawn —
 * the map never adds pins of its own.
 */
export const HaratnaMap = forwardRef<HaratnaMapHandle, HaratnaMapProps>(function HaratnaMap(
  { center, delta = 0.02, markers, polygons = [], onMarkerPress, showsUserLocation, onMapPress, scrollEnabled = true, style },
  ref,
) {
  const theme = useTheme();
  const mapRef = useRef<MapView>(null);

  useImperativeHandle(ref, () => ({
    centerOn: (c, d = delta) => {
      const region: Region = { ...c, latitudeDelta: d, longitudeDelta: d };
      mapRef.current?.animateToRegion(region, 450);
    },
  }));

  return (
    <MapView
      ref={mapRef}
      style={[{ flex: 1 }, style]}
      initialRegion={{ ...center, latitudeDelta: delta, longitudeDelta: delta }}
      showsUserLocation={showsUserLocation}
      showsCompass
      showsScale
      pitchEnabled={false}
      toolbarEnabled={false}
      scrollEnabled={scrollEnabled}
      onPress={onMapPress ? (e) => onMapPress(e.nativeEvent.coordinate) : undefined}
      userInterfaceStyle={theme.scheme === 'dark' ? 'dark' : 'light'}
      accessibilityLabel="map"
    >
      {polygons.map((coords, i) => (
        <Polygon key={`poly-${i}`} coordinates={coords} strokeColor={theme.colors.primary} strokeWidth={2} fillColor={theme.colors.primary + '14'} />
      ))}
      {markers.map((m) => (
        <Marker
          key={m.id}
          identifier={m.id}
          coordinate={m.coordinate}
          title={m.title}
          pinColor={m.color}
          tracksViewChanges={false}
          onPress={(e) => {
            e.stopPropagation?.();
            onMarkerPress?.(m.id);
          }}
        />
      ))}
    </MapView>
  );
});
