import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, X } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { postService } from '@/services';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import type { PostType } from '@/models';

const CATEGORY_TYPES: PostType[] = ['general', 'announcement', 'recommendation'];

export default function CreatePostScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [category, setCategory] = useState<PostType>('general');
  const [audience, setAudience] = useState<'neighborhood' | 'city'>('neighborhood');
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 4 - images.length,
    });
    if (!result.canceled) setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 4));
  };

  const canSubmit = text.trim().length > 0 || images.length > 0;

  const onSubmit = async () => {
    setSubmitting(true);
    const post = await postService.createPost({ type: category, textAr: text.trim(), images, audience });
    setSubmitting(false);
    router.replace(`/post/${post.id}`);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title={t.create.post} fallbackRoute="/create" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md }} keyboardShouldPersistTaps="handled">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t.post.composerPlaceholder}
          placeholderTextColor={theme.colors.textMuted}
          multiline
          style={[theme.text('body'), styles.textInput]}
          autoFocus
        />

        {images.length > 0 ? (
          <View style={[theme.row(), styles.imageRow]}>
            {images.map((uri, i) => (
              <View key={uri} style={styles.imageWrap}>
                <Image source={{ uri }} style={styles.image} />
                <Pressable
                  style={[styles.removeBtn, { backgroundColor: theme.colors.overlay }]}
                  onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <X size={13} color="#fff" />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <Pressable
          onPress={pickImage}
          style={[theme.row(), styles.addImageBtn, { borderColor: theme.colors.border }]}
          accessibilityRole="button"
        >
          <ImagePlus size={17} color={theme.colors.primary} />
          <Text style={theme.text('bodySmall', theme.colors.primary)}>{t.post.addImages}</Text>
        </Pressable>

        <Text style={[theme.text('bodySmall', theme.colors.textSecondary), styles.label]}>{t.post.category}</Text>
        <View style={[theme.row(), { gap: 8 }]}>
          {CATEGORY_TYPES.map((c) => (
            <Chip
              key={c}
              label={t.post.categories[c as 'general' | 'announcement' | 'recommendation']}
              selected={category === c}
              onPress={() => setCategory(c)}
            />
          ))}
        </View>

        <Text style={[theme.text('bodySmall', theme.colors.textSecondary), styles.label]}>{t.post.audience}</Text>
        <View style={[theme.row(), { gap: 8 }]}>
          <Chip label={t.post.audienceNeighborhood} selected={audience === 'neighborhood'} onPress={() => setAudience('neighborhood')} />
          <Chip label={t.post.audienceCity} selected={audience === 'city'} onPress={() => setAudience('city')} />
        </View>

        <View style={{ height: 24 }} />
        <Button label={t.post.publish} onPress={onSubmit} disabled={!canSubmit} loading={submitting} fullWidth size="lg" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  textInput: { minHeight: 90, textAlignVertical: 'top' },
  imageRow: { gap: 8, marginTop: 12, flexWrap: 'wrap' },
  imageWrap: { width: 84, height: 84, borderRadius: 10, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageBtn: {
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 12,
    marginBottom: 20,
  },
  label: { marginBottom: 8, marginTop: 4 },
});
