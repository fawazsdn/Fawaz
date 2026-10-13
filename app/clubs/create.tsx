import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ImagePlus, ShieldCheck, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useCurrentUserId, useStore } from '@/store/useStore';
import { useAction } from '@/hooks/useAction';
import { useCurrentNeighborhood, useIsVerified } from '@/hooks/useNeighborhood';
import {
  declareDateOfBirth,
  getClubEligibility,
  submitClubApplication,
  updateClub,
  type ClubApplicationInput,
  type ClubEligibility,
} from '@/backend/actions';
import type { ClubCategory, ClubMembershipType } from '@/models';
import { saudiIsoDate } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { DateTimeField } from '@/components/DateTimeField';
import { EmptyState } from '@/components/EmptyState';
import { VerifyGate } from '@/components/VerifyGate';
import { useImagePicker } from '@/components/imageEditor/useImagePicker';
import {
  CLUB_CATEGORY_GROUPS,
  CLUB_ICON,
  containsContactInfo,
  validateClubApplication,
  type ClubCategoryGroup,
} from '@/features/clubs/clubLogic';

const FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'irregular'] as const;

/**
 * Create Club = submit an application for admin review (status starts at
 * pending_review on the server). With ?edit=<id> it edits a pending /
 * changes-requested application (and resubmits it), or — for an approved
 * club — the parts organizers may change without a new review.
 */
