import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LocateFixed, MapPin } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import { geographyService } from '@/services/geography';
import { normalizeForSearch } from '@/utils/searchNormalize';
import { SearchBar } from '@/components/SearchBar';
import { Chip } from '@/components/Chip';
import { MapPlaceholder } from '@/components/MapPlaceholder';
import { Button } from '@/components/Button';
import { BottomSheet } from '@/components/BottomSheet';
import type { SaudiCity, SaudiNeighborhood } from '@/types/geography';

/**
 * Neighborhood picker for the city chosen on the previous screen — backed by
 * GeographyService, not a hardcoded list. Search is local (a city's district
 * list is small) but normalization-tolerant (Arabic variants, case,
 * whitespace) via searchNormalize. Includes "Can't find your neighborhood?"
 * -> a local suggestion flow, and a city-only fallback for the many smaller
 * cities the source has no district-level breakdown for.
 */
export default function SelectNeighborhoodScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const regionId = useStore((s) => s.session.regionId);
  const cityId = useStore((s) => s.session.cityId);
  const selectNeighborhood = useStore((s) => s.selectNeighborhood);

  const [city, setCity] = useState<SaudiCity | null>(null);
  const [neighborhoods, setNeighborhoods] = useState<SaudiNeighborhood[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [locating, setLocating] = useState(false);

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestNameAr, setSuggestNameAr] = useState('');
  const [suggestNameEn, setSuggestNameEn] = useState('');
  const [suggestNote, setSuggestNote] = useState('');
  const [suggestSubmitted, setSuggestSubmitted] = useState(false);

  useEffect(() => {
    if (!cityId) return;
    geographyService.getCity(cityId).then((c) => setCity(c ?? null));
    geographyService.getNeighborhoods(cityId).then((list) => {
      setNeighborhoods(list);
      setLoaded(true);
    });
  }, [cityId]);

  const filtered = useMemo(() => {
    const q = normalizeForSearch(query);
    if (!q) return neighborhoods;
    return neighborhoods.filter(
      (n) => normalizeForSearch(n.nameAr).includes(q) || normalizeForSearch(n.nameEn).includes(q),
    );
  }, [neighborhoods, query]);

  const cityCenterLat = city?.centerLat ?? 24.7;
  const cityCenterLng = city?.centerLng ?? 46.7;

  const onSelect = (n: SaudiNeighborhood) => {
    selectNeighborhood(n.id);
    router.push('/(auth)/verification');
  };

  const continueWithCityOnly = () => router.push('/(auth)/verification');

  // Demo-only: re-resolves the same city from a fixed coordinate (mirrors
  // select-city's "use my location"), since this frontend has no real
  // point-in-polygon capability to pick a neighborhood from coordinates.
  const useMyLocation = async () => {
    setLocating(true);
    const DEMO_COORDS = { lat: 26.29, lng: 50.21 };
    await geographyService.resolveApproxCityFromCoordinates(DEMO_COORDS.lat, DEMO_COORDS.lng);
    setLocating(false);
  };

  const submitNeighborhoodSuggestion = async () => {
    if (!regionId || !cityId || !suggestNameAr.trim()) return;
    await geographyService.submitNeighborhoodSuggestion({
      regionId,
      cityId,
      neighborhoodNameAr: suggestNameAr.trim(),
      neighborhoodNameEn: suggestNameEn.trim() || undefined,
      note: suggestNote.trim() || undefined,
      submittedByUserId: CURRENT_USER_ID,
    });
    setSuggestSubmitted(true);
  };

  const closeSuggest = () => {
    setSuggestOpen(false);
    setSuggestNameAr('');
    setSuggestNameEn('');
    setSuggestNote('');
    setSuggestSubmitted(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + 16 }}>
      <Text style={[theme.text('heading1'), styles.title]}>{t.neighborhood.title}</Text>

      <View style={[styles.searchWrap, theme.row(), { gap: 10 }]}>
        <View style={{ flex: 1 }}>
          <SearchBar value={query} onChangeText={setQuery} placeholder={t.neighborhood.searchPlaceholder} />
        </View>
      </View>

      {neighborhoods.length > 0 ? (
        <View style={[theme.row(), styles.toggleRow]}>
          <Chip label={t.neighborhood.listView} selected={view === 'list'} onPress={() => setView('list')} />
          <Chip label={t.neighborhood.mapView} selected={view === 'map'} onPress={() => setView('map')} />
        </View>
      ) : null}

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

      {!loaded ? null : neighborhoods.length === 0 ? (
        <View style={{ paddingHorizontal: 24, flex: 1 }}>
          <Text style={[theme.text('body', theme.colors.textSecondary), { marginBottom: 16 }]}>
            {t.neighborhood.noDistrictData}
          </Text>
          <Button label={t.neighborhood.continueWithCityOnly} onPress={continueWithCityOnly} variant="primary" />
        </View>
      ) : view === 'map' ? (
        <View style={{ paddingHorizontal: 24, flex: 1 }}>
          <MapPlaceholder
            centerLat={cityCenterLat}
            centerLng={cityCenterLng}
            spanDegrees={0.08}
            pins={filtered.map((n) => ({
              id: n.id,
              lat: n.centerLat ?? cityCenterLat,
              lng: n.centerLng ?? cityCenterLng,
              label: n.nameAr,
            }))}
            onPressPin={(id) => {
              const n = filtered.find((x) => x.id === id);
              if (n) onSelect(n);
            }}
            height={340}
          />
          <FlatList
            data={filtered}
            keyExtractor={(n) => n.id}
            contentContainerStyle={{ marginTop: 16, gap: 8, paddingBottom: insets.bottom + 24 }}
            renderItem={({ item }) => <NeighborhoodRow n={item} locale={locale} onPress={() => onSelect(item)} />}
            ListFooterComponent={<CantFindLink t={t} theme={theme} onPress={() => setSuggestOpen(true)} />}
          />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24, gap: 8 }}
          renderItem={({ item }) => <NeighborhoodRow n={item} locale={locale} onPress={() => onSelect(item)} />}
          initialNumToRender={20}
          windowSize={7}
          ListEmptyComponent={
            <Text style={[theme.text('bodySmall', theme.colors.textMuted), { textAlign: 'center', marginTop: 12 }]}>
              {t.neighborhood.noResults}
            </Text>
          }
          ListFooterComponent={<CantFindLink t={t} theme={theme} onPress={() => setSuggestOpen(true)} />}
        />
      )}

      <BottomSheet visible={suggestOpen} onClose={closeSuggest}>
        <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md }}>
          {suggestSubmitted ? (
            <>
              <Text style={[theme.text('heading3'), { marginBottom: 8 }]}>{t.neighborhood.suggestSuccess}</Text>
              <Button label={t.common.done} onPress={closeSuggest} variant="primary" fullWidth />
            </>
          ) : (
            <>
              <Text style={[theme.text('heading3'), { marginBottom: 6 }]}>{t.neighborhood.suggestTitle}</Text>
              <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginBottom: 16 }]}>
                {t.neighborhood.suggestBody}
              </Text>
              <TextInput
                value={suggestNameAr}
                onChangeText={setSuggestNameAr}
                placeholder={t.neighborhood.suggestNameAr}
                placeholderTextColor={theme.colors.textMuted}
                style={[theme.text('body'), styles.input, { borderColor: theme.colors.border }]}
              />
              <TextInput
                value={suggestNameEn}
                onChangeText={setSuggestNameEn}
                placeholder={t.neighborhood.suggestNameEn}
                placeholderTextColor={theme.colors.textMuted}
                style={[theme.text('body'), styles.input, { borderColor: theme.colors.border }]}
              />
              <TextInput
                value={suggestNote}
                onChangeText={setSuggestNote}
                placeholder={t.neighborhood.suggestNote}
                placeholderTextColor={theme.colors.textMuted}
                multiline
                style={[theme.text('body'), styles.input, styles.noteInput, { borderColor: theme.colors.border }]}
              />
              <Button
                label={t.neighborhood.suggestSubmit}
                onPress={submitNeighborhoodSuggestion}
                variant="primary"
                fullWidth
                disabled={!suggestNameAr.trim()}
              />
            </>
          )}
        </View>
      </BottomSheet>
    </View>
  );
}

function CantFindLink({ t, theme, onPress }: { t: ReturnType<typeof useI18n>['t']; theme: ReturnType<typeof useTheme>; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 16 }}>
      <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{t.neighborhood.cantFind}</Text>
      <Text style={[theme.text('bodySmall', theme.colors.primary), { marginTop: 2 }]}>{t.neighborhood.suggestLink}</Text>
    </Pressable>
  );
}

function NeighborhoodRow({ n, locale, onPress }: { n: SaudiNeighborhood; locale: 'ar' | 'en'; onPress: () => void }) {
  const theme = useTheme();
  const primary = locale === 'ar' ? n.nameAr : n.nameEn;
  const secondary = locale === 'ar' ? n.nameEn : n.nameAr;
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
        <Text style={theme.text('title')} numberOfLines={1}>
          {primary}
        </Text>
        {secondary ? (
          <Text style={theme.text('caption', theme.colors.textMuted)} numberOfLines={1}>
            {secondary}
          </Text>
        ) : null}
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
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, marginBottom: 12 },
  noteInput: { minHeight: 70, textAlignVertical: 'top' },
});
