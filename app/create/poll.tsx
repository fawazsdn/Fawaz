import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, X } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { pollService } from '@/services';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';

const DURATIONS = [
  { hours: 24, key: '1d' },
  { hours: 72, key: '3d' },
  { hours: 168, key: '1w' },
];

export default function CreatePollScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [duration, setDuration] = useState(72);
  const [submitting, setSubmitting] = useState(false);

  const durationLabel = (h: number) => {
    if (locale === 'ar') return h === 24 ? 'يوم واحد' : h === 72 ? '3 أيام' : 'أسبوع';
    return h === 24 ? '1 day' : h === 72 ? '3 days' : '1 week';
  };

  const updateOption = (i: number, value: string) => setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  const addOption = () => options.length < 5 && setOptions((prev) => [...prev, '']);
  const removeOption = (i: number) => setOptions((prev) => prev.filter((_, idx) => idx !== i));

  const validOptions = options.map((o) => o.trim()).filter(Boolean);
  const canSubmit = question.trim().length > 2 && validOptions.length >= 2;

  const onSubmit = async () => {
    setSubmitting(true);
    const poll = await pollService.createPoll({ question: question.trim(), options: validOptions, closesInHours: duration });
    setSubmitting(false);
    router.replace(`/post/${poll.postId}`);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader title={t.create.poll} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md }} keyboardShouldPersistTaps="handled">
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder={t.create.pollDesc}
          placeholderTextColor={theme.colors.textMuted}
          style={[theme.text('title'), styles.questionInput, { borderColor: theme.colors.border }]}
          multiline
          autoFocus
        />

        <View style={{ gap: 10, marginTop: 16 }}>
          {options.map((opt, i) => (
            <View key={i} style={[theme.row(), { alignItems: 'center', gap: 8 }]}>
              <TextInput
                value={opt}
                onChangeText={(v) => updateOption(i, v)}
                placeholder={`${t.common.optional} ${i + 1}`}
                placeholderTextColor={theme.colors.textMuted}
                style={[theme.text('body'), styles.optionInput, { borderColor: theme.colors.border, flex: 1 }]}
              />
              {options.length > 2 ? (
                <Pressable onPress={() => removeOption(i)} hitSlop={8}>
                  <X size={18} color={theme.colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {options.length < 5 ? (
            <Pressable onPress={addOption} style={[theme.row(), styles.addBtn]} accessibilityRole="button">
              <Plus size={16} color={theme.colors.primary} />
              <Text style={theme.text('bodySmall', theme.colors.primary)}>{t.common.add}</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginTop: 20, marginBottom: 8 }]}>{t.polls.closesIn}</Text>
        <View style={[theme.row(), { gap: 8 }]}>
          {DURATIONS.map((d) => (
            <Chip key={d.key} label={durationLabel(d.hours)} selected={duration === d.hours} onPress={() => setDuration(d.hours)} />
          ))}
        </View>

        <View style={{ height: 24 }} />
        <Button label={t.post.publish} onPress={onSubmit} disabled={!canSubmit} loading={submitting} fullWidth size="lg" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  questionInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, minHeight: 60 },
  optionInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12 },
  addBtn: { alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
});
