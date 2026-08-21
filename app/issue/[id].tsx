import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Users } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import { displayName, formatRelativeTime } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import type { IssueStatus } from '@/models';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Card } from '@/components/Card';
import { StatusTimeline } from '@/components/StatusTimeline';
import { ImageGallery } from '@/components/ImageGallery';
import { MapPlaceholder } from '@/components/MapPlaceholder';
import { EmptyState } from '@/components/EmptyState';
import { Composer } from '@/components/Composer';
import { CommentRow } from '@/features/feed/CommentRow';

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
  const allComments = useStore((s) => s.comments);
  const comments = useMemo(() => allComments.filter((c) => c.postId === id), [allComments, id]);
  const demoRole = useStore((s) => s.settings.demoRole);
  const markIssueAffected = useStore((s) => s.markIssueAffected);
  const toggleFollowIssue = useStore((s) => s.toggleFollowIssue);
  const setIssueStatus = useStore((s) => s.setIssueStatus);
  const addComment = useStore((s) => s.addComment);

  const [replyTarget, setReplyTarget] = useState<string | null>(null);

  if (!issue || !reporter) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="" />
        <EmptyState title={t.errors.genericTitle} />
      </View>
    );
  }

  const affected = issue.affectedUserIds.includes(CURRENT_USER_ID);
  const following = issue.followerIds.includes(CURRENT_USER_ID);
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
      <AppHeader title={t.issueCreate.categories[issue.category]} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 100 }}>
        {issue.images.length > 0 ? (
          <View style={{ marginBottom: 12 }}>
            <ImageGallery images={issue.images} maxHeight={200} />
          </View>
        ) : (
          <View style={{ marginBottom: 12 }}>
            <MapPlaceholder
              centerLat={issue.approxLat}
              centerLng={issue.approxLng}
              pins={[{ id: issue.id, lat: issue.approxLat, lng: issue.approxLng }]}
              height={160}
            />
          </View>
        )}

        <Text style={theme.text('heading2')}>{issue.title}</Text>
        <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginTop: 8 }]}>{issue.description}</Text>

        <View style={[theme.row(), { alignItems: 'center', gap: 6, marginTop: 12 }]}>
          <Users size={14} color={theme.colors.textMuted} />
          <Text style={theme.text('caption', theme.colors.textMuted)}>
            {displayName(reporter)} · {locale === 'ar' ? neighborhood?.nameAr : neighborhood?.nameEn} ·{' '}
            {formatRelativeTime(issue.createdAt, locale)}
          </Text>
        </View>

        <Card style={{ marginTop: 14 }}>
          <View style={[theme.row(), { justifyContent: 'space-between' }]}>
            <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{t.issue.affectedCount}</Text>
            <Text style={theme.text('title')}>{issue.affectedUserIds.length}</Text>
          </View>
        </Card>

        <View style={{ marginTop: 16, marginBottom: 8 }}>
          <Button
            label={affected ? t.help.offered : t.issue.iHaveThisToo}
            onPress={() => {
              haptics.medium();
              markIssueAffected(issue.id);
            }}
            disabled={affected}
            fullWidth
            size="lg"
          />
          <View style={{ height: 10 }} />
          <Button
            label={following ? t.issue.following : t.common.follow}
            onPress={() => toggleFollowIssue(issue.id)}
            variant="outline"
            fullWidth
          />
        </View>

        <Text style={[theme.text('title'), styles.sectionTitle]}>{t.issue.progress}</Text>
        <Card>
          <StatusTimeline steps={timelineSteps} activeIndex={activeIndex} />
        </Card>

        {demoRole === 'moderator' ? (
          <View style={{ marginTop: 14 }}>
            <Text style={theme.text('caption', theme.colors.textMuted)}>{t.issue.devControls}</Text>
            <View style={[theme.row(), { gap: 6, marginTop: 8, flexWrap: 'wrap' }]}>
              {STATUS_ORDER.map((status) => (
                <Chip
                  key={status}
                  label={t.issue[`status${statusKey(status)}` as keyof typeof t.issue] as string}
                  selected={issue.status === status}
                  onPress={() => setIssueStatus(issue.id, status)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <Text style={[theme.text('title'), styles.sectionTitle]}>
          {t.post.commentsTitle} {comments.length > 0 ? `(${comments.length})` : ''}
        </Text>
        {comments.length === 0 ? (
          <EmptyState title={t.post.noComments} compact />
        ) : (
          comments.map((c) => <CommentRow key={c.id} comment={c} onReply={(cm) => setReplyTarget(cm.id)} />)
        )}
      </ScrollView>

      <Composer
        placeholder={t.post.writeComment}
        onSend={(text) => {
          addComment(issue.id, text, replyTarget ?? undefined);
          setReplyTarget(null);
        }}
      />
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
