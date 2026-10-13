import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AuthShell } from '@/features/auth/AuthShell';
import { AuthTextField, PasswordField, useAuthErrorText } from '@/features/auth/AuthFields';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { isValidEmail, passwordProblem, signUpWithEmail } from '@/features/auth/supabaseAuth';
import { routeAfterAuth } from '@/features/auth/routeAfterAuth';
import { ConsentNotice } from '@/features/auth/ConsentNotice';

export default function SignUpScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const setSupabaseAuth = useStore((s) => s.setSupabaseAuth);
  const errorText = useAuthErrorText();
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [consentError, setConsentError] = useState(false);

  const validate = () => {
    const next: typeof errors = {};
    if (!isValidEmail(email)) next.email = t.auth.errInvalidEmail;
    const problem = passwordProblem(password);
    if (problem === 'too_short') next.password = t.auth.errPasswordShort;
    else if (problem === 'needs_letter_and_number') next.password = t.auth.errPasswordWeak;
    if (!next.password && confirm !== password) next.confirm = t.auth.errPasswordMismatch;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async () => {
    setFormError(null);
    const fieldsOk = validate();
    setConsentError(!agreed);
    if (!fieldsOk || !agreed) return;
    setPending(true);
    const outcome = await signUpWithEmail(email, password, locale);
    if (!outcome.ok) {
      setPending(false);
      setFormError(errorText(outcome.reason));
      return;
    }
    if (outcome.needsConfirmation) {
      setPending(false);
      router.replace({ pathname: '/(auth)/check-email', params: { email: outcome.email ?? email } });
      return;
    }
    setSupabaseAuth(outcome.userId, 'email', outcome.email);
    const next = await routeAfterAuth();
    setPending(false);
    router.replace(next);
  };

  return (
    <AuthShell title={t.auth.signUpTitle} body={t.auth.signUpBody} fallbackRoute="/(auth)/sign-in">
      <AuthTextField
        label={t.auth.email}
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        editable={!pending}
      />
      <PasswordField
        ref={passwordRef}
        label={t.auth.password}
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        editable={!pending}
      />
      <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: -8, marginBottom: 14 }]}>{t.auth.passwordRules}</Text>
      <PasswordField
        ref={confirmRef}
        label={t.auth.confirmPassword}
        value={confirm}
        onChangeText={setConfirm}
        error={errors.confirm}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        editable={!pending}
      />

      {formError ? <Text style={[theme.text('bodySmall', theme.colors.danger), styles.center]}>{formError}</Text> : null}

      <ConsentNotice
        checked={agreed}
        onToggle={() => {
          setAgreed((v) => !v);
          setConsentError(false);
        }}
        error={consentError}
      />

      <Button label={t.auth.createAccount} onPress={onSubmit} loading={pending} disabled={pending} fullWidth size="lg" />

      <View style={[theme.row(), styles.row]}>
        <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{t.auth.haveAccount}</Text>
        <Pressable onPress={() => router.replace('/(auth)/sign-in')} accessibilityRole="button" hitSlop={8}>
          <Text style={theme.text('bodySmall', theme.colors.primary)}>{t.auth.signIn}</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center', marginBottom: 12 },
  row: { justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 18 },
});
