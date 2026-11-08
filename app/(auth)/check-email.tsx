import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MailCheck } from 'lucide-react-native';

import { AuthShell } from '@/features/auth/AuthShell';
import { AuthTextField, useAuthErrorText } from '@/features/auth/AuthFields';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { resendConfirmation, verifySignupCode } from '@/features/auth/supabaseAuth';
import { routeAfterAuth } from '@/features/auth/routeAfterAuth';
import { useStore } from '@/store/useStore';
import { localizeDigits } from '@/utils/format';

export default function CheckEmailScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const errorText = useAuthErrorText();
  const { email } = useLocalSearchParams<{ email?: string }>();

  const [code, setCode] = useState('');
  const [action, setAction] = useState<'verify' | 'resend' | null>(null);
  const inFlight = useRef(false);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const validCode = code.length === 6 || code.length === 8;

  useEffect(() => {
    if (!remaining) return;
    const timer = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(timer);
  }, [now, remaining]);

  const startCooldown = () => {
    const time = Date.now();
    setNow(time);
    setRetryAt(time + 60_000);
  };

  const onResend = async () => {
    if (!email || remaining || inFlight.current) return;
    inFlight.current = true;
    setAction('resend');
    setMessage(null);
    try {
      const result = await resendConfirmation(email);
      if (result.ok || result.reason === 'rate_limited') startCooldown();
      if (result.ok) setCode('');
      setMessage(
        result.ok
          ? { text: t.auth.emailResent, ok: true }
          : { text: errorText(result.reason ?? 'unknown') ?? t.auth.signInError, ok: false },
      );
    } catch {
      setMessage({ text: t.auth.errNetwork, ok: false });
    } finally {
      inFlight.current = false;
      setAction(null);
    }
  };

  const onVerify = async () => {
    if (!email || !validCode || inFlight.current) return;
    inFlight.current = true;
    setAction('verify');
    setMessage(null);
    try {
      const outcome = await verifySignupCode(email, code);
      if (!outcome.ok) {
        setMessage({
          text: outcome.reason === 'link_expired' ? t.auth.verificationCodeInvalid : (errorText(outcome.reason) ?? t.auth.signInError),
          ok: false,
        });
        return;
      }
      useStore.getState().setSupabaseAuth(outcome.userId, outcome.provider, outcome.email);
      router.replace(await routeAfterAuth());
    } catch {
      setMessage({ text: t.auth.errNetwork, ok: false });
    } finally {
      inFlight.current = false;
      setAction(null);
    }
  };

  return (
    <AuthShell title={t.auth.checkEmailTitle} fallbackRoute="/(auth)/sign-in">
      <View style={[styles.icon, { backgroundColor: theme.colors.successSurface }]}>
        <MailCheck size={30} color={theme.colors.primary} />
      </View>
      <Text style={[theme.text('body', theme.colors.textSecondary), styles.center]}>{t.auth.checkEmailBody}</Text>
      {email ? <Text style={[theme.text('title'), styles.center, { writingDirection: 'ltr' }]}>{email}</Text> : null}
      <Text style={[theme.text('bodySmall', theme.colors.textMuted), styles.center, { marginTop: 12 }]}>{t.auth.checkEmailHint}</Text>

      {email ? (
        <View style={{ marginTop: 20 }}>
          <AuthTextField
            label={t.auth.verificationCode}
            value={code}
            onChangeText={(value) =>
              setCode(
                value
                  .replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) % 16))
                  .replace(/[^0-9]/g, '')
                  .slice(0, 8),
              )
            }
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            editable={!action}
          />
          <Button label={t.auth.confirmCode} onPress={onVerify} loading={action === 'verify'} disabled={!!action || !validCode} fullWidth />
        </View>
      ) : null}

      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[theme.text('bodySmall', message.ok ? theme.colors.primary : theme.colors.danger), styles.center, { marginTop: 16 }]}
        >
          {message.text}
        </Text>
      ) : null}

      <View style={{ gap: 10, marginTop: 24 }}>
        <Button
          label={remaining ? `${t.auth.resendEmail} (${localizeDigits(remaining, locale)})` : t.auth.resendEmail}
          onPress={onResend}
          variant="outline"
          loading={action === 'resend'}
          disabled={!!action || !email || remaining > 0}
          fullWidth
        />
        <Button label={t.auth.backToSignIn} onPress={() => router.replace('/(auth)/sign-in')} variant="primary" fullWidth />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  center: { textAlign: 'center' },
});
