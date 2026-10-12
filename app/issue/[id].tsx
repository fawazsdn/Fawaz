import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Share2, Users } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, useCurrentUserId } from '@/store/useStore';
import { useAction } from '@/hooks/useAction';
import { markIssueAffected, setIssueStatus, toggleFollowIssue } from '@/backend/actions';
import { HaratnaMap } from '@/components/HaratnaMap';
import { displayName, formatRelativeTime, localizeDigits } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { shareContent } from '@/utils/share';
import { links } from '@/config/links';
import type { IssueStatus } from '@/models';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Card } from '@/components/Card';
import { StatusTimeline } from '@/components/StatusTimeline';
import { ImageGallery } from '@/components/ImageGallery';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';

const STATUS_ORDER: IssueStatus[] = ['reported', 'confirmed', 'submitted', 'under_review', 'in_progress', 'resolved'];

export default function IssueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t, locale } = useI18n();

  const issue = useStore((s) => s.issues.find((i) => i.id === id));
  // Raw state + useMemo, not filter()/sort() inside the selector — see
  // HomeHeader for why (getSnapshot must return a stable reference).
  const allIssueUpdates = useStore((s) => s.issueUpdates);
  const updates = useMemo(
    () => allIssueUpdates.filter((u) => u.issueId === id).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [allIssueUpdates, id],
  );
  const reporter = useStore((s) => s.getUser(issue?.reporterId ?? ''));
  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === issue?.neighborhoodId));
  const me = useCurrentUserId();
  // Status changes are staff-only; RLS enforces this server-side too.
  const isStaff = useStore((s) => {
    const role = s.users.find((u) => u.id === me)?.role;
    return role === 'moderator' || role === 'admin';
  });
  const { run, pending } = useAction();

  if (!issue) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="" fallbackRoute="/issues" />
        <EmptyState title={t.errors.genericTitle} />
      </View>
    );
  }

  const affected = issue.affectedUserIds.includes(me);
  const following = issue.followerIds.includes(me);
  const hasPin = issue.approxLat != null && issue.approxLng != null;
  const activeIndex = STATUS_ORDER.indexOf(issue.status);

  const timelineSteps = STATUS_ORDER.map((status) => {
    const update = updates.find((u) => u.status === status);
    return {
      key: status,
      label: t.issue[`status${statusKey(status)}` as keyof typeof t.issue] as string,
      note: update?.note,
      dateLabel: update ? formatRelativeTime(update.createdAt, locale) : undefined,
    };
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title={t.issueCreate.categories[issue.category]}
        fallbackRoute="/issues"
        right={
          <IconButton
            accessibilityLabel={t.common.share}
            onPress={() => shareContent({ title: issue.title, message: issue.title, url: links.issue(issue.id) })}
          >
            <Share2 size={19} color={theme.colors.textPrimary} />
          </IconButton>
        }
      />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 100 }}>
        {issue.images.length > 0 ? (
          <View style={{ marginBottom: 12 }}>
            <ImageGallery images={issue.images} maxHeight={200} />
          </View>
        ) : hasPin ? (
          <View style={{ marginBottom: 12, height: 160, borderRadius: theme.radii.md, overflow: 'hidden' }}>
            <HaratnaMap
              center={{ latitude: issue.approxLat as number, longitude: issue.approxLng as number }}
              delta={0.008}
              markers={[
                {
                  id: issue.id,
                  coordinate: { latitude: issue.approxLat as number, longitude: issue.approxLng as number },
                  title: issue.title,
                  color: theme.colors.warning,
                },
              ]}
            />
          </View>
        ) : null}

        <Text style={theme.text('heading2')}>{issue.title}</Text>
        <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginTop: 8 }]}>{issue.description}</Text>

        <View style={[theme.row(), { alignItems: 'center', gap: 6, marginTop: 12 }]}>
          <Users size={14} color={theme.colors.textMuted} />
          <Text style={theme.text('caption', theme.colors.textMuted)}>
            {reporter ? displayName(reporter) : t.common.neighbor} · {locale === 'ar' ? neighborhood?.nameAr : neighborhood?.nameEn} ·{' '}
            {formatRelativeTime(issue.createdAt, locale)}
          </Text>
        </View>

        <Card style={{ marginTop: 14 }}>
          <View style={[theme.row(), { justifyContent: 'space-between' }]}>
            <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{t.issue.affectedCount}</Text>
            <Text style={theme.text('title')}>{localizeDigits(issue.affectedUserIds.length, locale)}</Text>
          </View>
        </Card>

        <View style={{ marginTop: 16, marginBottom: 8 }}>
          <Button
            label={affected ? t.help.offered : t.issue.iHaveThisToo}
            onPress={() => {
              haptics.medium();
              run(() => markIssueAffected(issue.id));
            }}
            disabled={affected || pending}
            fullWidth
            size="lg"
          />
          <View style={{ height: 10 }} />
          <Button
            label={following ? t.issue.following : t.common.follow}
            onPress={() => run(() => toggleFollowIssue(issue.id))}
            variant="outline"
            fullWidth
          />
        </View>

        <Text style={[theme.text('title'), styles.sectionTitle]}>{t.issue.progress}</Text>
        <Card>
          <StatusTimeline steps={timelineSteps} activeIndex={activeIndex} />
        </Card>

        {isStaff ? (
          <View style={{ marginTop: 14 }}>
            <Text style={theme.text('caption', theme.colors.textMuted)}>{t.issue.devControls}</Text>
            <View style={[theme.row(), { gap: 6, marginTop: 8, flexWrap: 'wrap' }]}>
              {STATUS_ORDER.map((status) => (
                <Chip
                  key={status}
                  label={t.issue[`status${statusKey(status)}` as keyof typeof t.issue] as string}
                  selected={issue.status === status}
                  onPress={() => run(() => setIssueStatus(issue.id, status))}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function statusKey(status: IssueStatus) {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

const styles = StyleSheet.create({
  sectionTitle: { marginTop: 20, marginBottom: 10 },
});
