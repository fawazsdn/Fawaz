import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  Building2,
  Calendar,
  Dumbbell,
  HandCoins,
  HeartHandshake,
  MapPin as MapPinIcon,
  PawPrint,
  Star,
  Users,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { haptics } from '@/utils/haptics';

interface Category {
  key: string;
  icon: LucideIcon;
  label: string;
  route: Href;
}

/**
 * Explore's category grid. Several tiles here point at the same
 * underlying screen (Restaurants & Cafés / Services / Local Businesses /
 * Recommendations all open the businesses browse screen; Sports &
 * Fitness opens Events, which already buckets football/padel/walking
 * into its own "Sports" section) — distinct, honest user-facing
 * categories without inventing separate backend systems for each.
 */
export function ExploreCategoryGrid() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  const categories: Category[] = [
    { key: 'events', icon: Calendar, label: t.explore.categoryEvents, route: '/events' },
    { key: 'sports', icon: Dumbbell, label: t.explore.categorySports, route: '/events' },
    { key: 'restaurants', icon: UtensilsCrossed, label: t.explore.categoryRestaurants, route: '/recommendations?category=restaurant' },
    { key: 'services', icon: Wrench, label: t.explore.categoryServices, route: '/recommendations' },
    { key: 'recommendations', icon: Star, label: t.explore.categoryRecommendations, route: '/recommendations' },
    { key: 'marketplace', icon: HandCoins, label: t.explore.categoryMarketplace, route: '/marketplace' },
    { key: 'lostFound', icon: PawPrint, label: t.explore.categoryLostFound, route: '/lost-found' },
    { key: 'community', icon: Users, label: t.explore.categoryCommunity, route: '/community' },
    { key: 'help', icon: HeartHandshake, label: t.explore.categoryHelp, route: '/help-request/create' },
    { key: 'businesses', icon: Building2, label: t.explore.categoryBusinesses, route: '/recommendations' },
    { key: 'map', icon: MapPinIcon, label: t.explore.categoryMap, route: '/map' },
  ];

  return (
    <View style={[styles.grid, theme.row()]}>
      {categories.map((c) => (
        <Pressable
          key={c.key}
          onPress={() => {
            haptics.selection();
            router.push(c.route);
          }}
          accessibilityRole="button"
          accessibilityLabel={c.label}
          style={({ pressed }) => [
            styles.tile,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.successSurface }]}>
            <c.icon size={20} color={theme.colors.primary} />
          </View>
          <Text style={[theme.text('bodySmall', theme.colors.textPrimary), styles.label]} numberOfLines={2}>
            {c.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '31%',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center' },
});
