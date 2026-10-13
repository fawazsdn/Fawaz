import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { ActionError } from '@/backend/actions';
import { useI18n } from '@/i18n/useI18n';

/** Maps an ActionError to a translated, human message. */
export function useActionErrorMessage() {
  const { t } = useI18n();
  return useCallback(
    (err: unknown): string => {
      const code = err instanceof ActionError ? err.code : 'unknown';
      // Specific reasons raised by club/activity RPCs ("not_adult", "rate_limited", "invalid:name", ...).
      const reason = err instanceof ActionError ? err.reason : undefined;
      if (reason) {
        if (reason === 'content_blocked') return t.errors.contentBlocked;
        const clubErrors = t.clubs.errors as Record<string, string>;
        if (clubErrors[reason]) return clubErrors[reason];
        const neighborErrors = t.neighbors.errors as Record<string, string>;
        if (neighborErrors[reason]) return neighborErrors[reason];
        if (reason === 'invalid:custom_category') return t.eventCreate.customCategoryRequired;
        if (reason.startsWith('invalid:')) return t.clubs.fixFields;
      }
      switch (code) {
        case 'not_signed_in':
          return t.errors.notSignedIn;
        case 'not_verified':
          return t.errors.notVerified;
        case 'no_neighborhood':
          return t.errors.noNeighborhood;
        case 'offline':
          return t.errors.offlineAction;
        case 'closed':
          return t.errors.closed;
        case 'forbidden':
          return t.errors.forbidden;
        case 'invalid':
          return t.errors.invalid;
        default:
          return t.errors.genericBody;
      }
    },
    [t],
  );
}

export type ActionResult<T> = { ok: true; value: T } | { ok: false };

/**
 * Runs a backend action with a pending flag and shows a real, translated
 * error if the server rejects it — never a silent no-op or a fake success.
 */
export function useAction() {
  const { t } = useI18n();
  const message = useActionErrorMessage();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async <T>(fn: () => Promise<T>): Promise<ActionResult<T>> => {
      setPending(true);
      try {
        return { ok: true, value: await fn() };
      } catch (err) {
        Alert.alert(t.errors.actionFailedTitle, message(err));
        return { ok: false };
      } finally {
        setPending(false);
      }
    },
    [message, t],
  );

  return { run, pending };
}
