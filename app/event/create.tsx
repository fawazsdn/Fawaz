import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ImagePlus, LocateFixed, MapPin, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useCurrentNeighborhood, useIsVerified } from '@/hooks/useNeighborhood';
import { useAction } from '@/hooks/useAction';
import { createEvent, approximateCoordinate } from '@/backend/actions';
import { locateOnce } from '@/backend/location';
import type { EventCategory, EventKind, EventOccasion } from '@/models';
import { saudiParts, saudiWallTimeToDate } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { DateTimeField } from '@/components/DateTimeField';
import { HaratnaMap, type MapCoordinate } from '@/components/HaratnaMap';
import { VerifyGate } from '@/components/VerifyGate';
import { useImagePicker } from '@/components/imageEditor/useImagePicker';
import { CATEGORY_ICON } from '@/features/events/EventCard';

const CATEGORIES: EventCategory[] = ['football', 'padel', 'walking', 'family', 'kids', 'iftar', 'cleanup', 'coffee', 'community'];
const OCCASIONS: (EventOccasion | 'none')[] = ['none', 'national_day', 'founding_day', 'ramadan', 'eid', 'festival'];

/** Next whole hour (Riyadh), at least 1h from now. */
function defaultStart(): Date {
  const p = saudiParts(new Date(Date.now() + 3600000));
  return saudiWallTimeToDate(p.year, p.month, p.day, p.hour + 1, 0);
}

/** Combines the start's Riyadh date with an end time-of-day; rolls past midnight if needed. */
export function combineEnd(start: Date, endTime: Date): Date {
  const s = saudiParts(start);
  const e = saudiParts(endTime);
  let end = saudiWallTimeToDate(s.year, s.month, s.day, e.hour, e.minute);
  if (end.getTime() <= start.getTime()) end = new Date(end.getTime() + 86400000);
  return end;
}

