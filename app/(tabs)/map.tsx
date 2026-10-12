import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { Calendar, Clock, LocateFixed, MapPin, Navigation, User as UserIcon, Users } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { useCurrentNeighborhood } from '@/hooks/useNeighborhood';
import { geographyService } from '@/services/geography';
import { boundaryToPolygons, fetchNeighborhoodBoundary, locateOnce } from '@/backend/location';
import { displayName, formatClock, formatDay, localizeDigits } from '@/utils/format';
import { normalizeSearchQuery, normalizeForSearch } from '@/utils/searchNormalize';
import { AppHeader } from '@/components/AppHeader';
import { SearchBar } from '@/components/SearchBar';
import { FilterBar } from '@/components/FilterBar';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { NoNeighborhoodState } from '@/components/NoNeighborhoodState';
import { HaratnaMap, type HaratnaMapHandle, type MapCoordinate } from '@/components/HaratnaMap';
import { CATEGORY_ICON, eventState } from '@/features/events/EventCard';
import type { GeographySearchResult } from '@/types/geography';

type FilterKey = 'all' | 'activities' | 'events' | 'businesses' | 'community';

interface MapItem {
  id: string;
  kind: Exclude<FilterKey, 'all'>;
  coordinate: MapCoordinate;
  color: string;
  title: string;
  route: Href;
}

/**
 * Real interactive neighborhood map. Every marker is a real, RLS-visible
 * record that its author explicitly placed (rounded to ~110 m); records
 * without a pinned location simply aren't drawn — nothing is scattered or
 * invented around the neighborhood center. Residents' homes are never shown.
 */
