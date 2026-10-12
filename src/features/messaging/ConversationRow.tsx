import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, useCurrentUserId } from '@/store/useStore';
import type { Conversation } from '@/models';
import { displayName, formatRelativeTime, localizeDigits } from '@/utils/format';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';

export function ConversationRow({ conversation }: { conversation: Conversation }) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();

  const me = useCurrentUserId();
  const otherUserId = conversation.participantIds.find((id) => id !== me);
  const otherUser = useStore((s) => s.getUser(otherUserId ?? ''));
  // Raw state + useMemo, not filter() inside the selector — see HomeHeader
  // for why (getSnapshot must return a stable reference across renders).
  const allMessages = useStore((s) => s.messages);
  const messages = useMemo(
    () => allMessages.filter((m) => m.conversationId === conversation.id),
    [allMessages, conversation.id],
  );
  const lastMessage = messages[messages.length - 1];
  const unreadCount = messages.filter((m) => m.senderId !== me && !m.readBy.includes(me)).length;
  const unread = unreadCount > 0;

  const title = conversation.isGroup ? (conversation.title ?? '') : otherUser ? displayName(otherUser) : t.common.neighbor;
  const contextLabel = !conversation.isGroup
    ? t.messages.contextNeighbor
    : conversation.eventId
      ? t.messages.contextEvent
      : t.messages.contextCommunity;

  return (
    <Pressable onPress={() => router.push(`/messages/${conversation.id}`)} style={[theme.row(), styles.row]} accessibilityRole="button">
      {conversation.isGroup ? (
        <View style={[styles.groupAvatar, { backgroundColor: theme.colors.backgroundAlt }]}>
          <Users size={20} color={theme.colors.primary} />
        </View>
      ) : (
        <Avatar uri={otherUser?.avatarUrl} name={title} size={50} />
      )}
      <View style={{ flex: 1 }}>
        <View style={[theme.row(), { justifyContent: 'space-between', alignItems: 'center' }]}>
          <View style={[theme.row(), { alignItems: 'center', gap: 6, flexShrink: 1 }]}>
            <Text style={theme.text('title')} numberOfLines={1}>
              {title}
            </Text>
            <Badge label={contextLabel} tone={conversation.isGroup ? (conversation.eventId ? 'primary' : 'info') : 'neutral'} />
          </View>
          <Text style={theme.text('caption', theme.colors.textMuted)}>{formatRelativeTime(lastMessage?.createdAt ?? conversation.lastMessageAt, locale)}</Text>
        </View>
        <View style={[theme.row(), { justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }]}>
          <Text style={theme.text('bodySmall', unread ? theme.colors.textPrimary : theme.colors.textMuted)} numberOfLines={1}>
            {lastMessage ? (lastMessage.image && !lastMessage.text ? `📷 ${t.messages.photo}` : lastMessage.text) : t.messages.noMessagesYet}
          </Text>
          {unread ? (
            <View style={[styles.badge, { backgroundColor: theme.colors.primary }]} accessibilityLabel={`${unreadCount} ${t.messages.unread}`}>
              <Text style={[theme.text('caption', theme.colors.onPrimary), { fontSize: 11 }]}>{localizeDigits(unreadCount > 99 ? '99+' : unreadCount, locale)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', gap: 12, paddingVertical: 10 },
  groupAvatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
});
