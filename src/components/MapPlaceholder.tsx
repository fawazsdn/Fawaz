import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPin as MapPinIcon } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  color?: string;
  label?: string;
}

interface MapPlaceholderProps {
  centerLat: number;
  centerLng: number;
  pins?: MapPin[];
  onPressPin?: (id: string) => void;
  height?: number;
  spanDegrees?: number;
}

interface ProjectedPin {
  pin: MapPin;
  left: number;
  top: number;
}

/** Distance (in projected-% space) under which two pins are grouped into
 * one cluster marker, so a dense neighborhood doesn't render overlapping
 * pins on top of each other. A real map SDK would cluster by real
 * screen-pixel proximity as the user zooms; this is the same idea against
 * this component's simplified projection. */
const CLUSTER_THRESHOLD_PCT = 7;

/**
 * A frontend-safe stand-in for a real map SDK (Apple/Google/Mapbox maps).
 * It renders a stylized grid with pins positioned by simple lat/lng ->
 * percentage projection around a center point, with lightweight greedy
 * clustering for pins that would otherwise overlap. This keeps the whole
 * app runnable without map SDK credentials; swapping in a real MapView
 * later only touches this one component — `MapPin`/`onPressPin` is the
 * same shape a real provider's marker callback would use.
 */
export function MapPlaceholder({ centerLat, centerLng, pins = [], onPressPin, height = 220, spanDegrees = 0.02 }: MapPlaceholderProps) {
  const theme = useTheme();

  const project = (lat: number, lng: number) => {
    const x = 50 + ((lng - centerLng) / spanDegrees) * 50;
    const y = 50 - ((lat - centerLat) / spanDegrees) * 50;
    return { left: Math.min(94, Math.max(6, x)), top: Math.min(90, Math.max(10, y)) };
  };

  // Greedy clustering: walk pins in order, and fold any pin within
  // CLUSTER_THRESHOLD_PCT of an existing cluster's anchor point into it,
  // rather than a proper spatial index — pin counts here are always small
  // (a single neighborhood's worth), so this stays O(n²) on purpose.
  const clusters = useMemo(() => {
    const projected: ProjectedPin[] = pins.map((pin) => {
      const { left, top } = project(pin.lat, pin.lng);
      return { pin, left, top };
    });
    const groups: ProjectedPin[][] = [];
    for (const p of projected) {
      const target = groups.find((g) => {
        const anchor = g[0]!;
        return Math.hypot(anchor.left - p.left, anchor.top - p.top) < CLUSTER_THRESHOLD_PCT;
      });
      if (target) target.push(p);
      else groups.push([p]);
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `project` is a pure function of centerLat/centerLng/spanDegrees, already in deps
  }, [pins, centerLat, centerLng, spanDegrees]);

  return (
    <View
      style={[
        styles.wrap,
        { height, backgroundColor: theme.scheme === 'dark' ? theme.colors.surfaceElevated : theme.colors.backgroundAlt, borderRadius: theme.radii.lg },
      ]}
    >
      <View style={[styles.gridWrap, StyleSheet.absoluteFill]} pointerEvents="none">
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={`h${i}`} style={[styles.gridLineH, { top: `${(i + 1) * (100 / 7)}%`, backgroundColor: theme.colors.border }]} />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={`v${i}`} style={[styles.gridLineV, { left: `${(i + 1) * (100 / 7)}%`, backgroundColor: theme.colors.border }]} />
        ))}
      </View>

      <View style={[styles.centerPin]} pointerEvents="none">
        <View style={[styles.centerDot, { backgroundColor: theme.colors.primary }]} />
        <View style={[styles.centerRing, { borderColor: theme.colors.primary }]} />
      </View>

      {clusters.map((group) => {
        const anchor = group[0]!;
        const isCluster = group.length > 1;
        // A cluster mixes categories — fall back to the brand primary
        // color rather than picking one member's color arbitrarily.
        const color = isCluster ? theme.colors.primary : (anchor.pin.color ?? theme.colors.danger);
        return (
          <Pressable
            key={anchor.pin.id}
            onPress={() => onPressPin?.(anchor.pin.id)}
            style={[styles.pin, { left: `${anchor.left}%` as const, top: `${anchor.top}%` as const }]}
            accessibilityRole="button"
            accessibilityLabel={isCluster ? `${group.length} pins` : (anchor.pin.label ?? 'map pin')}
          >
            <View style={[styles.pinBubble, isCluster && styles.clusterBubble, { backgroundColor: color, borderColor: theme.colors.surfaceElevated }]}>
              {isCluster ? (
                <Text style={[theme.text('caption', '#fff'), styles.clusterLabel]}>{group.length}</Text>
              ) : (
                <MapPinIcon size={12} color="#fff" fill={color} />
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden', position: 'relative' },
  gridWrap: {},
  gridLineH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  gridLineV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  centerPin: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -6,
    marginTop: -6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerDot: { width: 12, height: 12, borderRadius: 6 },
  centerRing: { position: 'absolute', width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, opacity: 0.5 },
  pin: { position: 'absolute', marginLeft: -12, marginTop: -24 },
  pinBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  clusterBubble: { width: 28, height: 28, borderRadius: 14 },
  clusterLabel: { fontSize: 11 },
});