export default function MapScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ focus?: string }>();
  const mapRef = useRef<HaratnaMapHandle>(null);

  const neighborhood = useCurrentNeighborhood();
  const allEvents = useStore((s) => s.events);
  const allBusinesses = useStore((s) => s.businesses);
  const allPosts = useStore((s) => s.posts);
  const allIssues = useStore((s) => s.issues);
  const users = useStore((s) => s.users);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<GeographySearchResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [polygons, setPolygons] = useState<MapCoordinate[][]>([]);
  const [boundaryMissing, setBoundaryMissing] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [locNote, setLocNote] = useState<string | null>(null);

  // Official neighborhood outline (address.gov.sa polygon) — or an explicit
  // "unavailable" note; never a made-up circle.
  useEffect(() => {
    if (!neighborhood) return;
    let alive = true;
    fetchNeighborhoodBoundary(neighborhood.id)
      .then((b) => {
        if (!alive) return;
        const p = boundaryToPolygons(b);
        setPolygons(p);
        setBoundaryMissing(p.length === 0);
      })
      .catch(() => alive && setBoundaryMissing(!neighborhood.hasBoundary));
    return () => {
      alive = false;
    };
  }, [neighborhood?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const now = Date.now();
  const items: MapItem[] = useMemo(() => {
    const list: MapItem[] = [];
    for (const e of allEvents) {
      if (e.approxLat == null || e.approxLng == null || e.cancelled || new Date(e.endsAt).getTime() < now) continue;
      list.push({
        id: e.id,
        kind: e.kind === 'activity' ? 'activities' : 'events',
        coordinate: { latitude: e.approxLat, longitude: e.approxLng },
        color: e.kind === 'activity' ? theme.colors.primary : theme.colors.secondary,
        title: e.title,
        route: `/event/${e.id}`,
      });
    }
    for (const b of allBusinesses) {
      if (b.approxLat == null || b.approxLng == null) continue;
      list.push({
        id: b.id,
        kind: 'businesses',
        coordinate: { latitude: b.approxLat, longitude: b.approxLng },
        color: theme.colors.accent,
        title: b.name,
        route: `/business/${b.id}`,
      });
    }
    for (const p of allPosts) {
      if (p.approxLat == null || p.approxLng == null) continue;
      list.push({
        id: p.id,
        kind: 'community',
        coordinate: { latitude: p.approxLat, longitude: p.approxLng },
        color: theme.colors.info,
        title: p.textAr.slice(0, 60) || t.map.post,
        route: `/post/${p.id}`,
      });
    }
    for (const i of allIssues) {
      if (i.approxLat == null || i.approxLng == null || i.status === 'resolved') continue;
      list.push({
        id: i.id,
        kind: 'community',
        coordinate: { latitude: i.approxLat, longitude: i.approxLng },
        color: theme.colors.warning,
        title: i.title,
        route: `/issue/${i.id}`,
      });
    }
    return list;
  }, [allEvents, allBusinesses, allPosts, allIssues, theme, t, now]);

  const filtered = useMemo(() => {
    let list = filter === 'all' ? items : items.filter((i) => i.kind === filter);
    const q = normalizeForSearch(query);
    if (q) list = list.filter((i) => normalizeForSearch(i.title).includes(q));
    return list;
  }, [items, filter, query]);

  // Place search (neighborhoods/cities from the official dataset).
  useEffect(() => {
    const q = normalizeSearchQuery(query);
    if (q.length < 2) {
      setPlaces([]);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => geographyService.search(query, { limit: 6 }).then((r) => alive && setPlaces(r)), 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  // Deep link from an activity: /(tabs)/map?focus=<eventId>
  useEffect(() => {
    if (!params.focus) return;
    const item = items.find((i) => i.id === params.focus);
    if (item) {
      setTimeout(() => mapRef.current?.centerOn(item.coordinate, 0.006), 300);
      setSelectedId(item.id);
    }
  }, [params.focus, items]);

  if (!neighborhood) return <NoNeighborhoodState />;

  const center = { latitude: neighborhood.centerLat, longitude: neighborhood.centerLng };

  const goToPlace = (r: GeographySearchResult) => {
    const lat = r.neighborhood?.centerLat ?? r.city.centerLat;
    const lng = r.neighborhood?.centerLng ?? r.city.centerLng;
    if (lat != null && lng != null) mapRef.current?.centerOn({ latitude: lat, longitude: lng }, r.neighborhood ? 0.02 : 0.15);
    setQuery('');
    setPlaces([]);
  };

  const locateMe = async () => {
    setLocNote(null);
    const loc = await locateOnce();
    if (loc.status !== 'ok') {
      setLocNote(loc.status === 'denied' ? t.map.locationDenied : t.verification.locationUnavailableBody);
      return;
    }
    setShowUser(true);
    mapRef.current?.centerOn({ latitude: loc.lat, longitude: loc.lng }, 0.01);
  };

  const filterOptions: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t.map.all },
    { key: 'activities', label: t.map.activities },
    { key: 'events', label: t.map.events },
    { key: 'businesses', label: t.map.businesses },
    { key: 'community', label: t.map.community },
  ];

  const selectedEvent = selectedId ? allEvents.find((e) => e.id === selectedId) : undefined;
  const selectedOther = selectedId && !selectedEvent ? items.find((i) => i.id === selectedId) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.map.title} showBack={false} />

      <View style={{ paddingHorizontal: theme.spacing.md, marginBottom: 8, zIndex: 2 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t.map.searchPlaceholder} />
        {places.length > 0 ? (
          <View
            style={[
              styles.dropdown,
              { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border, borderRadius: theme.radii.md },
            ]}
          >
            <Text style={[theme.text('caption', theme.colors.textMuted), { paddingHorizontal: 12, paddingTop: 8 }]}>{t.map.places}</Text>
            {places.map((r) => (
              <Pressable
                key={`${r.kind}-${r.neighborhood?.id ?? r.city.id}`}
                onPress={() => goToPlace(r)}
                style={[styles.placeRow, theme.row()]}
                accessibilityRole="button"
              >
                <MapPin size={14} color={theme.colors.primary} />
                <Text style={[theme.text('bodySmall'), { flex: 1 }]} numberOfLines={1}>
                  {r.neighborhood ? (locale === 'ar' ? r.neighborhood.nameAr : r.neighborhood.nameEn) + ' · ' : ''}
                  {locale === 'ar' ? r.city.nameAr : r.city.nameEn}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={{ marginBottom: 8 }}>
        <FilterBar options={filterOptions} selected={filter} onSelect={(k) => setFilter(k as FilterKey)} />
      </View>

      <View style={{ flex: 1, marginHorizontal: theme.spacing.md, borderRadius: theme.radii.lg, overflow: 'hidden' }}>
        <HaratnaMap
          ref={mapRef}
          center={center}
          delta={0.025}
          markers={filtered.map((i) => ({ id: i.id, coordinate: i.coordinate, title: i.title, color: i.color }))}
          polygons={polygons}
          onMarkerPress={setSelectedId}
          showsUserLocation={showUser}
        />

        <View style={styles.fabColumn} pointerEvents="box-none">
          <Pressable
            onPress={locateMe}
            style={[styles.fab, { backgroundColor: theme.colors.surfaceElevated }]}
            accessibilityRole="button"
            accessibilityLabel={t.map.myLocation}
          >
            <LocateFixed size={20} color={theme.colors.primary} />
          </Pressable>
          <Pressable
            onPress={() => mapRef.current?.centerOn(center, 0.025)}
            style={[styles.fab, { backgroundColor: theme.colors.surfaceElevated }]}
            accessibilityRole="button"
            accessibilityLabel={t.map.backToNeighborhood}
          >
            <Navigation size={20} color={theme.colors.primary} />
          </Pressable>
        </View>

        {filtered.length === 0 ? (
          <View
            pointerEvents="none"
            style={[styles.overlay, { backgroundColor: theme.colors.surfaceElevated + 'ee', borderRadius: theme.radii.md }]}
          >
            <Text style={theme.text('title')}>{t.map.nothingOnMap}</Text>
            <Text style={theme.text('caption', theme.colors.textSecondary)}>{t.map.nothingOnMapBody}</Text>
          </View>
        ) : null}
        {boundaryMissing || locNote ? (
          <View
            pointerEvents="none"
            style={[styles.note, { backgroundColor: theme.colors.surfaceElevated + 'ee', borderRadius: theme.radii.sm }]}
          >
            <Text style={theme.text('caption', theme.colors.textSecondary)}>{locNote ?? t.map.boundaryUnavailable}</Text>
          </View>
        ) : null}
      </View>

      <Text style={[theme.text('caption', theme.colors.textMuted), styles.notice]} numberOfLines={2}>
        {t.map.approxNotice}
      </Text>

      <BottomSheet visible={!!selectedId} onClose={() => setSelectedId(null)}>
        {selectedEvent ? (
          <ActivitySheet
            eventId={selectedEvent.id}
            onView={() => {
              setSelectedId(null);
              router.push(`/event/${selectedEvent.id}`);
            }}
          />
        ) : selectedOther ? (
          <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.lg, gap: 12 }}>
            <Text style={theme.text('heading3')}>{selectedOther.title}</Text>
            <Button
              label={t.map.seeDetails}
              onPress={() => {
                const route = selectedOther.route;
                setSelectedId(null);
                router.push(route);
              }}
              fullWidth
            />
          </ScrollView>
        ) : null}
      </BottomSheet>
    </View>
  );

  function ActivitySheet({ eventId, onView }: { eventId: string; onView: () => void }) {
    const event = allEvents.find((e) => e.id === eventId);
    if (!event) return null;
    const host = users.find((u) => u.id === event.hostId);
    const { going, spotsLeft, isFull } = eventState(event);
    const category = (t.eventCreate.categories as Record<string, string>)[event.category] ?? event.category;
    const Row = ({ icon: Icon, text }: { icon: typeof Clock; text: string }) => (
      <View style={[theme.row(), { alignItems: 'center', gap: 8 }]}>
        <Icon size={15} color={theme.colors.textMuted} />
        <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { flex: 1 }]}>{text}</Text>
      </View>
    );
    return (
      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.lg, gap: 10 }}>
        {event.coverImage ? <Image source={{ uri: event.coverImage }} style={styles.sheetImage} contentFit="cover" /> : null}
        <Text style={theme.text('caption', theme.colors.primary)}>
          {CATEGORY_ICON[event.category] ?? ''} {category} · {event.kind === 'activity' ? t.events.kindActivity : t.events.kindEvent}
        </Text>
        <Text style={theme.text('heading3')}>{event.title}</Text>
        <Row icon={Calendar} text={formatDay(event.startsAt, locale)} />
        <Row icon={Clock} text={`${formatClock(event.startsAt, locale)} – ${formatClock(event.endsAt, locale)}`} />
        <Row icon={MapPin} text={event.locationLabel} />
        <Row icon={UserIcon} text={`${t.events.organizer}: ${host ? displayName(host) : t.common.neighbor}`} />
        <Row
          icon={Users}
          text={`${localizeDigits(going, locale)} ${t.events.participants} · ${isFull ? t.events.full : `${localizeDigits(spotsLeft, locale)} ${t.events.spotsLeft}`}`}
        />
        <View style={{ height: 4 }} />
        <Button label={t.events.viewActivity} onPress={onView} fullWidth />
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  dropdown: {
    position: 'absolute',
    top: 52,
    left: 16,
    right: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingBottom: 6,
    elevation: 4,
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  fabColumn: { position: 'absolute', top: 12, end: 12, gap: 10 },
  fab: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  overlay: { position: 'absolute', left: 12, right: 12, bottom: 12, padding: 12, gap: 4 },
  note: { position: 'absolute', left: 12, right: 64, top: 12, padding: 8 },
  notice: { textAlign: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  sheetImage: { width: '100%', height: 140, borderRadius: 14 },
});
