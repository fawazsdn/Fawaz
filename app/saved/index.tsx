import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Bookmark } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import { AppHeader } from '@/components/AppHeader';
import { FilterBar } from '@/components/FilterBar';
import { EmptyState } from '@/components/EmptyState';
import { PostCard } from '@/features/feed/PostCard';
import { MarketplaceCard } from '@/features/marketplace/MarketplaceCard';
import type { MarketplaceListing, Post } from '@/models';

type Filter = 'all' | 'posts' | 'marketplace';
type Row = { kind: 'post'; item: Post } | { kind: 'listing'; item: MarketplaceListing };

/**
 * A resident's saved posts + marketplace listings in one place — the
 * "Saved" destination linked from the Profile/Account menu. Both models
 * carry a real `savedBy: string[]` field toggled from PostCard /
 * MarketplaceCard's bookmark button, so this screen reads real state,
 * nothing fabricated.
 */
export default function SavedScreen() {
  const theme = useTheme();
  const { t } = useI18n();

  // Raw state + useMemo, not filter() inside the selector — see
  // src/features/home/HomeHeader.tsx for why.
  const allPosts = useStore((s) => s.posts);
  const allListings = useStore((s) => s.marketplaceListings);
  const savedPosts = useMemo(() => allPosts.filter((p) => p.savedBy.includes(CURRENT_USER_ID)), [allPosts]);
  const savedListings = useMemo(() => allListings.filter((l) => l.savedBy.includes(CURRENT_USER_ID)), [allListings]);

  const [filter, setFilter] = useState<Filter>('all');

  const rows: Row[] = useMemo(() => {
    const postRows: Row[] = filter === 'marketplace' ? [] : savedPosts.map((item) => ({ kind: 'post' as const, item }));
    const listingRows: Row[] = filter === 'posts' ? [] : savedListings.map((item) => ({ kind: 'listing' as const, item }));
    return [...postRows, ...listingRows].sort(
      (a, b) => +new Date(b.item.createdAt) - +new Date(a.item.createdAt),
    );
  }, [filter, savedPosts, savedListings]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.saved.title} fallbackRoute="/settings" />
      <View style={{ marginBottom: 10 }}>
        <FilterBar
          options={[
            { key: 'all', label: t.saved.filterAll },
            { key: 'posts', label: t.saved.filterPosts },
            { key: 'marketplace', label: t.saved.filterMarketplace },
          ]}
          selected={filter}
          onSelect={(k) => setFilter(k as Filter)}
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => `${r.kind}-${r.item.id}`}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.md, paddingBottom: 40, gap: 12 }}
        renderItem={({ item: row }) => (row.kind === 'post' ? <PostCard post={row.item} /> : <MarketplaceCard listing={row.item} />)}
        ListEmptyComponent={<EmptyState icon={Bookmark} title={t.saved.empty} />}
      />
    </View>
  );
}
