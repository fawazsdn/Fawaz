# Production migration approval request — Haratna social features (PR #5)

**Status: waiting for the owner's approval. Nothing below has been applied to production.**
Supabase project: `ckqwziutmqohihrenstz`. Build 13 (branch `codex/haratna-release-candidate-13`) stays the stable fallback.

## 1. What will be changed

Two database migrations, applied in this order, plus one Edge Function update and a one-off photo move.

| # | Change | File |
|---|--------|------|
| 1 | Follows, private accounts, post audiences, photo-post privacy, block enforcement, follow notifications, account-deletion cleanup | `supabase/migrations/20261109120000_social_follows_photo_posts.sql` |
| 2 | Private profile photos and RLS hardening | `supabase/migrations/20261109130000_private_profile_photos.sql` |
| 3 | `delete-account` Edge Function also removes the private profile-photo bucket and sweeps each account's own folders | `supabase/functions/delete-account/index.ts` |
| 4 | Move existing profile photos into private storage (operator script, dry run first) | `scripts/migrate-avatars-to-private.mjs` |

### Migration 1 — social features
- **New table `follows`**: follower, followee, status `pending`/`accepted`.
  - No self-follows and no duplicates (primary key).
  - Clients can't write it directly; changes only go through `follow_user`, `unfollow_user`, `respond_follow_request` and `remove_follower`.
- **New column `profiles.is_private`**, default `false`. Nobody's privacy changes until they switch it on.
  - Turning it off approves everyone who is waiting.
- **Post audiences**: `public`, `followers` and `neighborhood` ("Verified neighbors", the default). The legacy `city` value stays readable.
- **Who can see a post** (`private.can_view_post`). The author and staff can always see it, and a block in either direction always hides it. Otherwise:
  - Verified neighbors (`neighborhood` / `city`): verified members of the post's neighborhood only.
  - Followers (`followers`): accepted followers only.
  - Public (`public`): verified Haratna residents anywhere in Saudi Arabia. For a private account, only its accepted followers and its neighborhood.
- **Comments, likes and saves** follow the same rule. Blocked people's comments are hidden, and post authors can remove comments on their own posts.
- **Photos**:
  - New post photos go to `community-media/posts/<uid>/`. They are readable only by someone who can see a post that uses them.
  - A post can only reference its author's own files.
  - Photos from the neighborhood folder can't be put on a public or followers-only post.
  - Edits can reorder or remove photos, not add them. Maximum 10 photos per post.
- **Notifications**: new types `follow`, `follow_request` and `follow_accepted`. Like and comment notifications are skipped between blocked accounts.
- **Blocking** also removes follows and follow notifications in both directions.
- **Account deletion** (`purge_account_data`) also removes follows and every notification the account caused.

### Migration 2 — private profile photos
- **New private bucket `profile-photos`**: 5 MB limit, JPEG/PNG/WebP/HEIC only.
- **New column `profiles.avatar_path`**. It must point into the account's own folder.
- **Who can open a profile photo.** The app gets 1-hour signed links, and the storage policy only signs them for:
  - the owner and staff;
  - for a public account: verified residents;
  - for a private account: accepted followers, plus people who already see the full profile under today's neighborhood rules (or who asked to follow them).

  Nobody across a block sees it, and unverified or signed-out users never do.
- **Going private** clears the legacy public URL from the profile row. The app moves the photo into private storage first.
- **Profile cards and follower lists** return a photo only to viewers allowed to see it.
- **Hardening found in the review:**
  - `media_attachments` rows are visible only to their owner and staff. Before, the whole neighborhood could list them, which exposed the storage paths of followers-only photos.
  - Editing a comment can no longer move it to another post or change its author.

## 2. Impact on existing data
Read-only counts from production on 2026-11-09:

| Item | Count |
|---|---|
| Profiles | 5 (all active) |
| Profile photos in the public `avatars` bucket | 1 |
| Profile photos hosted elsewhere | 0 |
| Posts | 1 (at most 1 photo; none use a new audience) |
| Notifications | 16 |
| Media attachment records | 4 |
| `follows`, `is_private`, `avatar_path`, `profile-photos` | none exist yet |

- **No existing row is deleted or rewritten by the migrations.** Existing posts keep their audience and photos, and every account starts public with no follows.
- **The one existing public profile photo** is copied to private storage by the script (or by the app the first time its owner opens the new build). The public file is deleted only after the copy has been read back and checked.
- **Effect on build 13:**
  - Build 13 keeps working. It doesn't use the new columns or functions, and its own posting path (neighborhood folder, neighborhood/city audience) is still allowed.
  - Once a photo has been moved and its public copy removed, people still on build 13 see initials instead of that photo.
  - Two things build 13 users would notice: they no longer see posts from someone who blocked them, and they can't open other residents' `media_attachments` rows (the app never reads them).

## 3. Privacy protections and how they were tested
Testing used a local PostgreSQL 16 + PostGIS replica built from the production schema only: tables, constraints, policies, functions and grants, with no user data.

**Migration cycle** (`run_cycle.sh`; every step passed):
1. Production schema: existing suites pass (neighbors 12, compliance 4, clubs 18, poll 2).
2. Apply 120000 + 130000: all of those, plus `social_follows` (11 groups) and `private_profile_photos` (10 groups).
3. Roll back 130000: existing suites and `social_follows` still pass.
4. Roll back 120000: existing suites pass, the same as before the migration.
5. Re-apply both after the rollback: everything passes again.

