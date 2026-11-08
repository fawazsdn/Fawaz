import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AppHeader } from '@/components/AppHeader';
import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { useAuthErrorText } from '@/features/auth/AuthFields';
import { classifyAuthError, exchangeAuthCode, parseAuthLink } from '@/features/auth/supabaseAuth';
import { routeAfterAuth } from '@/features/auth/routeAfterAuth';

/**
 * Deep-link target for email confirmation (and OAuth) links:
 *   haratna://auth/callback?code=...
 * Exchanges the one-time PKCE code for a real session. If the link was
 * opened on a different device (no code verifier here), the email is still
 * confirmed server-side, so we send the resident to sign in.
 */
export default function AuthCallbackScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams();
  const setSupabaseAuth = useStore((s) => s.setSupabaseAuth);
  const errorText = useAuthErrorText();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { code, error, errorDescription } = parseAuthLink(params as Record<string, string>);
      if (error || !code) {
        if (alive) setMessage(errorText(classifyAuthError({ code: error, message: errorDescription })) ?? t.auth.errLinkExpired);
        return;
      }
      const outcome = await exchangeAuthCode(code);
      if (!alive) return;
      if (!outcome.ok) {
        setMessage(errorText(outcome.reason) ?? t.auth.signInError);
        return;
      }
      setSupabaseAuth(outcome.userId, outcome.provider, outcome.email);
      const next = await routeAfterAuth();
      if (alive) router.replace(next);
    })().catch(() => {
      if (alive) setMessage(t.auth.errNetwork);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per link
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader fallbackRoute="/(auth)/sign-in" />
      <View style={styles.wrap}>
        {message ? (
          <>
            <Text style={[theme.text('body'), styles.text]}>{message}</Text>
          </>
        ) : (
          <>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={[theme.text('bodySmall', theme.colors.textSecondary), styles.text]}>{t.auth.confirmingEmail}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  text: { textAlign: 'center' },
});
