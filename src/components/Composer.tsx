import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Send } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';
import { haptics } from '@/utils/haptics';

interface ComposerProps {
  placeholder: string;
  /** Resolve false to keep the draft (the send failed and may be retried). */
  onSend: (text: string) => void | boolean | Promise<void | boolean>;
  replyingTo?: string;
  onCancelReply?: () => void;
  cancelLabel?: string;
}

export function Composer({ placeholder, onSend, replyingTo, onCancelReply, cancelLabel }: ComposerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  // A ref, not just state: taps in the same frame must see the guard immediately.
  const inFlight = useRef(false);

  // The draft stays until the send is confirmed, so a failed send can be retried
  // (with the same operation id - see pendingOps.ts). Repeated taps are ignored.
  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || inFlight.current) return;
    inFlight.current = true;
    haptics.light();
    setSending(true);
    try {
      const ok = await onSend(trimmed);
      if (ok !== false) setText('');
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: insets.bottom + 8, backgroundColor: theme.colors.surfaceElevated, borderTopColor: theme.colors.divider },
      ]}
    >
      {replyingTo ? (
        <View style={[theme.row(), styles.replyBar, { backgroundColor: theme.colors.backgroundAlt }]}>
          <Text style={theme.text('caption', theme.colors.textSecondary)} numberOfLines={1}>
            {replyingTo}
          </Text>
          <Pressable onPress={onCancelReply}>
            <Text style={theme.text('caption', theme.colors.primary)}>{cancelLabel}</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={[theme.row(), styles.inputRow]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          style={[theme.text('body'), styles.input, { backgroundColor: theme.colors.backgroundAlt, borderRadius: theme.radii.pill }]}
          multiline
        />
        <Pressable
          onPress={submit}
          disabled={!text.trim() || sending}
          style={[styles.sendBtn, { backgroundColor: text.trim() ? theme.colors.primary : theme.colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="send"
          accessibilityState={{ disabled: !text.trim() || sending, busy: sending }}
          testID="composer-send"
        >
          <Send size={16} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 8 },
  replyBar: { alignItems: 'center', justifyContent: 'space-between', padding: 8, borderRadius: 8, marginBottom: 6 },
  inputRow: { alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, maxHeight: 100, paddingHorizontal: 14, paddingVertical: 10 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
