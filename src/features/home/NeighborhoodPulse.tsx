import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, HeartHandshake, PartyPopper, ShoppingBag } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { Card } from '@/components/Card';
import { useNeighborhoodActivity } from './useNeighborhoodActivity';

export function NeighborhoodPulse({ neighborhoodId }: { neighborhoodId: string }) {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  const { events, issues, helpRequests, listings } = useNeighborhoodActivity(neighborhoodId);

  const stats = [
    { key: 'events', value: events.length, icon: PartyPopper, tone: theme.colors.primary, route: '/events' as const },
    { key: 'issues', value: issues.length, icon: AlertTriangle, tone: theme.colors.warning, route: '/community' as const },
    { key: 'help', value: helpRequests.length, icon: HeartHandshake, tone: theme.colors.info, route: '/(tabs)/discover' as const },
    { key: 'listings', value: listings.length, icon: ShoppingBag, tone: theme.colors.secondary, route: '/marketplace' as const },
  ];

  const labels: Record<string, string> = {
    events: t.home.pulseEvents,
    issues: t.home.pulseIssues,
    help: t.home.pulseHelp,
    listings: t.home.pulseListings,
  };

  return (
    <Card>
      <Text style={[theme.text('title'), { marginBottom: 12 }]}>{t.home.pulseTitle}</Text>
      <View style={[theme.row(), styles.grid]}>
        {stats.map((stat) => (
          <Pressable key={stat.key} onPress={() => router.push(stat.route)} style={styles.statCell} accessibilityRole="button">
            <View style={[styles.iconWrap, { backgroundColor: stat.tone + '1a' }]}>
              <stat.icon size={17} color={stat.tone} />
            </View>
            <AnimatedCounter value={stat.value} style={{ ...theme.text('heading2'), marginTop: 6 }} />
            <Text style={theme.text('caption', theme.colors.textMuted)} numberOfLines={1}>
              {labels[stat.key]}
            </Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { justifyContent: 'space-between' },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
