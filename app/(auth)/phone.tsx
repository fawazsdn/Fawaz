import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AuthShell } from '@/features/auth/AuthShell';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { authService } from '@/services';

export default function PhoneScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const digits = phone.replace(/\D/g, '');
  const valid = digits.length === 9 && digits.startsWith('5');

  const onSubmit = async () => {
    setSubmitting(true);
    await authService.sendOtp(`+966${digits}`);
    setSubmitting(false);
    router.push('/(auth)/otp');
  };

  return (
    <AuthShell
      title={t.auth.phoneTitle}
      body={t.auth.phoneBody}
      showBack={false}
      footer={<Button label={t.auth.sendCode} onPress={onSubmit} disabled={!valid} loading={submitting} fullWidth size="lg" />}
    >
      <View
        style={[
          styles.inputWrap,
          theme.row(),
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.md },
        ]}
      >
        <View style={[styles.prefix, { borderColor: theme.colors.border }]}>
          <Text style={theme.text('title')}>+966</Text>
        </View>
        <TextInput
          value={phone}
          onChangeText={(v) => setPhone(v.replace(/[^\d]/g, '').slice(0, 9))}
          placeholder={t.auth.phonePlaceholder}
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="number-pad"
          style={[styles.input, theme.text('title')]}
          autoFocus
          accessibilityLabel={t.auth.phoneTitle}
        />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  inputWrap: { alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, height: 56 },
  prefix: { paddingHorizontal: 16, height: '100%', alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, paddingHorizontal: 14 },
});
