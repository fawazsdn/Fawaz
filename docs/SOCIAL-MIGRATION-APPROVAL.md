# Production migration approval request — Haratna social features (PR #5)

**Status: waiting for the owner's explicit approval. Nothing below has been applied to production.**

- Supabase project: `ckqwziutmqohihrenstz` (PostgreSQL 17.6).
- Build 13 (branch `codex/haratna-release-candidate-13`) stays the stable fallback throughout.

## 0. Corrections since the first review

| # | Request | Resolution |
|---|---|---|
| 1 | Should the deletion update go to `delete-account-v2`? | **Yes.** The repo's `supabase/functions/delete-account/` source is what runs as `delete-account-v2` (live v1 matches the reviewed base exactly). The update deploys to `delete-account-v2` only. The legacy `delete-account` (v5) is not touched. The new build sends **every** account deletion to v2 (§3). |
| 2 | A pending follow request must not grant photo access | Fixed. Photo access no longer uses the follow-related profile rules: a pending request grants nothing **in either direction**. Tested both ways (§5). |
| 3 | Rollback must handle real photos and follows safely | The rollbacks now copy follows, privacy settings, new audiences, follow notifications and photo paths into private backup tables first. They delete no files and restore archived public links. The photo rollback stops if anyone would lose their photo. A restore script brings everything back after a re-apply. A drill with real data proved before == after (§6). |
| 4 | Keep original public avatars until the device tests pass | The app and the script now only **copy** originals. Removing them is a separate stage that refuses to run without `--confirm-device-tests-passed` and a passing integrity check (§4). Any public link taken off a profile is archived, and its file kept. |
| 5 | Build 13 must keep working during the rollout | A new test replays build 13's exact database calls against the migrated schema; all pass (§7). |

**Found while checking item 5 (pre-existing, not caused by these migrations):**
- On today's production schema, deleting a post or a comment from the app fails. The app's direct update is refused by RLS because the deleted row no longer passes the read policy. Production has 0 soft-deleted posts or comments, which is consistent with this.
- Build 13 is affected today and stays unchanged.
- The new build fixes it for posts and comments with `delete_post` / `delete_post_comment` (authors, post authors for comments, and staff).
- Staff removal of **marketplace listings** has the same pre-existing problem. It is outside this PR and left for a separate fix.

## 1. What will be changed

| # | Change | File |
|---|--------|------|
| 1 | Follows, private accounts, post audiences, photo-post privacy, block enforcement, follow notifications, `delete_post`, account-deletion cleanup | `supabase/migrations/20261109120000_social_follows_photo_posts.sql` |
| 2 | Private profile photos, the archive of public photo links, RLS hardening | `supabase/migrations/20261109130000_private_profile_photos.sql` |
| 3 | `delete-account-v2` also removes private profile and post photos and sweeps each account's own folders | `supabase/functions/delete-account/index.ts` (deployed as **`delete-account-v2`**) |
| 4 | Staged copy of existing profile photos | `scripts/migrate-avatars-to-private.mjs` |

### Migration 1 — social features
- **New table `follows`**: pending/accepted.
  - No self-follows and no duplicates.
  - Clients can't write it directly; changes only go through `follow_user`, `unfollow_user`, `respond_follow_request` and `remove_follower`.
- **New column `profiles.is_private`** (default `false`). Turning it off approves pending requests.
- **Post audiences:**
  - **Public**: verified Haratna residents across Saudi Arabia; for a private account, only its followers and its neighborhood.
  - **Followers**: accepted followers only.
  - **Verified neighbors** (`neighborhood`, the default; legacy `city` behaves the same): verified members of that neighborhood only.

  The author and staff always see their posts, and a block hides them either way.
