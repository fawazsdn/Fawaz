import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Calendar, ImagePlus, Send, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import { displayName } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { MessageBubble } from '@/features/messaging/MessageBubble';

const CANNED_REPLIES = ['تمام 👍', 'إن شاء الله', 'حياك الله', 'أوكي، بشوفك هناك', 'تسلم عالخبر'];

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);

  const conversation = useStore((s) => s.conversations.find((c) => c.id === id));
  // Raw state + useMemo, not filter()/sort() inside the selector — see
  // src/features/home/HomeHeader.tsx for why.
  const allMessages = useStore((s) => s.messages);
  const messages = useMemo(
    () => allMessages.filter((m) => m.conversationId === id).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [allMessages, id],
  );
  const otherUserId = conversation?.participantIds.find((p) => p !== CURRENT_USER_ID);
  const otherUser = useStore((s) => s.getUser(otherUserId ?? ''));
  const event = useStore((s) => s.events.find((e) => e.id === conversation?.eventId));
  const sendMessage = useStore((s) => s.sendMessage);
  const simulateIncoming = useStore((s) => s.simulateIncomingMessage);
  const markConversationRead = useStore((s) => s.markConversationRead);

  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (id) markConversationRead(id);
  }, [id, markConversationRead]);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
  }, [messages.length]);

  if (!conversation) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="" />
        <EmptyState title={t.errors.genericTitle} />
      </View>
    );
  }

  const title = conversation.isGroup ? (conversation.title ?? '') : otherUser ? displayName(otherUser) : '';

  const onSend = (msgText: string, image?: string) => {
    sendMessage(conversation.id, msgText, image);
    setText('');
    if (!conversation.isGroup && otherUserId) {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        const reply = CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)] ?? CANNED_REPLIES[0]!;
        simulateIncoming(conversation.id, otherUserId, reply);
      }, 1600);
    }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) onSend('', result.assets[0].uri);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <AppHeader
        title={title}
        right={
          conversation.isGroup ? (
            <Users size={19} color={theme.colors.textMuted} />
          ) : otherUser ? (
            <Avatar uri={otherUser.avatarUrl} name={title} size={32} />
          ) : undefined
        }
      />

      {conversation.isGroup && event ? (
        <Pressable
          onPress={() => router.push(`/event/${event.id}`)}
          style={[theme.row(), styles.eventBanner, { backgroundColor: theme.colors.backgroundAlt }]}
        >
          <Calendar size={14} color={theme.colors.primary} />
          <Text style={theme.text('caption', theme.colors.primary)}>{t.messages.backToEvent}</Text>
        </Pressable>
      ) : null}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: theme.spacing.md, flexGrow: 1 }}
        renderItem={({ item, index }) => {
          const next = messages[index + 1];
          const showTail = !next || next.senderId !== item.senderId;
          return (
            <MessageBubble message={item} isOwn={item.senderId === CURRENT_USER_ID} read={item.readBy.length > 1} showTail={showTail} />
          );
        }}
        ListFooterComponent={
          typing ? (
            <View style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginTop: 4 }}>
              <View
                style={[
                  styles.typingBubble,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
                ]}
              >
                <Text style={theme.text('caption', theme.colors.textMuted)}>{t.messages.typing}</Text>
              </View>
            </View>
          ) : null
        }
      />

      <View
        style={[
          styles.composer,
          { paddingBottom: insets.bottom + 8, backgroundColor: theme.colors.surfaceElevated, borderTopColor: theme.colors.divider },
        ]}
      >
        <View style={[theme.row(), { alignItems: 'flex-end', gap: 8 }]}>
          <Pressable onPress={pickImage} hitSlop={8} style={styles.imgBtn} accessibilityRole="button" accessibilityLabel={t.post.addImages}>
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
            disabled={!text.trim()}
            style={[styles.sendBtn, { backgroundColor: text.trim() ? theme.colors.primary : theme.colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="send"
          >
            <Send size={16} color="#fff" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  eventBanner: { alignItems: 'center', gap: 6, paddingVertical: 8, justifyContent: 'center' },
  typingBubble: { paddingVertical: 8, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 8 },
  imgBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  inputWrap: {},
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
