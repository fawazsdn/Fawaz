import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MessageSquareOff } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, useCurrentUserId } from '@/store/useStore';
import { requestSync } from '@/backend/sync';
import { HomeHeader } from '@/features/home/HomeHeader';
import { NeighborhoodIdentityCard } from '@/features/home/NeighborhoodIdentityCard';
import { QuickActions } from '@/features/home/QuickActions';
import { NeighborhoodPulse } from '@/features/home/NeighborhoodPulse';
import { HappeningNow } from '@/features/home/HappeningNow';
import { DailySummaryCard } from '@/features/home/DailySummaryCard';
import { InviteNeighborhoodCard } from '@/features/home/InviteNeighborhoodCard';
import { PostCard } from '@/features/feed/PostCard';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCardRow } from '@/components/Skeleton';
import { NoNeighborhoodState } from '@/components/NoNeighborhoodState';
import { SyncNotice, VerifyGate, useNeedsVerification } from '@/components/VerifyGate';
import { EventCard } from '@/features/events/EventCard';

export default function HomeScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const me = useCurrentUserId();
  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === s.session.neighborhoodId));
  const hasNeighborhoodId = useStore((s) => !!s.session.neighborhoodId);
  const ramadanMode = useStore((s) => s.settings.ramadanMode);
  const syncStatus = useStore((s) => s.sync.status);
  const allPosts = useStore((s) => s.posts);
  const allEvents = useStore((s) => s.events);
  const blocked = useStore((s) => s.blockedUserIds);
  const muted = useStore((s) => s.mutedUserIds);
  const needsVerification = useNeedsVerification();
  const [refreshing, setRefreshing] = useState(false);

  const posts = useMemo(
    () =>
      allPosts
        .filter((p) => p.neighborhoodId === neighborhood?.id && !blocked.includes(p.authorId) && (p.authorId === me || !muted.includes(p.authorId)))
        .sort((a, b) => (a.pinned === b.pinned ? +new Date(b.createdAt) - +new Date(a.createdAt) : a.pinned ? -1 : 1)),
    [allPosts, neighborhood?.id, blocked, muted, me],
  );
  const upcoming = useMemo(
    () =>
      allEvents
        .filter((e) => e.neighborhoodId === neighborhood?.id && !e.cancelled && new Date(e.endsAt).getTime() > Date.now())
        .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
        .slice(0, 6),
    [allEvents, neighborhood?.id],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await requestSync();
    setRefreshing(false);
  }, []);

  const loading = syncStatus === 'loading' && allPosts.length === 0 && !needsVerification;

  // A real recovery screen instead of a blank tab when there's no resolvable
  // neighborhood (direct deep link, or a stale pointer from an older build).
  // While the first sync is still resolving the neighborhood, show a skeleton.
  if (!neighborhood) {
    if (hasNeighborhoodId && (syncStatus === 'loading' || syncStatus === 'idle')) {
      return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: 80, paddingHorizontal: theme.spacing.md }}>
          <SkeletonCardRow count={3} />
        </View>
      );
    }
    return <NoNeighborhoodState />;
  }

  return (
    <FlatList
      style={{ backgroundColor: theme.colors.background }}
      data={needsVerification || loading ? [] : posts}
      keyExtractor={(p) => p.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      contentContainerStyle={{ paddingBottom: 32 }}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: theme.spacing.md, marginBottom: 12 }}>
          <PostCard post={item} />
        </View>
      )}
      ListHeaderComponent={
        <View>
          <HomeHeader />

          <View style={{ paddingHorizontal: theme.spacing.md, marginBottom: 14 }}>
            <NeighborhoodIdentityCard neighborhoodId={neighborhood.id} />
          </View>

          {ramadanMode ? <RamadanBanner /> : null}

          <View style={{ marginBottom: 14 }}>
            <QuickActions />
          </View>

          <View style={{ paddingHorizontal: theme.spacing.md, gap: 14, marginBottom: 18 }}>
            <NeighborhoodPulse neighborhoodId={neighborhood.id} />
            <DailySummaryCard neighborhoodId={neighborhood.id} />
            <InviteNeighborhoodCard />
          </View>

          <SyncNotice />
          {needsVerification ? <VerifyGate compact /> : null}

          <View style={{ marginBottom: 20 }}>
            <HappeningNow neighborhoodId={neighborhood.id} />
          </View>

          {upcoming.length > 0 ? (
            <View style={{ marginBottom: 20 }}>
              <SectionHeader title={t.events.title} onSeeAll={() => router.push('/events')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ ...theme.row(), gap: 10, paddingHorizontal: theme.spacing.md }}>
                {upcoming.map((e) => (
                  <View key={e.id} style={{ width: 250 }}>
                    <EventCard event={e} compact />
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <SectionHeader title={t.home.feedTitle} />

          {loading ? (
            <View style={{ paddingHorizontal: theme.spacing.md }}>
              <SkeletonCardRow count={3} />
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        !loading && !needsVerification ? (
          <EmptyState icon={MessageSquareOff} title={t.emptyStates.noPosts} actionLabel={t.create.post} onAction={() => router.push('/create/post')} compact />
        ) : null
      }
    />
  );
}

function RamadanBanner() {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <View
      style={[
        styles.ramadanBanner,
        { backgroundColor: theme.colors.primary, marginHorizontal: theme.spacing.md, borderRadius: theme.radii.lg },
      ]}
    >
      <Text style={[theme.text('title', theme.colors.onPrimary)]}>{t.ramadan.bannerTitle}</Text>
      <Text style={[theme.text('bodySmall', theme.colors.onPrimary), { opacity: 0.9, marginTop: 4 }]}>{t.ramadan.bannerBody}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ramadanBanner: { padding: 16, marginBottom: 18 },
});
