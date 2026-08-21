import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, Calendar, MessageSquarePlus, Star } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { haptics } from '@/utils/haptics';

/**
 * The four fastest paths into creating something, surfaced right on Home
 * rather than making residents open the Create sheet first. "Recommend"
 * routes to the recommendations browse screen (the closest existing entry
 * point — there's no standalone "create a recommendation" composer, only
 * leaving one from a business's own page) rather than a fabricated flow.
 */
export function QuickActions() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  const actions = [
    { key: 'ask', icon: MessageSquarePlus, label: t.home.quickAskNeighbors, route: '/create/post' as const },
    { key: 'event', icon: Calendar, label: t.home.quickCreateEvent, route: '/event/create' as const },
    { key: 'issue', icon: AlertTriangle, label: t.home.quickReportIssue, route: '/issue/create' as const },
    { key: 'recommend', icon: Star, label: t.home.quickRecommendPlace, route: '/recommendations' as const },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.list, theme.row(), { paddingHorizontal: theme.spacing.md }]}
    >
      {actions.map((a) => (
        <Pressable
          key={a.key}
          onPress={() => {
            haptics.selection();
            router.push(a.route);
          }}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.successSurface }]}>
            <a.icon size={18} color={theme.colors.primary} />
          </View>
          <Text style={[theme.text('caption', theme.colors.textSecondary), styles.label]} numberOfLines={2}>
            {a.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: 84,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center' },
});
