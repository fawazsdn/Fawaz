import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Camera } from 'lucide-react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, useCurrentUserId } from '@/store/useStore';
import { useAction } from '@/hooks/useAction';
import { saveProfile } from '@/backend/actions';
import { useImagePicker } from '@/components/imageEditor/useImagePicker';
import { SkeletonCardRow } from '@/components/Skeleton';
import type { User } from '@/models';
import { profileSchema, type ProfileFormValues } from '@/models/schemas';
import type { NamePrivacy } from '@/models';
import { useSafeBack } from '@/hooks/useSafeBack';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';

export default function EditProfileScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const me = useCurrentUserId();
  const user = useStore((s) => s.getUser(me));
  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={t.profile.editProfile} fallbackRoute="/settings" />
        <View style={{ padding: theme.spacing.md }}>
          <SkeletonCardRow count={2} />
        </View>
      </View>
    );
  }
  return <EditProfileForm user={user} />;
}

function EditProfileForm({ user }: { user: User }) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const safeBack = useSafeBack('/settings');
  const { run, pending: saving } = useAction();
  const { pickImage: pickAvatar, editor } = useImagePicker({ aspects: ['square'], previewShape: 'circle' });

  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    defaultValues: { firstName: user.firstName, lastName: user.lastName, bio: user.bio ?? '', namePrivacy: user.namePrivacy },
  });

  const firstName = watch('firstName');
  const namePrivacy = watch('namePrivacy');

  const options: { key: NamePrivacy; label: string }[] = [
    { key: 'full', label: t.profileSetup.displayFull },
    { key: 'first_last_initial', label: t.profileSetup.displayFirstLast },
    { key: 'first_only', label: t.profileSetup.displayFirstOnly },
  ];

  const pickImage = async () => {
    const uri = await pickAvatar();
    if (uri) setAvatarUrl(uri);
  };

  const onSave = async (values: ProfileFormValues) => {
    const res = await run(() =>
      saveProfile({
        firstName: values.firstName.trim(),
        lastName: (values.lastName ?? '').trim(),
        namePrivacy: values.namePrivacy,
        bio: values.bio?.trim() || undefined,
        localAvatarUri: avatarUrl !== user.avatarUrl ? avatarUrl : undefined,
        locale,
      }),
    );
    if (res.ok) safeBack();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader title={t.profile.editProfile} fallbackRoute="/settings" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Pressable onPress={pickImage} accessibilityRole="button" style={styles.avatarPicker}>
          <Avatar uri={avatarUrl} name={firstName} size={88} ring />
          <View style={[styles.cameraBadge, { backgroundColor: theme.colors.primary, borderColor: theme.colors.background }]}>
            <Camera size={14} color={theme.colors.onPrimary} />
          </View>
        </Pressable>

        <Field label={t.profileSetup.firstName} error={errors.firstName?.message}>
          <Controller
            control={control}
            name="firstName"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput value={value} onChangeText={onChange} onBlur={onBlur} style={fieldStyle(theme, !!errors.firstName)} />
            )}
          />
        </Field>
        <Field label={t.profileSetup.lastNameOptional}>
          <Controller
            control={control}
            name="lastName"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput value={value} onChangeText={onChange} onBlur={onBlur} style={fieldStyle(theme, false)} />
            )}
          />
        </Field>
        <Field label={t.profileSetup.bio}>
          <Controller
            control={control}
            name="bio"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                multiline
                style={[fieldStyle(theme, false), { height: 84, textAlignVertical: 'top', paddingTop: 12 }]}
              />
            )}
          />
        </Field>

        <Text style={[theme.text('title'), { marginBottom: 10 }]}>{t.profileSetup.displayPreference}</Text>
        <Controller
          control={control}
          name="namePrivacy"
          render={({ field: { onChange } }) => (
            <View style={{ gap: 8 }}>
              {options.map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => onChange(opt.key)}
                  style={[
                    theme.row(),
                    styles.radioRow,
                    { borderColor: namePrivacy === opt.key ? theme.colors.primary : theme.colors.border },
                  ]}
                >
                  <View style={[styles.radioDot, { borderColor: namePrivacy === opt.key ? theme.colors.primary : theme.colors.border }]}>
                    {namePrivacy === opt.key ? <View style={[styles.radioInner, { backgroundColor: theme.colors.primary }]} /> : null}
                  </View>
                  <Text style={theme.text('body')}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        />

        <View style={{ height: 24 }} />
        <Button label={t.common.save} onPress={handleSubmit(onSave)} disabled={!isValid} loading={saving} fullWidth size="lg" />
      </ScrollView>
      {editor}
    </KeyboardAvoidingView>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginBottom: 6 }]}>{label}</Text>
      {children}
      {error ? <Text style={[theme.text('caption', theme.colors.danger), { marginTop: 4 }]}>{error}</Text> : null}
    </View>
  );
}

function fieldStyle(theme: ReturnType<typeof useTheme>, hasError: boolean) {
  return [
    theme.text('body'),
    {
      height: 50,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hasError ? theme.colors.danger : theme.colors.border,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.md,
      paddingHorizontal: 14,
    },
  ];
}

const styles = StyleSheet.create({
  avatarPicker: { alignSelf: 'center', marginBottom: 24 },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  radioRow: { alignItems: 'center', gap: 10, padding: 14, borderWidth: 1.5, borderRadius: 10 },
  radioDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
});
