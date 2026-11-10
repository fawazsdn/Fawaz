# Haratna private-photo privacy: findings and policy

Branch `claude/haratna-photo-privacy-hardening` (from `4cf273c`, PR #5 head). Development only; nothing here is deployed.

## Findings

| # | Finding | Source | Severity |
|---|---|---|---|
| 1 | A signed URL issued **before** a block kept working after the block (5-minute link in Codex's local Storage test). | Codex local test | High |
| 2 | Signed URLs can't be revoked. Storage checks only the token's signature and expiry, not the database's access rules. | Supabase Storage design | High |
| 3 | Smart CDN (on by default for Pro) caches signed-URL responses per token. Expiring a token does **not** purge its CDN entry; the same URL can keep being served after the token expires. Only **deleting the object** invalidates every cached copy, within up to 60 seconds. | [Smart CDN docs](https://supabase.com/docs/guides/storage/cdn/smart-cdn) | High |
| 4 | The app reused signed links from memory for up to 1 hour (profile photos) or 6 hours (post photos). | `src/backend/media.ts` | Medium |
| 5 | Expo Image's default disk cache kept private photos on the device after sign-out, block or unfollow. React Native `Image` in message bubbles also caches on disk. | `Avatar`, `PhotoCarousel`, `ImageGallery`, `MessageBubble`… | Medium |
| 6 | Private uploads used the Storage default browser/CDN `cacheControl` of 1 hour. | upload calls | Low |

## What the product can honestly promise
- **Can promise:** "When you block someone, remove a follower or make your account private, they can't open your profile, posts or photos from that moment on."
- **Cannot promise:** that *every* already-loaded copy disappears instantly. A copy already on the other person's screen, or in their phone's memory, can't be recalled. Any app that sends images to a phone has this limit.
- **Recommended wording** for the privacy policy and Help:
  > Changes take effect immediately for anything new. Photos someone already had open may stay visible to them for a few minutes (profile photos up to about 5 minutes; post photos up to about 15 minutes) and aren't saved to their device's storage by Haratna.

## Fixes implemented on this branch

| Fix | Effect |
|---|---|
| **Profile-photo rotation** (`rotateProfilePhoto`): after you block someone, remove a follower or go private, the app copies your photo to a new file, points your profile at it and **deletes the old file**. | Every link already issued for the old file, and its CDN-cached copies, stop working within about 60 seconds (Supabase invalidation). This closes finding 1 for profile photos. |
| Profile-photo links: **1 h → 5 min**. Post-photo links (`posts/…`): **6 h → 15 min**. Re-signed shortly before expiry. Legacy neighborhood media is unchanged. | Bounds how long a leaked or cached link works. |
| Private uploads set `cacheControl: '300'`. | Browser/HTTP caches keep private photos at most 5 minutes. |
| `cachePolicy="memory"` for every signed (private) image: avatars, carousel, zoom viewer, galleries, profile grid, post editor, message photos (now Expo Image). | Private photos are never written to the disk cache. |
| Caches cleared on **sign-out** (even if the network call fails), **account deletion**, **block** and **unfollow** (`clearPrivateMediaCaches`). | Nothing private stays on a shared device or after losing access. |

## Remaining risks (not fixed here)
1. **Post photos are not rotated** on block or follower removal. Rotating them needs a database function (the post guard deliberately blocks adding new photo paths on edit), which is a migration change requiring approval.
   - Until then, someone who already loaded a followers-only post photo can reuse that exact link for up to 15 minutes. CDN-cached responses for that link can last longer, until the CDN entry ages out.
   - Proposed follow-up: a `rotate_post_photos(post_id)` server function, plus Storage-side copy and delete, triggered on block and remove-follower for followers-only posts.
2. **The blocked person's own device** may still hold a photo in memory until the app is closed. That can't be controlled from the owner's side.
3. **Legacy public avatars** (stage 3 of the rollout) stay publicly readable until their owner-approved removal.
4. **Rotation depends on the Storage `copy` API** being allowed by the `profile_photos_*_own` policies (select on the source, insert on the destination, both in the owner's folder). Covered by unit tests with mocks; it **needs an integration check** on the local Supabase stack or the Simulator.

## Tests
- `src/backend/__tests__/mediaPrivacy.test.ts` (11 tests): cache policy; link lifetimes; re-signing; rotation order and failure safety; rotation after block, remove-follower and going private; cache clearing on block, unfollow and sign-out.
- `src/backend/__tests__/profilePhotos.test.ts` updated to the 5-minute lifetime.
