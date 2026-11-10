import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Globe, Lock, MapPin, Users, X } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useAction } from '@/hooks/useAction';
import { useStore, useCurrentUserId } from '@/store/useStore';
import { updatePost } from '@/backend/social';
import { useSocialAvailable } from '@/backend/socialState';
import type { PostAudience } from '@/models';
import { movePhoto } from '@/features/social/photoOrder';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { imageCachePolicy } from '@/backend/mediaPrivacy';

/** Edit caption, audience and location; photos can be reordered or removed (adding is a new post). */
export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const me = useCurrentUserId();
  const socialOn = useSocialAvailable();
  const post = useStore((s) => s.posts.find((p) => p.id === id));
  const { run, pending } = useAction();

  const initialPhotos = useMemo(
    () => (post?.imagePaths ?? []).map((path, i) => ({ path, uri: post?.images[i] })).filter((p): p is { path: string; uri: string } => !!p.uri),
    [post],
  );
  const [caption, setCaption] = useState(post?.textAr ?? '');
  const [location, setLocation] = useState(post?.locationLabel ?? '');
  const [audience, setAudience] = useState<PostAudience>(post?.audience ?? 'neighborhood');
  const [photos, setPhotos] = useState(initialPhotos);

  if (!post || post.authorId !== me) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={t.social.editPost} fallbackRoute="/" />
        <EmptyState title={t.errors.notFound} />
      </View>
    );
  }

  // Photos stored in the neighborhood folder can only stay on neighborhood posts (enforced by the server too).
  const legacyPhotos = (post.imagePaths ?? []).some((p) => !p.startsWith('posts/'));
  const audiences: { key: PostAudience; label: string; icon: typeof Globe }[] = socialOn && !legacyPhotos
    ? [
        { key: 'public', label: t.social.audiencePublic, icon: Globe },
        { key: 'followers', label: t.social.audienceFollowers, icon: Lock },
        { key: 'neighborhood', label: t.social.audienceNeighbors, icon: Users },
      ]
    : [
        { key: 'neighborhood', label: t.post.audienceNeighborhood, icon: Users },
        { key: 'city', label: t.post.audienceCity, icon: Globe },
      ];

  const canSave = caption.trim().length > 0 || photos.length > 0;

  const save = async () => {
    const res = await run(() =>
      updatePost(post.id, {
        caption: caption.trim(),
        audience,
        locationLabel: location.trim() || null,
        ...(photos.length !== initialPhotos.length || photos.some((p, i) => p.path !== initialPhotos[i]?.path)
          ? { imagePaths: photos.map((p) => p.path) }
          : {}),
      }),
    );
    if (res.ok) router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader title={t.social.editPost} fallbackRoute={`/post/${post.id}`} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginBottom: 14 }}>
            {photos.map((p, i) => (
              <View key={p.path} style={styles.tile}>
                <Image source={{ uri: p.uri }} cachePolicy={imageCachePolicy(p.uri)} style={styles.tile} contentFit="cover" />
                <Pressable
                  style={[styles.remove, { backgroundColor: theme.colors.overlay }]}
                  onPress={() => setPhotos((prev) => prev.filter((x) => x.path !== p.path))}
                  accessibilityRole="button"
                  accessibilityLabel={t.social.removeImage}
                >
                  <X size={13} color="#fff" />
                </Pressable>
                <View style={styles.controls}>
                  <Pressable disabled={i === 0} onPress={() => setPhotos((prev) => movePhoto(prev, i, i - 1))} accessibilityLabel={t.social.moveEarlier} style={[styles.ctrl, { opacity: i === 0 ? 0.35 : 1 }]}>
                    <ChevronLeft size={15} color="#fff" />
                  </Pressable>
                  <Pressable disabled={i === photos.length - 1} onPress={() => setPhotos((prev) => movePhoto(prev, i, i + 1))} accessibilityLabel={t.social.moveLater} style={[styles.ctrl, { opacity: i === photos.length - 1 ? 0.35 : 1 }]}>
                    <ChevronRight size={15} color="#fff" />
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder={t.social.caption}
          placeholderTextColor={theme.colors.textMuted}
          multiline
          maxLength={10000}
          style={[theme.text('body'), { minHeight: 90, textAlignVertical: 'top' }]}
        />
        <View style={[theme.row(), styles.location, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}>
          <MapPin size={15} color={theme.colors.textMuted} />
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder={t.social.location}
            placeholderTextColor={theme.colors.textMuted}
            maxLength={80}
            style={[theme.text('body'), { flex: 1, paddingVertical: 8 }]}
          />
        </View>

        <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginTop: 18, marginBottom: 8 }]}>{t.post.audience}</Text>
        <View style={{ gap: 8 }}>
          {audiences.map(({ key, label, icon: Icon }) => (
            <Pressable
              key={key}
              onPress={() => setAudience(key)}
              style={[theme.row(), styles.audience, { borderColor: audience === key ? theme.colors.primary : theme.colors.border, borderRadius: theme.radii.md }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: audience === key }}
            >
              <Icon size={17} color={audience === key ? theme.colors.primary : theme.colors.textMuted} />
              <Text style={theme.text('body')}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 24 }} />
        <Button label={t.social.saveChanges} onPress={save} disabled={!canSave || pending} loading={pending} fullWidth size="lg" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tile: { width: 112, height: 140, borderRadius: 12, overflow: 'hidden' },
  remove: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  controls: { position: 'absolute', bottom: 6, left: 6, right: 6, flexDirection: 'row', justifyContent: 'space-between' },
  ctrl: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  location: { alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, marginTop: 8 },
  audience: { alignItems: 'center', gap: 10, padding: 12, borderWidth: 1 },
});
