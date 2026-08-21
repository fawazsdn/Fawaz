import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';

/**
 * The one safe way to wire up a "back" control anywhere in Haratna.
 *
 * Plain `router.back()` (== `navigation.goBack()`) assumes a previous
 * screen already exists in the navigation stack. That's true when a
 * resident pushed into this screen from elsewhere in the app, but false
 * whenever this screen is the FIRST thing the navigator ever mounted:
 *   - a direct URL open (typed, bookmarked, or a WhatsApp/referral
 *     share link landing straight on an event/post/listing/invite),
 *   - a page refresh on web,
 *   - a fresh app launch that deep-links straight into a detail screen.
 * In every one of those cases there is nothing to pop, and dispatching
 * GO_BACK throws "The action 'GO_BACK' was not handled by any
 * navigator." — a real, user-facing crash risk, not just a warning.
 *
 * `useSafeBack(fallback)` checks `router.canGoBack()` (the supported
 * Expo Router API for this — see expo-router's global-state/router.ts)
 * before deciding: real history → `router.back()`; no history →
 * `router.replace(fallback)` (replace, not push, so the fallback doesn't
 * itself become a poppable dead end that re-triggers this same problem).
 *
 * Every back control in the app should go through this hook — directly,
 * or via `AppHeader`'s/`AuthShell`'s `fallbackRoute` prop — instead of
 * calling `router.back()` / `navigation.goBack()` on its own. Callers
 * must pick a real, screen-appropriate fallback (the nearest logical
 * parent screen), not a single blanket default.
 */
export function useSafeBack(fallback: Href) {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallback);
    }
  }, [router, fallback]);
}
