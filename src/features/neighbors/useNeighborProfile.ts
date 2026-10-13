import { useCallback, useEffect, useState } from 'react';

import { fetchNeighborProfile } from '@/backend/actions';
import type { NeighborProfileInfo } from '@/models';
import { useStore } from '@/store/useStore';

/**
 * Server-computed relationship + permitted extras (mutual neighbors, shared
 * clubs…) for one profile. Re-fetches whenever my requests or connections
 * change after a sync, so the button always reflects server truth.
 */
export function useNeighborProfile(userId: string | undefined) {
  const [info, setInfo] = useState<NeighborProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const requests = useStore((s) => s.neighborRequests);
  const connections = useStore((s) => s.neighborConnections);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      setInfo(await fetchNeighborProfile(userId));
    } catch {
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload, requests, connections]);

  return { info, loading, reload };
}
