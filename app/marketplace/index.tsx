import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, ShoppingBag } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { AppHeader } from '@/components/AppHeader';
import { IconButton } from '@/components/IconButton';
import { SearchBar } from '@/components/SearchBar';
import { FilterBar } from '@/components/FilterBar';
import { EmptyState } from '@/components/EmptyState';
import { MarketplaceCard } from '@/features/marketplace/MarketplaceCard';
import type { ListingType } from '@/models';

export default function MarketplaceScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const neighborhoodId = useStore((s) => s.session.neighborhoodId);
  const listings = useStore((s) => s.marketplaceListings.filter((m) => m.neighborhoodId === neighborhoodId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<ListingType>('sale');

  const filtered = useMemo(() => {
    let list = listings.filter((l) => l.listingType === tab);
    if (query.trim()) list = list.filter((l) => l.title.toLowerCase().includes(query.trim().toLowerCase()));
    return list;
  }, [listings, tab, query]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title={t.marketplace.title}
        right={
          <IconButton accessibilityLabel={t.marketplace.createListing} onPress={() => router.push('/marketplace/create')}>
            <Plus size={20} color={theme.colors.primary} />
          </IconButton>
        }
      />
      <View style={{ paddingHorizontal: theme.spacing.md, marginBottom: 10 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t.common.search} />
      </View>
      <View style={{ marginBottom: 10 }}>
        <FilterBar
          options={[
            { key: 'sale', label: t.marketplace.forSale },
            { key: 'free', label: t.marketplace.free },
            { key: 'wanted', label: t.marketplace.wanted },
          ]}
          selected={tab}
          onSelect={(k) => setTab(k as ListingType)}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(l) => l.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: theme.spacing.md }}
        contentContainerStyle={{ gap: 12, paddingBottom: 40 }}
        renderItem={({ item }) => <MarketplaceCard listing={item} />}
        ListEmptyComponent={<EmptyState icon={ShoppingBag} title={t.emptyStates.noMarketplace} actionLabel={t.marketplace.createListing} onAction={() => router.push('/marketplace/create')} />}
      />
    </View>
  );
}
