import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';

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

/**
 * A frontend-safe stand-in for a real map SDK (Apple/Google/Mapbox maps).
 * It renders a stylized grid with pins positioned by simple lat/lng ->
 * percentage projection around a center point. This keeps the whole app
 * runnable without map SDK credentials; swapping in a real MapView later
 * only touches this one component.
 */
export function MapPlaceholder({ centerLat, centerLng, pins = [], onPressPin, height = 220, spanDegrees = 0.02 }: MapPlaceholderProps) {
  const theme = useTheme();

  const project = (lat: number, lng: number) => {
    const x = 50 + ((lng - centerLng) / spanDegrees) * 50;
    const y = 50 - ((lat - centerLat) / spanDegrees) * 50;
    return { left: `${Math.min(94, Math.max(6, x))}%` as const, top: `${Math.min(90, Math.max(10, y))}%` as const };
  };

  return (
    <View style={[styles.wrap, { height, backgroundColor: theme.scheme === 'dark' ? '#1B2A23' : '#E7EFE3', borderRadius: theme.radii.lg }]}>
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

      {pins.map((pin) => {
        const pos = project(pin.lat, pin.lng);
        return (
          <Pressable
            key={pin.id}
            onPress={() => onPressPin?.(pin.id)}
            style={[styles.pin, { left: pos.left, top: pos.top }]}
            accessibilityRole="button"
            accessibilityLabel={pin.label ?? 'map pin'}
          >
            <View style={[styles.pinBubble, { backgroundColor: pin.color ?? theme.colors.danger }]}>
              <MapPin size={12} color="#fff" fill={pin.color ?? theme.colors.danger} />
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
  centerPin: { position: 'absolute', left: '50%', top: '50%', marginLeft: -6, marginTop: -6, alignItems: 'center', justifyContent: 'center' },
  centerDot: { width: 12, height: 12, borderRadius: 6 },
  centerRing: { position: 'absolute', width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, opacity: 0.5 },
  pin: { position: 'absolute', marginLeft: -12, marginTop: -24 },
  pinBubble: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
});
