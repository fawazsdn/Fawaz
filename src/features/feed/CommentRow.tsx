import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, MoreHorizontal } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
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
  const author = useStore((s) => s.getUser(comment.authorId));
  const toggleCommentLike = useStore((s) => s.toggleCommentLike);
  const editComment = useStore((s) => s.editComment);
  const deleteComment = useStore((s) => s.deleteComment);

  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.textAr);

  if (!author) return null;
  const isOwn = comment.authorId === CURRENT_USER_ID;
  const liked = comment.likedBy.includes(CURRENT_USER_ID);

  const menuItems: ActionSheetItem[] = isOwn
    ? [
        { key: 'edit', label: t.common.edit, onPress: () => setEditing(true) },
        { key: 'delete', label: t.common.delete, destructive: true, onPress: () => setDeleteOpen(true) },
      ]
    : [{ key: 'report', label: t.common.report, onPress: () => {} }];

  return (
    <View style={[theme.row(), styles.wrap]}>
      <Pressable onPress={() => router.push(`/profile/${author.id}`)}>
        <Avatar uri={author.avatarUrl} name={displayName(author)} size={32} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <View style={[styles.bubble, { backgroundColor: theme.colors.backgroundAlt, borderRadius: theme.radii.md }]}>
          <View style={[theme.row(), { alignItems: 'center', gap: 6 }]}>
            <Text style={theme.text('bodySmall')}>{displayName(author)}</Text>
          </View>
          {editing ? (
            <View style={{ marginTop: 4 }}>
              <TextInput value={draft} onChangeText={setDraft} style={[theme.text('bodySmall'), { minHeight: 36 }]} multiline autoFocus />
              <View style={[theme.row(), { gap: 12, marginTop: 6 }]}>
                <Text
                  onPress={() => {
                    editComment(comment.id, draft.trim() || comment.textAr);
                    setEditing(false);
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
          <Pressable onPress={() => toggleCommentLike(comment.id)} style={[theme.row(), { alignItems: 'center', gap: 3 }]}>
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
      <ConfirmationModal
        visible={deleteOpen}
        title={t.common.delete}
        destructive
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          deleteComment(comment.id);
          setDeleteOpen(false);
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
