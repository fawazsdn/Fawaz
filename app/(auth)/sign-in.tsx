import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { LogIn } from 'lucide-react-native';

import { AuthShell } from '@/features/auth/AuthShell';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { signInWithApple, signInWithGoogle, type SignInOutcome } from '@/features/auth/supabaseAuth';

export default function SignInScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const setSupabaseAuth = useStore((s) => s.setSupabaseAuth);

  const [pending, setPending] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOutcome = (outcome: SignInOutcome, provider: 'apple' | 'google') => {
    setPending(null);
    if (outcome.ok) {
      setError(null);
      setSupabaseAuth(outcome.userId, provider);
      router.replace('/(auth)/profile-setup');
      return;
    }
    if (outcome.reason === 'cancelled') {
      setError(null);
      return;
    }
    setError(outcome.reason === 'unavailable' ? t.auth.signInError : t.auth.signInError);
  };

  const onApple = async () => {
    setPending('apple');
    setError(null);
    const outcome = await signInWithApple();
    handleOutcome(outcome, 'apple');
  };

  const onGoogle = async () => {
    setPending('google');
    setError(null);
    const outcome = await signInWithGoogle();
    handleOutcome(outcome, 'google');
  };

  return (
    <AuthShell title={t.auth.signInTitle} body={t.auth.signInBody} showBack={false}>
      <View style={{ gap: 12, marginTop: 12 }}>
        {Platform.OS === 'ios' ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={theme.scheme === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={theme.radii.md}
            style={styles.appleButton}
            onPress={onApple}
          />
        ) : null}

        <Button
          label={pending === 'google' ? t.auth.signingIn : t.auth.continueWithGoogle}
          onPress={onGoogle}
          variant="outline"
          fullWidth
          size="lg"
          loading={pending === 'google'}
          disabled={pending === 'apple'}
          icon={<LogIn size={17} color={theme.colors.textPrimary} />}
        />

        {error ? <Text style={[theme.text('bodySmall', theme.colors.danger), styles.error]}>{error}</Text> : null}

        <Text style={[theme.text('caption', theme.colors.textMuted), styles.phoneNote]}>{t.auth.orPhoneComingSoon}</Text>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  appleButton: { width: '100%', height: 50 },
  error: { textAlign: 'center', marginTop: 4 },
  phoneNote: { textAlign: 'center', marginTop: 8 },
});
