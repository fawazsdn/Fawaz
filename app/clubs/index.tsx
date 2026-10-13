import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Shield } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useCurrentUserId, useStore } from '@/store/useStore';
import { requestSync } from '@/backend/sync';
import type { ClubCategory } from '@/models';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { FilterBar } from '@/components/FilterBar';
import { IconButton } from '@/components/IconButton';
import { SearchBar } from '@/components/SearchBar';
import { SectionHeader } from '@/components/SectionHeader';
import { SkeletonCardRow } from '@/components/Skeleton';
import { SyncNotice, VerifyGate, useNeedsVerification } from '@/components/VerifyGate';
import { ClubCard } from '@/features/clubs/ClubCard';
import {
  ALL_CLUB_CATEGORIES,
  CLUB_ICON,
  discoverableClubs,
  discoverySections,
  searchClubs,
  sortClubs,
  type ClubSort,
} from '@/features/clubs/clubLogic';

/** Club discovery for the resident's verified neighborhood. Only admin-approved clubs appear. */
export default function ClubsScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const me = useCurrentUserId();
  const needsVerification = useNeedsVerification();
  const neighborhoodId = useStore((s) => s.session.neighborhoodId);
  const allClubs = useStore((s) => s.clubs);
  const events = useStore((s) => s.events);
  const memberships = useStore((s) => s.clubMemberships);
  const syncStatus = useStore((s) => s.sync.status);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ClubCategory | 'all'>('all');
  const [sort, setSort] = useState<ClubSort>('popular');
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await requestSync();
    setRefreshing(false);
  }, []);

  const labels = t.clubs.categories as Record<string, string>;
  const clubs = useMemo(() => discoverableClubs(allClubs, neighborhoodId), [allClubs, neighborhoodId]);
  const sections = useMemo(() => discoverySections(clubs, events, memberships, me), [clubs, events, memberships, me]);
  const usedCategories = useMemo(() => ALL_CLUB_CATEGORIES.filter((c) => clubs.some((club) => club.category === c)), [clubs]);
  const filtering = query.trim().length > 0 || category !== 'all';
  const results = useMemo(
    () => sortClubs(searchClubs(category === 'all' ? clubs : clubs.filter((c) => c.category === category), query, labels), sort, events),
    [clubs, category, query, labels, sort, events],
  );

  const createButton = (
    <IconButton accessibilityLabel={t.clubs.createClub} onPress={() => router.push('/clubs/create')}>
      <Plus size={20} color={theme.colors.textPrimary} />
    </IconButton>
  );

  if (needsVerification) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={t.clubs.title} fallbackRoute="/" />
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <VerifyGate />
        </ScrollView>
      </View>
    );
  }

  const loading = syncStatus === 'loading' && allClubs.length === 0;

  const carousel = (title: string, list: typeof clubs, key: string) =>
    list.length > 0 ? (
      <View key={key} style={{ marginBottom: 20 }}>
        <SectionHeader title={title} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[theme.row(), { gap: 12, paddingHorizontal: theme.spacing.md }]}
        >
          {list.map((c) => (
            <ClubCard key={c.id} club={c} compact />
          ))}
        </ScrollView>
      </View>
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.clubs.title} fallbackRoute="/" right={createButton} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        <SyncNotice />
        <View style={{ paddingHorizontal: theme.spacing.md, marginBottom: 10 }}>
          <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginBottom: 10 }]}>{t.clubs.subtitle}</Text>
          <SearchBar value={query} onChangeText={setQuery} placeholder={t.clubs.searchPlaceholder} />
        </View>

        {usedCategories.length > 1 ? (
          <View style={{ marginBottom: 8 }}>
            <FilterBar
              options={[
                { key: 'all', label: t.common.all },
                ...usedCategories.map((c) => ({ key: c, label: `${CLUB_ICON[c]} ${labels[c]}` })),
              ]}
              selected={category}
              onSelect={(k) => setCategory(k as ClubCategory | 'all')}
            />
          </View>
        ) : null}
        {clubs.length > 1 ? (
          <View style={{ marginBottom: 14 }}>
            <FilterBar
              options={[
                { key: 'popular', label: t.clubs.sortPopular },
                { key: 'newest', label: t.clubs.sortNewest },
                { key: 'active', label: t.clubs.sortActive },
              ]}
              selected={sort}
              onSelect={(k) => setSort(k as ClubSort)}
            />
          </View>
        ) : null}

        {loading ? (
          <View style={{ paddingHorizontal: theme.spacing.md }}>
            <SkeletonCardRow count={3} />
          </View>
        ) : clubs.length === 0 ? (
          <EmptyState
            icon={Shield}
            title={t.clubs.emptyTitle}
            actionLabel={t.clubs.createClub}
            onAction={() => router.push('/clubs/create')}
          />
        ) : filtering ? (
          results.length === 0 ? (
            <EmptyState title={t.clubs.noResults} compact />
          ) : (
            <View style={{ paddingHorizontal: theme.spacing.md, gap: 12 }}>
              {results.map((c) => (
                <ClubCard key={c.id} club={c} />
              ))}
            </View>
          )
        ) : (
          <>
            {carousel(t.clubs.myClubs, sections.mine, 'mine')}
            {carousel(t.clubs.sectionFeatured, sections.featured, 'featured')}
            {carousel(t.clubs.sectionPopular, sections.popular, 'popular')}
            {carousel(t.clubs.sectionNew, sections.newest, 'new')}
            {carousel(t.clubs.sectionSports, sections.sports, 'sports')}
            {carousel(t.clubs.sectionSocial, sections.social, 'social')}
            <SectionHeader title={t.clubs.title} />
            <View style={{ paddingHorizontal: theme.spacing.md, gap: 12 }}>
              {sortClubs(clubs, sort, events).map((c) => (
                <ClubCard key={c.id} club={c} />
              ))}
            </View>
          </>
        )}

        <View style={{ paddingHorizontal: theme.spacing.md, marginTop: 24, gap: 10 }}>
          <Button label={t.clubs.createClub} onPress={() => router.push('/clubs/create')} fullWidth />
          <Button label={t.clubs.myClubs} onPress={() => router.push('/clubs/mine')} variant="outline" fullWidth />
        </View>
      </ScrollView>
    </View>
  );
}
