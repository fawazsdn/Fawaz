import { create } from 'zustand';

/**
 * Whether the social backend (follows, private accounts, new audiences) is
 * deployed. null until checked; false while
 * supabase/migrations/20261109120000_social_follows_photo_posts.sql is not
 * applied, in which case every screen keeps the existing behavior.
 */
interface SocialState {
  available: boolean | null;
  setAvailable: (v: boolean) => void;
}

export const useSocialStore = create<SocialState>((set) => ({
  available: null,
  setAvailable: (available) => set({ available }),
}));

export const useSocialAvailable = () => useSocialStore((s) => s.available === true);
