import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { eventService } from '@/services';
import type { EventCategory } from '@/models';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';

const CATEGORIES: EventCategory[] = ['football', 'padel', 'walking', 'cleanup', 'coffee', 'iftar', 'kids', 'family', 'community'];
const DAY_OFFSETS = [0, 1, 2, 3, 7];
const HOURS = [8, 10, 16, 18, 19, 20, 21];

export default function CreateEventScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === s.session.neighborhoodId));

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('football');
  const [image, setImage] = useState<string | undefined>();
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [dayOffset, setDayOffset] = useState(1);
  const [startHour, setStartHour] = useState(19);
  const [capacity, setCapacity] = useState('12');
  const [recurring, setRecurring] = useState(false);
  const [audience, setAudience] = useState<'neighborhood' | 'city'>('neighborhood');
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setImage(result.assets[0].uri);
  };

  const dayLabel = (offset: number) => {
    if (offset === 0) return t.common.today;
    const d = new Date(Date.now() + offset * 86400000);
    return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'short', day: 'numeric' });
  };

  const canSubmit = title.trim().length > 2 && location.trim().length > 1 && Number(capacity) > 1;

  const onSubmit = async () => {
    if (!neighborhood) return;
    setSubmitting(true);
    const startsAt = new Date(Date.now() + dayOffset * 86400000);
    startsAt.setHours(startHour, 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + 90 * 60000);

    const event = await eventService.createEvent({
      title: title.trim(),
      category,
      coverImage: image ?? 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800',
      description: description.trim(),
      neighborhoodId: neighborhood.id,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      locationLabel: location.trim(),
      approxLat: neighborhood.centerLat,
      approxLng: neighborhood.centerLng,
      capacity: Number(capacity),
      audience,
      recurring,
    });
    setSubmitting(false);
    router.replace(`/event/${event.id}`);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title={t.eventCreate.title} fallbackRoute="/events" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={pickImage} style={[styles.imagePicker, { borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}>
          {image ? <Image source={{ uri: image }} style={styles.image} /> : <ImagePlus size={26} color={theme.colors.primary} />}
        </Pressable>

        <Field label={t.eventCreate.titleLabel}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            style={[theme.text('body'), styles.input, { borderColor: theme.colors.border }]}
            placeholderTextColor={theme.colors.textMuted}
          />
        </Field>

        <Field label={t.eventCreate.category}>
          <View style={[theme.row(), { gap: 8, flexWrap: 'wrap' }]}>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={t.eventCreate.categories[c]} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </View>
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

        <Field label={t.eventCreate.date}>
          <View style={[theme.row(), { gap: 8, flexWrap: 'wrap' }]}>
            {DAY_OFFSETS.map((offset) => (
              <Chip key={offset} label={dayLabel(offset)} selected={dayOffset === offset} onPress={() => setDayOffset(offset)} />
            ))}
          </View>
        </Field>

        <Field label={t.eventCreate.startTime}>
          <View style={[theme.row(), { gap: 8, flexWrap: 'wrap' }]}>
            {HOURS.map((h) => (
              <Chip key={h} label={`${h}:00`} selected={startHour === h} onPress={() => setStartHour(h)} />
            ))}
          </View>
        </Field>

        <Field label={t.eventCreate.location}>
          <TextInput
            value={location}
            onChangeText={setLocation}
            style={[theme.text('body'), styles.input, { borderColor: theme.colors.border }]}
            placeholderTextColor={theme.colors.textMuted}
          />
        </Field>

        <Field label={t.eventCreate.capacity}>
          <TextInput
            value={capacity}
            onChangeText={(v) => setCapacity(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            style={[theme.text('body'), styles.input, { borderColor: theme.colors.border, width: 100 }]}
          />
        </Field>

        <View style={[theme.row(), styles.switchRow]}>
          <Text style={theme.text('body')}>{t.eventCreate.recurring}</Text>
          <Switch value={recurring} onValueChange={setRecurring} trackColor={{ true: theme.colors.primary }} />
        </View>

        <Field label={t.eventCreate.audience}>
          <View style={[theme.row(), { gap: 8 }]}>
            <Chip label={t.post.audienceNeighborhood} selected={audience === 'neighborhood'} onPress={() => setAudience('neighborhood')} />
            <Chip label={t.post.audienceCity} selected={audience === 'city'} onPress={() => setAudience('city')} />
          </View>
        </Field>

        <View style={{ height: 12 }} />
        <Button label={t.eventCreate.publish} onPress={onSubmit} disabled={!canSubmit} loading={submitting} fullWidth size="lg" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginBottom: 8 }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  imagePicker: {
    height: 150,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 18,
  },
  image: { width: '100%', height: '100%' },
  input: { height: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 14 },
  textArea: { minHeight: 90, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 14, textAlignVertical: 'top' },
  switchRow: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
});
