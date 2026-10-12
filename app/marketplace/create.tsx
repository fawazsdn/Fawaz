import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ImagePlus, X } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useAction } from '@/hooks/useAction';
import { useIsVerified } from '@/hooks/useNeighborhood';
import { createListing } from '@/backend/actions';
import { VerifyGate } from '@/components/VerifyGate';
import { useImagePicker } from '@/components/imageEditor/useImagePicker';
import type { ListingCondition, ListingType } from '@/models';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';

const CATEGORIES = ['أثاث', 'إلكترونيات', 'أطفال', 'مكتب', 'رياضة', 'أخرى'];
const CONDITIONS: ListingCondition[] = ['new', 'like_new', 'good', 'used', 'for_parts'];

export default function CreateListingScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const verified = useIsVerified();
  const { run, pending: submitting } = useAction();
  const { pickImage: pickEdited, editor } = useImagePicker({ aspects: ['square', 'classic', 'portrait'] });

  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]!);
  const [listingType, setListingType] = useState<ListingType>('sale');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState<ListingCondition>('good');

  const pickImage = async () => {
    if (images.length >= 4) return;
    const uri = await pickEdited();
    if (uri) setImages((prev) => [...prev, uri].slice(0, 4));
  };

  const canSubmit = title.trim().length > 2 && (listingType !== 'sale' || Number(price) > 0);

  const onSubmit = async () => {
    const res = await run(() =>
      createListing({
        title: title.trim(),
        description: description.trim(),
        localImages: images,
        category,
        listingType,
        price: listingType === 'sale' ? Number(price) : undefined,
        condition,
      }),
    );
    if (res.ok) router.replace(`/marketplace/${res.value}`);
  };

  if (!verified) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={t.create.sell} fallbackRoute="/marketplace" />
        <VerifyGate />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title={t.marketplace.createListing} fallbackRoute="/marketplace" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md }} keyboardShouldPersistTaps="handled">
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
          {images.length < 4 ? (
            <Pressable onPress={pickImage} style={[styles.addImage, { borderColor: theme.colors.border }]}>
              <ImagePlus size={20} color={theme.colors.primary} />
            </Pressable>
          ) : null}
        </View>

        <Field label={t.eventCreate.titleLabel}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            style={[theme.text('body'), styles.input, { borderColor: theme.colors.border }]}
            placeholderTextColor={theme.colors.textMuted}
          />
        </Field>

        <Field label={t.eventCreate.description}>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            style={[theme.text('body'), styles.textArea, { borderColor: theme.colors.border }]}
            placeholderTextColor={theme.colors.textMuted}
          />
        </Field>

        <Field label={t.post.category}>
          <View style={[theme.row(), { gap: 8, flexWrap: 'wrap' }]}>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </View>
        </Field>

        <Field label={t.lostFound.title}>
          <View style={[theme.row(), { gap: 8 }]}>
            <Chip label={t.marketplace.forSale} selected={listingType === 'sale'} onPress={() => setListingType('sale')} />
            <Chip label={t.marketplace.free} selected={listingType === 'free'} onPress={() => setListingType('free')} />
            <Chip label={t.marketplace.wanted} selected={listingType === 'wanted'} onPress={() => setListingType('wanted')} />
          </View>
        </Field>

        {listingType === 'sale' ? (
          <Field label={t.marketplace.priceLabel}>
            <TextInput
              value={price}
              onChangeText={(v) => setPrice(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              style={[theme.text('body'), styles.input, { borderColor: theme.colors.border, width: 140 }]}
            />
          </Field>
        ) : null}

        <Field label={t.marketplace.condition.good}>
          <View style={[theme.row(), { gap: 8, flexWrap: 'wrap' }]}>
            {CONDITIONS.map((c) => (
              <Chip key={c} label={t.marketplace.condition[c]} selected={condition === c} onPress={() => setCondition(c)} />
            ))}
          </View>
        </Field>

        <View style={{ height: 12 }} />
        <Button label={t.post.publish} onPress={onSubmit} disabled={!canSubmit} loading={submitting} fullWidth size="lg" />
      </ScrollView>
      {editor}
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: 18, marginTop: 6 }}>
      <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginBottom: 8 }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
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
  addImage: {
    width: 84,
    height: 84,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: { height: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 14 },
  textArea: { minHeight: 90, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 14, textAlignVertical: 'top' },
});
