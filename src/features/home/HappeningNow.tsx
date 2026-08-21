import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, Calendar, HeartHandshake, PawPrint, TriangleAlert, type LucideIcon } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { formatClock } from '@/utils/format';

interface HappeningItem {
  id: string;
  icon: LucideIcon;
  tone: string;
  title: string;
  subtitle: string;
  route: string;
}

export function HappeningNow({ neighborhoodId }: { neighborhoodId: string }) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();

  // Raw state + useMemo, not filter()/sort()/slice() inside the selector —
  // see src/features/home/HomeHeader.tsx for why.
  const allEvents = useStore((s) => s.events);
  const events = useMemo(
    () =>
      allEvents
        .filter((e) => e.neighborhoodId === neighborhoodId && !e.cancelled && new Date(e.startsAt).getTime() > Date.now())
        .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
        .slice(0, 2),
    [allEvents, neighborhoodId],
  );
  const issue = useStore((s) => s.issues.find((i) => i.neighborhoodId === neighborhoodId && i.status !== 'resolved'));
  const help = useStore((s) => s.helpRequests.find((h) => h.neighborhoodId === neighborhoodId && h.status === 'open'));
  const lostPet = useStore((s) => s.lostFound.find((l) => l.neighborhoodId === neighborhoodId && l.kind === 'pet' && l.status === 'lost'));
  const alert = useStore((s) => s.alerts.find((a) => a.neighborhoodId === neighborhoodId));

  const items: HappeningItem[] = [
    ...events.map((e) => ({
      id: e.id,
      icon: Calendar,
      tone: theme.colors.primary,
      title: e.title,
      subtitle: formatClock(e.startsAt, locale),
      route: `/event/${e.id}`,
    })),
    ...(alert
      ? [
          {
            id: alert.id,
            icon: TriangleAlert,
            tone: theme.colors.warning,
            title: alert.titleAr,
            subtitle: t.notifications.title,
            route: '/(tabs)',
          },
        ]
      : []),
    ...(help
      ? [
          {
            id: help.id,
            icon: HeartHandshake,
            tone: theme.colors.info,
            title: help.title,
            subtitle: t.help.categories[help.category],
            route: `/help-request/${help.id}`,
          },
        ]
      : []),
    ...(lostPet
      ? [
          {
            id: lostPet.id,
            icon: PawPrint,
            tone: theme.colors.danger,
            title: lostPet.title,
            subtitle: t.lostFound.lost,
            route: `/lost-found/${lostPet.id}`,
          },
        ]
      : []),
    ...(issue
      ? [
          {
            id: issue.id,
            icon: AlertTriangle,
            tone: theme.colors.warning,
            title: issue.title,
            subtitle: t.issueCreate.categories[issue.category],
            route: `/issue/${issue.id}`,
          },
        ]
      : []),
  ];

  if (items.length === 0) return null;

  return (
    <View>
      <Text style={[theme.text('title'), styles.heading]}>{t.home.happeningNow}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, theme.row()]}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => router.push(item.route as never)}
            style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}
            accessibilityRole="button"
          >
            <View style={[styles.iconWrap, { backgroundColor: item.tone + '1a' }]}>
              <item.icon size={18} color={item.tone} />
            </View>
            <Text style={theme.text('bodySmall')} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={theme.text('caption', theme.colors.textMuted)} numberOfLines={1}>
              {item.subtitle}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { paddingHorizontal: 16, marginBottom: 10 },
  scrollContent: { gap: 10, paddingHorizontal: 16, paddingBottom: 4 },
  card: { width: 148, padding: 12, borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
