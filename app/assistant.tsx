import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { assistantService } from '@/services';
import { AppHeader } from '@/components/AppHeader';

interface ChatMessage {
  id: string;
  fromUser: boolean;
  text: string;
}

export default function AssistantScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const neighborhoodId = useStore((s) => s.session.neighborhoodId);
  const listRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);

  const suggestions = [
    t.assistant.suggestion1,
    t.assistant.suggestion2,
    t.assistant.suggestion3,
    t.assistant.suggestion4,
    t.assistant.suggestion5,
  ];

  const ask = async (query: string) => {
    if (!query.trim() || !neighborhoodId) return;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, fromUser: true, text: query }]);
    setInput('');
    setThinking(true);
    const answer = await assistantService.ask(query, neighborhoodId);
    setThinking(false);
    setMessages((prev) => [...prev, { id: `a-${Date.now()}`, fromUser: false, text: answer }]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <AppHeader title={t.assistant.title} fallbackRoute="/(tabs)/discover" />
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: theme.spacing.md, flexGrow: 1 }}
        renderItem={({ item }) => (
          <View style={{ alignSelf: item.fromUser ? 'flex-end' : 'flex-start', maxWidth: '82%', marginBottom: 10 }}>
            <View
              style={[
                styles.bubble,
                {
                  backgroundColor: item.fromUser ? theme.colors.primary : theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.lg,
                },
              ]}
            >
              <Text style={theme.text('body', item.fromUser ? theme.colors.onPrimary : theme.colors.textPrimary)}>{item.text}</Text>
            </View>
          </View>
        )}
        ListHeaderComponent={
          messages.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 30, gap: 14 }}>
              <View style={[styles.iconWrap, { backgroundColor: theme.colors.successSurface }]}>
                <Sparkles size={26} color={theme.colors.primary} />
              </View>
              <Text style={theme.text('title')}>{t.assistant.title}</Text>
              <View style={{ gap: 8, width: '100%' }}>
                {suggestions.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => ask(s)}
                    style={[styles.suggestion, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}
                  >
                    <Text style={theme.text('bodySmall')}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null
        }
        ListFooterComponent={
          thinking ? (
            <View
              style={[
                styles.bubble,
                {
                  alignSelf: 'flex-start',
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.lg,
                },
              ]}
            >
              <Text style={theme.text('bodySmall', theme.colors.textMuted)}>{t.common.loading}</Text>
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
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={t.assistant.placeholder}
          placeholderTextColor={theme.colors.textMuted}
          onSubmitEditing={() => ask(input)}
          style={[theme.text('body'), styles.input, { backgroundColor: theme.colors.backgroundAlt, borderRadius: theme.radii.pill }]}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubble: { padding: 12, borderWidth: 1 },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  suggestion: { padding: 12, borderWidth: 1 },
  composer: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 8 },
  input: { paddingHorizontal: 16, paddingVertical: 12 },
});
