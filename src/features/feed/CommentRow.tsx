import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, MoreHorizontal } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useCurrentUserId } from '@/store/useStore';
import { useUser } from '@/hooks/useNeighborhood';
import { useAction } from '@/hooks/useAction';
import { deleteComment, editComment, toggleCommentLike } from '@/backend/actions';
import { ReportSheet } from '@/components/ReportSheet';
import type { Comment } from '@/models';
import { displayName, formatRelativeTime } from '@/utils/format';
import { Avatar } from '@/components/Avatar';
import { ActionSheet, type ActionSheetItem } from '@/components/ActionSheet';
import { ConfirmationModal } from '@/components/ConfirmationModal';

interface CommentRowProps {
  comment: Comment;
  onReply: (comment: Comment) => void;
}

export function CommentRow({ comment, onReply }: CommentRowProps) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const me = useCurrentUserId();
  const author = useUser(comment.authorId);
  const { run } = useAction();
  const [reportOpen, setReportOpen] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.textAr);

  const authorName = author ? displayName(author) : t.common.neighbor;
  const isOwn = comment.authorId === me;
  const liked = comment.likedBy.includes(me);

  const menuItems: ActionSheetItem[] = isOwn
    ? [
        { key: 'edit', label: t.common.edit, onPress: () => setEditing(true) },
        { key: 'delete', label: t.common.delete, destructive: true, onPress: () => setDeleteOpen(true) },
      ]
    : [{ key: 'report', label: t.common.report, onPress: () => setReportOpen(true) }];

  return (
    <View style={[theme.row(), styles.wrap]}>
      <Pressable onPress={() => author && router.push(`/profile/${author.id}`)}>
        <Avatar uri={author?.avatarUrl} name={authorName} size={32} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <View style={[styles.bubble, { backgroundColor: theme.colors.backgroundAlt, borderRadius: theme.radii.md }]}>
          <View style={[theme.row(), { alignItems: 'center', gap: 6 }]}>
            <Text style={theme.text('bodySmall')}>{authorName}</Text>
          </View>
          {editing ? (
            <View style={{ marginTop: 4 }}>
              <TextInput value={draft} onChangeText={setDraft} style={[theme.text('bodySmall'), { minHeight: 36 }]} multiline autoFocus />
              <View style={[theme.row(), { gap: 12, marginTop: 6 }]}>
                <Text
                  onPress={() => {
                    const text = draft.trim();
                    setEditing(false);
                    if (text && text !== comment.textAr) run(() => editComment(comment.id, comment.postId, text));
                  }}
                  style={theme.text('caption', theme.colors.primary)}
                >
                  {t.common.save}
                </Text>
                <Text onPress={() => setEditing(false)} style={theme.text('caption', theme.colors.textMuted)}>
                  {t.common.cancel}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={[theme.text('bodySmall'), { marginTop: 2 }]}>{comment.textAr}</Text>
          )}
        </View>
        <View style={[theme.row(), styles.metaRow]}>
          <Text style={theme.text('caption', theme.colors.textMuted)}>
            {formatRelativeTime(comment.createdAt, locale)}
            {comment.edited ? ` · ${t.common.edit}` : ''}
          </Text>
          <Pressable onPress={() => onReply(comment)}>
            <Text style={theme.text('caption', theme.colors.textSecondary)}>{t.post.reply}</Text>
          </Pressable>
          <Pressable
            onPress={() => run(() => toggleCommentLike(comment.id, comment.postId))}
            style={[theme.row(), { alignItems: 'center', gap: 3 }]}
          >
            <Heart
              size={12}
              color={liked ? theme.colors.danger : theme.colors.textMuted}
              fill={liked ? theme.colors.danger : 'transparent'}
            />
            {comment.likedBy.length > 0 ? (
              <Text style={theme.text('caption', theme.colors.textMuted)}>{comment.likedBy.length}</Text>
            ) : null}
          </Pressable>
        </View>
      </View>
      <Pressable onPress={() => setMenuOpen(true)} hitSlop={8}>
        <MoreHorizontal size={16} color={theme.colors.textMuted} />
      </Pressable>

      <ActionSheet visible={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />
      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} targetType="comment" targetId={comment.id} />
      <ConfirmationModal
        visible={deleteOpen}
        title={t.common.delete}
        destructive
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false);
          run(() => deleteComment(comment.id, comment.postId));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, paddingVertical: 8, alignItems: 'flex-start' },
  bubble: { padding: 10 },
  metaRow: { gap: 14, marginTop: 4, paddingHorizontal: 2, alignItems: 'center' },
});
