import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useCurrentUserId, useStore } from '@/store/useStore';
import { useAction } from '@/hooks/useAction';
import { addComment, loadComments } from '@/backend/actions';
import { canOpenExplorePost, stagingExploreEnabled } from '@/backend/exploreFeed';
import { ExplorePostCard } from '@/features/explore/ExploreSocialFeed';
import { fetchPost } from '@/backend/social';
import { SkeletonCardRow } from '@/components/Skeleton';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { Composer } from '@/components/Composer';
import { PostCard } from '@/features/feed/PostCard';
import { CommentRow } from '@/features/feed/CommentRow';
import { displayName } from '@/utils/format';
import type { Comment } from '@/models';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t } = useI18n();

  const viewer = useCurrentUserId();
  const blocked = useStore((s) => s.blockedUserIds);
  const storedPost = useStore((s) => s.posts.find((p) => p.id === id));
  // Raw state + useMemo, not filter()/sort() inside the selector — see
  // src/features/home/HomeHeader.tsx for why.
  const allComments = useStore((s) => s.comments);
  const comments = useMemo(
    () => allComments.filter((c) => c.postId === id).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [allComments, id],
  );
  const getUser = useStore((s) => s.getUser);
  const syncStatus = useStore((s) => s.sync.status);
  const { run, pending } = useAction();
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'missing'>('idle');

  const [access, setAccess] = useState<{ key: string; granted: boolean }>();
  const accessKey = JSON.stringify([viewer, id]);
  useFocusEffect(useCallback(() => {
    if (!stagingExploreEnabled || !id || !viewer) return;
    let active = true;
    setAccess(undefined);
    const check = async () => {
      const authorized = await canOpenExplorePost(id);
      if (!active) return;
      const granted = authorized && !!await fetchPost(id, false);
      if (active) setAccess({ key: accessKey, granted });
    };
    void check().catch(() => { if (active) setAccess({ key: accessKey, granted: false }); });
    return () => { active = false; setAccess(undefined); };
  }, [accessKey, id, viewer]));
  const post = !stagingExploreEnabled || (access?.key === accessKey && access.granted && !blocked.includes(storedPost?.authorId ?? ''))
    ? storedPost : undefined;

  // Posts outside the synced feed (a notification, a followed account, a link)
  // are fetched on demand; RLS returns nothing if you may not see them.
  useEffect(() => {
    if (stagingExploreEnabled || !id || post || fetchState !== 'idle') return;
    setFetchState('loading');
    fetchPost(id)
      .then((p) => setFetchState(p ? 'idle' : 'missing'))
      .catch(() => setFetchState('missing'));
  }, [id, post, fetchState]);

  const canLoadComments = !stagingExploreEnabled || !!post;
  useEffect(() => {
    if (!id || !canLoadComments) return;
    loadComments(id)
      .catch(() => {})
      .finally(() => setCommentsLoaded(true));
  }, [id, canLoadComments]);

  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

  if (!post) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={t.post.commentsTitle} fallbackRoute="/" />
        {(stagingExploreEnabled ? access?.key !== accessKey : syncStatus === 'loading' || fetchState !== 'missing') ? (
          <View style={{ padding: theme.spacing.md }}>
            <SkeletonCardRow count={2} />
          </View>
        ) : (
          <EmptyState title={t.errors.notFound} />
        )}
      </View>
    );
  }

  const onSend = async (text: string) => {
    if (pending) return false;
    const parent = replyingTo?.id;
    const res = await run(() => addComment(post.id, text, parent));
    // Keep the draft (and reply target) when the send failed, so it can be retried.
    if (res.ok) setReplyingTo(null);
    return res.ok;
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <AppHeader title={t.post.commentsTitle} fallbackRoute="/" />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.md }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        {stagingExploreEnabled ? <ExplorePostCard post={post} onPress={() => {}} /> : <PostCard post={post} onPress={() => {}} />}
        <Text style={[theme.text('title'), { marginTop: 20, marginBottom: 4 }]}>
          {t.post.commentsTitle} {comments.length > 0 ? `(${comments.length})` : ''}
        </Text>
        {!commentsLoaded ? (
          <SkeletonCardRow count={1} />
        ) : comments.length === 0 ? (
          <EmptyState title={t.post.noComments} compact />
        ) : (
          comments.map((c) => <CommentRow key={c.id} comment={c} onReply={setReplyingTo} postAuthorId={post.authorId} />)
        )}
      </ScrollView>
      <Composer
        placeholder={t.post.writeComment}
        onSend={onSend}
        replyingTo={
          replyingTo
            ? `${t.post.reply} ${(() => {
                const u = getUser(replyingTo.authorId);
                return u ? displayName(u) : t.common.neighbor;
              })()}`
            : undefined
        }
        onCancelReply={() => setReplyingTo(null)}
        cancelLabel={t.common.cancel}
      />
    </KeyboardAvoidingView>
  );
}
