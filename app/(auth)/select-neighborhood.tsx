import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LocateFixed, MapPin } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { SearchBar } from '@/components/SearchBar';
import { Chip } from '@/components/Chip';
import { MapPlaceholder } from '@/components/MapPlaceholder';
import { Button } from '@/components/Button';
import type { Neighborhood } from '@/models';

export default function SelectNeighborhoodScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const citySlug = useStore((s) => s.session.citySlug);
  const allNeighborhoods = useStore((s) => s.neighborhoods);
  const selectNeighborhood = useStore((s) => s.selectNeighborhood);

  const [query, setQuery] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [locating, setLocating] = useState(false);

  const neighborhoods = useMemo(() => allNeighborhoods.filter((n) => n.citySlug === citySlug), [allNeighborhoods, citySlug]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return neighborhoods;
    return neighborhoods.filter((n) => n.nameAr.includes(q) || n.nameEn.toLowerCase().includes(q));
  }, [neighborhoods, query]);

  const cityCenter = neighborhoods[0] ?? { centerLat: 26.29, centerLng: 50.21 };

  const onSelect = (n: Neighborhood) => {
    selectNeighborhood(n.id);
    router.push('/(auth)/verification');
  };

  const useMyLocation = () => {
    setLocating(true);
    setTimeout(() => {
      setLocating(false);
      const nearest = neighborhoods[0];
      if (nearest) onSelect(nearest);
    }, 1000);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + 16 }}>
      <Text style={[theme.text('heading1'), styles.title]}>{t.neighborhood.title}</Text>

      <View style={[styles.searchWrap, theme.row(), { gap: 10 }]}>
        <View style={{ flex: 1 }}>
          <SearchBar value={query} onChangeText={setQuery} placeholder={t.neighborhood.searchPlaceholder} />
        </View>
      </View>

      <View style={[theme.row(), styles.toggleRow]}>
        <Chip label={t.neighborhood.listView} selected={view === 'list'} onPress={() => setView('list')} />
        <Chip label={t.neighborhood.mapView} selected={view === 'map'} onPress={() => setView('map')} />
      </View>

      <View style={{ paddingHorizontal: 24, marginBottom: 12 }}>
        <Button
          label={locating ? t.neighborhood.locating : t.neighborhood.useCurrentLocation}
          onPress={useMyLocation}
          variant="outline"
          size="sm"
          loading={locating}
          icon={<LocateFixed size={16} color={theme.colors.primary} />}
        />
      </View>

      {view === 'map' ? (
        <View style={{ paddingHorizontal: 24, flex: 1 }}>
          <MapPlaceholder
            centerLat={cityCenter.centerLat}
            centerLng={cityCenter.centerLng}
            spanDegrees={0.08}
            pins={filtered.map((n) => ({ id: n.id, lat: n.centerLat, lng: n.centerLng, label: n.nameAr }))}
            onPressPin={(id) => {
              const n = filtered.find((x) => x.id === id);
              if (n) onSelect(n);
            }}
            height={340}
          />
          <View style={{ marginTop: 16, gap: 8 }}>
            {filtered.map((n) => (
              <NeighborhoodRow key={n.id} n={n} locale={locale} onPress={() => onSelect(n)} />
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24, gap: 8 }}
          renderItem={({ item }) => <NeighborhoodRow n={item} locale={locale} onPress={() => onSelect(item)} />}
        />
      )}
    </View>
  );
}

function NeighborhoodRow({ n, locale, onPress }: { n: Neighborhood; locale: 'ar' | 'en'; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      style={[
        theme.row(),
        styles.row,
        { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, borderRadius: theme.radii.md },
      ]}
      accessibilityRole="button"
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.backgroundAlt }]}>
        <MapPin size={16} color={theme.colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={theme.text('title')}>{locale === 'ar' ? n.nameAr : n.nameEn}</Text>
        <Text style={theme.text('caption', theme.colors.textMuted)}>
          {n.residentsCount.toLocaleString()} {t.neighborhood.residents}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: 24, marginBottom: 16 },
  searchWrap: { paddingHorizontal: 24, marginBottom: 12 },
  toggleRow: { paddingHorizontal: 24, gap: 8, marginBottom: 12 },
  row: { alignItems: 'center', gap: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
