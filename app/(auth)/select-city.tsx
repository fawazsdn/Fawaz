import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, LocateFixed, MapPin } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { geographyService } from '@/services/geography';
import { normalizeForSearch } from '@/utils/searchNormalize';
import { SearchBar } from '@/components/SearchBar';
import { Button } from '@/components/Button';
import type { GeographySearchResult, SaudiCity, SaudiRegion } from '@/types/geography';

/**
 * Region -> City picker, backed by GeographyService (all 13 Saudi regions,
 * 4,500+ cities/governorates — never a small hardcoded sample). A search box
 * jumps straight to any city or neighborhood by Arabic/English name; picking
 * a neighborhood result here skips straight to verification.
 */
export default function SelectCityScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const selectCity = useStore((s) => s.selectCity);
  const selectNeighborhood = useStore((s) => s.selectNeighborhood);
  const addRecentCity = useStore((s) => s.addRecentCity);
  const recentCityIds = useStore((s) => s.recentCityIds);

  const [regions, setRegions] = useState<SaudiRegion[]>([]);
  const [popularCities, setPopularCities] = useState<SaudiCity[]>([]);
  const [recentCities, setRecentCities] = useState<SaudiCity[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<SaudiRegion | null>(null);
  const [regionCities, setRegionCities] = useState<SaudiCity[]>([]);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeographySearchResult[]>([]);
  const [locating, setLocating] = useState(false);
  const [loadingRegionCities, setLoadingRegionCities] = useState(false);

  useEffect(() => {
    geographyService.getRegions().then(setRegions);
    geographyService.getPopularCities().then(setPopularCities);
  }, []);

  useEffect(() => {
    Promise.all(recentCityIds.map((id) => geographyService.getCity(id))).then((cities) =>
      setRecentCities(cities.filter((c): c is SaudiCity => !!c)),
    );
  }, [recentCityIds]);

  // Debounced national search across cities + neighborhoods (Arabic/English,
  // normalization-tolerant) — see src/services/geography/MockGeographyService.ts.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      geographyService.search(q, { limit: 30 }).then((results) => {
        if (!cancelled) setSearchResults(results);
      });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const openRegion = (region: SaudiRegion) => {
    setSelectedRegion(region);
    setLoadingRegionCities(true);
    geographyService.getCities(region.id).then((cities) => {
      setRegionCities(cities);
      setLoadingRegionCities(false);
    });
  };

  const chooseCity = (city: SaudiCity) => {
    selectCity({ regionId: city.regionId, cityId: city.id });
    addRecentCity(city.id);
    router.push('/(auth)/select-neighborhood');
  };

  const chooseSearchResult = (result: GeographySearchResult) => {
    selectCity({ regionId: result.region.id, cityId: result.city.id });
    addRecentCity(result.city.id);
    if (result.kind === 'neighborhood' && result.neighborhood) {
      selectNeighborhood(result.neighborhood.id);
      router.push('/(auth)/verification');
    } else {
      router.push('/(auth)/select-neighborhood');
    }
  };

  // Demo-only affordance: approximates a city from a fixed coordinate, via
  // the same haversine-nearest-city logic a real GPS reading would use.
  // Deliberately city-level only — see GeographyService.resolveApproxCityFromCoordinates.
  const useMyLocation = async () => {
    setLocating(true);
    const DEMO_COORDS = { lat: 26.29, lng: 50.21 };
    const resolved = await geographyService.resolveApproxCityFromCoordinates(DEMO_COORDS.lat, DEMO_COORDS.lng);
    setLocating(false);
    if (resolved) chooseCity(resolved.city);
  };

  const cityLabel = (c: SaudiCity) => (locale === 'ar' ? c.nameAr : c.nameEn);
  const regionLabel = (r: SaudiRegion) => (locale === 'ar' ? r.nameAr : r.nameEn);

  const renderCity = (city: SaudiCity) => (
    <Pressable
      key={city.id}
      onPress={() => chooseCity(city)}
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
      <Text style={[theme.text('title'), { flex: 1 }]} numberOfLines={1}>
        {cityLabel(city)}
      </Text>
    </Pressable>
  );

  const renderSearchResult = ({ item }: { item: GeographySearchResult }) => {
    const primary =
      item.kind === 'neighborhood' && item.neighborhood
        ? locale === 'ar'
          ? item.neighborhood.nameAr
          : item.neighborhood.nameEn
        : cityLabel(item.city);
    const context =
      item.kind === 'neighborhood'
        ? `${cityLabel(item.city)} · ${regionLabel(item.region)}`
        : regionLabel(item.region);
    return (
      <Pressable
        onPress={() => chooseSearchResult(item)}
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
          <Text style={theme.text('title')} numberOfLines={1}>
            {primary}
          </Text>
          <Text style={theme.text('caption', theme.colors.textMuted)} numberOfLines={1}>
            {context}
          </Text>
        </View>
      </Pressable>
    );
  };

  // -- Region-drilldown view --------------------------------------------
  // Search here filters this region's own city list (client-side — a
  // region has at most a few hundred cities, cheap to filter directly)
  // rather than jumping to the national search below.
  if (selectedRegion) {
    const q = normalizeForSearch(query);
    const regionFiltered = q
      ? regionCities.filter((c) => normalizeForSearch(c.nameAr).includes(q) || normalizeForSearch(c.nameEn).includes(q))
      : regionCities;
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + 16 }}>
        <View style={[theme.row(), styles.headerRow]}>
          <Pressable
            onPress={() => {
              setSelectedRegion(null);
              setQuery('');
            }}
            accessibilityRole="button"
            accessibilityLabel={t.city.changeRegion}
            hitSlop={10}
          >
            <ChevronLeft size={22} color={theme.colors.textPrimary} style={locale === 'ar' ? styles.flip : undefined} />
          </Pressable>
          <Text style={[theme.text('heading1'), { flex: 1 }]} numberOfLines={1}>
            {regionLabel(selectedRegion)}
          </Text>
        </View>
        <View style={styles.searchWrap}>
          <SearchBar value={query} onChangeText={setQuery} placeholder={t.city.searchPlaceholder} />
        </View>
        {loadingRegionCities ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={theme.colors.primary} />
        ) : (
          <FlatList
            data={regionFiltered}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24, gap: 8 }}
            renderItem={({ item }) => renderCity(item)}
            initialNumToRender={20}
            windowSize={7}
            ListEmptyComponent={
              <Text style={[theme.text('bodySmall', theme.colors.textMuted), { textAlign: 'center', marginTop: 24 }]}>
                {t.city.noResults}
              </Text>
            }
          />
        )}
      </View>
    );
  }

  const showingSearch = query.trim().length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + 16 }}>
      <Text style={[theme.text('heading1'), styles.title]}>{t.city.title}</Text>
      <View style={styles.searchWrap}>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t.city.searchPlaceholder} />
      </View>

      {showingSearch ? (
        <FlatList
          data={searchResults}
          keyExtractor={(r, i) => `${r.kind}-${r.city.id}-${r.neighborhood?.id ?? i}`}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24, gap: 8 }}
          renderItem={renderSearchResult}
          ListEmptyComponent={
            <Text style={[theme.text('bodySmall', theme.colors.textMuted), { textAlign: 'center', marginTop: 24 }]}>
              {t.city.noResults}
            </Text>
          }
        />
      ) : (
        <FlatList
          data={[
            { key: 'location', kind: 'location' as const },
            { key: 'recent', kind: 'recent' as const, items: recentCities },
            { key: 'popular', kind: 'popular' as const, items: popularCities },
            { key: 'regions', kind: 'regions' as const, items: regions },
          ]}
          keyExtractor={(s) => s.key}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}
          renderItem={({ item: section }) => {
            if (section.kind === 'location') {
              return (
                <View style={{ marginBottom: 20 }}>
                  <Button
                    label={locating ? t.city.locating : t.city.useCurrentLocation}
                    onPress={useMyLocation}
                    variant="outline"
                    size="sm"
                    loading={locating}
                    icon={<LocateFixed size={16} color={theme.colors.primary} />}
                  />
                </View>
              );
            }
            if (section.kind === 'recent') {
              if (section.items.length === 0) return null;
              return (
                <View style={{ marginBottom: 20 }}>
                  <Text style={[theme.text('caption', theme.colors.textMuted), styles.sectionLabel]}>{t.city.recent}</Text>
                  <View style={{ gap: 8 }}>{section.items.map(renderCity)}</View>
                </View>
              );
            }
            if (section.kind === 'popular') {
              return (
                <View style={{ marginBottom: 20 }}>
                  <Text style={[theme.text('caption', theme.colors.textMuted), styles.sectionLabel]}>{t.city.popular}</Text>
                  <View style={{ gap: 8 }}>{section.items.map(renderCity)}</View>
                </View>
              );
            }
            return (
              <View style={{ marginBottom: 20 }}>
                <Text style={[theme.text('caption', theme.colors.textMuted), styles.sectionLabel]}>{t.city.regionTitle}</Text>
                <View style={{ gap: 8 }}>
                  {section.items.map((region) => (
                    <Pressable
                      key={region.id}
                      onPress={() => openRegion(region)}
                      style={[
                        theme.row(),
                        styles.row,
                        { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, borderRadius: theme.radii.md },
                      ]}
                      accessibilityRole="button"
                    >
                      <Text style={[theme.text('title'), { flex: 1 }]} numberOfLines={1}>
                        {regionLabel(region)}
                      </Text>
                      <ChevronLeft
                        size={18}
                        color={theme.colors.textMuted}
                        style={locale === 'en' ? styles.flip : undefined}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: 24, marginBottom: 16 },
  headerRow: { paddingHorizontal: 24, marginBottom: 16, alignItems: 'center', gap: 10 },
  searchWrap: { paddingHorizontal: 24, marginBottom: 16 },
  sectionLabel: { marginBottom: 8, textTransform: 'uppercase' },
  row: { alignItems: 'center', gap: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth },
  iconWrap: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  flip: { transform: [{ scaleX: -1 }] },
});
