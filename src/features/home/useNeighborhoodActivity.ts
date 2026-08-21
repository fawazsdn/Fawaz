import { useMemo } from 'react';

import { useStore } from '@/store/useStore';

/**
 * Real "what's happening" counts for a neighborhood — upcoming events,
 * open issues, open help requests, and marketplace listings posted in
 * the last 48h. Shared by NeighborhoodPulse (per-category breakdown) and
 * NeighborhoodIdentityCard (a single total) so both read the same
 * definition of "happening" rather than drifting apart.
 *
 * Selects raw state arrays and derives with useMemo rather than
 * filtering inside the `useStore` selector itself — a selector that
 * returns a freshly-built array on every call is an unstable snapshot
 * and crashes with "Maximum update depth exceeded" under
 * useSyncExternalStore (which Zustand's useStore is built on).
 */
export function useNeighborhoodActivity(neighborhoodId: string | null) {
  const allEvents = useStore((s) => s.events);
  const allIssues = useStore((s) => s.issues);
  const allHelpRequests = useStore((s) => s.helpRequests);
  const allListings = useStore((s) => s.marketplaceListings);

  const events = useMemo(
    () => allEvents.filter((e) => e.neighborhoodId === neighborhoodId && new Date(e.startsAt).getTime() > Date.now()),
    [allEvents, neighborhoodId],
  );
  const issues = useMemo(
    () => allIssues.filter((i) => i.neighborhoodId === neighborhoodId && i.status !== 'resolved'),
    [allIssues, neighborhoodId],
  );
  const helpRequests = useMemo(
    () => allHelpRequests.filter((h) => h.neighborhoodId === neighborhoodId && h.status === 'open'),
    [allHelpRequests, neighborhoodId],
  );
  const listings = useMemo(
    () =>
      allListings.filter(
        (m) => m.neighborhoodId === neighborhoodId && Date.now() - new Date(m.createdAt).getTime() < 48 * 3600 * 1000,
      ),
    [allListings, neighborhoodId],
  );

  const total = events.length + issues.length + helpRequests.length + listings.length;

  return { events, issues, helpRequests, listings, total };
}
