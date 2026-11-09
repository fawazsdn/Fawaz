import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Crop, Globe, ImagePlus, Lock, MapPin, Users, X } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useAction } from '@/hooks/useAction';
import { useIsVerified } from '@/hooks/useNeighborhood';
import { useStore } from '@/store/useStore';
import { createPost } from '@/backend/actions';
import { locateOnce } from '@/backend/location';
import { MAX_POST_PHOTOS, isAcceptedImageType, preparePhoto } from '@/backend/social';
import { useSocialAvailable } from '@/backend/socialState';
import { ImageEditorModal } from '@/components/imageEditor/ImageEditorModal';
import { VerifyGate } from '@/components/VerifyGate';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { localizeDigits } from '@/utils/format';
import { movePhoto } from '@/features/social/photoOrder';
import type { PostAudience, PostType } from '@/models';

const CATEGORY_TYPES: PostType[] = ['general', 'announcement', 'recommendation'];
/** Anything larger than this straight from the library is refused before processing. */
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;

interface DraftPhoto {
  key: string;
  uri: string;
  width: number;
  height: number;
}

export default function CreatePostScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const verified = useIsVerified();
  const socialOn = useSocialAvailable();
  const neighborhoodId = useStore((s) => s.session.neighborhoodId);
  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === neighborhoodId));
  const { run, pending: submitting } = useAction();

  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [editing, setEditing] = useState<DraftPhoto | null>(null);
  const [category, setCategory] = useState<PostType>('general');
  const [audience, setAudience] = useState<PostAudience>('neighborhood');
  const [location, setLocation] = useState('');
  const [shareLocation, setShareLocation] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const remaining = MAX_POST_PHOTOS - photos.length;

  const pickPhotos = async () => {
    if (remaining <= 0) {
      setNote(t.social.photoLimit.replace('{max}', localizeDigits(MAX_POST_PHOTOS, locale)));
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        Alert.alert(t.imageEditor.permissionTitle, t.imageEditor.permissionBody, [
          { text: t.common.cancel, style: 'cancel' },
          { text: t.imageEditor.openSettings, onPress: () => Linking.openSettings() },
        ]);
      }
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      orderedSelection: true,
      quality: 1,
      exif: false,
    });
    if (result.canceled) return;
    setNote(null);
    setPreparing(true);
    const added: DraftPhoto[] = [];
    let rejected = false;
    for (const asset of result.assets.slice(0, remaining)) {
      if (!isAcceptedImageType(asset.mimeType) || (asset.fileSize ?? 0) > MAX_SOURCE_BYTES) {
        rejected = true;
        continue;
      }
      try {
        // Re-encoding strips EXIF (incl. GPS) and caps the size before anything is uploaded.
        const out = await preparePhoto(asset.uri, asset.width, asset.height);
        added.push({ key: `${Date.now()}-${added.length}-${out.uri}`, ...out });
      } catch {
        rejected = true;
      }
    }
    setPhotos((prev) => [...prev, ...added].slice(0, MAX_POST_PHOTOS));
    setPreparing(false);
    if (rejected) setNote(t.social.imageRejected);
  };

  const canSubmit = (text.trim().length > 0 || photos.length > 0) && !preparing;

  const audienceLabel = (a: PostAudience) =>
    a === 'public'
      ? t.social.audiencePublic
      : a === 'followers'
        ? t.social.audienceFollowers
        : a === 'city'
          ? t.post.audienceCity
          : socialOn
            ? t.social.audienceNeighbors
            : t.post.audienceNeighborhood;

  const publish = async () => {
    setReviewOpen(false);
    let geotag: { lat: number; lng: number } | undefined;
    if (shareLocation) {
      const loc = await locateOnce();
      if (loc.status !== 'ok') {
        setNote(loc.status === 'denied' ? t.map.locationDenied : t.verification.locationUnavailableBody);
        return;
      }
      geotag = { lat: loc.lat, lng: loc.lng };
    }
    const res = await run(() =>
      createPost({
        type: category,
        textAr: text.trim(),
        localImages: photos.map((p) => p.uri),
        audience,
        geotag: geotag ? { ...geotag, label: location.trim() || undefined } : undefined,
        locationLabel: location.trim() || undefined,
      }),
    );
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

  const audiences: { key: PostAudience; icon: typeof Globe; hint?: string }[] = socialOn
    ? [
        { key: 'public', icon: Globe, hint: t.social.audiencePublicHint },
        { key: 'followers', icon: Lock, hint: t.social.audienceFollowersHint },
        { key: 'neighborhood', icon: Users, hint: t.social.audienceNeighborsHint },
      ]
    : [
        { key: 'neighborhood', icon: Users },
        { key: 'city', icon: Globe },
      ];

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
        {/* Photos */}
        {photos.length > 0 ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
              {photos.map((p, i) => (
                <View key={p.key} style={styles.tile} testID="draft-photo">
                  <Pressable onPress={() => setEditing(p)} accessibilityRole="imagebutton" accessibilityLabel={t.social.editImage}>
                    <Image source={{ uri: p.uri }} style={styles.tileImage} contentFit="cover" />
                  </Pressable>
                  <View style={[styles.indexBadge, { backgroundColor: theme.colors.overlay }]}>
                    <Text style={styles.indexText}>{localizeDigits(i + 1, locale)}</Text>
                  </View>
                  <Pressable
                    style={[styles.removeBtn, { backgroundColor: theme.colors.overlay }]}
                    onPress={() => setPhotos((prev) => prev.filter((x) => x.key !== p.key))}
                    accessibilityRole="button"
                    accessibilityLabel={t.social.removeImage}
                    hitSlop={6}
                    testID="remove-photo"
                  >
                    <X size={13} color="#fff" />
                  </Pressable>
                  <View style={styles.tileControls}>
                    <SmallIcon label={t.social.moveEarlier} disabled={i === 0} onPress={() => setPhotos((prev) => movePhoto(prev, i, i - 1))}>
                      <ChevronLeft size={15} color="#fff" />
                    </SmallIcon>
                    <SmallIcon label={t.social.editImage} onPress={() => setEditing(p)}>
                      <Crop size={13} color="#fff" />
                    </SmallIcon>
                    <SmallIcon label={t.social.moveLater} disabled={i === photos.length - 1} onPress={() => setPhotos((prev) => movePhoto(prev, i, i + 1))}>
                      <ChevronRight size={15} color="#fff" />
                    </SmallIcon>
                  </View>
                </View>
              ))}
            </ScrollView>
            <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 6 }]}>
              {t.social.photosCount.replace('{n}', localizeDigits(photos.length, locale)).replace('{max}', localizeDigits(MAX_POST_PHOTOS, locale))}
            </Text>
          </>
        ) : null}

        <Pressable
          onPress={pickPhotos}
          disabled={preparing || remaining <= 0}
          style={[theme.row(), styles.addImageBtn, { borderColor: theme.colors.border, opacity: remaining <= 0 ? 0.5 : 1 }]}
          accessibilityRole="button"
          testID="add-photos"
        >
          {preparing ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <ImagePlus size={17} color={theme.colors.primary} />}
          <Text style={theme.text('bodySmall', theme.colors.primary)}>{preparing ? t.social.preparing : t.post.addImages}</Text>
        </Pressable>

        {/* Caption */}
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={photos.length > 0 ? t.social.caption : t.post.composerPlaceholder}
          placeholderTextColor={theme.colors.textMuted}
          multiline
          maxLength={10000}
          style={[theme.text('body'), styles.textInput]}
          testID="caption-input"
        />

        {/* Location / neighborhood tag */}
        <View style={[theme.row(), styles.locationRow, { borderColor: theme.colors.border, borderRadius: theme.radii.md }]}>
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
        {neighborhood && !location ? (
          <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
            <Chip
              label={t.social.tagNeighborhood}
              icon={<MapPin size={12} color={theme.colors.textSecondary} />}
              onPress={() => setLocation(locale === 'ar' ? neighborhood.nameAr : neighborhood.nameEn)}
            />
          </View>
        ) : null}

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

        {/* Audience */}
        <Text style={[theme.text('bodySmall', theme.colors.textSecondary), styles.label]}>{t.post.audience}</Text>
        <View style={{ gap: 8 }} accessibilityRole="radiogroup">
          {audiences.map(({ key, icon: Icon, hint }) => {
            const selected = audience === key;
            return (
              <Pressable
                key={key}
                onPress={() => setAudience(key)}
                style={[
                  theme.row(),
                  styles.audience,
                  {
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                    backgroundColor: selected ? theme.colors.backgroundAlt : 'transparent',
                    borderRadius: theme.radii.md,
                  },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                testID={`audience-${key}`}
              >
                <Icon size={17} color={selected ? theme.colors.primary : theme.colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={theme.text('body')}>{audienceLabel(key)}</Text>
                  {hint ? <Text style={theme.text('caption', theme.colors.textMuted)}>{hint}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={[theme.row(), styles.switchRow]}>
          <View style={{ flex: 1 }}>
            <Text style={theme.text('body')}>{t.post.showOnMap}</Text>
            <Text style={theme.text('caption', theme.colors.textMuted)}>{t.post.showOnMapHint}</Text>
          </View>
          <Switch value={shareLocation} onValueChange={setShareLocation} trackColor={{ true: theme.colors.primary }} />
        </View>
        {note ? <Text style={[theme.text('caption', theme.colors.danger), { marginTop: 8 }]}>{note}</Text> : null}

        <View style={{ height: 24 }} />
        <Button
          label={t.post.publish}
          onPress={() => setReviewOpen(true)}
          disabled={!canSubmit || submitting}
          loading={submitting}
          fullWidth
          size="lg"
          testID="publish-button"
        />
      </ScrollView>

      <ConfirmationModal
        visible={reviewOpen}
        title={t.social.reviewTitle}
        body={t.social.reviewBody.replace('{audience}', audienceLabel(audience))}
        confirmLabel={t.social.publishNow}
        onCancel={() => setReviewOpen(false)}
        onConfirm={publish}
      />
      <ImageEditorModal
        visible={!!editing}
        source={editing ? { uri: editing.uri, width: editing.width, height: editing.height } : null}
        aspects={['original', 'square', 'portrait', 'wide']}
        onCancel={() => setEditing(null)}
        onDone={(r) => {
          const target = editing;
          setEditing(null);
          if (target) setPhotos((prev) => prev.map((p) => (p.key === target.key ? { ...p, uri: r.uri, width: r.width ?? p.width, height: r.height ?? p.height } : p)));
        }}
      />
    </KeyboardAvoidingView>
  );
}

function SmallIcon({ label, onPress, disabled, children }: { label: string; onPress: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.smallIcon, { opacity: disabled ? 0.35 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { width: 112, height: 140, borderRadius: 12, overflow: 'hidden' },
  tileImage: { width: 112, height: 140 },
  indexBadge: { position: 'absolute', top: 6, left: 6, minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  indexText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  removeBtn: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tileControls: { position: 'absolute', bottom: 6, left: 6, right: 6, flexDirection: 'row', justifyContent: 'space-between' },
  smallIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
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
    marginBottom: 14,
  },
  textInput: { minHeight: 90, textAlignVertical: 'top' },
  locationRow: { alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, marginTop: 8 },
  label: { marginBottom: 8, marginTop: 18 },
  audience: { alignItems: 'center', gap: 10, padding: 12, borderWidth: 1 },
  switchRow: { alignItems: 'center', justifyContent: 'space-between', marginTop: 20, gap: 10 },
});
