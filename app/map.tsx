import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SlidersHorizontal } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { AppHeader } from '@/components/AppHeader';
import { IconButton } from '@/components/IconButton';
import { MapPlaceholder, type MapPin } from '@/components/MapPlaceholder';
import { BottomSheet } from '@/components/BottomSheet';
import { Chip } from '@/components/Chip';

type LayerKey = 'events' | 'issues' | 'marketplace' | 'services' | 'lostFound';

export default function MapScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === s.session.neighborhoodId));
  const events = useStore((s) => s.events.filter((e) => e.neighborhoodId === neighborhood?.id && !e.cancelled));
  const issues = useStore((s) => s.issues.filter((i) => i.neighborhoodId === neighborhood?.id && i.status !== 'resolved'));
  const businesses = useStore((s) => s.businesses.filter((b) => b.neighborhoodIds.includes(neighborhood?.id ?? '')));
  const lostFound = useStore((s) => s.lostFound.filter((l) => l.neighborhoodId === neighborhood?.id && l.status !== 'reunited'));

  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ events: true, issues: true, marketplace: false, services: false, lostFound: true });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedPin, setSelectedPin] = useState<{ label: string; route: string } | null>(null);

  const pins: (MapPin & { route: string })[] = useMemo(() => {
    if (!neighborhood) return [];
    const list: (MapPin & { route: string })[] = [];
    if (layers.events) events.forEach((e) => list.push({ id: e.id, lat: e.approxLat, lng: e.approxLng, color: theme.colors.primary, label: e.title, route: `/event/${e.id}` }));
    if (layers.issues) issues.forEach((i) => list.push({ id: i.id, lat: i.approxLat, lng: i.approxLng, color: theme.colors.warning, label: i.title, route: `/issue/${i.id}` }));
    if (layers.services) businesses.forEach((b, idx) => list.push({ id: b.id, lat: neighborhood.centerLat + (idx % 3) * 0.002 - 0.002, lng: neighborhood.centerLng + Math.floor(idx / 3) * 0.002 - 0.002, color: theme.colors.info, label: b.name, route: `/business/${b.id}` }));
    if (layers.lostFound) lostFound.forEach((l, idx) => list.push({ id: l.id, lat: neighborhood.centerLat - (idx % 3) * 0.0015, lng: neighborhood.centerLng - Math.floor(idx / 3) * 0.0015, color: theme.colors.danger, label: l.title, route: `/lost-found/${l.id}` }));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neighborhood, events, issues, businesses, lostFound, layers, theme]);

  if (!neighborhood) return null;

  const toggle = (key: LayerKey) => setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  const layerOptions: { key: LayerKey; label: string }[] = [
    { key: 'events', label: t.map.events },
    { key: 'issues', label: t.map.issues },
    { key: 'marketplace', label: t.map.marketplace },
    { key: 'services', label: t.map.services },
    { key: 'lostFound', label: t.map.lostFound },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title={t.map.title}
        right={
          <IconButton accessibilityLabel={t.map.filters} onPress={() => setFiltersOpen(true)}>
            <SlidersHorizontal size={19} color={theme.colors.textPrimary} />
          </IconButton>
        }
      />
      <View style={{ flex: 1, paddingHorizontal: theme.spacing.md }}>
        <MapPlaceholder
          centerLat={neighborhood.centerLat}
          centerLng={neighborhood.centerLng}
          spanDegrees={0.01}
          pins={pins}
          height={520}
          onPressPin={(id) => {
            const pin = pins.find((p) => p.id === id);
            if (pin) setSelectedPin({ label: pin.label ?? '', route: pin.route });
          }}
        />
      </View>
      <Text style={[theme.text('caption', theme.colors.textMuted), { textAlign: 'center', paddingVertical: 10 }]}>{t.map.approxNotice}</Text>

      <BottomSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)}>
        <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md }}>
          <Text style={[theme.text('heading3'), { marginBottom: 12 }]}>{t.map.filters}</Text>
          <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {layerOptions.map((opt) => (
              <Chip key={opt.key} label={opt.label} selected={layers[opt.key]} onPress={() => toggle(opt.key)} />
            ))}
          </ScrollView>
        </View>
      </BottomSheet>

      <BottomSheet visible={!!selectedPin} onClose={() => setSelectedPin(null)}>
        <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
          <Text style={[theme.text('title'), { marginBottom: 12 }]}>{selectedPin?.label}</Text>
          <Pressable
            onPress={() => {
              if (selectedPin) {
                const route = selectedPin.route;
                setSelectedPin(null);
                router.push(route as never);
              }
            }}
          >
            <Text style={theme.text('body', theme.colors.primary)}>{t.common.seeDetails}</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  );
}