export default function CreateEventScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ kind?: string }>();
  const neighborhood = useCurrentNeighborhood();
  const verified = useIsVerified();
  const { run, pending } = useAction();
  const { pickImage, editor } = useImagePicker({ aspects: ['wide', 'classic', 'square'] });

  const [kind, setKind] = useState<EventKind>(params.kind === 'event' ? 'event' : 'activity');
  const [occasion, setOccasion] = useState<EventOccasion | 'none'>('none');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('football');
  const [image, setImage] = useState<string | undefined>();
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [start, setStart] = useState<Date>(defaultStart);
  const [endTime, setEndTime] = useState<Date>(() => new Date(defaultStart().getTime() + 90 * 60000));
  const [capacity, setCapacity] = useState('12');
  const [recurring, setRecurring] = useState(false);
  const [audience, setAudience] = useState<'neighborhood' | 'city'>('neighborhood');
  const [pin, setPin] = useState<MapCoordinate | null>(null);
  const [locating, setLocating] = useState(false);
  const [locNote, setLocNote] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const end = useMemo(() => combineEnd(start, endTime), [start, endTime]);
  const cap = Number(capacity);
  const errors = {
    title: title.trim().length < 3,
    location: location.trim().length < 2,
    capacity: !(cap >= 2 && cap <= 1000),
    start: start.getTime() <= Date.now(),
  };
  const valid = !errors.title && !errors.location && !errors.capacity && !errors.start;

  if (!verified) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={t.eventCreate.title} fallbackRoute="/events" />
        <VerifyGate />
      </View>
    );
  }

  const useMyLocation = async () => {
    setLocating(true);
    setLocNote(null);
    const loc = await locateOnce();
    setLocating(false);
    if (loc.status !== 'ok') {
      setLocNote(loc.status === 'denied' ? t.map.locationDenied : t.verification.locationUnavailableBody);
      return;
    }
    setPin({ latitude: approximateCoordinate(loc.lat), longitude: approximateCoordinate(loc.lng) });
  };

  const onSubmit = async () => {
    setSubmitted(true);
    if (!valid || !neighborhood) return;
    const res = await run(() =>
      createEvent({
        kind,
        occasion: occasion === 'none' ? undefined : occasion,
        title: title.trim(),
        category,
        description: description.trim(),
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        locationLabel: location.trim(),
        coordinate: pin ? { lat: pin.latitude, lng: pin.longitude } : undefined,
        capacity: cap,
        audience,
        recurring,
        localCoverImage: image,
      }),
    );
    if (res.ok) router.replace(`/event/${res.value}`);
  };

  const inputStyle = (bad: boolean) => [theme.text('body'), styles.input, { borderColor: bad ? theme.colors.danger : theme.colors.border, backgroundColor: theme.colors.surface }];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader title={t.eventCreate.title} fallbackRoute="/events" />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <Field label={t.eventCreate.kind}>
          <View style={[theme.row(), { gap: 8 }]}>
            <Chip label={t.events.kindActivity} selected={kind === 'activity'} onPress={() => setKind('activity')} />
            <Chip label={t.events.kindEvent} selected={kind === 'event'} onPress={() => setKind('event')} />
          </View>
          <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 6 }]}>
            {kind === 'activity' ? t.eventCreate.kindActivityHint : t.eventCreate.kindEventHint}
          </Text>
        </Field>

        <Field label={t.eventCreate.coverImage}>
          <Pressable
            onPress={async () => {
              const uri = await pickImage();
              if (uri) setImage(uri);
            }}
            style={[styles.imagePicker, { borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}
            accessibilityRole="button"
            accessibilityLabel={t.eventCreate.addCover}
          >
            {image ? (
              <Image source={{ uri: image }} style={styles.image} contentFit="cover" />
            ) : (
              <View style={{ alignItems: 'center', gap: 6 }}>
                <ImagePlus size={26} color={theme.colors.primary} />
                <Text style={theme.text('caption', theme.colors.textMuted)}>{t.eventCreate.addCover}</Text>
              </View>
            )}
          </Pressable>
          {image ? (
            <Pressable onPress={() => setImage(undefined)} style={[theme.row(), { alignItems: 'center', gap: 4, marginTop: 6 }]} accessibilityRole="button">
              <X size={14} color={theme.colors.textMuted} />
              <Text style={theme.text('caption', theme.colors.textMuted)}>{t.common.remove}</Text>
            </Pressable>
          ) : null}
        </Field>

        <Field label={t.eventCreate.titleLabel}>
          <TextInput value={title} onChangeText={setTitle} maxLength={200} style={inputStyle(submitted && errors.title)} placeholderTextColor={theme.colors.textMuted} />
        </Field>

        <Field label={t.eventCreate.category}>
          <View style={[theme.row(), styles.wrap]}>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={`${CATEGORY_ICON[c] ?? ''} ${t.eventCreate.categories[c]}`} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </View>
        </Field>

        <Field label={t.occasions.label}>
          <View style={[theme.row(), styles.wrap]}>
            {OCCASIONS.map((o) => (
              <Chip key={o} label={t.occasions[o]} selected={occasion === o} onPress={() => setOccasion(o)} />
            ))}
          </View>
        </Field>

        <Field label={t.eventCreate.description}>
          <TextInput value={description} onChangeText={setDescription} multiline maxLength={5000} style={[...inputStyle(false), styles.textArea]} placeholderTextColor={theme.colors.textMuted} />
        </Field>

        <Field label={t.eventCreate.date}>
          <View style={{ gap: 8 }}>
            <DateTimeField label={t.eventCreate.date} mode="date" value={start} onChange={setStart} minimumDate={new Date()} />
            <View style={[theme.row(), { gap: 8 }]}>
              <View style={{ flex: 1 }}>
                <DateTimeField label={t.eventCreate.startTime} mode="time" value={start} onChange={setStart} />
              </View>
              <View style={{ flex: 1 }}>
                <DateTimeField label={t.eventCreate.endTime} mode="time" value={endTime} onChange={setEndTime} />
              </View>
            </View>
            <Text style={theme.text('caption', theme.colors.textMuted)}>{t.eventCreate.timesInSaudi}</Text>
            {submitted && errors.start ? <Text style={theme.text('caption', theme.colors.danger)}>{t.eventCreate.startInPast}</Text> : null}
          </View>
        </Field>

        <Field label={t.eventCreate.location}>
          <TextInput value={location} onChangeText={setLocation} maxLength={200} style={inputStyle(submitted && errors.location)} placeholderTextColor={theme.colors.textMuted} />
        </Field>

        <Field label={t.eventCreate.pinLocation}>
          <Text style={[theme.text('caption', theme.colors.textMuted), { marginBottom: 8 }]}>{t.eventCreate.pinLocationHint}</Text>
          {neighborhood ? (
            <View style={{ height: 200, borderRadius: theme.radii.md, overflow: 'hidden' }}>
              <HaratnaMap
                center={pin ?? { latitude: neighborhood.centerLat, longitude: neighborhood.centerLng }}
                delta={0.02}
                markers={pin ? [{ id: 'pin', coordinate: pin, title: location || title || t.eventCreate.pinned, color: theme.colors.primary }] : []}
                onMapPress={(c) => setPin({ latitude: approximateCoordinate(c.latitude), longitude: approximateCoordinate(c.longitude) })}
              />
            </View>
          ) : null}
          <View style={[theme.row(), { gap: 8, marginTop: 8, flexWrap: 'wrap' }]}>
            <Button
              label={locating ? t.eventCreate.usingCurrentLocation : t.eventCreate.useMyLocation}
              onPress={useMyLocation}
              variant="outline"
              size="sm"
              loading={locating}
              icon={<LocateFixed size={14} color={theme.colors.primary} />}
            />
            {pin ? <Button label={t.eventCreate.removePin} onPress={() => setPin(null)} variant="ghost" size="sm" icon={<MapPin size={14} color={theme.colors.textMuted} />} /> : null}
          </View>
          {locNote ? <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 6 }]}>{locNote}</Text> : null}
        </Field>

        <Field label={t.eventCreate.capacity}>
          <TextInput
            value={capacity}
            onChangeText={(v) => setCapacity(v.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            style={[...inputStyle(submitted && errors.capacity), { width: 110 }]}
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

        <View style={{ height: 8 }} />
        <Button label={t.eventCreate.publish} onPress={onSubmit} loading={pending} disabled={pending} fullWidth size="lg" />
        {submitted && !valid ? <Text style={[theme.text('caption', theme.colors.danger), { textAlign: 'center', marginTop: 8 }]}>{t.errors.invalid}</Text> : null}
      </ScrollView>
      {editor}
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
  imagePicker: { height: 160, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  input: { height: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 14 },
  textArea: { minHeight: 96, height: undefined, paddingVertical: 12, textAlignVertical: 'top' },
  switchRow: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  wrap: { gap: 8, flexWrap: 'wrap' },
});
