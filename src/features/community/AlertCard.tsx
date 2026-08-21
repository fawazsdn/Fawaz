import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import type { AlertItem } from '@/models';

const SEVERITY_COLOR = { info: 'info', warning: 'warning', critical: 'danger' } as const;

// A stable shared reference for the "alert not found" fallback — `?? []`
// would otherwise construct a brand-new array on every getSnapshot call,
// which is exactly as unstable a selector result as `.filter()` would be.
const EMPTY_ARRAY: readonly string[] = [];

export function AlertCard({ alert }: { alert: AlertItem }) {
  const theme = useTheme();
  const { t } = useI18n();
  const tone = theme.colors[SEVERITY_COLOR[alert.severity]];

  const followerIds = useStore((s) => s.alerts.find((a) => a.id === alert.id)?.followerIds ?? EMPTY_ARRAY);
  const helpfulBy = useStore((s) => s.alerts.find((a) => a.id === alert.id)?.helpfulBy ?? EMPTY_ARRAY);
  const toggleAlertFollow = useStore((s) => s.toggleAlertFollow);
  const toggleAlertHelpful = useStore((s) => s.toggleAlertHelpful);

  const following = followerIds.includes(CURRENT_USER_ID);
  const foundHelpful = helpfulBy.includes(CURRENT_USER_ID);

  return (
    <View style={[styles.card, { backgroundColor: tone + '14', borderColor: tone + '55', borderRadius: theme.radii.lg }]}>
      <View style={[theme.row(), { alignItems: 'center', gap: 8, marginBottom: 6 }]}>
        <TriangleAlert size={16} color={tone} />
        <Text style={theme.text('title', tone)} numberOfLines={1}>
          {alert.titleAr}
        </Text>
      </View>
      <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{alert.bodyAr}</Text>
      <View style={[theme.row(), { gap: 16, marginTop: 10 }]}>
        <Pressable accessibilityRole="button" onPress={() => toggleAlertHelpful(alert.id)}>
          <Text style={theme.text('caption', foundHelpful ? tone : theme.colors.textMuted)}>
            {t.alerts.helpful} · {helpfulBy.length}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => toggleAlertFollow(alert.id)}>
          <Text style={theme.text('caption', following ? tone : theme.colors.textMuted)}>
            {following ? t.common.following : t.alerts.follow}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderWidth: 1 },
});