**What the new suites check, using two accounts plus a stranger, an unverified account and staff:**
- Follows: no self-follows, no forged rows, no follows from unverified accounts; following is idempotent and notifications aren't duplicated.
- Private-account requests: withdraw, decline, accept, remove follower; a pending request reveals nothing.
- Post audiences: across neighborhoods and for non-followers; unverified accounts see no public posts.
- Photo storage: own-folder uploads only, unpublished photos unreadable, no borrowing someone else's photo, followers-only photos hidden from non-followers, no listing of folders.
- Private profile photos: stranger vs. follower vs. requester vs. neighbor; removed followers lose access; blocks in both directions; staff access; anonymous access denied; no `avatar_path` pointing at another folder, no path traversal; going private clears the public URL.
- Blocks across posts, comments, reactions, cards, lists and photos.
- Comment moderation, and comments can't be re-pointed.
- Privilege fields (`app_role`) stay protected; one account can't change another's privacy or photo.
- `media_attachments` hidden from neighbors.
- Account deletion removes follows, notifications the account caused, and attachment records. Residents can't call the purge function.

**Automated sweep after migrating:** no public table without RLS; no SECURITY DEFINER function without a fixed `search_path`; no new function callable by `anon`; `purge_account_data` callable only by `service_role`; `follows` not writable by clients; `profile-photos` not public.

**App tests:** TypeScript and ESLint clean; Jest (social, profile photos, splash and the existing suites); `node --test` for the photo-move script; `deno check` for the Edge Function, with the existing Apple-revocation tests passing. The iOS bundle exports.

## 4. Deployment procedure (after approval)
1. Take a fresh backup or confirm point-in-time recovery for the project.
2. Apply `20261109120000_social_follows_photo_posts.sql`, then `20261109130000_private_profile_photos.sql`.
3. Re-run the read-only checks: the new objects exist, the 4 existing suites' guarantees still hold, and the advisors report nothing new.
4. Deploy the updated `delete-account` function, keeping JWT verification on (same endpoint name; the legacy endpoint is untouched).
5. Run `node scripts/migrate-avatars-to-private.mjs` as a dry run, then `--apply`, then `--remove-public` once the new build is on TestFlight. It needs `SUPABASE_SERVICE_ROLE_KEY` in the operator's environment and is never shipped in the app.
6. Build above 13, upload to the internal **Team (Expo)** group, then test on an iPhone (checklist in section 6).

## 5. Rollback procedure
Run in reverse order, each in a single transaction:
1. `supabase/rollbacks/20261109130000_private_profile_photos.sql`
2. `supabase/rollbacks/20261109120000_social_follows_photo_posts.sql`

**What a rollback loses:**
- The `follows` table, `is_private` and `avatar_path`.
- Posts with the new audiences become `neighborhood` (the strictest existing audience, so nothing becomes more visible).
- Follow notifications.

**Files:** storage files are not deleted by SQL.
- Before rolling back 130000, check `select count(*) from profiles where avatar_path is not null and avatar_url is null`. Those accounts fall back to initials unless their photo is re-uploaded.
- The `profile-photos` bucket stays private.

**Edge Function:** redeploy the previous `delete-account` version. The new version also works without the new bucket.

Build 13 keeps working before, during and after a rollback.

## 6. Remaining device tests (not done; need an iPhone)
- Splash: dark green, N2 logo, name and tagline; no flash between the native and in-app splash.
- Profile photos:
  - change, remove and pinch zoom;
  - a private account's photo is hidden from a stranger and visible to a follower;
  - the legacy photo moves on first launch.
- Follows: follow, unfollow, request, withdraw, accept, decline, remove follower, block; counts update; follower lists and search.
- Private accounts: the content lock; going public approves pending requests.
- Multi-photo posting:
  - 1–10 photos, HEIC from the camera roll, reorder/remove/crop;
  - the review step, each audience, editing afterwards;
  - deleting a post.
- Likes, double-tap, comments (and an author removing a comment), share sheet (non-public posts share only the link), report and save.
- Notifications open the right profile or post.
- Regression: Apple, Google and email sign-in; Apple Maps; neighborhood verification and lock; business directory; events; clubs; messages; support; account deletion v2.

## 7. Note on `routerQueryDecoding.test.js`
- **Cause:** the earlier failure came from this container's `node_modules`, which didn't match the lockfile. `decode-uri-component` 0.2.2 was installed, while `package-lock.json` pins 0.5.1 through the `overrides` entry.
  - Without the `query-string` patch, 0.2.2 hangs on a long malformed value (the test hung).
  - With the patch, `require('decode-uri-component').default` doesn't exist in 0.2.2, so it threw `decodeComponent is not a function`.
- **Fix:** after a clean `npm ci`, which installs 0.5.1 and applies `patches/query-string+7.1.3.patch` through `postinstall`, both tests pass.
- **Effect on production:** none. EAS builds run `npm ci` from the lockfile, and the patch step uses `--error-on-fail`, so a build fails rather than shipping the broken combination.
- **Note for the team:** always install with `npm ci`, never `npm install` without the lockfile.
