import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { profileService } from '@/services';
import type { NamePrivacy } from '@/models';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';

export default function EditProfileScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const user = useStore((s) => s.currentUser());
  const createProfile = useStore((s) => s.createProfile);

  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [bio, setBio] = useState(user.bio ?? '');
  const [namePrivacy, setNamePrivacy] = useState<NamePrivacy>(user.namePrivacy);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [saving, setSaving] = useState(false);

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

  const onSave = async () => {
    setSaving(true);
    await profileService.updateProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      namePrivacy,
      bio: bio.trim() || undefined,
      avatarUrl,
    });
    createProfile({ firstName: firstName.trim(), lastName: lastName.trim(), namePrivacy, bio: bio.trim() || undefined, avatarUrl });
    setSaving(false);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.profile.editProfile} />
      <View style={{ padding: theme.spacing.md }}>
        <Pressable onPress={pickImage} accessibilityRole="button" style={styles.avatarPicker}>
          <Avatar uri={avatarUrl} name={firstName} size={88} ring />
          <View style={[styles.cameraBadge, { backgroundColor: theme.colors.primary, borderColor: theme.colors.background }]}>
            <Camera size={14} color={theme.colors.onPrimary} />
          </View>
        </Pressable>

        <Field label={t.profileSetup.firstName}>
          <TextInput value={firstName} onChangeText={setFirstName} style={fieldStyle(theme)} />
        </Field>
        <Field label={t.profileSetup.lastNameOptional}>
          <TextInput value={lastName} onChangeText={setLastName} style={fieldStyle(theme)} />
        </Field>
        <Field label={t.profileSetup.bio}>
          <TextInput
            value={bio}
            onChangeText={setBio}
            multiline
            style={[fieldStyle(theme), { height: 84, textAlignVertical: 'top', paddingTop: 12 }]}
          />
        </Field>

        <Text style={[theme.text('title'), { marginBottom: 10 }]}>{t.profileSetup.displayPreference}</Text>
        <View style={{ gap: 8 }}>
          {options.map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => setNamePrivacy(opt.key)}
              style={[theme.row(), styles.radioRow, { borderColor: namePrivacy === opt.key ? theme.colors.primary : theme.colors.border }]}
            >
              <View style={[styles.radioDot, { borderColor: namePrivacy === opt.key ? theme.colors.primary : theme.colors.border }]}>
                {namePrivacy === opt.key ? <View style={[styles.radioInner, { backgroundColor: theme.colors.primary }]} /> : null}
              </View>
              <Text style={theme.text('body')}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 24 }} />
        <Button label={t.common.save} onPress={onSave} loading={saving} fullWidth size="lg" />
      </View>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginBottom: 6 }]}>{label}</Text>
      {children}
    </View>
  );
}

function fieldStyle(theme: ReturnType<typeof useTheme>) {
  return [
    theme.text('body'),
    {
      height: 50,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
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
