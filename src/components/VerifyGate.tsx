import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldCheck, WifiOff } from 'lucide-react-native';

import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { useCurrentNeighborhood } from '@/hooks/useNeighborhood';
import { EmptyState } from './EmptyState';

/**
 * Shown in place of neighborhood content when the server says the resident
 * isn't verified yet (RLS would return nothing anyway) — an honest
 * explanation plus the way forward, instead of an empty "nothing here".
 * Also surfaces offline/sync failures so empty lists are never misread as
 * "no activity".
 */
export function VerifyGate({ compact }: { compact?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const neighborhood = useCurrentNeighborhood();
  const verification = useStore((s) => s.session.verification);

  if (verification === 'verified') return null;
  const noBoundary = neighborhood && !neighborhood.hasBoundary;
  return (
    <View>
      <EmptyState
        icon={ShieldCheck}
        title={t.verifyGate.title}
        body={noBoundary ? `${t.verifyGate.body}\n\n${t.verifyGate.pendingNoBoundary}` : t.verifyGate.body}
        actionLabel={noBoundary ? undefined : t.verifyGate.action}
        onAction={noBoundary ? undefined : () => router.push('/(auth)/verification')}
        compact={compact}
      />
    </View>
  );
}

/** Banner-sized notice when the last refresh failed or the device is offline. */
export function SyncNotice() {
  const { t } = useI18n();
  const status = useStore((s) => s.sync.status);
  if (status !== 'offline' && status !== 'error') return null;
  return (
    <EmptyState icon={WifiOff} title={status === 'offline' ? t.errors.offlineTitle : t.errors.syncFailed} body={status === 'offline' ? t.errors.offlineBody : t.errors.genericBody} compact />
  );
}

export function useNeedsVerification() {
  return useStore((s) => s.session.verification !== 'verified');
}
