import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useCurrentUserId } from '@/store/useStore';
import { useAction } from '@/hooks/useAction';
import { offerHelp } from '@/backend/actions';
import type { HelpRequest } from '@/models';
import { formatRelativeTime } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';

export function HelpRequestCard({ request }: { request: HelpRequest }) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const me = useCurrentUserId();
  const { run, pending } = useAction();
  const offered = request.offeredBy.includes(me);
  const isOwn = request.requesterId === me;

  return (
    // accessibilityRole="link", not "button" — react-native-web renders
    // "button" as a real <button>, and this card contains two real
    // buttons of its own below; nesting <button> inside <button> is
    // invalid HTML and breaks the inner ones.
    <Pressable
      onPress={() => router.push(`/help-request/${request.id}`)}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}
      accessibilityRole="link"
      accessibilityLabel={request.title}
    >
      <View style={[theme.row(), { justifyContent: 'space-between', marginBottom: 8 }]}>
        <Badge label={t.help.categories[request.category]} tone="info" />
        {request.status === 'resolved' ? <Badge label={t.common.done} tone="success" /> : null}
      </View>
      <Text style={theme.text('title')} numberOfLines={2}>
        {request.title}
      </Text>
      <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 4 }]}>{formatRelativeTime(request.createdAt, locale)}</Text>

      <View style={[theme.row(), styles.actions]}>
        <Button
          label={offered ? t.help.offered : t.help.iCanHelp}
          size="sm"
          disabled={offered || isOwn || request.status === 'resolved' || pending}
          onPress={(e) => {
            e?.stopPropagation?.();
            haptics.medium();
            run(() => offerHelp(request.id));
          }}
        />
        <Button
          label={t.common.message}
          size="sm"
          variant="outline"
          onPress={(e) => {
            e?.stopPropagation?.();
            router.push(`/help-request/${request.id}`);
          }}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderWidth: StyleSheet.hairlineWidth },
  actions: { gap: 8, marginTop: 12 },
});
