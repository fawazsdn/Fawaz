import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PawPrint, Plus } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { AppHeader } from '@/components/AppHeader';
import { IconButton } from '@/components/IconButton';
import { FilterBar } from '@/components/FilterBar';
import { EmptyState } from '@/components/EmptyState';
import { LostFoundCard } from '@/features/lostFound/LostFoundCard';
import type { LostFoundStatus } from '@/models';

export default function LostFoundScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const neighborhoodId = useStore((s) => s.session.neighborhoodId);
  const items = useStore((s) => s.lostFound.filter((l) => l.neighborhoodId === neighborhoodId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));

  const [filter, setFilter] = useState<LostFoundStatus | 'all'>('all');

  const filtered = useMemo(() => (filter === 'all' ? items : items.filter((i) => i.status === filter)), [items, filter]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title={t.lostFound.title}
        right={
          <IconButton accessibilityLabel={t.lostFound.report} onPress={() => router.push('/lost-found/create')}>
            <Plus size={20} color={theme.colors.primary} />
          </IconButton>
        }
      />
      <View style={{ marginBottom: 8 }}>
        <FilterBar
          options={[
            { key: 'all', label: t.common.all },
            { key: 'lost', label: t.lostFound.lost },
            { key: 'found', label: t.lostFound.found },
            { key: 'reunited', label: t.lostFound.reunited },
          ]}
          selected={filter}
          onSelect={(k) => setFilter(k as LostFoundStatus | 'all')}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: theme.spacing.md, gap: 10 }}
        renderItem={({ item }) => <LostFoundCard item={item} />}
        ListEmptyComponent={<EmptyState icon={PawPrint} title={t.emptyStates.noResults} />}
      />
    </View>
  );
}
