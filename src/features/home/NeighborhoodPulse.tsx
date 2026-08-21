import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, HeartHandshake, PartyPopper, ShoppingBag } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { Card } from '@/components/Card';

export function NeighborhoodPulse({ neighborhoodId }: { neighborhoodId: string }) {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  // Raw state + useMemo, not filter() inside the selector — see HomeHeader
  // for why (getSnapshot must return a stable reference across renders).
  const allEvents = useStore((s) => s.events);
  const allIssues = useStore((s) => s.issues);
  const allHelpRequests = useStore((s) => s.helpRequests);
  const allListings = useStore((s) => s.marketplaceListings);

  const events = useMemo(
    () => allEvents.filter((e) => e.neighborhoodId === neighborhoodId && new Date(e.startsAt).getTime() > Date.now()),
    [allEvents, neighborhoodId],
  );
  const issues = useMemo(
    () => allIssues.filter((i) => i.neighborhoodId === neighborhoodId && i.status !== 'resolved'),
    [allIssues, neighborhoodId],
  );
  const helpRequests = useMemo(
    () => allHelpRequests.filter((h) => h.neighborhoodId === neighborhoodId && h.status === 'open'),
    [allHelpRequests, neighborhoodId],
  );
  const listings = useMemo(
    () =>
      allListings.filter(
        (m) => m.neighborhoodId === neighborhoodId && Date.now() - new Date(m.createdAt).getTime() < 48 * 3600 * 1000,
      ),
    [allListings, neighborhoodId],
  );

  const stats = [
    { key: 'events', value: events.length, icon: PartyPopper, tone: theme.colors.primary, route: '/events' as const },
    { key: 'issues', value: issues.length, icon: AlertTriangle, tone: theme.colors.warning, route: '/community' as const },
    { key: 'help', value: helpRequests.length, icon: HeartHandshake, tone: theme.colors.info, route: '/(tabs)/discover' as const },
    { key: 'listings', value: listings.length, icon: ShoppingBag, tone: theme.colors.secondary, route: '/marketplace' as const },
  ];

  const labels: Record<string, string> = {
    events: 'فعالية',
    issues: 'بلاغ نشط',
    help: 'يحتاجون مساعدة',
    listings: 'إعلان جديد',
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
