import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { EmptyState } from './EmptyState';

/**
 * Shown instead of a blank content area on Home/Explore/Map when there is
 * no resolvable neighborhood for the current session — either
 * session.neighborhoodId is missing (e.g. this tab route was opened
 * directly or refreshed on web, which mounts it without ever passing
 * through app/index.tsx's onboarding-guard redirect — that only runs
 * when the app boots through "/") or it no longer matches anything in
 * the current neighborhoods dataset (a stale id persisted by an older
 * build). These screens used to `return null` in that case, which left
 * the content area permanently blank with the tab bar still visible and
 * no way to recover short of manually navigating away.
 *
 * Routes to select-city (not select-neighborhood) because we can't
 * assume the persisted regionId/cityId are still valid either — safest
 * to restart the location-picking flow from its first step.
 */
export function NoNeighborhoodState() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center' }}>
      <EmptyState
        icon={MapPin}
        title={t.errors.couldNotLoadNeighborhood}
        body={t.errors.noNeighborhoodBody}
        actionLabel={t.neighborhood.title}
        onAction={() => router.replace('/(auth)/select-city')}
      />
    </View>
  );
}
