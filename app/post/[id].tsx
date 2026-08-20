import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
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

  const post = useStore((s) => s.posts.find((p) => p.id === id));
  const comments = useStore((s) => s.comments.filter((c) => c.postId === id).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)));
  const addComment = useStore((s) => s.addComment);
  const getUser = useStore((s) => s.getUser);

  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

  if (!post) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={t.post.commentsTitle} />
        <EmptyState title={t.errors.genericTitle} />
      </View>
    );
  }

  const onSend = (text: string) => {
    addComment(post.id, text, replyingTo?.id);
    setReplyingTo(null);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
      <AppHeader title={t.post.commentsTitle} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md }}>
        <PostCard post={post} onPress={() => {}} />
        <Text style={[theme.text('title'), { marginTop: 20, marginBottom: 4 }]}>
          {t.post.commentsTitle} {comments.length > 0 ? `(${comments.length})` : ''}
        </Text>
        {comments.length === 0 ? (
          <EmptyState title={t.post.noComments} compact />
        ) : (
          comments.map((c) => <CommentRow key={c.id} comment={c} onReply={setReplyingTo} />)
        )}
      </ScrollView>
      <Composer
        placeholder={t.post.writeComment}
        onSend={onSend}
        replyingTo={replyingTo ? `${t.post.reply} ${displayName(getUser(replyingTo.authorId) ?? { firstName: '', lastName: '', namePrivacy: 'first_only' })}` : undefined}
        onCancelReply={() => setReplyingTo(null)}
        cancelLabel={t.common.cancel}
      />
    </KeyboardAvoidingView>
  );
}
