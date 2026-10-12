import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MailCheck } from 'lucide-react-native';

import { AuthShell } from '@/features/auth/AuthShell';
import { useAuthErrorText } from '@/features/auth/AuthFields';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { resendConfirmation } from '@/features/auth/supabaseAuth';

export default function CheckEmailScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const errorText = useAuthErrorText();
  const { email } = useLocalSearchParams<{ email?: string }>();

  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const onResend = async () => {
    if (!email) return;
    setPending(true);
    const res = await resendConfirmation(email);
    setPending(false);
    setMessage(
      res.ok ? { text: t.auth.emailResent, ok: true } : { text: errorText(res.reason ?? 'unknown') ?? t.auth.signInError, ok: false },
    );
  };

  return (
    <AuthShell title={t.auth.checkEmailTitle} fallbackRoute="/(auth)/sign-in">
      <View style={[styles.icon, { backgroundColor: theme.colors.successSurface }]}>
        <MailCheck size={30} color={theme.colors.primary} />
      </View>
      <Text style={[theme.text('body', theme.colors.textSecondary), styles.center]}>{t.auth.checkEmailBody}</Text>
      {email ? <Text style={[theme.text('title'), styles.center, { writingDirection: 'ltr' }]}>{email}</Text> : null}
      <Text style={[theme.text('bodySmall', theme.colors.textMuted), styles.center, { marginTop: 12 }]}>{t.auth.checkEmailHint}</Text>

      {message ? (
        <Text style={[theme.text('bodySmall', message.ok ? theme.colors.primary : theme.colors.danger), styles.center, { marginTop: 16 }]}>
          {message.text}
        </Text>
      ) : null}

      <View style={{ gap: 10, marginTop: 24 }}>
        <Button label={t.auth.resendEmail} onPress={onResend} variant="outline" loading={pending} disabled={pending || !email} fullWidth />
        <Button label={t.auth.backToSignIn} onPress={() => router.replace('/(auth)/sign-in')} variant="primary" fullWidth />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  center: { textAlign: 'center' },
});
