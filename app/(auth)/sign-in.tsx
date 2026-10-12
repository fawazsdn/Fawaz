import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { LogIn } from 'lucide-react-native';

import { AuthShell } from '@/features/auth/AuthShell';
import { AuthTextField, PasswordField, useAuthErrorText } from '@/features/auth/AuthFields';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { isValidEmail, signInWithApple, signInWithEmail, signInWithGoogle, type AuthOutcome } from '@/features/auth/supabaseAuth';
import { routeAfterAuth } from '@/features/auth/routeAfterAuth';

type Pending = 'email' | 'apple' | 'google' | null;

export default function SignInScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const setSupabaseAuth = useStore((s) => s.setSupabaseAuth);
  const errorText = useAuthErrorText();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [pending, setPending] = useState<Pending>(null);

  const finish = async (outcome: AuthOutcome) => {
    if (!outcome.ok) {
      setPending(null);
      setNeedsConfirmation(outcome.reason === 'email_not_confirmed');
      setError(errorText(outcome.reason));
      return;
    }
    setSupabaseAuth(outcome.userId, outcome.provider, outcome.email);
    const next = await routeAfterAuth();
    setPending(null);
    router.replace(next);
  };

  const onEmailSignIn = async () => {
    setError(null);
    setNeedsConfirmation(false);
    if (!isValidEmail(email)) {
      setEmailError(t.auth.errInvalidEmail);
      return;
    }
    setEmailError(null);
    if (!password) {
      setError(t.auth.errInvalidCredentials);
      return;
    }
    setPending('email');
    await finish(await signInWithEmail(email, password));
  };

  const onApple = async () => {
    setPending('apple');
    setError(null);
    await finish(await signInWithApple());
  };

  const onGoogle = async () => {
    setPending('google');
    setError(null);
    await finish(await signInWithGoogle());
  };

  const busy = pending !== null;

  return (
    <AuthShell title={t.auth.signInTitle} body={t.auth.signInBody} showBack={false}>
      <AuthTextField
        label={t.auth.email}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (emailError) setEmailError(null);
        }}
        error={emailError}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        editable={!busy}
      />
      <PasswordField
        ref={passwordRef}
        label={t.auth.password}
        value={password}
        onChangeText={setPassword}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={onEmailSignIn}
        editable={!busy}
      />

      {error ? (
        <Text style={[theme.text('bodySmall', theme.colors.danger), styles.center]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {needsConfirmation ? (
        <Pressable onPress={() => router.push({ pathname: '/(auth)/check-email', params: { email } })} accessibilityRole="button" style={styles.link}>
          <Text style={theme.text('bodySmall', theme.colors.primary)}>{t.auth.resendEmail}</Text>
        </Pressable>
      ) : null}

      <Button label={t.auth.signIn} onPress={onEmailSignIn} loading={pending === 'email'} disabled={busy} fullWidth size="lg" />

      <Pressable onPress={() => router.push({ pathname: '/(auth)/forgot-password', params: { email } })} accessibilityRole="button" style={styles.link}>
        <Text style={theme.text('bodySmall', theme.colors.primary)}>{t.auth.forgotPassword}</Text>
      </Pressable>

      <View style={[theme.row(), styles.signUpRow]}>
        <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{t.auth.noAccount}</Text>
        <Pressable onPress={() => router.push('/(auth)/sign-up')} accessibilityRole="button" hitSlop={8}>
          <Text style={theme.text('bodySmall', theme.colors.primary)}>{t.auth.signUp}</Text>
        </Pressable>
      </View>

      <View style={[theme.row(), styles.dividerRow]}>
        <View style={[styles.divider, { backgroundColor: theme.colors.divider }]} />
        <Text style={theme.text('caption', theme.colors.textMuted)}>{t.auth.or}</Text>
        <View style={[styles.divider, { backgroundColor: theme.colors.divider }]} />
      </View>

      <View style={{ gap: 12 }}>
        {Platform.OS === 'ios' ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              theme.scheme === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={theme.radii.md}
            style={styles.appleButton}
            onPress={busy ? () => {} : onApple}
          />
        ) : null}
        <Button
          label={t.auth.continueWithGoogle}
          onPress={onGoogle}
          variant="outline"
          fullWidth
          size="lg"
          loading={pending === 'google'}
          disabled={busy}
          icon={<LogIn size={17} color={theme.colors.textPrimary} />}
        />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  appleButton: { width: '100%', height: 50 },
  center: { textAlign: 'center', marginBottom: 12 },
  link: { alignItems: 'center', paddingVertical: 12 },
  signUpRow: { justifyContent: 'center', alignItems: 'center', gap: 6 },
  dividerRow: { alignItems: 'center', gap: 10, marginVertical: 20 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth },
});
