import { useStore } from '@/store/useStore';
import type { Neighborhood, User } from '@/models';

/** The resident's current neighborhood (official geography + real counts), or undefined. */
export function useCurrentNeighborhood(): Neighborhood | undefined {
  return useStore((s) => s.neighborhoods.find((n) => n.id === s.session.neighborhoodId));
}

/** True once the server has confirmed the resident lives in their neighborhood. */
export function useIsVerified(): boolean {
  return useStore((s) => s.session.verification === 'verified');
}

/**
 * A neighbor's profile. RLS only returns profiles of people who share a
 * verified neighborhood with you, so a referenced author can legitimately be
 * unavailable (e.g. they moved away). Callers render a neutral "Neighbor"
 * label instead of hiding real content or inventing a name.
 */
export function useUser(id: string | undefined): User | undefined {
  return useStore((s) => (id ? s.users.find((u) => u.id === id) : undefined));
}
