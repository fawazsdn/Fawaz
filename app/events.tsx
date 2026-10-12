import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarPlus } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { requestSync } from '@/backend/sync';
import { AppHeader } from '@/components/AppHeader';
import { FilterBar } from '@/components/FilterBar';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCardRow } from '@/components/Skeleton';
import { SyncNotice, VerifyGate, useNeedsVerification } from '@/components/VerifyGate';
import { EventCard, eventState } from '@/features/events/EventCard';
import type { CommunityEvent, EventCategory } from '@/models';
import { isSameSaudiDay } from '@/utils/format';

type KindFilter = 'all' | 'activity' | 'event';

/** Splits real events into the Activities page sections. Exported for tests. */
export function groupActivities(events: CommunityEvent[], now = new Date()) {
  const t = now.getTime();
  const week = t + 7 * 86400000;
  const live = events.filter((e) => !e.cancelled);
  const upcomingAll = live.filter((e) => new Date(e.endsAt).getTime() > t).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const past = live.filter((e) => new Date(e.endsAt).getTime() <= t).sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));
  const today = upcomingAll.filter((e) => isSameSaudiDay(e.startsAt, now) || new Date(e.startsAt).getTime() <= t);
  const thisWeek = upcomingAll.filter((e) => !today.includes(e) && new Date(e.startsAt).getTime() < week);
  const later = upcomingAll.filter((e) => !today.includes(e) && !thisWeek.includes(e));
  // Featured = the most-joined upcoming ones (a real signal, not editorial).
  const featured = [...upcomingAll]
    .filter((e) => eventState(e).going > 1)
    .sort((a, b) => eventState(b).going - eventState(a).going)
    .slice(0, 3);
  return { featured, today, thisWeek, upcoming: later, past: past.slice(0, 20) };
}

export default function ActivitiesScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const neighborhoodId = useStore((s) => s.session.neighborhoodId);
  const allEvents = useStore((s) => s.events);
  const syncStatus = useStore((s) => s.sync.status);
  const needsVerification = useNeedsVerification();
  const [kind, setKind] = useState<KindFilter>('all');
  const [category, setCategory] = useState<EventCategory | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await requestSync();
    setRefreshing(false);
  }, []);

  const visible = useMemo(
    () => allEvents.filter((e) => e.neighborhoodId === neighborhoodId && (kind === 'all' || e.kind === kind) && (category === 'all' || e.category === category)),
    [allEvents, neighborhoodId, kind, category],
  );
  const groups = useMemo(() => groupActivities(visible), [visible]);

  const categories: (EventCategory | 'all')[] = ['all', 'football', 'padel', 'walking', 'family', 'kids', 'iftar', 'cleanup', 'coffee', 'community'];
  const labels = t.eventCreate.categories as Record<string, string>;
  const loading = syncStatus === 'loading' && allEvents.length === 0;
  const empty = !loading && groups.featured.length + groups.today.length + groups.thisWeek.length + groups.upcoming.length + groups.past.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.events.title} fallbackRoute="/" />
      {needsVerification ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <VerifyGate />
        </ScrollView>
      ) : (
        <>
          <View style={{ marginBottom: 6 }}>
            <FilterBar
              options={[
                { key: 'all', label: t.events.allKinds },
                { key: 'activity', label: t.events.activitiesOnly },
                { key: 'event', label: t.events.eventsOnly },
              ]}
              selected={kind}
              onSelect={(k) => setKind(k as KindFilter)}
            />
          </View>
          <View style={{ marginBottom: 10 }}>
            <FilterBar options={categories.map((c) => ({ key: c, label: c === 'all' ? t.common.all : labels[c] }))} selected={category} onSelect={(k) => setCategory(k as EventCategory | 'all')} />
          </View>
          <ScrollView
            contentContainerStyle={{ paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          >
            <SyncNotice />
            {loading ? (
              <View style={{ paddingHorizontal: theme.spacing.md }}>
                <SkeletonCardRow count={3} />
              </View>
            ) : empty ? (
              <EmptyState icon={CalendarPlus} title={t.events.noActivities} body={t.events.noActivitiesBody} actionLabel={t.events.create} onAction={() => router.push('/event/create')} />
            ) : (
              <>
                <Section title={t.events.featured} events={groups.featured} wide />
                <Section title={t.events.happeningToday} events={groups.today} />
                <Section title={t.events.thisWeek} events={groups.thisWeek} />
                <Section title={t.events.upcoming} events={groups.upcoming} />
                <Section title={t.events.past} events={groups.past} />
              </>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

function Section({ title, events, wide }: { title: string; events: CommunityEvent[]; wide?: boolean }) {
  const theme = useTheme();
  if (events.length === 0) return null;
  return (
    <View style={{ marginBottom: 20 }}>
      <SectionHeader title={title} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ ...theme.row(), gap: 10, paddingHorizontal: theme.spacing.md }}>
        {events.map((e) => (
          <View key={e.id} style={{ width: wide ? 290 : 250 }}>
            <EventCard event={e} compact={!wide} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
