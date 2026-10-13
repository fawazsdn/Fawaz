import { useState } from 'react';
import { View } from 'react-native';
import { Check, UserPlus } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useAction } from '@/hooks/useAction';
import { cancelNeighborRequest, removeNeighbor, respondNeighborRequest, sendNeighborRequest } from '@/backend/actions';
import type { NeighborProfileInfo } from '@/models';
import { Button } from '@/components/Button';
import { ConfirmationModal } from '@/components/ConfirmationModal';

interface Props {
  userId: string;
  name: string;
  info: NeighborProfileInfo | null;
  onChanged: () => void;
  size?: 'sm' | 'md';
}

/**
 * Every connection state, with the server deciding: Add Neighbor → Request
 * Sent (cancel) / Accept · Decline → Neighbors ✓ (remove). Accepting is only
 * ever possible for the recipient's own incoming request.
 */
export function NeighborButton({ userId, name, info, onChanged, size = 'md' }: Props) {
  const theme = useTheme();
  const { t } = useI18n();
  const { run, pending } = useAction();
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (!info || info.state === 'self') return null;
  const act = async (fn: () => Promise<unknown>) => {
    await run(fn);
    onChanged();
  };

  switch (info.state) {
    case 'blocked':
      return <Button label={t.neighbors.blocked} onPress={() => {}} variant="outline" size={size} disabled />;
    case 'request_received':
      return (
        <View style={[theme.row(), { gap: 8 }]}>
          <Button
            label={t.neighbors.accept}
            size={size}
            loading={pending}
            onPress={() => info.incomingRequestId && act(() => respondNeighborRequest(info.incomingRequestId!, true))}
          />
          <Button
            label={t.neighbors.decline}
            size={size}
            variant="outline"
            disabled={pending}
            onPress={() => info.incomingRequestId && act(() => respondNeighborRequest(info.incomingRequestId!, false))}
          />
        </View>
      );
    case 'request_sent':
      return (
        <View style={[theme.row(), { gap: 8 }]}>
          <Button label={t.neighbors.requestSent} size={size} variant="outline" onPress={() => {}} disabled />
          <Button
            label={t.neighbors.cancelRequest}
            size={size}
            variant="ghost"
            disabled={pending}
            onPress={() => act(() => cancelNeighborRequest(userId))}
          />
        </View>
      );
    case 'connected':
      return (
        <>
          <Button
            label={t.neighbors.connected}
            size={size}
            variant="outline"
            icon={<Check size={15} color={theme.colors.primary} />}
            onPress={() => setConfirmRemove(true)}
            accessibilityLabel={`${t.neighbors.connected} — ${t.neighbors.removeNeighbor}`}
          />
          <ConfirmationModal
            visible={confirmRemove}
            title={t.neighbors.removeNeighbor}
            body={t.neighbors.removeConfirm.replace('{name}', name)}
            confirmLabel={t.neighbors.removeNeighbor}
            destructive
            onCancel={() => setConfirmRemove(false)}
            onConfirm={() => {
              setConfirmRemove(false);
              act(() => removeNeighbor(userId));
            }}
          />
        </>
      );
    default:
      return (
        <Button
          label={info.acceptsRequests ? t.neighbors.addNeighbor : t.neighbors.requestsClosed}
          size={size}
          disabled={!info.acceptsRequests || pending}
          loading={pending}
          icon={info.acceptsRequests ? <UserPlus size={15} color={theme.colors.onPrimary} /> : undefined}
          onPress={() => act(() => sendNeighborRequest(userId))}
        />
      );
  }
}
