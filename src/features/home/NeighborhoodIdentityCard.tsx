import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Users } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { geographyService } from '@/services/geography';
import type { SaudiCity } from '@/types/geography';
import { Card } from '@/components/Card';
import { useNeighborhoodActivity } from './useNeighborhoodActivity';

/**
 * The neighborhood-identity summary at the top of Home — answers "where
 * am I" and "what's happening" in one glance. `residentsCount` is real
 * seeded data on the curated `Neighborhood` record (same field the
 * neighborhood switcher and Invite screen's growth card already read —
 * see src/models Neighborhood), and the activity total is the same real
 * count NeighborhoodPulse shows broken out by category. Nothing here is
 * a fabricated production number.
 */
export function NeighborhoodIdentityCard({ neighborhoodId }: { neighborhoodId: string }) {
  const theme = useTheme();
  const { t, locale } = useI18n();

  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === neighborhoodId));
  const { total } = useNeighborhoodActivity(neighborhoodId);
  const [city, setCity] = useState<SaudiCity | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    if (neighborhood?.cityId) {
      geographyService.getCity(neighborhood.cityId).then((c) => alive && setCity(c));
    }
    return () => {
      alive = false;
    };
  }, [neighborhood?.cityId]);

  if (!neighborhood) return null;

  const name = locale === 'ar' ? neighborhood.nameAr : neighborhood.nameEn;
  const cityName = city ? (locale === 'ar' ? city.nameAr : city.nameEn) : '';

  return (
    <Card style={{ backgroundColor: theme.colors.primary, borderWidth: 0 }}>
      <View style={[theme.row(), { alignItems: 'center', justifyContent: 'space-between' }]}>
        <View style={{ flex: 1 }}>
          <Text style={theme.text('heading3', theme.colors.onPrimary)} numberOfLines={1}>
            {name}
            {cityName ? ` · ${cityName}` : ''}
          </Text>
          <View style={[theme.row(), { alignItems: 'center', gap: 5, marginTop: 4 }]}>
            <Users size={13} color={theme.colors.onPrimary} />
            <Text style={[theme.text('caption', theme.colors.onPrimary), { opacity: 0.9 }]}>
              {neighborhood.residentsCount.toLocaleString()} {t.home.neighborsLabel}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          theme.row(),
          { alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.onPrimary + '22' },
        ]}
      >
        <Text style={[theme.text('bodySmall', theme.colors.onPrimary), { opacity: 0.9 }]}>
          {t.home.todayIn} {name}
        </Text>
        <Text style={theme.text('title', theme.colors.onPrimary)}>
          {total > 0 ? `${total} ${t.home.thingsHappening}` : t.home.nothingHappeningToday}
        </Text>
      </View>
    </Card>
  );
}
