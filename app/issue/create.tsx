import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, X } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { issueService } from '@/services';
import type { IssueCategory } from '@/models';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { MapPlaceholder } from '@/components/MapPlaceholder';

const CATEGORIES: IssueCategory[] = [
  'streetlight',
  'road_damage',
  'trash',
  'water',
  'electricity',
  'flooding',
  'abandoned_vehicle',
  'safety',
  'other',
];
const STEPS = ['category', 'photos', 'location', 'description', 'review'] as const;

export default function CreateIssueScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === s.session.neighborhoodId));

  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<IssueCategory | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const stepTitles = [
    t.issueCreate.stepCategory,
    t.issueCreate.stepPhotos,
    t.issueCreate.stepLocation,
    t.issueCreate.stepDescription,
    t.issueCreate.stepReview,
  ];

  const canProceed = [category !== null, true, true, description.trim().length > 4, true][step];

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 3 - images.length,
    });
    if (!result.canceled) setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 3));
  };

  const onNext = () => (step < STEPS.length - 1 ? setStep(step + 1) : onSubmit());
  const onBack = () => (step > 0 ? setStep(step - 1) : router.back());

  const onSubmit = async () => {
    if (!category || !neighborhood) return;
    setSubmitting(true);
    const issue = await issueService.createIssue({
      title: t.issueCreate.categories[category],
      category,
      description: description.trim(),
      images,
      neighborhoodId: neighborhood.id,
      approxLat: neighborhood.centerLat,
      approxLng: neighborhood.centerLng,
    });
    setSubmitting(false);
    router.replace(`/issue/${issue.id}`);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title={t.issueCreate.title} onBack={onBack} />
      <View style={[theme.row(), styles.progressRow, { paddingHorizontal: theme.spacing.md }]}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[styles.progressDot, { flex: 1, backgroundColor: i <= step ? theme.colors.primary : theme.colors.border }]}
          />
        ))}
      </View>
      <Text style={[theme.text('caption', theme.colors.textMuted), { paddingHorizontal: theme.spacing.md, marginTop: 8 }]}>
        {stepTitles[step]}
      </Text>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.md }} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <View style={[theme.row(), styles.categoryGrid]}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[
                  styles.categoryCell,
                  {
                    borderColor: category === c ? theme.colors.primary : theme.colors.border,
                    backgroundColor: category === c ? theme.colors.successSurface : theme.colors.surface,
                    borderRadius: theme.radii.md,
                  },
                ]}
              >
                <Text style={theme.text('bodySmall', category === c ? theme.colors.primary : theme.colors.textPrimary)}>
                  {t.issueCreate.categories[c]}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {step === 1 ? (
          <View>
            <View style={[theme.row(), { gap: 8, flexWrap: 'wrap' }]}>
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
            {images.length < 3 ? (
              <Pressable onPress={pickImage} style={[theme.row(), styles.addImageBtn, { borderColor: theme.colors.border }]}>
                <ImagePlus size={17} color={theme.colors.primary} />
                <Text style={theme.text('bodySmall', theme.colors.primary)}>{t.post.addImages}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {step === 2 ? (
          <View>
            {neighborhood ? (
              <MapPlaceholder
                centerLat={neighborhood.centerLat}
                centerLng={neighborhood.centerLng}
                pins={[{ id: 'x', lat: neighborhood.centerLat, lng: neighborhood.centerLng }]}
                height={220}
              />
            ) : null}
            <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 10 }]}>{t.map.approxNotice}</Text>
          </View>
        ) : null}

        {step === 3 ? (
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t.issueCreate.stepDescription}
            placeholderTextColor={theme.colors.textMuted}
            multiline
            autoFocus
            style={[theme.text('body'), styles.textInput, { borderColor: theme.colors.border }]}
          />
        ) : null}

        {step === 4 ? (
          <Card>
            <Text style={theme.text('title')}>{category ? t.issueCreate.categories[category] : ''}</Text>
            <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginTop: 8 }]}>{description}</Text>
            {images.length > 0 ? (
              <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 8 }]}>{images.length} 📷</Text>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>

      <View style={{ padding: theme.spacing.md }}>
        <Button
          label={step === STEPS.length - 1 ? t.issueCreate.submit : t.common.next}
          onPress={onNext}
          disabled={!canProceed}
          loading={submitting}
          fullWidth
          size="lg"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  progressRow: { gap: 6, marginTop: 6 },
  progressDot: { height: 4, borderRadius: 2 },
  categoryGrid: { flexWrap: 'wrap', gap: 10 },
  categoryCell: { width: '31%', paddingVertical: 16, alignItems: 'center', borderWidth: 1.5 },
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
  },
  textInput: { minHeight: 140, textAlignVertical: 'top', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14 },
});
