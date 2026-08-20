import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { AuthShell } from '@/features/auth/AuthShell';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/Avatar';
import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { profileService } from '@/services';
import { profileSchema, type ProfileFormValues } from '@/models/schemas';
import type { NamePrivacy } from '@/models';

export default function ProfileSetupScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const createProfile = useStore((s) => s.createProfile);

  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    defaultValues: { firstName: '', lastName: '', bio: '', namePrivacy: 'first_last_initial' },
  });

  const firstName = watch('firstName');
  const namePrivacy = watch('namePrivacy');

  const options: { key: NamePrivacy; label: string }[] = [
    { key: 'full', label: t.profileSetup.displayFull },
    { key: 'first_last_initial', label: t.profileSetup.displayFirstLast },
    { key: 'first_only', label: t.profileSetup.displayFirstOnly },
  ];

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) setAvatarUrl(result.assets[0].uri);
  };

  const onSubmit = async (values: ProfileFormValues) => {
    setSubmitting(true);
    const input = {
      firstName: values.firstName.trim(),
      lastName: (values.lastName ?? '').trim(),
      namePrivacy: values.namePrivacy,
      bio: values.bio?.trim() || undefined,
      avatarUrl,
    };
    await profileService.updateProfile(input);
    createProfile(input);
    setSubmitting(false);
    router.replace('/(auth)/select-city');
  };

  return (
    <AuthShell
      title={t.profileSetup.title}
      showBack={false}
      footer={
        <Button
          label={t.profileSetup.continue}
          onPress={handleSubmit(onSubmit)}
          disabled={!isValid}
          loading={submitting}
          fullWidth
          size="lg"
        />
      }
    >
      <Pressable onPress={pickImage} accessibilityRole="button" accessibilityLabel={t.profileSetup.uploadPhoto} style={styles.avatarPicker}>
        <Avatar uri={avatarUrl} name={firstName || '؟'} size={92} ring />
        <View style={[styles.cameraBadge, { backgroundColor: theme.colors.primary, borderColor: theme.colors.background }]}>
          <Camera size={15} color={theme.colors.onPrimary} />
        </View>
      </Pressable>
      <Text style={[theme.text('bodySmall', theme.colors.primary), styles.centerText]} onPress={pickImage}>
        {avatarUrl ? t.profileSetup.changePhoto : t.profileSetup.uploadPhoto}
      </Text>

      <Field label={t.profileSetup.firstName} error={errors.firstName?.message}>
        <Controller
          control={control}
          name="firstName"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              style={fieldInputStyle(theme, !!errors.firstName)}
              placeholderTextColor={theme.colors.textMuted}
              accessibilityLabel={t.profileSetup.firstName}
            />
          )}
        />
      </Field>
      <Field label={t.profileSetup.lastNameOptional}>
        <Controller
          control={control}
          name="lastName"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              style={fieldInputStyle(theme, false)}
              placeholderTextColor={theme.colors.textMuted}
              accessibilityLabel={t.profileSetup.lastName}
            />
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
              placeholder={t.profileSetup.bioPlaceholder}
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={3}
              style={[fieldInputStyle(theme, false), { height: 84, textAlignVertical: 'top', paddingTop: 12 }]}
              accessibilityLabel={t.profileSetup.bio}
            />
          )}
        />
      </Field>

      <Text style={[theme.text('title'), { marginTop: 8, marginBottom: 10 }]}>{t.profileSetup.displayPreference}</Text>
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
                  {
                    borderColor: namePrivacy === opt.key ? theme.colors.primary : theme.colors.border,
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radii.md,
                  },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: namePrivacy === opt.key }}
              >
                <View style={[styles.radioDot, { borderColor: namePrivacy === opt.key ? theme.colors.primary : theme.colors.border }]}>
                  {namePrivacy === opt.key ? <View style={[styles.radioDotInner, { backgroundColor: theme.colors.primary }]} /> : null}
                </View>
                <Text style={theme.text('body')}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      />
    </AuthShell>
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

function fieldInputStyle(theme: ReturnType<typeof useTheme>, hasError: boolean) {
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
  avatarPicker: { alignSelf: 'center', marginBottom: 6 },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  centerText: { textAlign: 'center', marginBottom: 24 },
  radioRow: { alignItems: 'center', gap: 10, padding: 14, borderWidth: 1.5 },
  radioDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDotInner: { width: 10, height: 10, borderRadius: 5 },
});
