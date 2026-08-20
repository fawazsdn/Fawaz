import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { Button } from './Button';

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({ visible, title, body, confirmLabel, cancelLabel, destructive, onConfirm, onCancel }: ConfirmationModalProps) {
  const theme = useTheme();
  const { t } = useI18n();
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="dismiss" />
        <View style={[styles.card, { backgroundColor: theme.colors.surfaceElevated, borderRadius: theme.radii.lg }]}>
          <Text style={[theme.text('heading3'), styles.center]}>{title}</Text>
          {body ? <Text style={[theme.text('bodySmall', theme.colors.textSecondary), styles.center, { marginTop: 6 }]}>{body}</Text> : null}
          <View style={{ height: theme.spacing.lg }} />
          <View style={{ gap: 10 }}>
            <Button label={confirmLabel ?? t.common.confirm} variant={destructive ? 'danger' : 'primary'} onPress={onConfirm} fullWidth />
            <Button label={cancelLabel ?? t.common.cancel} variant="ghost" onPress={onCancel} fullWidth />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, padding: 22 },
  center: { textAlign: 'center' },
});