- **Comments, likes and saves** follow the post rule. Blocked people's comments are hidden, and post authors can remove comments on their posts.
- **New post photos** go to `community-media/posts/<uid>/`, readable only through a visible post.
  - A post can only reference its author's own files.
  - Neighborhood-folder photos can't go on public or followers-only posts.
  - Edits can reorder or remove photos, not add them. Maximum 10 photos.
- **Notifications**: new types `follow`, `follow_request` and `follow_accepted`. Like and comment notifications are skipped between blocked accounts.
- **Blocking** removes follows and follow notifications in both directions.
- **`purge_account_data`** also removes follows and every notification the account caused.

### Migration 2 — private profile photos
- **New private bucket `profile-photos`**: 5 MB limit, JPEG/PNG/WebP/HEIC only.
- **New column `profiles.avatar_path`**, confined to the account's own folder (no path traversal).
- **Who may open a profile photo.** The app gets 5-minute signed links (post photos: 15 minutes), keeps them off the device disk, and rotates the photo file after a block, a removed follower or going private so earlier links stop working (see `docs/HARATNA-PHOTO-PRIVACY.md`).
  - The owner and staff: always.
  - Across a block: never. Unverified or signed-out users: never.
  - Public account: verified residents.
  - Private account: accepted followers, and people who already see the profile under the existing neighborhood rule.
  - A follow request grants nothing.
- **`private.avatar_legacy_urls`** archives any public photo link removed from a profile (account went private, photo replaced, removed or moved).
  - The files themselves stay until the approved cleanup.
  - Clients can't read the archive. `legacy_avatar_inventory` and `mark_legacy_avatar_removed` are for the service role only.
- **Profile cards and follower lists** return a photo only to allowed viewers.
- **Hardening:** `media_attachments` rows are visible only to their owner and staff; comment edits can't change post, author or parent.

## 2. Impact on existing data
Read-only counts from production on 2026-11-09:
- 5 profiles; 1 profile photo in the public bucket; 0 hosted elsewhere.
- 1 post (1 photo, existing audience); 16 notifications; 4 media records.
- 0 soft-deleted posts or comments.
- None of the new objects exist yet.

**No existing row is deleted or rewritten by either migration.** Every account starts public with no follows, and existing posts keep their audience and photos. The one public profile photo is **copied**; the original file and its link stay until stage 3 (§4).

## 3. Account deletion during the staged rollout

| Client | Endpoint | Removes |
|---|---|---|
| New build, all accounts | `delete-account-v2` (Apple accounts: Apple token revocation first, unchanged) | Tracked files in all three buckets, plus a sweep of `avatars/<uid>`, `profile-photos/<uid>` and `community-media/posts/<uid>`. Then purge, session revocation and auth-user deletion, as before. |
| Build 13 Apple accounts | `delete-account-v2` (as today) | Same as above, once v2 is redeployed |
| Build 13 email/Google accounts | legacy `delete-account` v5 (untouched) | Public avatars and community media, as today. A private **copy** made during stage 1 may remain; `--sweep-orphans` removes files of accounts that no longer exist. |

- **v2 vs. v5 for accounts without Apple:** the two are identical except for v2's GET capability check. Routing every new-build deletion to v2 is therefore the same behaviour plus more complete cleanup.
- **Preserved in v2:**
  - Apple revocation: a fresh code is required; the ID-token signature, issuer, audience and subject are verified; deletion stops before cleanup on any failure.
  - JWT verification is on.
  - Deletion order: storage → purge → session revocation → auth user.
- **Change in v2:** only the storage step, which now covers more files. `deno check` passes and the 3 Apple revocation tests pass.
- **Cutting the legacy endpoint over** stays a separate decision, as in `docs/app-store/account-deletion-rollout.md`.

## 4. Staged photo rollout
1. **Stage 1 — copy (with deployment):**
   - `scripts/migrate-avatars-to-private.mjs` dry run, then `--apply`, which copies originals to `<uid>/legacy-<file>`, checks the size, and sets `avatar_path`.
   - The new app does the same for its own user on first launch.
   - `avatar_url` and the public files are untouched, so **build 13 keeps showing every photo**.
   - An account that goes private stops being served its public link (archived), but the file stays.
