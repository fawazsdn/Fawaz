import { Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';

export function useExploreSections() {
  const { t, locale } = useI18n();
  const local = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const row = (label: string, href: Href) => ({ label, href });
  return [
    {
      id: 'food',
      label: local('Food & Entertainment', 'الأطعمة والترفيه'),
      rows: [
        row(local('Restaurants', 'المطاعم'), '/recommendations?category=restaurant'),
        row(local('Cafés', 'المقاهي'), '/recommendations?category=cafe'),
        row(t.events.title, '/events'),
        row(t.explore.categorySports, '/events?category=sports'),
        row(local('Entertainment', 'الترفيه'), '/recommendations?category=entertainment'),
        row(local('Parks & Places', 'الحدائق والأماكن'), '/map'),
      ],
    },
    {
      id: 'business',
      label: local('Local Businesses & Services', 'المتاجر والخدمات المحلية'),
      rows: [
        row(local('Grocery Stores', 'متاجر المواد الغذائية'), '/recommendations?category=grocery'),
        row(local('Retail Shops', 'متاجر التجزئة'), '/recommendations?category=retail'),
        row(local('Salons & Barbers', 'الصالونات والحلاقة'), '/recommendations?category=barber'),
        row(local('Healthcare & Pharmacies', 'الرعاية الصحية والصيدليات'), '/recommendations?category=healthcare'),
        row(local('Home Services', 'خدمات المنزل'), '/recommendations?category=home_services'),
        row(t.explore.categoryBusinesses, '/recommendations'),
      ],
    },
    {
      id: 'community',
      label: t.explore.categoryCommunity,
      rows: [
        row(t.neighbors.title, '/neighbors'),
        row(t.clubs.title, '/clubs'),
        row(local('Community Groups', 'مجموعات الحي'), '/community'),
        row(t.explore.categoryHelp, '/help-request/create'),
        row(t.explore.categoryRecommendations, '/recommendations'),
        row(local('Community Requests', 'طلبات الحي'), '/community'),
        row(local('Neighborhood Discussions', 'نقاشات الحي'), '/(tabs)'),
      ],
    },
    {
      id: 'marketplace',
      label: t.explore.categoryMarketplace,
      rows: [
        row(local('Buy & Sell', 'البيع والشراء'), '/marketplace'),
        row(t.explore.categoryLostFound, '/lost-found'),
        row(local('Marketplace Listings', 'إعلانات السوق'), '/marketplace'),
      ],
    },
  ];
}

export function ExploreLinks({ rows }: { rows: { label: string; href: Href }[] }) {
  const theme = useTheme();
  const router = useRouter();
  const { isRTL } = useI18n();
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  return (
    <View style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radii.lg }}>
      {rows.map(({ label, href }, index) => (
        <Pressable
          key={label}
          accessibilityRole="link"
          onPress={() => router.push(href)}
          style={({ pressed }) => ({
            ...theme.row(),
            alignItems: 'center',
            gap: 12,
            minHeight: 52,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderTopWidth: index === 0 ? 0 : 1,
            borderTopColor: theme.colors.divider,
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <Text style={[theme.text('title'), { flex: 1 }]}>{label}</Text>
          <Chevron size={20} color={theme.colors.primary} />
        </Pressable>
      ))}
    </View>
  );
}

export function ExploreSections() {
  const sections = useExploreSections();
  return (
    <ExploreLinks rows={sections.map(({ id, label }) => ({ label, href: { pathname: '/explore/[section]', params: { section: id } } }))} />
  );
}
