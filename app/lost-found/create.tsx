import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { lostFoundService } from '@/services';
import type { LostFoundStatus } from '@/models';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';

export default function CreateLostFoundScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const neighborhoodId = useStore((s) => s.session.neighborhoodId);

  const [kind, setKind] = useState<'pet' | 'item'>('item');
  const [status, setStatus] = useState<LostFoundStatus>('lost');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setImage(result.assets[0].uri);
  };

  const canSubmit = title.trim().length > 2 && !!image;

  const onSubmit = async () => {
    if (!neighborhoodId || !image) return;
    setSubmitting(true);
    const post = await lostFoundService.create({
      kind,
      title: title.trim(),
      description: description.trim(),
      image,
      neighborhoodId,
      status,
    });
    setSubmitting(false);
    router.replace(`/lost-found/${post.id}`);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title={t.lostFound.report} fallbackRoute="/lost-found" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md }} keyboardShouldPersistTaps="handled">
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
