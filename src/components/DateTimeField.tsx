import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Calendar, Clock } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { formatClock, formatDay } from '@/utils/format';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

export const SAUDI_TZ = 'Asia/Riyadh';

interface Props {
  label: string;
  mode: 'date' | 'time';
  value: Date;
  onChange: (d: Date) => void;
  minimumDate?: Date;
}

/**
 * Native date/time picker field. Always shown and picked in Saudi time
 * (Asia/Riyadh) with a 12-hour clock ("7:00 PM" / "٧:٠٠ م"); the value is a
 * real instant, stored as UTC by Supabase — formatting never changes it.
 */
export function DateTimeField({ label, mode, value, onChange, minimumDate }: Props) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const display = mode === 'date' ? formatDay(value.toISOString(), locale) : formatClock(value.toISOString(), locale);
  const Icon = mode === 'date' ? Calendar : Clock;

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode,
        is24Hour: false,
        minimumDate,
        timeZoneName: SAUDI_TZ,
        onChange: (e, d) => {
          if (e.type === 'set' && d) onChange(d);
        },
      });
      return;
    }
    setDraft(value);
    setOpen(true);
  };

  return (
    <>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${display}`}
        style={[theme.row(), styles.field, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, borderRadius: theme.radii.md }]}
      >
        <Icon size={16} color={theme.colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={theme.text('caption', theme.colors.textMuted)}>{label}</Text>
          <Text style={theme.text('body')}>{display}</Text>
        </View>
      </Pressable>
      {Platform.OS === 'ios' ? (
        <BottomSheet visible={open} onClose={() => setOpen(false)}>
          <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md }}>
            <Text style={[theme.text('heading3'), { marginBottom: 8 }]}>{label}</Text>
            <DateTimePicker
              value={draft}
              mode={mode}
              display={mode === 'date' ? 'inline' : 'spinner'}
              timeZoneName={SAUDI_TZ}
              locale={locale === 'ar' ? 'ar_SA' : 'en_US'}
              minimumDate={minimumDate}
              minuteInterval={5}
              themeVariant={theme.scheme === 'dark' ? 'dark' : 'light'}
              accentColor={theme.colors.primary}
              onChange={(_, d) => d && setDraft(d)}
            />
            <Button
              label={t.common.done}
              onPress={() => {
                onChange(draft);
                setOpen(false);
              }}
              fullWidth
            />
          </View>
        </BottomSheet>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  field: { alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 10 },
});
