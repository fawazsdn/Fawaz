import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { haptics } from '@/utils/haptics';
import type { ReportReason, ReportTargetType } from '@/models';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

interface ReportSheetProps {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  onSubmitted?: () => void;
}

const REASONS: ReportReason[] = [
  'spam',
  'scam',
  'harassment',
  'privacy_violation',
  'inappropriate',
  'misinformation',
  'impersonation',
  'other',
];

export function ReportSheet({ visible, onClose, targetType, targetId, onSubmitted }: ReportSheetProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const submitReport = useStore((s) => s.submitReport);
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    if (!selected) return;
    submitReport(targetType, targetId, selected, note.trim() || undefined);
    haptics.success();
    setSubmitted(true);
    setTimeout(() => {
      onSubmitted?.();
      onClose();
      setSubmitted(false);
      setSelected(null);
      setNote('');
    }, 900);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md }}>
        {submitted ? (
          <View style={{ paddingVertical: 30, alignItems: 'center' }}>
            <Text style={theme.text('title')}>{t.report.submitted}</Text>
          </View>
        ) : (
          <>
            <Text style={[theme.text('heading3'), { marginBottom: 12 }]}>{t.post.reportReasonTitle}</Text>
            {REASONS.map((reason) => (
              <Pressable
                key={reason}
                onPress={() => setSelected(reason)}
                style={[
                  theme.row(),
                  styles.row,
                  { borderColor: selected === reason ? theme.colors.primary : theme.colors.border, borderRadius: theme.radii.md },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: selected === reason }}
              >
                <View style={[styles.radioDot, { borderColor: selected === reason ? theme.colors.primary : theme.colors.border }]}>
                  {selected === reason ? <View style={[styles.radioInner, { backgroundColor: theme.colors.primary }]} /> : null}
                </View>
                <Text style={theme.text('body')}>{t.report.reasons[reason]}</Text>
              </Pressable>
            ))}
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t.common.optional}
              placeholderTextColor={theme.colors.textMuted}
              style={[theme.text('bodySmall'), styles.noteInput, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}
              multiline
            />
            <View style={{ marginTop: 14 }}>
              <Button label={t.common.submit} onPress={submit} disabled={!selected} fullWidth />
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 10, borderWidth: 1.5, marginBottom: 8 },
  radioDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 9, height: 9, borderRadius: 5 },
  noteInput: { borderWidth: StyleSheet.hairlineWidth, minHeight: 60, padding: 12, textAlignVertical: 'top', marginTop: 6 },
});
