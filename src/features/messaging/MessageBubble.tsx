import { Image, StyleSheet, Text, View } from 'react-native';
import { Check, CheckCheck } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import type { Message } from '@/models';
import { formatClock } from '@/utils/format';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  read: boolean;
  showTail: boolean;
}

export function MessageBubble({ message, isOwn, read, showTail }: MessageBubbleProps) {
  const theme = useTheme();
  const { locale, isRTL } = useI18n();

  const alignSelf = isOwn ? (isRTL ? 'flex-start' : 'flex-end') : isRTL ? 'flex-end' : 'flex-start';

  return (
    <View style={{ alignSelf, maxWidth: '78%', marginBottom: showTail ? 10 : 3 }}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isOwn ? theme.colors.primary : theme.colors.surface,
            borderColor: isOwn ? theme.colors.primary : theme.colors.border,
            borderRadius: theme.radii.lg,
          },
        ]}
      >
        {message.image ? <Image source={{ uri: message.image }} style={styles.image} /> : null}
        {message.text ? (
          <Text style={theme.text('body', isOwn ? theme.colors.onPrimary : theme.colors.textPrimary)}>{message.text}</Text>
        ) : null}
      </View>
      {showTail ? (
        <View style={[theme.row(), { gap: 4, marginTop: 3, justifyContent: isOwn ? (isRTL ? 'flex-start' : 'flex-end') : 'flex-start' }]}>
          <Text style={theme.text('caption', theme.colors.textMuted)}>{formatClock(message.createdAt, locale)}</Text>
          {isOwn ? read ? <CheckCheck size={13} color={theme.colors.primary} /> : <Check size={13} color={theme.colors.textMuted} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { paddingVertical: 9, paddingHorizontal: 13, borderWidth: StyleSheet.hairlineWidth },
  image: { width: 180, height: 180, borderRadius: 10, marginBottom: 4 },
});
