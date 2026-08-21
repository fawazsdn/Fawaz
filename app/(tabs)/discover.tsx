import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Map as MapIcon, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { SearchBar } from '@/components/SearchBar';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/EmptyState';
import { IssueCard } from '@/features/issues/IssueCard';
import { EventCard } from '@/features/events/EventCard';
import { MarketplaceCard } from '@/features/marketplace/MarketplaceCard';
import { HelpRequestCard } from '@/features/help/HelpRequestCard';
import { PostCard } from '@/features/feed/PostCard';
import { LostFoundCard } from '@/features/lostFound/LostFoundCard';
import { ExploreCategoryGrid } from '@/features/explore/ExploreCategoryGrid';

export default function DiscoverScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const neighborhoodId = useStore((s) => s.session.neighborhoodId);

  // Select raw state arrays and derive with useMemo — a selector that
  // returns a freshly-filtered/sorted array every getSnapshot call is
  // an unstable snapshot and crashes with "Maximum update depth exceeded"
  // under useSyncExternalStore (which Zustand's useStore is built on).
  const allEvents = useStore((s) => s.events);
  const allIssues = useStore((s) => s.issues);
  const allListings = useStore((s) => s.marketplaceListings);
  const allHelpRequests = useStore((s) => s.helpRequests);
  const allLostFound = useStore((s) => s.lostFound);
  const allPosts = useStore((s) => s.posts);
  const allBusinesses = useStore((s) => s.businesses);

  const events = useMemo(
    () => allEvents.filter((e) => e.neighborhoodId === neighborhoodId && !e.cancelled).slice(0, 4),
    [allEvents, neighborhoodId],
  );
  const issues = useMemo(
    () => allIssues.filter((i) => i.neighborhoodId === neighborhoodId && i.status !== 'resolved').slice(0, 3),
    [allIssues, neighborhoodId],
  );
  const listings = useMemo(
    () => allListings.filter((m) => m.neighborhoodId === neighborhoodId).slice(0, 4),
    [allListings, neighborhoodId],
  );
  const helpRequests = useMemo(
    () => allHelpRequests.filter((h) => h.neighborhoodId === neighborhoodId && h.status === 'open').slice(0, 3),
    [allHelpRequests, neighborhoodId],
  );
  const lostFound = useMemo(
    () => allLostFound.filter((l) => l.neighborhoodId === neighborhoodId && l.status !== 'reunited').slice(0, 3),
    [allLostFound, neighborhoodId],
  );
  const trendingPosts = useMemo(
    () =>
      [...allPosts]
        .filter((p) => p.neighborhoodId === neighborhoodId)
        .sort((a, b) => b.reactions.length + b.commentCount - (a.reactions.length + a.commentCount))
        .slice(0, 3),
    [allPosts, neighborhoodId],
  );
  const businesses = useMemo(
    () =>
      [...allBusinesses]
        .filter((b) => b.neighborhoodIds.includes(neighborhoodId ?? ''))
        .sort((a, b) => b.recommendationCount - a.recommendationCount)
        .slice(0, 4),
    [allBusinesses, neighborhoodId],
  );

  if (!neighborhoodId) return null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: theme.spacing.md, marginBottom: 12 }}>
        <Text style={[theme.text('heading1'), { marginBottom: 12 }]}>{t.discover.title}</Text>
        <Pressable onPress={() => router.push('/search')} accessibilityRole="button">
          <View pointerEvents="none">
            <SearchBar value="" onChangeText={() => {}} placeholder={t.discover.searchPlaceholder} />
          </View>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: theme.spacing.md, marginBottom: 20 }}>
        <Pressable
          onPress={() => router.push('/map')}
          style={{
            flex: 1,
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radii.lg,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <MapIcon size={20} color={theme.colors.onPrimary} />
          <Text style={theme.text('title', theme.colors.onPrimary)}>{t.discover.map}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/assistant')}
          style={{
            flex: 1,
            backgroundColor: theme.colors.secondary,
            borderRadius: theme.radii.lg,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Sparkles size={20} color={theme.colors.onSecondary} />
          <Text style={theme.text('title', theme.colors.onSecondary)}>{t.assistant.title}</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: theme.spacing.md, marginBottom: 22 }}>
        <ExploreCategoryGrid />
      </View>

      <Section title={t.discover.events} onSeeAll={() => router.push('/events')}>
        {events.length === 0 ? (
          <EmptyState title={t.emptyStates.noEvents} compact />
        ) : (
          <HorizontalList items={events} render={(e) => <EventCard event={e} compact />} width={220} />
        )}
      </Section>

      <Section title={t.discover.trending}>
        {trendingPosts.length === 0 ? (
          <EmptyState title={t.emptyStates.noPosts} compact />
        ) : (
          <View style={{ paddingHorizontal: theme.spacing.md, gap: 10 }}>
            {trendingPosts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </View>
        )}
      </Section>

      <Section title={t.discover.issuesAround} onSeeAll={() => router.push('/community')}>
        {issues.length === 0 ? (
          <EmptyState title={t.emptyStates.noIssues} compact />
        ) : (
          <HorizontalList items={issues} render={(i) => <IssueCard issue={i} />} width={260} />
        )}
      </Section>

      <Section title={t.discover.services}>
        {businesses.length === 0 ? (
          <EmptyState title={t.emptyStates.noResults} compact />
        ) : (
          <View style={{ paddingHorizontal: theme.spacing.md, gap: 10 }}>
            {businesses.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => router.push(`/business/${b.id}`)}
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                  borderRadius: theme.radii.md,
                  padding: 14,
                }}
              >
                <Text style={theme.text('title')}>{b.name}</Text>
                <Text style={theme.text('caption', theme.colors.textMuted)}>
                  {t.recommendations.recommendedBy} {b.recommendationCount} {t.recommendations.neighbors}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </Section>

      <Section title={t.discover.marketplace} onSeeAll={() => router.push('/marketplace')}>
        {listings.length === 0 ? (
          <EmptyState title={t.emptyStates.noMarketplace} compact />
        ) : (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              paddingHorizontal: theme.spacing.md,
              gap: 12,
            }}
          >
            {listings.map((l) => (
              <MarketplaceCard key={l.id} listing={l} />
            ))}
          </View>
        )}
      </Section>

      <Section title={t.lostFound.title} onSeeAll={() => router.push('/lost-found')}>
        {lostFound.length === 0 ? (
          <EmptyState title={t.emptyStates.noResults} compact />
        ) : (
          <View style={{ paddingHorizontal: theme.spacing.md, gap: 10 }}>
            {lostFound.map((l) => (
              <LostFoundCard key={l.id} item={l} />
            ))}
          </View>
        )}
      </Section>

      <Section title={t.discover.requests}>
        {helpRequests.length === 0 ? (
          <EmptyState title={t.emptyStates.noResults} compact />
        ) : (
          <HorizontalList items={helpRequests} render={(h) => <HelpRequestCard request={h} />} width={240} />
        )}
      </Section>
    </ScrollView>
  );
}

function Section({ title, onSeeAll, children }: { title: string; onSeeAll?: () => void; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 22 }}>
      <SectionHeader title={title} onSeeAll={onSeeAll} />
      {children}
    </View>
  );
}

function HorizontalList<T extends { id: string }>({
  items,
  render,
  width,
}: {
  items: T[];
  render: (item: T) => React.ReactNode;
  width: number;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ ...theme.row(), gap: 10, paddingHorizontal: theme.spacing.md }}
    >
      {items.map((item) => (
        <View key={item.id} style={{ width }}>
          {render(item)}
        </View>
      ))}
    </ScrollView>
  );
}
