import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { helpRequestService } from '@/services';
import type { HelpCategory } from '@/models';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';

const CATEGORIES: HelpCategory[] = ['car', 'borrow_item', 'moving', 'lost_pet', 'home', 'other'];

export default function CreateHelpRequestScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const neighborhoodId = useStore((s) => s.session.neighborhoodId);

  const [category, setCategory] = useState<HelpCategory | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = category !== null && title.trim().length > 3;

  const onSubmit = async () => {
    if (!category || !neighborhoodId) return;
    setSubmitting(true);
    const req = await helpRequestService.createHelpRequest({
      title: title.trim(),
      category,
      description: description.trim(),
      neighborhoodId,
      approxDistanceM: Math.round(150 + Math.random() * 700),
    });
    setSubmitting(false);
    router.replace(`/help-request/${req.id}`);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title={t.create.help} fallbackRoute="/(tabs)/discover" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md }} keyboardShouldPersistTaps="handled">
        <Text style={[theme.text('bodySmall', theme.colors.textSecondary), styles.label]}>{t.post.category}</Text>
        <View style={[theme.row(), styles.grid]}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              style={[
                styles.cell,
                {
                  borderColor: category === c ? theme.colors.primary : theme.colors.border,
                  backgroundColor: category === c ? theme.colors.infoSurface : theme.colors.surface,
                  borderRadius: theme.radii.md,
                },
              ]}
            >
              <Text style={theme.text('bodySmall', category === c ? theme.colors.info : theme.colors.textPrimary)}>
                {t.help.categories[c]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[theme.text('bodySmall', theme.colors.textSecondary), styles.label]}>{t.eventCreate.titleLabel}</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          style={[theme.text('body'), styles.input, { borderColor: theme.colors.border }]}
          placeholderTextColor={theme.colors.textMuted}
        />

        <Text style={[theme.text('bodySmall', theme.colors.textSecondary), styles.label]}>{t.eventCreate.description}</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          style={[theme.text('body'), styles.textArea, { borderColor: theme.colors.border }]}
          placeholderTextColor={theme.colors.textMuted}
        />

        <View style={{ height: 24 }} />
        <Button label={t.post.publish} onPress={onSubmit} disabled={!canSubmit} loading={submitting} fullWidth size="lg" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 8, marginTop: 16 },
  grid: { flexWrap: 'wrap', gap: 8 },
  cell: { paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1.5 },
  input: { height: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 14 },
  textArea: { minHeight: 100, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 14, textAlignVertical: 'top' },
});
