import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { BadgeCheck, Loader2, MapPinned, ShieldAlert, ShieldQuestion } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';

type LocalStatus =
  | 'not_started'
  | 'checking'
  | 'verified'
  | 'outside_boundary'
  | 'permission_denied'
  | 'permission_denied_forever'
  | 'location_unavailable'
  | 'boundary_unavailable'
  | 'rate_limited'
  | 'error';

const LOCATION_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export default function VerificationScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const neighborhoodId = useStore((s) => s.session.neighborhoodId);
  const setVerification = useStore((s) => s.setVerification);

  const [status, setStatus] = useState<LocalStatus>('not_started');

  const startCheck = async () => {
    if (!neighborhoodId) return;
    setStatus('checking');

    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      setStatus(perm.canAskAgain === false ? 'permission_denied_forever' : 'permission_denied');
      return;
    }

    let position: Location.LocationObject;
    try {
      position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        LOCATION_TIMEOUT_MS,
      );
    } catch {
      setStatus('location_unavailable');
      return;
    }

    const { latitude, longitude } = position.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setStatus('location_unavailable');
      return;
    }

    // Defensive: make sure a (pending) membership row exists server-side even
    // if the previous screen's call didn't land (e.g. was offline then).
    try {
      await supabase.rpc('select_neighborhood', { target_neighborhood_id: neighborhoodId });
    } catch {
      // best-effort; verify_neighborhood_location below will raise a clear error if this never landed
    }

    const { data, error } = await supabase.rpc('verify_neighborhood_location', {
      p_neighborhood_id: neighborhoodId,
      p_lat: latitude,
      p_lng: longitude,
    });

    if (error || !data) {
      setStatus('error');
      return;
    }

    const result = data as { status: string };
    switch (result.status) {
      case 'verified':
        setStatus('verified');
        setVerification('verified');
        break;
      case 'outside_boundary':
        setStatus('outside_boundary');
        break;
      case 'boundary_unavailable':
        setStatus('boundary_unavailable');
        break;
      case 'rate_limited':
        setStatus('rate_limited');
        break;
      case 'invalid_coordinates':
        setStatus('location_unavailable');
        break;
      default:
        setStatus('error');
    }
  };

  const goToApp = () => router.replace('/(tabs)');
  const openSettings = () => Linking.openSettings();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + 24, paddingHorizontal: 24 }}>
      <Text style={theme.text('heading1')}>{t.verification.title}</Text>
      <Text style={[theme.text('body', theme.colors.textSecondary), { marginTop: 8, marginBottom: 24 }]}>{t.verification.body}</Text>

      <StatusCard status={status} />

      <View style={{ height: 24 }} />

      {status === 'not_started' || status === 'outside_boundary' || status === 'rate_limited' || status === 'error' ? (
        <Button
          label={t.verification.verifyButton}
          onPress={startCheck}
          icon={<MapPinned size={17} color={theme.colors.onPrimary} />}
          fullWidth
          size="lg"
          disabled={!neighborhoodId}
        />
      ) : null}

      {status === 'permission_denied' ? (
        <Button label={t.verification.tryAgain} onPress={startCheck} fullWidth size="lg" icon={<MapPinned size={17} color={theme.colors.onPrimary} />} />
      ) : null}

      {status === 'permission_denied_forever' ? (
        <Button label={t.verification.openSettings} onPress={openSettings} fullWidth size="lg" variant="outline" />
      ) : null}

      {status === 'location_unavailable' ? (
        <Button label={t.verification.tryAgain} onPress={startCheck} fullWidth size="lg" icon={<MapPinned size={17} color={theme.colors.onPrimary} />} />
      ) : null}

      {status === 'boundary_unavailable' ? <Button label={t.verification.continueToApp} onPress={goToApp} fullWidth size="lg" /> : null}

      {status === 'verified' ? <Button label={t.verification.continueToApp} onPress={goToApp} fullWidth size="lg" /> : null}

      {status !== 'verified' ? (
        <Text onPress={goToApp} style={[theme.text('bodySmall', theme.colors.textMuted), styles.skipText]}>
          {t.verification.skipForNow}
        </Text>
      ) : null}
    </View>
  );
}

function StatusCard({ status }: { status: LocalStatus }) {
  const theme = useTheme();
  const { t } = useI18n();
  const spin = useSharedValue(0);

  useEffect(() => {
    if (status === 'checking') {
      spin.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false);
    }
  }, [status, spin]);

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  const map: Record<LocalStatus, { icon: React.ReactNode; label: string; body?: string; tone: string }> = {
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
    verified: { icon: <BadgeCheck size={26} color={theme.colors.success} />, label: t.verification.verified, body: t.verification.verifiedBody, tone: theme.colors.success },
    outside_boundary: { icon: <ShieldAlert size={26} color={theme.colors.warning} />, label: t.verification.outsideTitle, body: t.verification.outsideBody, tone: theme.colors.warning },
    permission_denied: {
      icon: <ShieldAlert size={26} color={theme.colors.warning} />,
      label: t.verification.permissionDeniedTitle,
      body: t.verification.permissionDeniedBody,
      tone: theme.colors.warning,
    },
    permission_denied_forever: {
      icon: <ShieldAlert size={26} color={theme.colors.warning} />,
      label: t.verification.permissionDeniedTitle,
      body: t.verification.permissionDeniedBody,
      tone: theme.colors.warning,
    },
    location_unavailable: {
      icon: <ShieldAlert size={26} color={theme.colors.danger} />,
      label: t.verification.locationUnavailableTitle,
      body: t.verification.locationUnavailableBody,
      tone: theme.colors.danger,
    },
    boundary_unavailable: {
      icon: <ShieldQuestion size={26} color={theme.colors.textMuted} />,
      label: t.verification.boundaryUnavailableTitle,
      body: t.verification.boundaryUnavailableBody,
      tone: theme.colors.textMuted,
    },
    rate_limited: { icon: <ShieldAlert size={26} color={theme.colors.warning} />, label: t.verification.failed, body: t.verification.rateLimitedBody, tone: theme.colors.warning },
    error: { icon: <ShieldAlert size={26} color={theme.colors.danger} />, label: t.verification.failed, body: t.verification.failedBody, tone: theme.colors.danger },
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
  skipText: { textAlign: 'center', marginTop: 16 },
});