2. **Stage 2 — verify:** `--verify` checks that every private photo exists, every copy matches its original byte-for-byte in size, and every archived original still exists.
3. **Stage 3 — remove originals (needs your separate go-ahead):**
   - Only after the replacement TestFlight build passes the device tests (§8) and `--verify` is clean.
   - Run `--remove-public --apply --confirm-device-tests-passed`. It re-runs the integrity check and aborts before touching anything if there's any problem.
   - It deletes originals that have a verified private copy, and those their owners replaced or removed. It never deletes a private account's original until its private copy exists.
   - After this stage, build 13 shows initials for moved photos.

Other modes:
- `--restore-public`: rollback aid that gives private-only photos a public copy again.
- `--sweep-orphans`: files of accounts that no longer exist.

All modes are dry-run unless `--apply`, print ids and counts only, and need the service-role key in the operator's environment (never in the app). The script has 11 automated tests.

## 5. Privacy protections tested
Testing used a local PostgreSQL 16 + PostGIS replica built from the production schema only (no user data).

**`social_follows` (11 groups)**
- No self-follows, forged rows or follows from unverified accounts; following is idempotent and notifications aren't duplicated.
- Private-account requests: withdraw, decline, accept, remove follower; a pending request reveals nothing.
- Every post audience across neighborhoods and for non-followers; unverified accounts see no public posts.
- Photo storage: own folder only, unpublished photos unreadable, no borrowed photos, no listing, the 10-photo limit, no adding photos on edit, no moving posts.
- Comment moderation; blocks across every surface; staff access; name search can't match hidden last names; account deletion.

**`private_profile_photos` (11 groups)**
- Own-folder rule and path traversal; public-account photos visible to verified residents only (not unverified, not anonymous).
- Going private hides the photo from strangers, removes the card photo and archives the link; clients can't read the archive or call the operator functions.
- **Pending request:**
  - a public requester's photo is visible to the recipient only because that account is public;
  - a **private requester's photo is hidden from the recipient**;
  - the requester never sees the private account's photo.
- Accepted followers see it, removed followers lose it; neighbors under the existing rule keep it; blocks hide it both ways; staff always see it.
- `media_attachments` hidden from neighbors; comments can't be re-pointed; privilege fields stay protected.
- Replaced and removed links are archived; deletion cleans up.

**Privilege sweep (after migrating):**
- no public table without RLS;
- no SECURITY DEFINER function without a fixed `search_path`;
- no new function callable by `anon`;
- purge and operator functions limited to `service_role`;
- private tables unreadable by clients;
- `follows` not writable by clients;
- the bucket is private.

## 6. Rollback procedure and data safety
Run in reverse order; each file is a single transaction:
1. `supabase/rollbacks/20261109130000_private_profile_photos.sql`
2. `supabase/rollbacks/20261109120000_social_follows_photo_posts.sql`

**What is preserved:**
- Follows, privacy, post audiences, follow notifications and photo paths are copied into `private.rollback_20261109_*` before anything is dropped.
- No storage file is deleted.
- Archived public links (accounts that went private or whose photo was moved) are put back on their profiles.
- Posts that used public or followers are set to `neighborhood` while rolled back, so nothing becomes more visible. Their photos stay readable only by their authors and staff.

**Guard:** the photo rollback **stops** if someone has only a private photo (uploaded in the new build, or whose original was already cleaned up). Run `--restore-public --apply` first, or explicitly accept initials with `set haratna.allow_photo_fallback = on`.

**Re-applying later:** apply both migrations again (they are safe after a rollback), then run `supabase/rollbacks/restore_20261109_social_data.sql`.

