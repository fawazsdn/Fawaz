/**
 * Centralized deep-link / share-URL configuration.
 *
 * Every shareable entity (post, event, business, marketplace listing,
 * neighborhood invite) gets its URL from here — never a one-off string
 * built inline in a screen — so wiring in a real web domain and eventual
 * Universal Links / App Links is a change to this one file, not a hunt
 * through every share button in the app.
 *
 * No production domain is hardcoded. Haratna's final web domain has not
 * been registered/configured, so links fall back to the app's own custom
 * URL scheme (`app.json` -> expo.scheme = "haratna"), which works today on
 * a device with the app installed. Set `EXPO_PUBLIC_WEB_BASE_URL` (see
 * .env.example) once a real domain exists — do not fabricate one here.
 */

const APP_SCHEME = 'haratna://';

const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, '');

function buildPath(path: string): string {
  const clean = path.replace(/^\//, '');
  return WEB_BASE_URL ? `${WEB_BASE_URL}/${clean}` : `${APP_SCHEME}${clean}`;
}

export const links = {
  post: (id: string) => buildPath(`/post/${id}`),
  event: (id: string) => buildPath(`/event/${id}`),
  business: (id: string) => buildPath(`/business/${id}`),
  marketplaceListing: (id: string) => buildPath(`/marketplace/${id}`),
  /**
   * A neighborhood invite link, conceptually `haratna.app/join/[neighborhood]/[referralCode]`
   * once a real domain exists (see WEB_BASE_URL above) — today it's
   * `haratna://join/<neighborhoodId>/<referralCode>`. Carries both the
   * target neighborhood and the referrer's code so a future backend can
   * attribute the join to both. See src/services/referral for the mock
   * implementation this feeds.
   */
  neighborhoodInvite: (neighborhoodId: string, referralCode: string) => buildPath(`/join/${neighborhoodId}/${referralCode}`),
};
