import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, ImagePlus, Lock, Send, Shield, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, useCurrentUserId } from '@/store/useStore';
import { useAction } from '@/hooks/useAction';
import { hideClubMessage, markConversationRead, sendMessage } from '@/backend/actions';
import { useImagePicker } from '@/components/imageEditor/useImagePicker';
import { SkeletonCardRow } from '@/components/Skeleton';
import { displayName } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { MessageBubble } from '@/features/messaging/MessageBubble';
import { ActionSheet } from '@/components/ActionSheet';
import { ReportSheet } from '@/components/ReportSheet';
import type { Message } from '@/models';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const me = useCurrentUserId();
  const { run, pending: sending } = useAction();
  const { pickImage: pickEdited, editor } = useImagePicker({ aspects: ['original', 'square', 'portrait', 'wide'] });
  const syncStatus = useStore((s) => s.sync.status);

  const conversation = useStore((s) => s.conversations.find((c) => c.id === id));
  // Raw state + useMemo, not filter()/sort() inside the selector — see
  // src/features/home/HomeHeader.tsx for why.
  const allMessages = useStore((s) => s.messages);
  const messages = useMemo(
    () => allMessages.filter((m) => m.conversationId === id).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [allMessages, id],
  );
  const otherUserId = conversation?.participantIds.find((p) => p !== me);
  const otherUser = useStore((s) => s.getUser(otherUserId ?? ''));
  const otherUserNeighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === otherUser?.neighborhoodId));
  const event = useStore((s) => s.events.find((e) => e.id === conversation?.eventId));
  const club = useStore((s) => (conversation?.groupId ? s.clubs.find((c) => c.id === conversation.groupId) : undefined));
  const managesClub = useStore((s) =>
    conversation?.groupId
      ? s.clubMemberships.some(
          (m) =>
            m.clubId === conversation.groupId && m.userId === me && m.status === 'active' && (m.role === 'owner' || m.role === 'moderator'),
        )
      : false,
  );
  const users = useStore((s) => s.users);
  const [actionsFor, setActionsFor] = useState<Message | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);

  const [text, setText] = useState('');
  const unreadFromOthers = messages.some((m) => m.senderId !== me && !m.readBy.includes(me));

  // Mark read on open and whenever new messages from others arrive (realtime).
  useEffect(() => {
    if (id && conversation && unreadFromOthers) void markConversationRead(id).catch(() => {});
  }, [id, conversation, unreadFromOthers]);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
  }, [messages.length]);

  if (!conversation) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="" fallbackRoute="/messages" />
        {syncStatus === 'loading' ? (
          <View style={{ padding: theme.spacing.md }}>
            <SkeletonCardRow count={2} />
          </View>
        ) : (
          <EmptyState title={t.errors.genericTitle} body={t.errors.genericBody} />
        )}
      </View>
    );
  }

  const title = club
    ? club.name
    : conversation.isGroup
      ? (conversation.title ?? '')
      : otherUser
        ? displayName(otherUser)
        : t.common.neighbor;
  // Suspended / archived clubs: history stays readable, the server refuses new messages.
  const readOnly = !!conversation.groupId && (!club || club.reviewStatus !== 'approved');
  const senderOf = (uid: string) => {
    const u = users.find((x) => x.id === uid);
    return { name: u ? displayName(u) : t.common.neighbor, avatarUrl: u?.avatarUrl };
  };

  const onSend = async (msgText: string, image?: string) => {
    const draft = msgText;
    setText('');
    const res = await run(() => sendMessage(conversation.id, draft, image));
    if (!res.ok) setText(draft);
  };

  const pickImage = async () => {
    const uri = await pickEdited();
    if (uri) onSend(text.trim(), uri);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <AppHeader
        title={title}
        fallbackRoute="/messages"
        right={
          conversation.isGroup ? (
            <Users size={19} color={theme.colors.textMuted} />
          ) : otherUser ? (
            <Avatar uri={otherUser.avatarUrl} name={title} size={32} />
          ) : undefined
        }
      />

      {club ? (
        <Pressable
          onPress={() => router.push(`/clubs/${club.id}`)}
          style={[theme.row(), styles.eventBanner, { backgroundColor: theme.colors.backgroundAlt }]}
          accessibilityRole="link"
        >
          <Shield size={14} color={theme.colors.primary} />
          <Text style={theme.text('caption', theme.colors.primary)}>{t.clubs.viewClub}</Text>
        </Pressable>
      ) : conversation.isGroup && event ? (
        <Pressable
          onPress={() => router.push(`/event/${event.id}`)}
          style={[theme.row(), styles.eventBanner, { backgroundColor: theme.colors.backgroundAlt }]}
        >
          <Calendar size={14} color={theme.colors.primary} />
          <Text style={theme.text('caption', theme.colors.primary)}>{t.messages.backToEvent}</Text>
        </Pressable>
      ) : !conversation.isGroup && otherUserNeighborhood ? (
        <View style={{ paddingBottom: 8 }}>
          <Text style={[theme.text('caption', theme.colors.textMuted), { textAlign: 'center' }]}>
            {locale === 'ar' ? otherUserNeighborhood.nameAr : otherUserNeighborhood.nameEn}
          </Text>
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: theme.spacing.md, flexGrow: 1 }}
        renderItem={({ item, index }) => {
          const next = messages[index + 1];
          const prev = messages[index - 1];
          const showTail = !next || next.senderId !== item.senderId;
          const isOwn = item.senderId === me;
          return (
            <MessageBubble
              message={item}
              isOwn={isOwn}
              read={item.readBy.length > 1}
              showTail={showTail}
              sender={conversation.isGroup ? senderOf(item.senderId) : undefined}
              showSender={!prev || prev.senderId !== item.senderId}
              onLongPress={!isOwn || managesClub ? () => setActionsFor(item) : undefined}
            />
          );
        }}
        keyboardDismissMode="interactive"
        ListEmptyComponent={<EmptyState title={t.messages.startConversation} compact />}
      />

      {readOnly ? (
        <View style={[theme.row(), styles.readOnly, { paddingBottom: insets.bottom + 10, backgroundColor: theme.colors.backgroundAlt }]}>
          <Lock size={14} color={theme.colors.textMuted} />
          <Text style={[theme.text('caption', theme.colors.textMuted), { flex: 1 }]}>
            {club ? t.clubs.statusNotice[club.reviewStatus] || t.clubs.errors.club_unavailable : t.clubs.errors.club_unavailable}
          </Text>
        </View>
      ) : (
        <View
          style={[
            styles.composer,
            { paddingBottom: insets.bottom + 8, backgroundColor: theme.colors.surfaceElevated, borderTopColor: theme.colors.divider },
          ]}
        >
          <View style={[theme.row(), { alignItems: 'flex-end', gap: 8 }]}>
            <Pressable
              onPress={pickImage}
              hitSlop={8}
              style={styles.imgBtn}
              accessibilityRole="button"
              accessibilityLabel={t.post.addImages}
            >
              <ImagePlus size={20} color={theme.colors.primary} />
            </Pressable>
            <View style={[styles.inputWrap, { backgroundColor: theme.colors.backgroundAlt, borderRadius: theme.radii.pill, flex: 1 }]}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={t.messages.composerPlaceholder}
                placeholderTextColor={theme.colors.textMuted}
                style={[theme.text('body'), { paddingHorizontal: 14, paddingVertical: 10, maxHeight: 100 }]}
                multiline
              />
            </View>
            <Pressable
              onPress={() => text.trim() && onSend(text.trim())}
              disabled={!text.trim() || sending}
              style={[styles.sendBtn, { backgroundColor: text.trim() ? theme.colors.primary : theme.colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t.messages.send}
            >
              <Send size={16} color={text.trim() ? theme.colors.onPrimary : theme.colors.textMuted} />
            </Pressable>
          </View>
        </View>
      )}
      <ActionSheet
        visible={actionsFor !== null}
        onClose={() => setActionsFor(null)}
        items={[
          ...(actionsFor && actionsFor.senderId !== me
            ? [{ key: 'report', label: t.common.report, onPress: () => setReportId(actionsFor.id) }]
            : []),
          ...(actionsFor && managesClub
            ? [{ key: 'hide', label: t.clubs.hideMessage, destructive: true, onPress: () => run(() => hideClubMessage(actionsFor.id)) }]
            : []),
        ].map((i) => ({
          ...i,
          onPress: () => {
            setActionsFor(null);
            i.onPress();
          },
        }))}
      />
      <ReportSheet visible={reportId !== null} onClose={() => setReportId(null)} targetType="message" targetId={reportId ?? ''} />
      {editor}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  eventBanner: { alignItems: 'center', gap: 6, paddingVertical: 8, justifyContent: 'center' },
  readOnly: { alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 8 },
  imgBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  inputWrap: {},
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
