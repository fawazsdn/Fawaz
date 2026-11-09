import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BadgeCheck, Lock } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useCurrentUserId } from '@/store/useStore';
import { useAction } from '@/hooks/useAction';
import { listFollows, removeFollower, type FollowEntry } from '@/backend/social';
import { displayName } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { EmptyState } from '@/components/EmptyState';
import { SearchBar } from '@/components/SearchBar';
import { SkeletonCardRow } from '@/components/Skeleton';
import { FollowButton } from '@/features/social/FollowButton';

/** Followers / following of a profile. The server hides lists of private accounts you don't follow. */
export default function FollowsScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const me = useCurrentUserId();
  const { run } = useAction();
  const [kind, setKind] = useState<'followers' | 'following'>(tab === 'following' ? 'following' : 'followers');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<FollowEntry[] | null>(null);
  const [removing, setRemoving] = useState<FollowEntry | null>(null);
  const isOwn = id === me;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setRows(await listFollows(id, kind, query));
    } catch {
      setRows([]);
    }
  }, [id, kind, query]);

  useEffect(() => {
    const h = setTimeout(load, query ? 250 : 0);
    return () => clearTimeout(h);
  }, [load, query]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={kind === 'followers' ? t.social.followers : t.social.following} fallbackRoute={`/profile/${id}`} />
      <View style={{ paddingHorizontal: theme.spacing.md, gap: 10, paddingBottom: 8 }}>
        <View style={[theme.row(), { gap: 8 }]}>
          <Chip label={t.social.followers} selected={kind === 'followers'} onPress={() => setKind('followers')} />
          <Chip label={t.social.following} selected={kind === 'following'} onPress={() => setKind('following')} />
        </View>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t.social.searchPeople} />
      </View>
      {rows === null ? (
        <View style={{ padding: theme.spacing.md }}>
          <SkeletonCardRow count={3} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.userId}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40, flexGrow: 1 }}
          ListEmptyComponent={<EmptyState title={kind === 'followers' ? t.social.noFollowers : t.social.noFollowing} compact />}
          renderItem={({ item }) => {
            const name = displayName(item);
            return (
              <View style={[theme.row(), { alignItems: 'center', gap: 12, paddingVertical: 8 }]} testID="follow-row">
                <Pressable
                  onPress={() => router.push(`/profile/${item.userId}`)}
                  style={[theme.row(), { alignItems: 'center', gap: 12, flex: 1 }]}
                  accessibilityRole="button"
                >
                  <Avatar uri={item.avatarUrl} name={name} size={44} />
                  <View style={{ flex: 1 }}>
                    <View style={[theme.row(), { alignItems: 'center', gap: 4 }]}>
                      <Text style={theme.text('title')} numberOfLines={1}>
                        {name}
                      </Text>
                      {item.verified ? <BadgeCheck size={14} color={theme.colors.primary} /> : null}
                      {item.isPrivate ? <Lock size={12} color={theme.colors.textMuted} /> : null}
                    </View>
                  </View>
                </Pressable>
                {isOwn && kind === 'followers' ? (
                  <Button label={t.social.remove} size="sm" variant="outline" onPress={() => setRemoving(item)} />
                ) : (
                  <FollowButton
                    userId={item.userId}
                    name={name}
                    state={item.followState}
                    size="sm"
                    onChanged={(followState) => setRows((prev) => prev?.map((r) => (r.userId === item.userId ? { ...r, followState } : r)) ?? null)}
                  />
                )}
              </View>
            );
          }}
        />
      )}
      <ConfirmationModal
        visible={!!removing}
        title={removing ? t.social.removeFollowerConfirm.replace('{name}', displayName(removing)) : ''}
        confirmLabel={t.social.remove}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          const target = removing;
          setRemoving(null);
          if (!target) return;
          const res = await run(() => removeFollower(target.userId));
          if (res.ok) setRows((prev) => prev?.filter((r) => r.userId !== target.userId) ?? null);
        }}
      />
    </View>
  );
}
