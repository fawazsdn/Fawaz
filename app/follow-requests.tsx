import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BadgeCheck } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useAction } from '@/hooks/useAction';
import { listFollowRequests, respondFollowRequest, type FollowEntry } from '@/backend/social';
import { displayName, formatRelativeTime } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCardRow } from '@/components/Skeleton';

/** Pending requests to follow your private account. */
export default function FollowRequestsScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const { run } = useAction();
  const [rows, setRows] = useState<FollowEntry[] | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await listFollowRequests());
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const answer = async (userId: string, accept: boolean) => {
    const res = await run(() => respondFollowRequest(userId, accept));
    if (res.ok) setRows((prev) => prev?.filter((r) => r.userId !== userId) ?? null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.social.followRequests} fallbackRoute="/settings" />
      {rows === null ? (
        <View style={{ padding: theme.spacing.md }}>
          <SkeletonCardRow count={3} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.userId}
          contentContainerStyle={{ padding: theme.spacing.md, flexGrow: 1 }}
          ListEmptyComponent={<EmptyState title={t.social.noFollowRequests} compact />}
          renderItem={({ item }) => {
            const name = displayName(item);
            return (
              <View style={[theme.row(), { alignItems: 'center', gap: 10, paddingVertical: 8 }]} testID="request-row">
                <Pressable
                  onPress={() => router.push(`/profile/${item.userId}`)}
                  style={[theme.row(), { alignItems: 'center', gap: 10, flex: 1 }]}
                  accessibilityRole="button"
                >
                  <Avatar uri={item.avatarUrl} name={name} size={44} />
                  <View style={{ flex: 1 }}>
                    <View style={[theme.row(), { alignItems: 'center', gap: 4 }]}>
                      <Text style={theme.text('title')} numberOfLines={1}>
                        {name}
                      </Text>
                      {item.verified ? <BadgeCheck size={14} color={theme.colors.primary} /> : null}
                    </View>
                    <Text style={theme.text('caption', theme.colors.textMuted)}>{formatRelativeTime(item.since, locale)}</Text>
                  </View>
                </Pressable>
                <Button label={t.social.accept} size="sm" onPress={() => answer(item.userId, true)} testID="accept-request" />
                <Button label={t.social.decline} size="sm" variant="outline" onPress={() => answer(item.userId, false)} />
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
