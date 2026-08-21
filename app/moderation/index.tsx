import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { formatRelativeTime } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { FilterBar } from '@/components/FilterBar';

const TONE = { open: 'warning', reviewed: 'info', dismissed: 'neutral', actioned: 'success' } as const;

export default function ModerationScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const reports = useStore((s) => s.reports);
  const moderateReport = useStore((s) => s.moderateReport);
  const removeContent = useStore((s) => s.removeContent);
  const posts = useStore((s) => s.posts);
  const comments = useStore((s) => s.comments);
  const users = useStore((s) => s.users);

  const [filter, setFilter] = useState<'open' | 'reviewed' | 'dismissed' | 'actioned'>('open');

  const filtered = reports.filter((r) => r.status === filter);

  const resolveTitle = (r: (typeof reports)[number]) => {
    if (r.targetType === 'post') return posts.find((p) => p.id === r.targetId)?.textAr ?? t.moderation.reportedPosts;
    if (r.targetType === 'comment') return comments.find((c) => c.id === r.targetId)?.textAr ?? t.moderation.reportedComments;
    if (r.targetType === 'user') return users.find((u) => u.id === r.targetId)?.firstName ?? t.moderation.reportedUsers;
    return r.targetId;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.moderation.title} fallbackRoute="/settings" />
      <View style={{ marginBottom: 10 }}>
        <FilterBar
          options={[
            { key: 'open', label: t.common.all },
            { key: 'reviewed', label: t.moderation.reviewed },
            { key: 'dismissed', label: t.moderation.dismiss },
            { key: 'actioned', label: t.moderation.actioned },
          ]}
          selected={filter}
          onSelect={(k) => setFilter(k as typeof filter)}
        />
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: 10 }}>
        {filtered.length === 0 ? (
          <EmptyState title={t.moderation.empty} />
        ) : (
          filtered.map((r) => (
            <View
              key={r.id}
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderWidth: 1,
                borderRadius: theme.radii.md,
                padding: 14,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Badge label={t.report.reasons[r.reasonType]} tone={TONE[r.status]} />
                <Text style={theme.text('caption', theme.colors.textMuted)}>{formatRelativeTime(r.createdAt, locale)}</Text>
              </View>
              <Text style={theme.text('bodySmall')} numberOfLines={2}>
                {resolveTitle(r)}
              </Text>
              {r.note ? <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 4 }]}>{r.note}</Text> : null}
              {r.status === 'open' ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <Button
                    label={t.moderation.removeContent}
                    size="sm"
                    variant="danger"
                    onPress={() => {
                      removeContent(r.targetType, r.targetId);
                      moderateReport(r.id, 'actioned');
                    }}
                  />
                  <Button label={t.moderation.warnUser} size="sm" variant="outline" onPress={() => moderateReport(r.id, 'reviewed')} />
                  <Button label={t.moderation.dismiss} size="sm" variant="ghost" onPress={() => moderateReport(r.id, 'dismissed')} />
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
