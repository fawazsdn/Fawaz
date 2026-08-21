import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import type { Conversation } from '@/models';
import { displayName, formatRelativeTime } from '@/utils/format';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';

export function ConversationRow({ conversation }: { conversation: Conversation }) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();

  const otherUserId = conversation.participantIds.find((id) => id !== CURRENT_USER_ID);
  const otherUser = useStore((s) => s.getUser(otherUserId ?? ''));
  // Raw state + useMemo, not filter() inside the selector — see HomeHeader
  // for why (getSnapshot must return a stable reference across renders).
  const allMessages = useStore((s) => s.messages);
  const messages = useMemo(
    () => allMessages.filter((m) => m.conversationId === conversation.id),
    [allMessages, conversation.id],
  );
  const lastMessage = messages[messages.length - 1];
  const unread = messages.some((m) => m.senderId !== CURRENT_USER_ID && !m.readBy.includes(CURRENT_USER_ID));

  const title = conversation.isGroup ? (conversation.title ?? '') : otherUser ? displayName(otherUser) : '';
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
          {lastMessage ? (
            <Text style={theme.text('caption', theme.colors.textMuted)}>{formatRelativeTime(lastMessage.createdAt, locale)}</Text>
          ) : null}
        </View>
        <View style={[theme.row(), { justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }]}>
          <Text style={theme.text('bodySmall', unread ? theme.colors.textPrimary : theme.colors.textMuted)} numberOfLines={1}>
            {lastMessage?.image ? '📷 صورة' : lastMessage?.text}
          </Text>
          {unread ? <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', gap: 12, paddingVertical: 10 },
  groupAvatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
