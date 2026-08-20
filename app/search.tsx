import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Clock, SearchX } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { AppHeader } from '@/components/AppHeader';
import { SearchBar } from '@/components/SearchBar';
import { FilterBar } from '@/components/FilterBar';
import { EmptyState } from '@/components/EmptyState';
import { UserRow } from '@/components/UserRow';
import { PostCard } from '@/features/feed/PostCard';
import { EventCard } from '@/features/events/EventCard';
import { MarketplaceCard } from '@/features/marketplace/MarketplaceCard';

type Tab = 'all' | 'posts' | 'events' | 'people' | 'services' | 'marketplace';

export default function SearchScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const neighborhoodId = useStore((s) => s.session.neighborhoodId);
  const searchHistory = useStore((s) => s.searchHistory);
  const addSearchHistory = useStore((s) => s.addSearchHistory);
  const clearSearchHistory = useStore((s) => s.clearSearchHistory);

  const posts = useStore((s) => s.posts.filter((p) => p.neighborhoodId === neighborhoodId));
  const events = useStore((s) => s.events.filter((e) => e.neighborhoodId === neighborhoodId));
  const users = useStore((s) => s.users.filter((u) => u.neighborhoodId === neighborhoodId));
  const businesses = useStore((s) => s.businesses.filter((b) => b.neighborhoodIds.includes(neighborhoodId ?? '')));
  const listings = useStore((s) => s.marketplaceListings.filter((m) => m.neighborhoodId === neighborhoodId));

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return null;
    return {
      posts: posts.filter((p) => p.textAr.toLowerCase().includes(q)),
      events: events.filter((e) => e.title.toLowerCase().includes(q)),
      people: users.filter((u) => `${u.firstName} ${u.lastName}`.toLowerCase().includes(q)),
      services: businesses.filter((b) => b.name.toLowerCase().includes(q)),
      marketplace: listings.filter((m) => m.title.toLowerCase().includes(q)),
    };
  }, [q, posts, events, users, businesses, listings]);

  const onSubmit = () => {
    if (query.trim()) addSearchHistory(query.trim());
  };

  const totalResults = results ? Object.values(results).reduce((sum, arr) => sum + arr.length, 0) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.common.search} />
      <View style={{ paddingHorizontal: theme.spacing.md, marginBottom: 10 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t.discover.searchPlaceholder} onSubmit={onSubmit} autoFocus />
      </View>

      {q ? (
        <View style={{ marginBottom: 8 }}>
          <FilterBar
            options={[
              { key: 'all', label: t.search.tabs.all },
              { key: 'posts', label: t.search.tabs.posts },
              { key: 'events', label: t.search.tabs.events },
              { key: 'people', label: t.search.tabs.people },
              { key: 'services', label: t.search.tabs.services },
              { key: 'marketplace', label: t.search.tabs.marketplace },
            ]}
            selected={tab}
            onSelect={(k) => setTab(k as Tab)}
          />
        </View>
      ) : null}

      {!q ? (
        <View style={{ padding: theme.spacing.md }}>
          {searchHistory.length > 0 ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={theme.text('title')}>{t.search.recent}</Text>
                <Pressable onPress={clearSearchHistory}>
                  <Text style={theme.text('bodySmall', theme.colors.primary)}>{t.search.clear}</Text>
                </Pressable>
              </View>
              {searchHistory.map((h) => (
                <Pressable
                  key={h}
                  onPress={() => setQuery(h)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}
                >
                  <Clock size={15} color={theme.colors.textMuted} />
                  <Text style={theme.text('body')}>{h}</Text>
                </Pressable>
              ))}
            </>
          ) : (
            <EmptyState title={t.discover.title} compact />
          )}
        </View>
      ) : totalResults === 0 ? (
        <EmptyState icon={SearchX} title={t.search.noResults} body={t.search.noResultsBody} />
      ) : (
        <FlatList
          data={['content']}
          keyExtractor={() => 'content'}
          contentContainerStyle={{ padding: theme.spacing.md, gap: 12 }}
          renderItem={() => (
            <View style={{ gap: 20 }}>
              {(tab === 'all' || tab === 'posts') && results!.posts.length > 0 ? (
                <ResultGroup title={t.search.tabs.posts}>
                  {results!.posts.map((p) => (
                    <PostCard key={p.id} post={p} />
                  ))}
                </ResultGroup>
              ) : null}
              {(tab === 'all' || tab === 'events') && results!.events.length > 0 ? (
                <ResultGroup title={t.search.tabs.events}>
                  {results!.events.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </ResultGroup>
              ) : null}
              {(tab === 'all' || tab === 'people') && results!.people.length > 0 ? (
                <ResultGroup title={t.search.tabs.people}>
                  {results!.people.map((u) => (
                    <UserRow key={u.id} user={u} onPress={() => router.push(`/profile/${u.id}`)} />
                  ))}
                </ResultGroup>
              ) : null}
              {(tab === 'all' || tab === 'services') && results!.services.length > 0 ? (
                <ResultGroup title={t.search.tabs.services}>
                  {results!.services.map((b) => (
                    <Pressable key={b.id} onPress={() => router.push(`/business/${b.id}`)} style={{ paddingVertical: 8 }}>
                      <Text style={theme.text('body')}>{b.name}</Text>
                    </Pressable>
                  ))}
                </ResultGroup>
              ) : null}
              {(tab === 'all' || tab === 'marketplace') && results!.marketplace.length > 0 ? (
                <ResultGroup title={t.search.tabs.marketplace}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
                    {results!.marketplace.map((m) => (
                      <MarketplaceCard key={m.id} listing={m} />
                    ))}
                  </View>
                </ResultGroup>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View>
      <Text style={[theme.text('title'), { marginBottom: 8 }]}>{title}</Text>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}
