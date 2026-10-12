import { StyleSheet, Text, View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import type { AlertItem } from '@/models';
import { formatRelativeTime } from '@/utils/format';

const SEVERITY_COLOR = { info: 'info', warning: 'warning', critical: 'danger' } as const;

/** A moderator-issued community alert (community_alerts). Read-only for residents. */
export function AlertCard({ alert }: { alert: AlertItem }) {
  const theme = useTheme();
  const { locale } = useI18n();
  const tone = theme.colors[SEVERITY_COLOR[alert.severity]];

  return (
    <View style={[styles.card, { backgroundColor: tone + '14', borderColor: tone + '55', borderRadius: theme.radii.lg }]}>
      <View style={[theme.row(), { alignItems: 'center', gap: 8, marginBottom: 6 }]}>
        <TriangleAlert size={16} color={tone} />
        <Text style={[theme.text('title', tone), { flexShrink: 1 }]} numberOfLines={2}>
          {alert.titleAr}
        </Text>
      </View>
      <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{alert.bodyAr}</Text>
      <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 8 }]}>{formatRelativeTime(alert.createdAt, locale)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderWidth: 1 },
});