export default function CreateClubScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useCurrentUserId();
  const params = useLocalSearchParams<{ edit?: string }>();
  const verified = useIsVerified();
  const neighborhood = useCurrentNeighborhood();
  const { run, pending } = useAction();
  const editing = useStore((s) => (params.edit ? s.clubs.find((c) => c.id === params.edit) : undefined));
  const editingApproved = editing?.reviewStatus === 'approved';
  const coverPicker = useImagePicker({ aspects: ['wide'] });
  const logoPicker = useImagePicker({ aspects: ['square'], previewShape: 'circle' });

  const [eligibility, setEligibility] = useState<ClubEligibility | null>(null);
  const [eligibilityError, setEligibilityError] = useState(false);
  const [dob, setDob] = useState(() => new Date(Date.UTC(2000, 0, 1, 9)));

  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [category, setCategory] = useState<ClubCategory>(editing?.category ?? 'running');
  const [customCategory, setCustomCategory] = useState(editing?.customCategory ?? '');
  const [purpose, setPurpose] = useState(editing?.purpose ?? '');
  const [planned, setPlanned] = useState(editing?.plannedActivities ?? '');
  const [frequency, setFrequency] = useState(editing?.meetingFrequency ?? '');
  const [benefit, setBenefit] = useState(editing?.neighborhoodBenefit ?? '');
  const [rules, setRules] = useState(editing?.rules ?? '');
  const [membershipType, setMembershipType] = useState<ClubMembershipType>(editing?.membershipType ?? 'approval');
  const [meetingLocation, setMeetingLocation] = useState(editing?.meetingLocation ?? '');
  const [meetingSchedule, setMeetingSchedule] = useState(editing?.meetingSchedule ?? '');
  const [additionalInfo, setAdditionalInfo] = useState(editing?.additionalInfo ?? '');
  const [cover, setCover] = useState<{ local?: string; path?: string | null; preview?: string }>({
    path: editing?.coverImagePath ?? null,
    preview: editing?.coverImage,
  });
  const [logo, setLogo] = useState<{ local?: string; path?: string | null; preview?: string }>({
    path: editing?.logoPath ?? null,
    preview: editing?.logo,
  });
  const [submitted, setSubmitted] = useState(false);

  const loadEligibility = useCallback(async () => {
    setEligibilityError(false);
    try {
      setEligibility(await getClubEligibility());
    } catch {
      setEligibilityError(true);
    }
  }, []);

  useEffect(() => {
    if (verified && !editingApproved) loadEligibility();
  }, [verified, editingApproved, loadEligibility]);

  const title = editing ? (editingApproved ? t.clubs.editApprovedTitle : t.clubs.editTitle) : t.clubs.createTitle;
  const fallback = editing ? (`/clubs/${editing.id}` as const) : ('/clubs' as const);
  const shell = (body: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={title} fallbackRoute={fallback} />
      {body}
    </View>
  );

  if (!verified) return shell(<VerifyGate />);
  if (params.edit && !editing) return shell(<EmptyState title={t.errors.notFound} />);
  if (editing && !editingApproved && editing.ownerId !== me) return shell(<EmptyState title={t.clubs.errors.not_authorized} />);
  if (editing && !['pending_review', 'needs_changes', 'approved'].includes(editing.reviewStatus)) {
    return shell(<EmptyState title={t.clubs.statusNotice[editing.reviewStatus] || t.clubs.errors.not_authorized} />);
  }

  // Eligibility (server-computed): verified neighborhood, 18+ declaration, not suspended.
  if (!editingApproved) {
    if (eligibilityError)
      return shell(<EmptyState title={t.errors.genericTitle} actionLabel={t.common.retry} onAction={loadEligibility} />);
    if (!eligibility) {
      return shell(
        <View style={{ padding: theme.spacing.xl, alignItems: 'center' }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>,
      );
    }
    if (!eligibility.verifiedNeighborhoodId) return shell(<EmptyState title={t.clubs.needVerified} />);
    if (eligibility.suspended) return shell(<EmptyState title={t.clubs.suspendedNotice} />);
    if (eligibility.ageDeclared && !eligibility.isAdult) return shell(<EmptyState title={t.clubs.underage} />);
    if (!eligibility.ageDeclared) {
      const maxDob = new Date();
      return shell(
        <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: 14 }}>
          <Text style={theme.text('heading3')}>{t.clubs.eligibilityTitle}</Text>
          <Text style={theme.text('body', theme.colors.textSecondary)}>{t.clubs.needAge}</Text>
          <DateTimeField label={t.clubs.dobLabel} mode="date" value={dob} onChange={setDob} maximumDate={maxDob} birthDate />
          <View style={[theme.row(), { gap: 8, alignItems: 'flex-start' }]}>
            <ShieldCheck size={16} color={theme.colors.textMuted} />
            <Text style={[theme.text('caption', theme.colors.textMuted), { flex: 1 }]}>{t.clubs.dobPrivacy}</Text>
          </View>
          <Button
            label={t.clubs.confirmDob}
            loading={pending}
            onPress={async () => {
              const res = await run(() => declareDateOfBirth(saudiIsoDate(dob)));
              if (res.ok) loadEligibility();
            }}
            fullWidth
          />
        </ScrollView>,
      );
    }
    if (!editing && eligibility.pendingApplications >= 2) return shell(<EmptyState title={t.clubs.tooManyPending} />);
  }

  const errors = editingApproved
    ? {
        description: description.trim().length < 20,
        rules: rules.trim().length < 10,
      }
    : validateClubApplication({
        name,
        description,
        category,
        customCategory,
        purpose,
        plannedActivities: planned,
        meetingFrequency: frequency,
        neighborhoodBenefit: benefit,
        rules,
      });
  const hasErrors = Object.values(errors).some(Boolean);
  const contactLeak = [name, description, rules, meetingLocation, meetingSchedule].some(containsContactInfo);
  const err = (k: string) => submitted && (errors as Record<string, boolean>)[k];

  const onSubmit = async () => {
    setSubmitted(true);
    if (hasErrors || contactLeak) return;
    const input: ClubApplicationInput = {
      name: name.trim(),
      description: description.trim(),
      category,
      customCategory: category === 'other' ? customCategory.trim() : undefined,
      purpose: purpose.trim(),
      plannedActivities: planned.trim(),
      meetingFrequency: frequency,
      neighborhoodBenefit: benefit.trim(),
      rules: rules.trim(),
      membershipType,
      meetingLocation: meetingLocation.trim() || undefined,
      meetingSchedule: meetingSchedule.trim() || undefined,
      additionalInfo: additionalInfo.trim() || undefined,
      localCover: cover.local,
      localLogo: logo.local,
      coverImagePath: cover.path ?? null,
      logoPath: logo.path ?? null,
    };
    if (editing) {
      const res = await run(() => updateClub(editing.id, input));
      if (res.ok) router.replace(`/clubs/${editing.id}`);
      return;
    }
    const res = await run(() => submitClubApplication(input));
    if (res.ok) router.replace({ pathname: '/clubs/submitted', params: { id: res.value } });
  };

  const input = (bad: boolean, multiline = false) => [
    theme.text('body'),
    styles.input,
    multiline && styles.textArea,
    { borderColor: bad ? theme.colors.danger : theme.colors.border, backgroundColor: theme.colors.surface },
  ];
  const labels = t.clubs.categories as Record<string, string>;
  const groupLabels = t.clubs.categoryGroups as Record<ClubCategoryGroup, string>;
  const nbName = neighborhood ? (locale === 'ar' ? neighborhood.nameAr : neighborhood.nameEn) : '';

  const imageField = (label: string, value: typeof cover, set: typeof setCover, picker: typeof coverPicker, round: boolean) => (
    <Field label={`${label} ${t.clubs.optional}`}>
      <Pressable
        onPress={async () => {
          const uri = await picker.pickImage();
          if (uri) set({ local: uri, path: null, preview: uri });
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[
          round ? styles.logoPicker : styles.coverPicker,
          { borderColor: theme.colors.border, borderRadius: round ? 48 : theme.radii.lg },
        ]}
      >
        {value.preview ? (
          <Image source={{ uri: value.preview }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <ImagePlus size={24} color={theme.colors.primary} />
        )}
      </Pressable>
      {value.preview ? (
        <Pressable
          onPress={() => set({ local: undefined, path: null, preview: undefined })}
          style={[theme.row(), { alignItems: 'center', gap: 4, marginTop: 6 }]}
          accessibilityRole="button"
        >
          <X size={14} color={theme.colors.textMuted} />
          <Text style={theme.text('caption', theme.colors.textMuted)}>{t.common.remove}</Text>
        </Pressable>
      ) : null}
    </Field>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title={title} fallbackRoute={fallback} />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: insets.bottom + 48 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        {!editingApproved ? (
          <Card style={{ marginBottom: 18 }}>
            <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{t.clubs.intro}</Text>
            <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 6 }]}>
              {t.clubs.neighborhoodLocked.replace('{name}', nbName)}
            </Text>
          </Card>
        ) : null}

        {editing?.reviewStatus === 'needs_changes' && editing.reviewNote ? (
          <Card style={{ marginBottom: 18 }}>
            <Text style={theme.text('caption', theme.colors.textMuted)}>{t.clubs.reviewerNote}</Text>
            <Text style={theme.text('bodySmall')}>{editing.reviewNote}</Text>
          </Card>
        ) : null}

        {!editingApproved ? (
          <Field label={t.clubs.fields.name} hint={t.clubs.hints.name}>
            <TextInput value={name} onChangeText={setName} maxLength={80} style={input(!!err('name'))} />
          </Field>
        ) : null}

        {!editingApproved ? (
          <Field label={t.clubs.fields.category}>
            <View style={{ gap: 12 }}>
              {(Object.keys(CLUB_CATEGORY_GROUPS) as ClubCategoryGroup[]).map((g) => (
                <View key={g}>
                  <Text style={[theme.text('caption', theme.colors.textMuted), { marginBottom: 6 }]}>{groupLabels[g]}</Text>
                  <View style={[theme.row(), styles.wrap]}>
                    {(CLUB_CATEGORY_GROUPS[g] as readonly ClubCategory[]).map((c) => (
                      <Chip key={c} label={`${CLUB_ICON[c]} ${labels[c]}`} selected={category === c} onPress={() => setCategory(c)} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
            {category === 'other' ? (
              <View style={{ marginTop: 12 }}>
                <TextInput
                  value={customCategory}
                  onChangeText={(v) => setCustomCategory(v.slice(0, 40))}
                  maxLength={40}
                  placeholder={t.clubs.hints.customCategory}
                  placeholderTextColor={theme.colors.textMuted}
                  style={input(!!err('customCategory'))}
                />
                <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 4, textAlign: 'right' }]}>
                  {customCategory.length}/40
                </Text>
              </View>
            ) : null}
          </Field>
        ) : null}

        <Field label={t.clubs.fields.description} hint={t.clubs.hints.description}>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={5000}
            style={input(!!err('description'), true)}
          />
        </Field>

        {!editingApproved ? (
          <>
            <Field label={t.clubs.fields.purpose} hint={t.clubs.hints.purpose}>
              <TextInput value={purpose} onChangeText={setPurpose} multiline maxLength={2000} style={input(!!err('purpose'), true)} />
            </Field>
            <Field label={t.clubs.fields.plannedActivities} hint={t.clubs.hints.plannedActivities}>
              <TextInput
                value={planned}
                onChangeText={setPlanned}
                multiline
                maxLength={2000}
                style={input(!!err('plannedActivities'), true)}
              />
            </Field>
            <Field label={t.clubs.fields.meetingFrequency}>
              <View style={[theme.row(), styles.wrap]}>
                {FREQUENCIES.map((f) => (
                  <Chip key={f} label={t.clubs.frequency[f]} selected={frequency === f} onPress={() => setFrequency(f)} />
                ))}
              </View>
              {err('meetingFrequency') ? (
                <Text style={[theme.text('caption', theme.colors.danger), { marginTop: 4 }]}>{t.clubs.fixFields}</Text>
              ) : null}
            </Field>
            <Field label={t.clubs.fields.benefit} hint={t.clubs.hints.benefit}>
              <TextInput
                value={benefit}
                onChangeText={setBenefit}
                multiline
                maxLength={2000}
                style={input(!!err('neighborhoodBenefit'), true)}
              />
            </Field>
          </>
        ) : null}

        <Field label={t.clubs.fields.rules} hint={t.clubs.hints.rules}>
          <TextInput value={rules} onChangeText={setRules} multiline maxLength={3000} style={input(!!err('rules'), true)} />
        </Field>

        <Field label={t.clubs.fields.membershipType}>
          <View style={[theme.row(), styles.wrap]}>
            <Chip
              label={t.clubs.membershipApproval}
              selected={membershipType === 'approval'}
              onPress={() => setMembershipType('approval')}
            />
            <Chip label={t.clubs.membershipOpen} selected={membershipType === 'open'} onPress={() => setMembershipType('open')} />
          </View>
        </Field>

        {imageField(t.clubs.fields.cover, cover, setCover, coverPicker, false)}
        {imageField(t.clubs.fields.logo, logo, setLogo, logoPicker, true)}

        <Field label={`${t.clubs.fields.meetingLocation} ${t.clubs.optional}`} hint={t.clubs.hints.meetingLocation}>
          <TextInput value={meetingLocation} onChangeText={setMeetingLocation} maxLength={200} style={input(false)} />
        </Field>
        <Field label={`${t.clubs.fields.meetingSchedule} ${t.clubs.optional}`}>
          <TextInput value={meetingSchedule} onChangeText={setMeetingSchedule} maxLength={200} style={input(false)} />
        </Field>
        {!editingApproved ? (
          <Field label={`${t.clubs.fields.additionalInfo} ${t.clubs.optional}`}>
            <TextInput value={additionalInfo} onChangeText={setAdditionalInfo} multiline maxLength={2000} style={input(false, true)} />
          </Field>
        ) : null}

        {contactLeak ? (
          <Text style={[theme.text('bodySmall', theme.colors.danger), { marginBottom: 10 }]}>{t.clubs.noContactInfo}</Text>
        ) : null}
        <Button
          label={editing ? (editing.reviewStatus === 'needs_changes' ? t.clubs.editAndResubmit : t.clubs.saveChanges) : t.clubs.submit}
          onPress={onSubmit}
          loading={pending}
          disabled={pending}
          fullWidth
          size="lg"
        />
        {submitted && hasErrors ? (
          <Text style={[theme.text('caption', theme.colors.danger), { textAlign: 'center', marginTop: 8 }]}>{t.clubs.fixFields}</Text>
        ) : null}
      </ScrollView>
      {coverPicker.editor}
      {logoPicker.editor}
    </KeyboardAvoidingView>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginBottom: 6 }]}>{label}</Text>
      {children}
      {hint ? <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 14 },
  textArea: { minHeight: 96, paddingVertical: 12, textAlignVertical: 'top' },
  wrap: { gap: 8, flexWrap: 'wrap' },
  coverPicker: { height: 150, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoPicker: {
    width: 96,
    height: 96,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
