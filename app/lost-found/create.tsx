import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ImagePlus } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useAction } from '@/hooks/useAction';
import { useIsVerified } from '@/hooks/useNeighborhood';
import { createLostFound } from '@/backend/actions';
import { VerifyGate } from '@/components/VerifyGate';
import { useImagePicker } from '@/components/imageEditor/useImagePicker';
import type { LostFoundStatus } from '@/models';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';

export default function CreateLostFoundScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const verified = useIsVerified();
  const { run, pending: submitting } = useAction();
  const { pickImage: pickEdited, editor } = useImagePicker({ aspects: ['square', 'classic', 'portrait'] });

  const [kind, setKind] = useState<'pet' | 'item'>('item');
  const [status, setStatus] = useState<LostFoundStatus>('lost');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | undefined>();

  const pickImage = async () => {
    const uri = await pickEdited();
    if (uri) setImage(uri);
  };

  const canSubmit = title.trim().length > 2;

  const onSubmit = async () => {
    const res = await run(() =>
      createLostFound({ kind, title: title.trim(), description: description.trim() || title.trim(), localImage: image, status }),
    );
    if (res.ok) router.replace(`/lost-found/${res.value}`);
  };

  if (!verified) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={t.lostFound.report} fallbackRoute="/lost-found" />
        <VerifyGate />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title={t.lostFound.report} fallbackRoute="/lost-found" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Pressable onPress={pickImage} style={[styles.imagePicker, { borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}>
          {image ? <Image source={{ uri: image }} style={styles.image} /> : <ImagePlus size={26} color={theme.colors.primary} />}
        </Pressable>

        <View style={[theme.row(), { gap: 8, marginTop: 16 }]}>
          <Chip label="🐾" selected={kind === 'pet'} onPress={() => setKind('pet')} />
          <Chip label="📦" selected={kind === 'item'} onPress={() => setKind('item')} />
          <Chip label={t.lostFound.lost} selected={status === 'lost'} onPress={() => setStatus('lost')} />
          <Chip label={t.lostFound.found} selected={status === 'found'} onPress={() => setStatus('found')} />
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
      {editor}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  imagePicker: { height: 160, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  label: { marginBottom: 8, marginTop: 16 },
  input: { height: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 14 },
  textArea: { minHeight: 100, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 14, textAlignVertical: 'top' },
});
