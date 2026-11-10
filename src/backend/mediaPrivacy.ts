import { Image } from 'expo-image';

import { clearMediaCache } from './media';

/**
 * Private-photo exposure rules (see docs/HARATNA-PHOTO-PRIVACY.md).
 *
 * Supabase signed URLs can't be revoked, and Smart CDN may keep serving a
 * cached response for a signed URL it has already served. Access withdrawn by
 * the database (block, removed follower, private account) therefore applies
 * to NEW links immediately, while links already issued stay usable for a
 * bounded time. These limits keep that window short and keep private photos
 * off the device's disk.
 */

/** Lifetime of signed links for profile photos (profile-photos bucket). */
export const PROFILE_PHOTO_LINK_SECONDS = 5 * 60;
/** Lifetime of signed links for social post photos (community-media/posts/...). */
export const POST_PHOTO_LINK_SECONDS = 15 * 60;
/** Browser/CDN cache lifetime set on private uploads (seconds, as Storage expects). */
export const PRIVATE_UPLOAD_CACHE_CONTROL = '300';

/** True for a Supabase Storage signed URL (private media). */
export function isSignedStorageUrl(uri?: string | null): boolean {
  return !!uri && uri.includes('/storage/v1/object/sign/');
}

/**
 * Expo Image cache policy for a URI: private (signed) media is kept in memory
 * only, never written to the disk cache where it would outlive revoked access
 * and a sign-out. Public and local images keep the default disk cache.
 */
export function imageCachePolicy(uri?: string | null): 'memory' | 'disk' {
  return isSignedStorageUrl(uri) ? 'memory' : 'disk';
}

/** Clears signed-link and image caches (sign-out, account deletion, own block/unfollow actions). */
export async function clearPrivateMediaCaches(): Promise<void> {
  clearMediaCache();
  await Promise.all([Image.clearMemoryCache().catch(() => false), Image.clearDiskCache().catch(() => false)]);
}
