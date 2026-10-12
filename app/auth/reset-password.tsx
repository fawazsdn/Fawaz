import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AuthShell } from '@/features/auth/AuthShell';
import { PasswordField, useAuthErrorText } from '@/features/auth/AuthFields';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { classifyAuthError, exchangeAuthCode, parseAuthLink, passwordProblem, updatePassword } from '@/features/auth/supabaseAuth';
import { routeAfterAuth } from '@/features/auth/routeAfterAuth';

/**
 * Deep-link target for password-reset emails: haratna://auth/reset-password?code=...
 * The code is exchanged for a short-lived recovery session, then the new
 * password is saved with updateUser().
 */
export default function ResetPasswordScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams();
  const setSupabaseAuth = useStore((s) => s.setSupabaseAuth);
  const errorText = useAuthErrorText();
  const confirmRef = useRef<TextInput>(null);

  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { code, error, errorDescription } = parseAuthLink(params as Record<string, string>);
      if (error || !code) {
        if (alive) setLinkError(errorText(classifyAuthError({ code: error, message: errorDescription })) ?? t.auth.errLinkExpired);
        return;
      }
      const outcome = await exchangeAuthCode(code);
      if (!alive) return;
      if (!outcome.ok) {
        setLinkError(errorText(outcome.reason) ?? t.auth.errLinkExpired);
        return;
      }
      setSupabaseAuth(outcome.userId, outcome.provider, outcome.email);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per link
  }, []);

  const onSave = async () => {
    const problem = passwordProblem(password);
    const next: typeof errors = {};
    if (problem === 'too_short') next.password = t.auth.errPasswordShort;
    else if (problem === 'needs_letter_and_number') next.password = t.auth.errPasswordWeak;
    else if (confirm !== password) next.confirm = t.auth.errPasswordMismatch;
    setErrors(next);
    if (Object.keys(next).length) return;
    setPending(true);
    const res = await updatePassword(password);
    setPending(false);
    if (!res.ok) {
      setErrors({ form: errorText(res.reason ?? 'unknown') ?? t.auth.signInError });
      return;
    }
    setDone(true);
  };

  if (linkError) {
    return (
      <AuthShell title={t.auth.resetTitle} fallbackRoute="/(auth)/sign-in">
        <Text style={[theme.text('body', theme.colors.danger), styles.center]}>{linkError}</Text>
        <View style={{ gap: 10, marginTop: 20 }}>
          <Button label={t.auth.sendResetLink} onPress={() => router.replace('/(auth)/forgot-password')} fullWidth />
          <Button label={t.auth.backToSignIn} variant="outline" onPress={() => router.replace('/(auth)/sign-in')} fullWidth />
        </View>
      </AuthShell>
    );
  }

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <AuthShell title={t.auth.resetTitle} body={done ? t.auth.passwordUpdated : t.auth.resetBody} showBack={false}>
      {done ? (
        <Button label={t.common.continue} onPress={async () => router.replace(await routeAfterAuth())} fullWidth size="lg" />
      ) : (
        <>
          <PasswordField
            label={t.auth.newPassword}
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
          <PasswordField
            ref={confirmRef}
            label={t.auth.confirmPassword}
            value={confirm}
            onChangeText={setConfirm}
            error={errors.confirm}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={onSave}
          />
          <Text style={[theme.text('caption', theme.colors.textMuted), { marginBottom: 16 }]}>{t.auth.passwordRules}</Text>
          {errors.form ? <Text style={[theme.text('bodySmall', theme.colors.danger), styles.center]}>{errors.form}</Text> : null}
          <Button label={t.auth.savePassword} onPress={onSave} loading={pending} disabled={pending} fullWidth size="lg" />
        </>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center', marginBottom: 12 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
