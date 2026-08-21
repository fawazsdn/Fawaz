import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus, ShoppingBag, Wrench } from 'lucide-react-native';

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
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  const neighborhoodId = useStore((s) => s.session.neighborhoodId);
  // Raw state + useMemo, not filter()/sort() inside the selector — see
  // src/features/home/HomeHeader.tsx for why.
  const allListings = useStore((s) => s.marketplaceListings);
  const listings = useMemo(
    () =>
      allListings
        .filter((m) => m.neighborhoodId === neighborhoodId)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [allListings, neighborhoodId],
  );

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
      <Pressable
        onPress={() => router.push('/borrow')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginHorizontal: theme.spacing.md,
          marginBottom: 10,
          padding: 12,
          backgroundColor: theme.colors.backgroundAlt,
          borderRadius: theme.radii.md,
        }}
      >
        <Wrench size={16} color={theme.colors.primary} />
        <Text style={[theme.text('bodySmall'), { flex: 1 }]}>{t.borrow.title}</Text>
        <Chevron size={16} color={theme.colors.textMuted} />
      </Pressable>
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
        ListEmptyComponent={
          <EmptyState
            icon={ShoppingBag}
            title={t.emptyStates.noMarketplace}
            actionLabel={t.marketplace.createListing}
            onAction={() => router.push('/marketplace/create')}
          />
        }
      />
    </View>
  );
}
