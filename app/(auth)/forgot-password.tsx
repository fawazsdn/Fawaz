import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AuthShell } from '@/features/auth/AuthShell';
import { AuthTextField, useAuthErrorText } from '@/features/auth/AuthFields';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { isValidEmail, sendPasswordReset } from '@/features/auth/supabaseAuth';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const errorText = useAuthErrorText();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  const onSubmit = async () => {
    if (!isValidEmail(email)) {
      setError(t.auth.errInvalidEmail);
      return;
    }
    setError(null);
    setPending(true);
    const res = await sendPasswordReset(email);
    setPending(false);
    // Same message whether or not the address exists (no account enumeration),
    // but real transport errors (rate limit, offline) are shown.
    if (res.ok || res.reason === 'unknown') setSent(true);
    else setError(errorText(res.reason ?? 'unknown'));
  };

  return (
    <AuthShell title={t.auth.forgotTitle} body={t.auth.forgotBody} fallbackRoute="/(auth)/sign-in">
      <AuthTextField
        label={t.auth.email}
        value={email}
        onChangeText={setEmail}
        error={error}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={onSubmit}
        editable={!pending && !sent}
      />
      {sent ? <Text style={[theme.text('bodySmall', theme.colors.primary), styles.msg]}>{t.auth.resetSent}</Text> : null}
      {sent ? (
        <Button label={t.auth.backToSignIn} onPress={() => router.replace('/(auth)/sign-in')} fullWidth size="lg" />
      ) : (
        <Button label={t.auth.sendResetLink} onPress={onSubmit} loading={pending} disabled={pending} fullWidth size="lg" />
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({ msg: { textAlign: 'center', marginBottom: 16 } });
