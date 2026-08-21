import { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { MapPin as MapPinIcon } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { normalizeForSearch } from '@/utils/searchNormalize';
import { AppHeader } from '@/components/AppHeader';
import { SearchBar } from '@/components/SearchBar';
import { FilterBar } from '@/components/FilterBar';
import { MapPlaceholder, type MapPin } from '@/components/MapPlaceholder';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';

type FilterKey = 'all' | 'events' | 'issues' | 'services' | 'marketplace' | 'lostFound';

interface MapItem {
  id: string;
  kind: Exclude<FilterKey, 'all'>;
  lat: number;
  lng: number;
  color: string;
  title: string;
  subtitle: string;
  image?: string;
  description: string;
  ctaLabel: string;
  route: Href;
}

/**
 * Haratna's neighborhood map — community-first, not business-first: events,
 * open issues, recommended businesses, marketplace listings, and lost &
 * found all show up together, filterable by category. Still the same
 * frontend-safe MapPlaceholder stand-in (no real map SDK credentials in
 * this build — see that component's doc comment); this screen only adds
 * the search/filter/detail-sheet UI around it, all through the same
 * MapPin/onPressPin contract a real provider's map view would use.
 */
export default function MapScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();

  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === s.session.neighborhoodId));
  // Raw state + useMemo, not filter() inside the selector — see HomeHeader
  // for why (getSnapshot must return a stable reference across renders).
  const allEvents = useStore((s) => s.events);
  const allIssues = useStore((s) => s.issues);
  const allBusinesses = useStore((s) => s.businesses);
  const allLostFound = useStore((s) => s.lostFound);
  const allListings = useStore((s) => s.marketplaceListings);

  const events = useMemo(
    () => allEvents.filter((e) => e.neighborhoodId === neighborhood?.id && !e.cancelled),
    [allEvents, neighborhood?.id],
  );
  const issues = useMemo(
    () => allIssues.filter((i) => i.neighborhoodId === neighborhood?.id && i.status !== 'resolved'),
    [allIssues, neighborhood?.id],
  );
  const businesses = useMemo(
    () => allBusinesses.filter((b) => b.neighborhoodIds.includes(neighborhood?.id ?? '')),
    [allBusinesses, neighborhood?.id],
  );
  const lostFound = useMemo(
    () => allLostFound.filter((l) => l.neighborhoodId === neighborhood?.id && l.status !== 'reunited'),
    [allLostFound, neighborhood?.id],
  );
  const listings = useMemo(
    () => allListings.filter((m) => m.neighborhoodId === neighborhood?.id && m.status === 'available'),
    [allListings, neighborhood?.id],
  );

  const items: MapItem[] = useMemo(() => {
    if (!neighborhood) return [];
    const neighborhoodLabel = locale === 'ar' ? neighborhood.nameAr : neighborhood.nameEn;
    const list: MapItem[] = [];
    events.forEach((e) =>
      list.push({
        id: e.id,
        kind: 'events',
        lat: e.approxLat,
        lng: e.approxLng,
        color: theme.colors.primary,
        title: e.title,
        subtitle: t.eventCreate.categories[e.category],
        image: e.coverImage,
        description: e.description,
        ctaLabel: t.events.join,
        route: `/event/${e.id}`,
      }),
    );
    issues.forEach((i) =>
      list.push({
        id: i.id,
        kind: 'issues',
        lat: i.approxLat,
        lng: i.approxLng,
        color: theme.colors.warning,
        title: i.title,
        subtitle: t.issueCreate.categories[i.category],
        image: i.images[0],
        description: i.description,
        ctaLabel: t.common.seeDetails,
        route: `/issue/${i.id}`,
      }),
    );
    businesses.forEach((b, idx) =>
      list.push({
        id: b.id,
        kind: 'services',
        lat: neighborhood.centerLat + (idx % 3) * 0.002 - 0.002,
        lng: neighborhood.centerLng + Math.floor(idx / 3) * 0.002 - 0.002,
        color: theme.colors.accent,
        title: b.name,
        subtitle: neighborhoodLabel,
        image: b.coverImage,
        description: b.description,
        ctaLabel: t.common.seeDetails,
        route: `/business/${b.id}`,
      }),
    );
    lostFound.forEach((l, idx) =>
      list.push({
        id: l.id,
        kind: 'lostFound',
        lat: neighborhood.centerLat - (idx % 3) * 0.0015,
        lng: neighborhood.centerLng - Math.floor(idx / 3) * 0.0015,
        color: theme.colors.danger,
        title: l.title,
        subtitle: neighborhoodLabel,
        image: l.image,
        description: l.description,
        ctaLabel: t.common.seeDetails,
        route: `/lost-found/${l.id}`,
      }),
    );
    listings.forEach((m, idx) =>
      list.push({
        id: m.id,
        kind: 'marketplace',
        lat: neighborhood.centerLat + (idx % 3) * 0.0018 + 0.0018,
        lng: neighborhood.centerLng - Math.floor(idx / 3) * 0.0018 - 0.0018,
        color: theme.colors.secondary,
        title: m.title,
        subtitle: m.listingType === 'sale' ? t.marketplace.forSale : m.listingType === 'free' ? t.marketplace.free : t.marketplace.wanted,
        image: m.images[0],
        description: m.description,
        ctaLabel: t.common.seeDetails,
        route: `/marketplace/${m.id}`,
      }),
    );
    return list;
  }, [neighborhood, events, issues, businesses, lostFound, listings, theme, t, locale]);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = filter === 'all' ? items : items.filter((i) => i.kind === filter);
    const q = normalizeForSearch(query);
    if (q) list = list.filter((i) => normalizeForSearch(i.title).includes(q) || normalizeForSearch(i.subtitle).includes(q));
    return list;
  }, [items, filter, query]);

  if (!neighborhood) return null;

  const pins: MapPin[] = filtered.map((i) => ({ id: i.id, lat: i.lat, lng: i.lng, color: i.color, label: i.title }));
  const selectedItem = filtered.find((i) => i.id === selectedId) ?? null;

  const filterOptions: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t.map.all },
    { key: 'events', label: t.map.events },
    { key: 'services', label: t.map.services },
    { key: 'marketplace', label: t.map.marketplace },
    { key: 'issues', label: t.map.issues },
    { key: 'lostFound', label: t.map.lostFound },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.map.title} showBack={false} />

      <View style={{ paddingHorizontal: theme.spacing.md, marginBottom: 8 }}>
        <View style={[theme.row(), { alignItems: 'center', gap: 6, marginBottom: 10 }]}>
          <MapPinIcon size={14} color={theme.colors.textMuted} />
          <Text style={theme.text('bodySmall', theme.colors.textSecondary)} numberOfLines={1}>
            {locale === 'ar' ? neighborhood.nameAr : neighborhood.nameEn}
          </Text>
        </View>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t.map.searchPlaceholder} />
      </View>

      <View style={{ marginBottom: 10 }}>
        <FilterBar options={filterOptions} selected={filter} onSelect={(k) => setFilter(k as FilterKey)} />
      </View>

      <View style={{ flex: 1, paddingHorizontal: theme.spacing.md }}>
        {filtered.length === 0 ? (
          <EmptyState icon={MapPinIcon} title={t.map.noResults} compact />
        ) : (
          <MapPlaceholder
            centerLat={neighborhood.centerLat}
            centerLng={neighborhood.centerLng}
            spanDegrees={0.01}
            pins={pins}
            height={480}
            onPressPin={setSelectedId}
          />
        )}
      </View>
      <Text style={[theme.text('caption', theme.colors.textMuted), { textAlign: 'center', paddingVertical: 10 }]}>
        {t.map.approxNotice}
      </Text>

      <BottomSheet visible={!!selectedItem} onClose={() => setSelectedId(null)}>
        {selectedItem ? (
          <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
            {selectedItem.image ? <Image source={{ uri: selectedItem.image }} style={styles.sheetImage} /> : null}
            <View style={[theme.row(), styles.sheetBadgeRow]}>
              <View style={[styles.sheetBadge, { backgroundColor: selectedItem.color + '1a' }]}>
                <Text style={theme.text('caption', selectedItem.color)}>{selectedItem.subtitle}</Text>
              </View>
            </View>
            <Text style={[theme.text('heading3'), { marginTop: 8 }]}>{selectedItem.title}</Text>
            <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginTop: 6, marginBottom: 18 }]} numberOfLines={3}>
              {selectedItem.description}
            </Text>
            <Button
              label={selectedItem.ctaLabel}
              onPress={() => {
                const route = selectedItem.route;
                setSelectedId(null);
                router.push(route);
              }}
              variant="primary"
              fullWidth
            />
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetImage: { width: '100%', height: 140, borderRadius: 14, marginBottom: 4 },
  sheetBadgeRow: { marginTop: 12 },
  sheetBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
});
