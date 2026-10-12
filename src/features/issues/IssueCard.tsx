import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, MapPin } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, useCurrentUserId } from '@/store/useStore';
import { useAction } from '@/hooks/useAction';
import { markIssueAffected, toggleFollowIssue } from '@/backend/actions';
import { localizeDigits } from '@/utils/format';
import type { Issue } from '@/models';
import { haptics } from '@/utils/haptics';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';

const STATUS_TONE: Record<Issue['status'], 'warning' | 'info' | 'success'> = {
  reported: 'warning',
  confirmed: 'warning',
  submitted: 'info',
  under_review: 'info',
  in_progress: 'info',
  resolved: 'success',
};

export function IssueCard({ issue }: { issue: Issue }) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();

  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === issue.neighborhoodId));
  const me = useCurrentUserId();
  const { run, pending } = useAction();

  const affected = issue.affectedUserIds.includes(me);
  const following = issue.followerIds.includes(me);

  return (
    // accessibilityRole="link", not "button" — react-native-web renders
    // "button" as a real <button>, and this card contains two real
    // buttons of its own below; nesting <button> inside <button> is
    // invalid HTML and breaks the inner ones.
    <Pressable
      onPress={() => router.push(`/issue/${issue.id}`)}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}
      accessibilityRole="link"
      accessibilityLabel={issue.title}
    >
      <View style={[theme.row(), { alignItems: 'center', gap: 8, marginBottom: 8 }]}>
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.warningSurface }]}>
          <AlertTriangle size={16} color={theme.colors.warning} />
        </View>
        <Text style={[theme.text('title'), { flex: 1 }]} numberOfLines={1}>
          {issue.title}
        </Text>
      </View>

      <View style={[theme.row(), { alignItems: 'center', gap: 4, marginBottom: 6 }]}>
        <MapPin size={12} color={theme.colors.textMuted} />
        <Text style={theme.text('caption', theme.colors.textMuted)} numberOfLines={1}>
          {locale === 'ar' ? neighborhood?.nameAr : neighborhood?.nameEn}
        </Text>
      </View>

      <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>
        {localizeDigits(issue.affectedUserIds.length, locale)} {t.issue.affectedCount}
      </Text>

      <View style={[theme.row(), styles.metaRow]}>
        <Badge label={t.issue[`status${statusKey(issue.status)}` as keyof typeof t.issue] as string} tone={STATUS_TONE[issue.status]} />
      </View>

      <View style={[theme.row(), styles.actions]}>
        <Button
          label={t.issue.iHaveThisToo}
          size="sm"
          variant={affected ? 'outline' : 'primary'}
          disabled={affected || pending}
          onPress={(e) => {
            e?.stopPropagation?.();
            haptics.medium();
            run(() => markIssueAffected(issue.id));
          }}
        />
        <Button
          label={following ? t.issue.following : t.common.follow}
          size="sm"
          variant="ghost"
          onPress={(e) => {
            e?.stopPropagation?.();
            run(() => toggleFollowIssue(issue.id));
          }}
        />
      </View>
    </Pressable>
  );
}

function statusKey(status: Issue['status']) {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

const styles = StyleSheet.create({
  card: { padding: 14, borderWidth: StyleSheet.hairlineWidth },
  iconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  metaRow: { alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  actions: { gap: 8, marginTop: 10 },
});
