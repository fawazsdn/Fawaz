import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Star } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { AppHeader } from '@/components/AppHeader';
import { FilterBar } from '@/components/FilterBar';
import { EmptyState } from '@/components/EmptyState';
import type { ServiceCategory } from '@/models';

const CATEGORIES: ServiceCategory[] = [
  'electrician',
  'plumber',
  'ac_repair',
  'car_wash',
  'cleaning',
  'restaurant',
  'cafe',
  'barber',
  'tailor',
  'tutor',
  'pet_services',
];

export default function RecommendationsScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { category: initialCategory } = useLocalSearchParams<{ category?: string }>();
  const neighborhoodId = useStore((s) => s.session.neighborhoodId);
  // Raw state + useMemo, not filter()/sort() inside the selector — see
  // src/features/home/HomeHeader.tsx for why.
  const allBusinesses = useStore((s) => s.businesses);
  const businesses = useMemo(
    () =>
      allBusinesses
        .filter((b) => b.neighborhoodIds.includes(neighborhoodId ?? ''))
        .sort((a, b) => b.recommendationCount - a.recommendationCount),
    [allBusinesses, neighborhoodId],
  );

  const [category, setCategory] = useState<ServiceCategory | 'all'>(
    initialCategory && (CATEGORIES as string[]).includes(initialCategory) ? (initialCategory as ServiceCategory) : 'all',
  );
  const filtered = useMemo(
    () => (category === 'all' ? businesses : businesses.filter((b) => b.category === category)),
    [businesses, category],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.recommendations.title} fallbackRoute="/(tabs)/discover" />
      <View style={{ marginBottom: 10 }}>
        <FilterBar
          options={[{ key: 'all', label: t.common.all }, ...CATEGORIES.map((c) => ({ key: c, label: categoryLabel(c) }))]}
          selected={category}
          onSelect={(k) => setCategory(k as ServiceCategory | 'all')}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: theme.spacing.md, gap: 10 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/business/${item.id}`)}
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderWidth: 1,
              borderRadius: theme.radii.md,
              padding: 14,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={theme.text('title')}>{item.name}</Text>
              {item.communityVerified ? <Star size={13} color={theme.colors.warning} fill={theme.colors.warning} /> : null}
            </View>
            <Text style={theme.text('caption', theme.colors.textMuted)}>{categoryLabel(item.category)}</Text>
            <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginTop: 6 }]}>
              {t.recommendations.recommendedBy} {item.recommendationCount} {t.recommendations.neighbors}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState title={t.emptyStates.noResults} />}
      />
    </View>
  );
}

function categoryLabel(c: ServiceCategory) {
  const map: Record<ServiceCategory, string> = {
    electrician: 'كهربائي',
    plumber: 'سباك',
    ac_repair: 'تكييف',
    car_wash: 'غسيل سيارات',
    cleaning: 'تنظيف',
    restaurant: 'مطعم',
    cafe: 'مقهى',
    barber: 'حلاق',
    tailor: 'خياط',
    tutor: 'معلم خصوصي',
    pet_services: 'خدمات حيوانات أليفة',
  };
  return map[c];
}
