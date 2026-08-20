import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BadgeCheck, Loader2, MapPinned, ShieldAlert, ShieldQuestion, UserCheck2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import type { VerificationStatus } from '@/models';

export default function VerificationScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const verification = useStore((s) => s.session.verification);
  const setVerification = useStore((s) => s.setVerification);

  const startCheck = () => {
    setVerification('checking');
    setTimeout(() => {
      // deterministic success for the demo
      setVerification('verified');
    }, 1800);
  };

  const requestManualReview = () => {
    setVerification('pending');
  };

  const goToApp = () => router.replace('/(tabs)');

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + 24, paddingHorizontal: 24 }}>
      <Text style={theme.text('heading1')}>{t.verification.title}</Text>
      <Text style={[theme.text('body', theme.colors.textSecondary), { marginTop: 8, marginBottom: 24 }]}>{t.verification.body}</Text>

      <StatusCard status={verification} />

      <View style={{ height: 24 }} />

      {verification === 'not_started' || verification === 'failed' ? (
        <View style={{ gap: 10 }}>
          <Button label={t.verification.confirmLocation} onPress={startCheck} icon={<MapPinned size={17} color={theme.colors.onPrimary} />} fullWidth size="lg" />
          <Button label={t.verification.manualReview} onPress={requestManualReview} variant="outline" fullWidth />
          <DisabledFutureRow label={t.verification.futureId} />
        </View>
      ) : null}

      {verification === 'checking' ? null : null}

      {verification === 'verified' ? <Button label={t.verification.continueToApp} onPress={goToApp} fullWidth size="lg" /> : null}

      {verification === 'pending' ? <Button label={t.verification.continueToApp} onPress={goToApp} variant="outline" fullWidth size="lg" /> : null}

      {verification !== 'verified' ? (
        <Text onPress={goToApp} style={[theme.text('bodySmall', theme.colors.textMuted), styles.skipText]}>
          {t.verification.skipForNow}
        </Text>
      ) : null}
    </View>
  );
}

function DisabledFutureRow({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={[theme.row(), styles.futureRow, { borderColor: theme.colors.border }]}>
      <ShieldQuestion size={16} color={theme.colors.textMuted} />
      <Text style={theme.text('bodySmall', theme.colors.textMuted)}>{label}</Text>
    </View>
  );
}

function StatusCard({ status }: { status: VerificationStatus }) {
  const theme = useTheme();
  const { t } = useI18n();
  const spin = useSharedValue(0);

  useEffect(() => {
    if (status === 'checking') {
      spin.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false);
    }
  }, [status, spin]);

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  const map: Record<VerificationStatus, { icon: React.ReactNode; label: string; body?: string; tone: string }> = {
    not_started: { icon: <ShieldQuestion size={26} color={theme.colors.textMuted} />, label: t.verification.notStarted, tone: theme.colors.textMuted },
    checking: {
      icon: (
        <Animated.View style={spinStyle}>
          <Loader2 size={26} color={theme.colors.info} />
        </Animated.View>
      ),
      label: t.verification.checking,
      tone: theme.colors.info,
    },
    pending: { icon: <UserCheck2 size={26} color={theme.colors.warning} />, label: t.verification.pending, tone: theme.colors.warning },
    verified: { icon: <BadgeCheck size={26} color={theme.colors.success} />, label: t.verification.verified, body: t.verification.verifiedBody, tone: theme.colors.success },
    failed: { icon: <ShieldAlert size={26} color={theme.colors.danger} />, label: t.verification.failed, body: t.verification.failedBody, tone: theme.colors.danger },
  };

  const entry = map[status];

  return (
    <Card>
      <View style={[theme.row(), { alignItems: 'center', gap: 12 }]}>
        <View style={[styles.iconWrap, { backgroundColor: entry.tone + '1c' }]}>{entry.icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={theme.text('title')}>{entry.label}</Text>
          {entry.body ? <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginTop: 2 }]}>{entry.body}</Text> : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  futureRow: { alignItems: 'center', gap: 10, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, opacity: 0.7 },
  skipText: { textAlign: 'center', marginTop: 16 },
});
