import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PartyPopper } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { haptics } from '@/utils/haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';

interface ThankSheetProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
}

export function ThankSheet({ visible, onClose, userId }: ThankSheetProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const thankUser = useStore((s) => s.thankUser);

  const reasons = [
    t.thanks.reasonHelpfulAdvice,
    t.thanks.reasonHelpedMe,
    t.thanks.reasonGreatOrganizer,
    t.thanks.reasonUsefulRecommendation,
    t.thanks.reasonGoodNeighbor,
  ];

  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const submit = () => {
    if (!selected) return;
    thankUser(userId, selected, message.trim() || undefined);
    haptics.success();
    setSent(true);
    setTimeout(() => {
      onClose();
      setSent(false);
      setSelected(null);
      setMessage('');
    }, 1100);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md }}>
        {sent ? (
          <View style={{ alignItems: 'center', paddingVertical: 26, gap: 8 }}>
            <PartyPopper size={32} color={theme.colors.primary} />
            <Text style={theme.text('title')}>{t.thanks.sentTitle}</Text>
            <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{t.thanks.sentBody}</Text>
          </View>
        ) : (
          <>
            <Text style={[theme.text('heading3'), { marginBottom: 12 }]}>{t.thanks.title}</Text>
            <View style={[theme.row(), styles.reasonGrid]}>
              {reasons.map((reason) => (
                <Pressable
                  key={reason}
                  onPress={() => setSelected(reason)}
                  style={[
                    styles.reasonChip,
                    {
                      borderColor: selected === reason ? theme.colors.primary : theme.colors.border,
                      backgroundColor: selected === reason ? theme.colors.successSurface : theme.colors.surface,
                      borderRadius: theme.radii.md,
                    },
                  ]}
                >
                  <Text style={theme.text('bodySmall', selected === reason ? theme.colors.primary : theme.colors.textPrimary)}>
                    {reason}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder={t.thanks.messagePlaceholder}
              placeholderTextColor={theme.colors.textMuted}
              style={[theme.text('bodySmall'), styles.messageInput, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}
              multiline
            />
            <View style={{ marginTop: 14 }}>
              <Button label={t.thanks.send} onPress={submit} disabled={!selected} fullWidth />
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  reasonGrid: { flexWrap: 'wrap', gap: 8 },
  reasonChip: { paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1.5 },
  messageInput: { borderWidth: StyleSheet.hairlineWidth, minHeight: 56, padding: 12, textAlignVertical: 'top', marginTop: 14 },
});
