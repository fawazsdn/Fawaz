import { useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { MessageSquareOff } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { postService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { HomeHeader } from '@/features/home/HomeHeader';
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

export default function HomeScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const neighborhoodId = useStore((s) => s.session.neighborhoodId);
  const ramadanMode = useStore((s) => s.settings.ramadanMode);

  const { data: posts, loading, refreshing, error, refresh } = useAsync(() => postService.getFeed(neighborhoodId ?? ''), [neighborhoodId]);

  const onRefresh = useCallback(() => refresh(), [refresh]);

  if (!neighborhoodId) return null;

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

          {ramadanMode ? <RamadanBanner /> : null}

          <View style={{ marginBottom: 14 }}>
            <QuickActions />
          </View>

          <View style={{ paddingHorizontal: theme.spacing.md, gap: 14, marginBottom: 18 }}>
            <NeighborhoodPulse neighborhoodId={neighborhoodId} />
            <DailySummaryCard neighborhoodId={neighborhoodId} />
            <InviteNeighborhoodCard />
          </View>

          <View style={{ marginBottom: 20 }}>
            <HappeningNow neighborhoodId={neighborhoodId} />
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
