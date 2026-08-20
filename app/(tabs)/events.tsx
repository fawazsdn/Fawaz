import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { eventService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { FilterBar } from '@/components/FilterBar';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { SkeletonCardRow } from '@/components/Skeleton';
import { EventCard } from '@/features/events/EventCard';
import type { EventCategory } from '@/models';

export default function EventsScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const categoryFilters: { key: EventCategory | 'all'; label: string }[] = [
    { key: 'all', label: t.common.all },
    { key: 'football', label: t.eventCreate.categories.football },
    { key: 'padel', label: t.eventCreate.categories.padel },
    { key: 'walking', label: t.eventCreate.categories.walking },
    { key: 'cleanup', label: t.eventCreate.categories.cleanup },
    { key: 'coffee', label: t.eventCreate.categories.coffee },
    { key: 'iftar', label: t.eventCreate.categories.iftar },
    { key: 'kids', label: t.eventCreate.categories.kids },
  ];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const neighborhoodId = useStore((s) => s.session.neighborhoodId);
  const [filter, setFilter] = useState<EventCategory | 'all'>('all');

  const {
    data: events,
    loading,
    refreshing,
    error,
    refresh,
  } = useAsync(() => eventService.getEvents(neighborhoodId ?? ''), [neighborhoodId]);

  const active = useMemo(() => (events ?? []).filter((e) => !e.cancelled && (filter === 'all' || e.category === filter)), [events, filter]);

  const now = Date.now();
  const dayMs = 24 * 3600 * 1000;
  const today = active.filter((e) => +new Date(e.startsAt) - now < dayMs);
  const thisWeek = active.filter((e) => +new Date(e.startsAt) - now >= dayMs && +new Date(e.startsAt) - now < 7 * dayMs);
  const upcoming = active.filter((e) => +new Date(e.startsAt) - now >= 7 * dayMs);
  const sports = active.filter((e) => e.category === 'football' || e.category === 'padel' || e.category === 'walking');
  const family = active.filter((e) => e.category === 'family' || e.category === 'kids');
  const community = active.filter(
    (e) => e.category === 'community' || e.category === 'cleanup' || e.category === 'coffee' || e.category === 'iftar',
  );

  if (!neighborhoodId) return null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: theme.spacing.md, paddingBottom: 12 }}>
        <Text style={theme.text('heading1')}>{t.events.title}</Text>
      </View>

      <View style={{ marginBottom: 10 }}>
        <FilterBar options={categoryFilters} selected={filter} onSelect={(k) => setFilter(k as EventCategory | 'all')} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} />}
      >
        {loading ? (
          <View style={{ paddingHorizontal: theme.spacing.md }}>
            <SkeletonCardRow count={3} />
          </View>
        ) : error ? (
          <ErrorState onRetry={refresh} />
        ) : active.length === 0 ? (
          <EmptyState
            icon={CalendarOff}
            title={t.emptyStates.noEvents}
            actionLabel={t.events.create}
            onAction={() => router.push('/event/create')}
          />
        ) : (
          <>
            <EventSection title={t.events.happeningToday} events={today} />
            <EventSection title={t.events.thisWeek} events={thisWeek} />
            <EventSection title={t.events.sports} events={sports} />
            <EventSection title={t.events.family} events={family} />
            <EventSection title={t.events.community} events={community} />
            <EventSection title={t.events.upcoming} events={upcoming} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function EventSection({ title, events }: { title: string; events: ReturnType<typeof useStore.getState>['events'] }) {
  const theme = useTheme();
  if (events.length === 0) return null;
  return (
    <View style={{ marginBottom: 20 }}>
      <SectionHeader title={title} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ ...theme.row(), gap: 10, paddingHorizontal: theme.spacing.md }}
      >
        {events.map((e) => (
          <View key={e.id} style={{ width: 240 }}>
            <EventCard event={e} compact />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
