import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { AppHeader } from '@/components/AppHeader';
import { SearchBar } from '@/components/SearchBar';
import { FilterBar } from '@/components/FilterBar';
import { UserRow } from '@/components/UserRow';
import { EmptyState } from '@/components/EmptyState';

type Filter = 'all' | 'contributors' | 'organizers' | 'leaders';

export default function DirectoryScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const neighborhoodId = useStore((s) => s.session.neighborhoodId);
  // Raw state + useMemo, not filter() inside the selector — see HomeHeader
  // for why (getSnapshot must return a stable reference across renders).
  const allUsers = useStore((s) => s.users);
  const users = useMemo(() => allUsers.filter((u) => u.neighborhoodId === neighborhoodId), [allUsers, neighborhoodId]);
  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === neighborhoodId));

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    let list = users;
    if (filter === 'contributors')
      list = list.filter(
        (u) => u.reputationTier === 'contributor' || u.reputationTier === 'community_builder' || u.reputationTier === 'community_champion',
      );
    if (filter === 'organizers') list = list.filter((u) => u.role === 'organizer');
    if (filter === 'leaders') list = list.filter((u) => u.reputationTier === 'community_champion' || u.role === 'moderator');
    if (query.trim()) list = list.filter((u) => `${u.firstName} ${u.lastName}`.toLowerCase().includes(query.trim().toLowerCase()));
    return list;
  }, [users, filter, query]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.directory.title} />
      <View style={{ paddingHorizontal: theme.spacing.md, marginBottom: 10 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t.directory.searchPlaceholder} />
      </View>
      <View style={{ marginBottom: 8 }}>
        <FilterBar
          options={[
            { key: 'all', label: t.common.all },
            { key: 'contributors', label: t.directory.activeContributors },
            { key: 'organizers', label: t.directory.organizers },
            { key: 'leaders', label: t.directory.leaders },
          ]}
          selected={filter}
          onSelect={(k) => setFilter(k as Filter)}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.md, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <UserRow
            user={item}
            subtitle={`${locale === 'ar' ? neighborhood?.nameAr : neighborhood?.nameEn} · ${t.reputation[item.reputationTier]}`}
            onPress={() => router.push(`/profile/${item.id}`)}
          />
        )}
        ListEmptyComponent={<EmptyState title={t.emptyStates.noResults} />}
      />
    </View>
  );
}
