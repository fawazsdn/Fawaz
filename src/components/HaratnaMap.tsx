import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import Constants from 'expo-constants';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE, type Region } from 'react-native-maps';

import { groupMapMarkers } from '@/features/map/clusterMarkers';
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
  clusterMarkers?: boolean;
  style?: StyleProp<ViewStyle>;
}

export interface HaratnaMapHandle {
  centerOn: (c: MapCoordinate, delta?: number) => void;
}

/**
 * The native provider is selected from the build's map configuration.
 * Zoom/pan/rotate are native. Only records passed in as `markers` are drawn —
 * the map never adds pins of its own.
 */
export const HaratnaMap = forwardRef<HaratnaMapHandle, HaratnaMapProps>(function HaratnaMap(
  {
    center,
    delta = 0.02,
    markers,
    polygons = [],
    onMarkerPress,
    showsUserLocation,
    onMapPress,
    scrollEnabled = true,
    clusterMarkers = false,
    style,
  },
  ref,
) {
  const theme = useTheme();
  const mapRef = useRef<MapView>(null);
  const [span, setSpan] = useState({ latitudeDelta: delta, longitudeDelta: delta });
  const groups = groupMapMarkers(markers, clusterMarkers ? span.latitudeDelta : 0, span.longitudeDelta);

  useImperativeHandle(ref, () => ({
    centerOn: (c, d = delta) => {
      const region: Region = { ...c, latitudeDelta: d, longitudeDelta: d };
      mapRef.current?.animateToRegion(region, 450);
    },
  }));

  return (
    <MapView
      ref={mapRef}
      provider={Platform.OS === 'ios' && Constants.expoConfig?.extra?.googleMapsIosEnabled === true ? PROVIDER_GOOGLE : undefined}
      style={[{ flex: 1 }, style]}
      initialRegion={{ ...center, latitudeDelta: delta, longitudeDelta: delta }}
      onRegionChangeComplete={
        clusterMarkers ? ({ latitudeDelta, longitudeDelta }) => setSpan({ latitudeDelta, longitudeDelta }) : undefined
      }
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
        <Polygon
          key={`poly-${i}`}
          coordinates={coords}
          strokeColor={theme.colors.primary}
          strokeWidth={2}
          fillColor={theme.colors.primary + '14'}
        />
      ))}
      {groups.map(({ markers: group, coordinate }) => {
        const marker = group[0];
        if (group.length > 1) {
          const label = String(group.length);
          return (
            <Marker
              key={`cluster:${marker.id}`}
              coordinate={coordinate}
              title={label}
              pinColor={theme.colors.primary}
              onPress={(event) => {
                event.stopPropagation?.();
                mapRef.current?.animateToRegion(
                  {
                    ...coordinate,
                    latitudeDelta: Math.max(0.001, span.latitudeDelta / 3),
                    longitudeDelta: Math.max(0.001, span.longitudeDelta / 3),
                  },
                  350,
                );
              }}
            />
          );
        }
        const m = marker;
        return (
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
        );
      })}
    </MapView>
  );
});
