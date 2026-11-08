import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MapPin, Star } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { IconButton } from '@/components/IconButton';
import { AppHeader } from '@/components/AppHeader';
import { FilterBar } from '@/components/FilterBar';
import { SearchBar } from '@/components/SearchBar';
import { normalizeForSearch } from '@/utils/searchNormalize';
import { EmptyState } from '@/components/EmptyState';
import type { ServiceCategory } from '@/models';

const LABELS: Record<ServiceCategory | 'home_services', readonly [string, string]> = {
  electrician: ['Electricians', 'كهربائيون'],
  plumber: ['Plumbers', 'سباكون'],
  ac_repair: ['AC Repair', 'صيانة التكييف'],
  car_wash: ['Car Washes', 'مغاسل السيارات'],
  cleaning: ['Cleaning', 'التنظيف'],
  restaurant: ['Restaurants', 'المطاعم'],
  cafe: ['Cafés', 'المقاهي'],
  barber: ['Salons & Barbers', 'الصالونات والحلاقة'],
  tailor: ['Tailors', 'الخياطون'],
  tutor: ['Tutors', 'المعلمون الخصوصيون'],
  pet_services: ['Pet Services', 'خدمات الحيوانات الأليفة'],
  grocery: ['Grocery Stores', 'متاجر المواد الغذائية'],
  retail: ['Retail Shops', 'متاجر التجزئة'],
  healthcare: ['Healthcare & Pharmacies', 'الرعاية الصحية والصيدليات'],
  entertainment: ['Entertainment', 'الترفيه'],
  home_services: ['Home Services', 'خدمات المنزل'],
};
type Category = keyof typeof LABELS;
const CATEGORIES = Object.keys(LABELS) as Category[];
const HOME_SERVICES: ServiceCategory[] = ['electrician', 'plumber', 'ac_repair', 'cleaning'];

export default function RecommendationsScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const categoryLabel = (category: Category) => LABELS[category]?.[locale === 'ar' ? 1 : 0] ?? category;
  const [query, setQuery] = useState('');
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

  const [category, setCategory] = useState<Category | 'all'>(
    initialCategory && (CATEGORIES as string[]).includes(initialCategory) ? (initialCategory as Category) : 'all',
  );
  const filtered = useMemo(() => {
    const needle = normalizeForSearch(query);
    return businesses.filter((business) => {
      const inCategory = category === 'home_services' ? HOME_SERVICES.includes(business.category) : business.category === category;
      return (
        (category === 'all' || inCategory) &&
        (!needle ||
          normalizeForSearch(
            [business.name, business.nameAr, business.nameEn, business.description, business.locationLabel].filter(Boolean).join(' '),
          ).includes(needle))
      );
    });
  }, [businesses, category, query]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title={t.recommendations.title}
        fallbackRoute="/(tabs)/discover"
        right={
          <IconButton
            accessibilityLabel={t.map.title}
            variant="surface"
            onPress={() => router.push({ pathname: '/(tabs)/map', params: { filter: 'businesses' } })}
          >
            <MapPin size={20} color={theme.colors.primary} />
          </IconButton>
        }
      />
      <View style={{ paddingHorizontal: theme.spacing.md, marginBottom: 10 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t.common.search} />
      </View>
      <View style={{ marginBottom: 10 }}>
        <FilterBar
          options={[{ key: 'all', label: t.common.all }, ...CATEGORIES.map((c) => ({ key: c, label: categoryLabel(c) }))]}
          selected={category}
          onSelect={(k) => setCategory(k as Category | 'all')}
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
            <View style={{ ...theme.row(), alignItems: 'center', gap: 8 }}>
              <Text style={theme.text('title')}>{(locale === 'ar' ? item.nameAr : item.nameEn) ?? item.name}</Text>
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
