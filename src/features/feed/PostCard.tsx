import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bookmark, Globe, Lock, Megaphone, MessageCircle, MoreHorizontal, Share2, ThumbsUp, TriangleAlert, Users } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, useCurrentUserId } from '@/store/useStore';
import { useUser } from '@/hooks/useNeighborhood';
import { useAction } from '@/hooks/useAction';
import { deletePost, toggleBlockUser, toggleReaction, toggleSavePost } from '@/backend/actions';
import type { Post } from '@/models';
import { displayName, formatRelativeTime } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { shareContent } from '@/utils/share';
import { links } from '@/config/links';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { IconButton } from '@/components/IconButton';
import { PhotoCarousel } from '@/features/social/PhotoCarousel';
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

  const me = useCurrentUserId();
  const author = useUser(post.authorId);
  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === post.neighborhoodId));
  const poll = useStore((s) => (post.type === 'poll' ? s.polls.find((p) => p.id === post.linkedEntityId) : undefined));
  const { run } = useAction();

  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const authorName = author ? displayName(author) : t.common.neighbor;
  const isOwn = post.authorId === me;
  const liked = post.reactions.some((r) => r.userId === me);
  const saved = post.savedBy.includes(me);
  const reactionType = post.type === 'alert' ? 'helpful' : 'like';

  const goToDetail = () => (onPress ? onPress() : router.push(`/post/${post.id}`));

  const like = () => {
    if (liked) return;
    haptics.light();
    run(() => toggleReaction(post.id, reactionType));
  };

  // Only public posts carry their text into other apps; everything else
  // shares a link that opens only for people allowed to see the post.
  const share = () =>
    shareContent(
      post.audience === 'public'
        ? { message: post.textAr, url: links.post(post.id) }
        : { message: t.social.sharePrivateNote, url: links.post(post.id) },
    );

  const AudienceIcon = post.audience === 'public' ? Globe : post.audience === 'followers' ? Lock : Users;
  const audienceLabel =
    post.audience === 'public'
      ? t.social.audiencePublic
      : post.audience === 'followers'
        ? t.social.audienceFollowers
        : t.social.audienceNeighbors;

  const menuItems: ActionSheetItem[] = isOwn
    ? [
        ...(post.type !== 'poll'
          ? [{ key: 'edit', label: t.social.editPost, onPress: () => router.push(`/post/edit/${post.id}`) }]
          : []),
        { key: 'delete', label: t.common.delete, destructive: true, onPress: () => setDeleteOpen(true) },
      ]
    : [
        { key: 'save', label: saved ? t.common.saved : t.common.save, onPress: () => run(() => toggleSavePost(post.id)) },
        { key: 'report', label: t.common.report, onPress: () => setReportOpen(true) },
        { key: 'block', label: t.common.block, destructive: true, onPress: () => run(() => toggleBlockUser(post.authorId)) },
      ];

  return (
    <>
      <Card onPress={goToDetail} accessibilityLabel={post.textAr} interactiveChildren>
        <View style={[theme.row(), styles.header]}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              if (author) router.push(`/profile/${author.id}`);
            }}
            accessibilityRole="button"
          >
            <Avatar uri={author?.avatarUrl} name={authorName} size={42} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={[theme.row(), { alignItems: 'center', gap: 4 }]}>
              <Text style={theme.text('title')} numberOfLines={1}>
                {authorName}
              </Text>
            </View>
            <View style={[theme.row(), { alignItems: 'center', gap: 4 }]}>
              <AudienceIcon size={11} color={theme.colors.textMuted} accessibilityLabel={audienceLabel} />
              <Text style={[theme.text('caption', theme.colors.textMuted), { flexShrink: 1 }]} numberOfLines={1}>
                {[post.locationLabel ?? (locale === 'ar' ? neighborhood?.nameAr : neighborhood?.nameEn), formatRelativeTime(post.createdAt, locale)]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
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
            {post.images.length > 0 ? (
              <View style={{ marginBottom: 8 }}>
                <PhotoCarousel images={post.images} onDoubleTapLike={like} aspectRatio={post.images.length > 1 ? 4 / 5 : 1} />
              </View>
            ) : null}
            {post.textAr ? <Text style={[theme.text('body'), styles.body]}>{post.textAr}</Text> : null}
          </>
        )}

        <View style={[theme.row(), styles.footer]}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              haptics.light();
              run(() => toggleReaction(post.id, reactionType));
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
              run(() => toggleSavePost(post.id));
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
              void share();
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
          setDeleteOpen(false);
          run(() => deletePost(post.id));
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
