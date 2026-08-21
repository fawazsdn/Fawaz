import { useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { MessageSquareOff } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { postService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
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
import { ErrorState } from '@/components/ErrorState';
import { SkeletonCardRow } from '@/components/Skeleton';
import { NoNeighborhoodState } from '@/components/NoNeighborhoodState';

export default function HomeScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const neighborhoodId = useStore((s) => s.session.neighborhoodId);
  // .find() returns the actual array element (a stable reference) rather
  // than a freshly-built array/object, so it's safe directly in a
  // selector — see src/features/home/HomeHeader.tsx for the same pattern
  // and why filter()/map() aren't. Guarding on the *resolved* neighborhood
  // (not just the id string) also catches a stale/invalid persisted
  // neighborhoodId that no longer matches anything in the current
  // neighborhoods dataset, instead of quietly rendering a hollow "0 of
  // everything" Home screen.
  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === s.session.neighborhoodId));
  const ramadanMode = useStore((s) => s.settings.ramadanMode);

  const { data: posts, loading, refreshing, error, refresh } = useAsync(() => postService.getFeed(neighborhoodId ?? ''), [neighborhoodId]);

  const onRefresh = useCallback(() => refresh(), [refresh]);

  // Previously `if (!neighborhoodId) return null` — a bare null render
  // left the screen permanently blank (content area empty, tab bar still
  // visible) whenever this route mounted with no resolvable neighborhood:
  // a direct URL open or a web refresh on this tab skips
  // app/index.tsx's splash-redirect guard entirely (that only runs when
  // the app boots through "/"), and a stale persisted neighborhoodId from
  // an older build hits this exact case too. Show a real recovery screen
  // instead.
  if (!neighborhood) return <NoNeighborhoodState />;

  return (
    <FlatList
      style={{ backgroundColor: theme.colors.background }}
      data={loading || error ? [] : (posts ?? [])}
      keyExtractor={(p) => p.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      contentContainerStyle={{ paddingBottom: 100 }}
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

          <View style={{ marginBottom: 20 }}>
            <HappeningNow neighborhoodId={neighborhood.id} />
          </View>

          <SectionHeader title={t.home.feedTitle} />

          {loading ? (
            <View style={{ paddingHorizontal: theme.spacing.md }}>
              <SkeletonCardRow count={3} />
            </View>
          ) : null}

          {error ? <ErrorState onRetry={refresh} /> : null}
        </View>
      }
      ListEmptyComponent={!loading && !error ? <EmptyState icon={MessageSquareOff} title={t.emptyStates.noPosts} compact /> : null}
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
