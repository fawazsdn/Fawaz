import { useState } from 'react';

import { useI18n } from '@/i18n/useI18n';
import { useAction } from '@/hooks/useAction';
import { followUser, unfollowUser, type FollowState } from '@/backend/social';
import { Button, type ButtonSize } from '@/components/Button';
import { ConfirmationModal } from '@/components/ConfirmationModal';

interface FollowButtonProps {
  userId: string;
  name: string;
  state: FollowState;
  followsYou?: boolean;
  size?: ButtonSize;
  onChanged?: (state: FollowState) => void;
}

/** Follow / Following / Requested. Unfollowing and withdrawing a request ask first. */
export function FollowButton({ userId, name, state, followsYou, size = 'md', onChanged }: FollowButtonProps) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const [confirm, setConfirm] = useState(false);

  if (state === 'self') return null;

  const follow = async () => {
    const res = await run(() => followUser(userId));
    if (res.ok) onChanged?.(res.value);
  };
  const undo = async () => {
    setConfirm(false);
    const res = await run(() => unfollowUser(userId));
    if (res.ok) onChanged?.('none');
  };

  return (
    <>
      {state === 'none' ? (
        <Button
          label={followsYou ? t.social.followBack : t.social.follow}
          onPress={follow}
          loading={pending}
          size={size}
          testID="follow-button"
        />
      ) : (
        <Button
          label={state === 'following' ? t.social.followingButton : t.social.requested}
          onPress={() => setConfirm(true)}
          variant="outline"
          loading={pending}
          size={size}
          testID="follow-button"
        />
      )}
      <ConfirmationModal
        visible={confirm}
        title={state === 'requested' ? t.social.withdrawRequest : t.social.unfollowConfirm.replace('{name}', name)}
        confirmLabel={state === 'requested' ? t.social.withdrawRequest : t.social.unfollow}
        destructive
        onCancel={() => setConfirm(false)}
        onConfirm={undo}
      />
    </>
  );
}