**Drill with committed sample data** (4 accounts, 3 follows incl. 1 pending, 1 private account, public/followers posts, 3 private photos):
1. The rollback stopped while a private-only photo existed.
2. After `--restore-public`, both rollbacks ran:
   - all data was saved;
   - audiences became `neighborhood`;
   - the private account's public link came back;
   - all 3 photo files were kept;
   - the existing suites passed.
3. After re-applying both migrations and the restore script, the data **matched the pre-rollback state exactly**, and all 7 suites passed.

**Remaining risk:** follows created *while rolled back* can't exist (no table). Once stage 3 has removed originals, rolling back needs `--restore-public`, which the guard enforces.

**Edge Function rollback:** redeploy `delete-account-v2` v1 from commit `0468b75`; v1 lacks only the new storage cleanup. Legacy v5 is unchanged throughout.

## 7. Build 13 during the staged rollout
`supabase/tests/build13_compat.sql` replays build 13's own calls (commit `0468b75`) against the migrated schema. All pass:
- Profile setup with a public-bucket photo.
- Neighborhood photo posts with `neighborhood` and `city` audiences.
- The neighborhood feed and signed photo links.
- Likes, saves, comments (add, reply, edit, like), reports, mutes, blocks.
- Marking notifications read.
- Seeing new-build public posts and their photos (but not followers-only posts).
- The new notification types arriving as ordinary title/body rows with valid `/profile/<id>` links.
- Unknown audiences still rejected.
- The legacy purge path.

Build 13's post and comment delete buttons behave exactly as they do in production today (refused; pre-existing). The neighbors, clubs, compliance and poll suites pass before the migration, after it and after the rollback.

**What build 13 users notice:**
- posts from people who blocked them disappear;
- other residents' media records are no longer readable (the app never reads them);
- once stage 3 runs, initials instead of moved photos.

Nothing else changes.

## 8. Deployment plan — for your approval
1. Confirm a fresh backup or point-in-time recovery.
2. Apply migration 1, then migration 2.
3. Re-run the read-only checks:
   - the objects exist;
   - the advisors show nothing new;
   - a non-destructive probe (no user data changed) confirms the functions and policies.
4. Deploy `delete-account-v2` (JWT verification on). Verify unauthenticated → 401 and authenticated GET → `appleRevocation` unchanged. The legacy `delete-account` stays untouched.
5. Run photo stage 1 (dry run, then `--apply`), then `--verify`.
6. Build above 13 on the authorized Mac (EAS `google-testflight` profile, store signing) and upload to **Team (Expo)**. Build 13 stays available and selected.
7. Device tests on an iPhone (none done yet):
   - Splash: dark green, N2, name and tagline, no flash.
   - Profile photos: change, remove, zoom; a private photo hidden from a stranger, visible to a follower and **not** to someone with only a pending request; the legacy photo copied on first launch, original kept.
   - Follows: follow, unfollow, request, withdraw, accept, decline, remove follower, block; counts, lists, search.
   - Private accounts: the content lock; going public approves pending requests.
   - Multi-photo posting: 1–10 photos, HEIC, reorder, remove, crop, the review step, each audience, editing, **deleting a post**.
   - Likes, double-tap, comments (incl. **deleting** and an author removing one), share (non-public posts share only the link), report, save.
   - Notifications open the right screens.
   - Regression: Apple, Google and email sign-in; Apple Maps; neighborhood verification and lock; directory; events; clubs; messages; support; account deletion v2 (only with your separate approval for a disposable account).
8. Stage 3 (removing originals) only after you confirm the device tests and `--verify` is clean.

## 9. Note on `routerQueryDecoding.test.js`
- **Cause:** a stale `node_modules` in the build container (`decode-uri-component` 0.2.2 instead of the locked 0.5.1).
- **Fix:** after `npm ci` the test passes.
- **Effect on production:** none. EAS installs from the lockfile, and `patch-package --error-on-fail` fails a build rather than shipping the broken combination.
