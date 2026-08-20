import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AuthShell } from '@/features/auth/AuthShell';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { authService } from '@/services';
import { haptics } from '@/utils/haptics';

const LENGTH = 6;

export default function OtpScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const phone = useStore((s) => s.session.phone);
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''));
  const [error, setError] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const code = digits.join('');

  const handleChange = (value: string, index: number) => {
    setError(false);
    // support pasting the whole code into one box
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, LENGTH).split('');
      const next = Array(LENGTH).fill('');
      pasted.forEach((d, i) => {
        next[i] = d;
      });
      setDigits(next);
      const lastIndex = Math.min(pasted.length, LENGTH) - 1;
      if (lastIndex >= 0) inputs.current[lastIndex]?.focus();
      return;
    }
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const verify = async () => {
    setVerifying(true);
    const res = await authService.verifyOtp(code);
    setVerifying(false);
    if (res.ok) {
      haptics.success();
      router.replace('/(auth)/profile-setup');
    } else {
      haptics.warning();
      setError(true);
      setDigits(Array(LENGTH).fill(''));
      inputs.current[0]?.focus();
    }
  };

  useEffect(() => {
    if (code.length === LENGTH) verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <AuthShell
      title={t.auth.otpTitle}
      body={`${t.auth.otpBody} +966${phone?.replace('+966', '') ?? ''}`}
      footer={
        <Button
          label={verifying ? t.auth.verifying : t.common.confirm}
          onPress={verify}
          disabled={code.length !== LENGTH}
          loading={verifying}
          fullWidth
          size="lg"
        />
      }
    >
      <View style={[theme.row(), styles.boxRow]}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(r) => {
              inputs.current[i] = r;
            }}
            value={d}
            onChangeText={(v) => handleChange(v, i)}
            onKeyPress={(e) => handleKeyPress(e.nativeEvent.key, i)}
            keyboardType="number-pad"
            maxLength={LENGTH}
            style={[
              styles.box,
              theme.text('heading2'),
              {
                borderColor: error ? theme.colors.danger : d ? theme.colors.primary : theme.colors.border,
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.sm,
                textAlign: 'center',
              },
            ]}
            accessibilityLabel={`digit ${i + 1}`}
          />
        ))}
      </View>

      {error ? <Text style={[theme.text('bodySmall', theme.colors.danger), { marginTop: 12 }]}>{t.auth.wrongCode}</Text> : null}

      <View style={[theme.row(), styles.resendRow]}>
        <Text
          onPress={() => {
            if (countdown <= 0) {
              setCountdown(30);
              if (phone) authService.sendOtp(phone);
            }
          }}
          style={theme.text('bodySmall', countdown > 0 ? theme.colors.textMuted : theme.colors.primary)}
        >
          {countdown > 0 ? `${t.auth.resendIn} 0:${countdown.toString().padStart(2, '0')}` : t.auth.resend}
        </Text>
      </View>

      <View style={[styles.demoHint, { backgroundColor: theme.colors.infoSurface, borderRadius: theme.radii.md }]}>
        <Text style={theme.text('caption', theme.colors.info)}>{t.auth.demoHint}</Text>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  boxRow: { gap: 10, justifyContent: 'center' },
  box: { width: 46, height: 56, borderWidth: 1.5 },
  resendRow: { marginTop: 20, justifyContent: 'center' },
  demoHint: { marginTop: 28, padding: 12 },
});
