import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import type { HelpRequest } from '@/models';
import { formatDistance, formatRelativeTime } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';

export function HelpRequestCard({ request }: { request: HelpRequest }) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const offerHelp = useStore((s) => s.offerHelp);
  const offered = request.offeredBy.includes(CURRENT_USER_ID);

  return (
    <Pressable
      onPress={() => router.push(`/help-request/${request.id}`)}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}
      accessibilityRole="button"
    >
      <View style={[theme.row(), { justifyContent: 'space-between', marginBottom: 8 }]}>
        <Badge label={t.help.categories[request.category]} tone="info" />
        {request.status === 'resolved' ? <Badge label={t.common.done} tone="success" /> : null}
      </View>
      <Text style={theme.text('title')} numberOfLines={2}>
        {request.title}
      </Text>
      <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 4 }]}>{formatRelativeTime(request.createdAt, locale)}</Text>
      <View style={[theme.row(), { alignItems: 'center', gap: 4, marginTop: 4 }]}>
        <MapPin size={12} color={theme.colors.textMuted} />
        <Text style={theme.text('caption', theme.colors.textMuted)}>{formatDistance(request.approxDistanceM, locale)}</Text>
      </View>

      <View style={[theme.row(), styles.actions]}>
        <Button
          label={offered ? t.help.offered : t.help.iCanHelp}
          size="sm"
          disabled={offered || request.status === 'resolved'}
          onPress={() => {
            haptics.medium();
            offerHelp(request.id);
          }}
        />
        <Button label={t.common.message} size="sm" variant="outline" onPress={() => router.push(`/help-request/${request.id}`)} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderWidth: StyleSheet.hairlineWidth },
  actions: { gap: 8, marginTop: 12 },
});
