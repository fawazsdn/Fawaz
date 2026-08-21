import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bookmark, Megaphone, MessageCircle, MoreHorizontal, Share2, ThumbsUp, TriangleAlert } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import type { Post } from '@/models';
import { displayName, formatRelativeTime } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { shareContent } from '@/utils/share';
import { links } from '@/config/links';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { IconButton } from '@/components/IconButton';
import { ImageGallery } from '@/components/ImageGallery';
import { ActionSheet, type ActionSheetItem } from '@/components/ActionSheet';
import { ReportSheet } from '@/components/ReportSheet';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { PollBlock } from '@/features/polls/PollBlock';

interface PostCardProps {
  post: Post;
  onPress?: () => void;
}

export function PostCard({ post, onPress }: PostCardProps) {
  const theme = useTheme();
  const { t, locale, isRTL } = useI18n();
  const router = useRouter();

  const author = useStore((s) => s.getUser(post.authorId));
  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === post.neighborhoodId));
  const poll = useStore((s) => (post.type === 'poll' ? s.polls.find((p) => p.id === post.linkedEntityId) : undefined));
  const toggleReaction = useStore((s) => s.toggleReaction);
  const toggleSavePost = useStore((s) => s.toggleSavePost);
  const deletePost = useStore((s) => s.deletePost);
  const toggleBlockUser = useStore((s) => s.toggleBlockUser);

  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!author) return null;

  const isOwn = post.authorId === CURRENT_USER_ID;
  const liked = post.reactions.some((r) => r.userId === CURRENT_USER_ID);
  const saved = post.savedBy.includes(CURRENT_USER_ID);
  const reactionType = post.type === 'alert' ? 'helpful' : 'like';

  const goToDetail = () => (onPress ? onPress() : router.push(`/post/${post.id}`));

  const menuItems: ActionSheetItem[] = isOwn
    ? [{ key: 'delete', label: t.common.delete, destructive: true, onPress: () => setDeleteOpen(true) }]
    : [
        { key: 'save', label: saved ? t.common.saved : t.common.save, onPress: () => toggleSavePost(post.id) },
        { key: 'report', label: t.common.report, onPress: () => setReportOpen(true) },
        { key: 'hide', label: t.common.hide, onPress: () => {} },
        { key: 'block', label: t.common.block, destructive: true, onPress: () => toggleBlockUser(post.authorId) },
      ];

  return (
    <>
      <Card onPress={goToDetail} accessibilityLabel={post.textAr} interactiveChildren>
        <View style={[theme.row(), styles.header]}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              router.push(`/profile/${author.id}`);
            }}
            accessibilityRole="button"
          >
            <Avatar uri={author.avatarUrl} name={displayName(author)} size={42} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={[theme.row(), { alignItems: 'center', gap: 4 }]}>
              <Text style={theme.text('title')} numberOfLines={1}>
                {displayName(author)}
              </Text>
            </View>
            <Text style={theme.text('caption', theme.colors.textMuted)} numberOfLines={1}>
              {locale === 'ar' ? neighborhood?.nameAr : neighborhood?.nameEn} · {formatRelativeTime(post.createdAt, locale)}
            </Text>
          </View>
          <IconButton
            accessibilityLabel="more"
            onPress={(e) => {
              e.stopPropagation?.();
              setMenuOpen(true);
            }}
          >
            <MoreHorizontal size={19} color={theme.colors.textMuted} />
          </IconButton>
        </View>

        {post.type === 'announcement' || post.type === 'alert' ? (
          <View style={{ marginBottom: 8 }}>
            <Badge
              label={post.type === 'announcement' ? t.create.post : t.notifications.title}
              tone={post.type === 'alert' ? 'warning' : 'info'}
              icon={
                post.type === 'alert' ? (
                  <TriangleAlert size={12} color={theme.colors.warning} />
                ) : (
                  <Megaphone size={12} color={theme.colors.info} />
                )
              }
            />
          </View>
        ) : null}

        {post.type === 'poll' && poll ? (
          <PollBlock poll={poll} />
        ) : (
          <>
            {post.textAr ? <Text style={[theme.text('body'), styles.body]}>{post.textAr}</Text> : null}
            {post.images.length > 0 ? (
              <View style={{ marginTop: 8 }}>
                <ImageGallery images={post.images} />
              </View>
            ) : null}
          </>
        )}

        <View style={[theme.row(), styles.footer]}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              haptics.light();
              toggleReaction(post.id, reactionType);
            }}
            style={[theme.row(), styles.footerBtn]}
            accessibilityRole="button"
          >
            <ThumbsUp
              size={17}
              color={liked ? theme.colors.primary : theme.colors.textMuted}
              fill={liked ? theme.colors.primary : 'transparent'}
            />
            <Text style={theme.text('bodySmall', liked ? theme.colors.primary : theme.colors.textMuted)}>
              {post.reactions.length || ''}
            </Text>
          </Pressable>

          <Pressable onPress={goToDetail} style={[theme.row(), styles.footerBtn]} accessibilityRole="button">
            <MessageCircle size={17} color={theme.colors.textMuted} />
            <Text style={theme.text('bodySmall', theme.colors.textMuted)}>{post.commentCount || ''}</Text>
          </Pressable>

          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              toggleSavePost(post.id);
            }}
            style={[theme.row(), styles.footerBtn]}
            accessibilityRole="button"
          >
            <Bookmark
              size={17}
              color={saved ? theme.colors.primary : theme.colors.textMuted}
              fill={saved ? theme.colors.primary : 'transparent'}
            />
          </Pressable>

          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              shareContent({ message: post.textAr, url: links.post(post.id) });
            }}
            style={[theme.row(), styles.footerBtn, isRTL ? { marginRight: 'auto' } : { marginLeft: 'auto' }]}
            accessibilityRole="button"
          >
            <Share2 size={17} color={theme.colors.textMuted} />
          </Pressable>
        </View>
      </Card>

      <ActionSheet visible={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />
      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} targetType="post" targetId={post.id} />
      <ConfirmationModal
        visible={deleteOpen}
        title={t.post.deletePostConfirm}
        destructive
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          deletePost(post.id);
          setDeleteOpen(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 10, marginBottom: 10 },
  body: { marginBottom: 4 },
  footer: { alignItems: 'center', gap: 22, marginTop: 12 },
  footerBtn: { alignItems: 'center', gap: 6 },
});
