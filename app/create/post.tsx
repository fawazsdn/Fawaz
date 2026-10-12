import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ImagePlus, MapPin, X } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useAction } from '@/hooks/useAction';
import { useIsVerified } from '@/hooks/useNeighborhood';
import { createPost } from '@/backend/actions';
import { locateOnce } from '@/backend/location';
import { useImagePicker } from '@/components/imageEditor/useImagePicker';
import { VerifyGate } from '@/components/VerifyGate';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import type { PostType } from '@/models';

const CATEGORY_TYPES: PostType[] = ['general', 'announcement', 'recommendation'];

export default function CreatePostScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const verified = useIsVerified();
  const { run, pending: submitting } = useAction();
  const { pickImage: pickEdited, editor } = useImagePicker({ aspects: ['portrait', 'square', 'wide', 'original'] });
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [category, setCategory] = useState<PostType>('general');
  const [audience, setAudience] = useState<'neighborhood' | 'city'>('neighborhood');
  const [shareLocation, setShareLocation] = useState(false);
  const [locNote, setLocNote] = useState<string | null>(null);

  // One photo at a time, each through the crop/preview editor (max 4).
  const pickImage = async () => {
    if (images.length >= 4) return;
    const uri = await pickEdited();
    if (uri) setImages((prev) => [...prev, uri].slice(0, 4));
  };

  const canSubmit = text.trim().length > 0 || images.length > 0;

  const onSubmit = async () => {
    let geotag: { lat: number; lng: number } | undefined;
    if (shareLocation) {
      const loc = await locateOnce();
      if (loc.status !== 'ok') {
        setLocNote(loc.status === 'denied' ? t.map.locationDenied : t.verification.locationUnavailableBody);
        return;
      }
      geotag = { lat: loc.lat, lng: loc.lng };
    }
    const res = await run(() => createPost({ type: category, textAr: text.trim(), localImages: images, audience, geotag }));
    if (res.ok) router.replace(`/post/${res.value}`);
  };

  if (!verified) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={t.create.post} fallbackRoute="/create" />
        <VerifyGate />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title={t.create.post} fallbackRoute="/create" />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
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
                <Image source={{ uri }} style={styles.image} contentFit="cover" />
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
          disabled={images.length >= 4}
          style={[theme.row(), styles.addImageBtn, { borderColor: theme.colors.border, opacity: images.length >= 4 ? 0.5 : 1 }]}
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

        <View style={[theme.row(), styles.switchRow]}>
          <View style={[theme.row(), { alignItems: 'center', gap: 6, flex: 1 }]}>
            <MapPin size={15} color={theme.colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={theme.text('body')}>{t.post.showOnMap}</Text>
              <Text style={theme.text('caption', theme.colors.textMuted)}>{t.post.showOnMapHint}</Text>
            </View>
          </View>
          <Switch value={shareLocation} onValueChange={setShareLocation} trackColor={{ true: theme.colors.primary }} />
        </View>
        {locNote ? <Text style={theme.text('caption', theme.colors.danger)}>{locNote}</Text> : null}

        <View style={{ height: 24 }} />
        <Button label={t.post.publish} onPress={onSubmit} disabled={!canSubmit || submitting} loading={submitting} fullWidth size="lg" />
      </ScrollView>
      {editor}
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
  switchRow: { alignItems: 'center', justifyContent: 'space-between', marginTop: 20, gap: 10 },
});
