# Haratna social resilience — cloud-session handoff (2026-11-10)

## Starting point
- **Branch:** `claude/haratna-social-resilience`, stacked on `claude/haratna-photo-privacy-hardening`, which is stacked on `4cf273c` (PR #5 head).
- **Codex's files were not reachable.** `docs/HARATNA-SOCIAL-RESILIENCE-HANDOFF.md`, `docs/HARATNA-SOCIAL-RELEASE-CHECKLIST.md`, `docs/social-validation/final-resilience.log` and the four PR #5 patches are not on any GitHub branch, and the owner's Mac is not connected to this session.
- **Codex's partial changes could not be checked.** Whether Codex made any is unknown from here; anything it made exists only on the Mac.
- **This file deliberately uses a different name.** It must be merged by hand with Codex's handoff and never overwrite it.

## Priority 1 — duplicate submissions (fixed)

**Server** (`supabase/migrations/20261110090000_social_resilience.sql`, not applied anywhere but the development database):
- `posts.client_op_id` and `post_comments.client_op_id`, unique per author.
- **`publish_post(op_id, …)` / `add_post_comment(op_id, …)`:**
  - Retries of the same operation are serialised with an advisory lock.
  - Returns `created`, `existing` (same author, same id, **same payload**: reconciled, nothing written) or `conflict` (same id, different payload: nothing written).
  - Ownership: ids are scoped to `auth.uid()`, so another account's identical id is a different operation and can't see or claim the first.
  - Clients can't change `client_op_id` afterwards (posts guard).

**App:**
- **`src/backend/pendingOps.ts`:**
  - Draft operation id, persisted (AsyncStorage) **before** any network call, keyed by account and draft (`post-composer`, `comment:<post>:<parent>`).
  - Remembers each photo upload as it completes.
  - 24-hour expiry.
- **`publishPostOnce` / `addCommentOnce`** (`src/backend/social.ts`):
  - A retry after a lost response reuses the id and photos.
  - `conflict` means the earlier attempt went through with other content: that post stays and the current content gets a new id.
  - `photo_unavailable` means a photo was cleaned up meanwhile: it is uploaded once more.
- **`createPost` / `addComment`** use them, and fall back to the old insert while the backend function is missing (production today).
- **Post composer:** a re-entrancy guard on Publish.
- **Comment composer:**
  - Keeps the draft (and reply target) until the server confirms, so a failed send can be retried under the same id.
  - **Bug found and fixed:** its "sending" guard was React state, so several taps in one frame each sent. It is now a ref.

## Priority 2 — committed photos vs cleanup (fixed, server-side)
- **Original bug:** after a failed insert, `createPost` deleted the uploaded photos. If the insert had committed and only the response was lost, the live post was left pointing at deleted files.
  - Fixed: the app never deletes post photos after a failure; `discardUploads` was removed.
- **Upload records.** Every `community-media/posts/<uid>/…` upload is recorded as `staged` (trigger-enforced; only the owner's folder).
- **Publication guard.** Any insert path, including a direct insert, runs `private.attach_post_photos` from the posts guard. For each photo it:
  - locks the record (`FOR UPDATE`);
  - requires the author to own it, the file to exist in Storage and the record not to be `deleting`;
  - marks it `attached`.

  Otherwise it raises `photo_unavailable` and nothing is written.
- **Cleanup** (`claim_abandoned_post_photos`, service role only):
  - Claims only `staged` uploads older than the cut-off that no live post references, using `FOR UPDATE SKIP LOCKED`, and marks them `deleting` before any file is touched.
  - `finish_post_photo_cleanup(deleted, failed)` drops the deleted records and re-stages only the paths explicitly reported as failed (and only if the file still exists).
- **Restrictive RLS:** clients can't delete a Storage object or upload record that a live post references, their own included.

## Evidence (development database: schema-only replica of production, synthetic accounts)

| Check | Result |
|---|---|
| `supabase/tests/social_resilience.sql` | **ALL_PASS 9**: staged uploads incl. forced status; lost-response retry → same post, no duplicate; payload mismatch → conflict; cross-account id reuse → separate post; cross-account photo use or delete refused; owner can't delete a referenced photo; deleted, unrecorded or claimed photo can't be published (RPC and direct insert); cleanup skips referenced photos; comment retry, conflict and notification not duplicated; unverified refused; `client_op_id` immutable |
| `supabase/tests/concurrency/resilience_race.sh` (real parallel sessions) | **RACE_ALL_PASS**, 3 consecutive runs: (1) two simultaneous publishes, same id → 1 post (`created` + `existing`); (2) cleanup during an in-flight publish → skipped, photo `attached`; (3) publish during an uncommitted cleanup claim → waits, then `photo_unavailable`, no post; (4) no live post references a missing or deleting file |
| Migration cycle: baseline → apply all 3 → roll back 090000 → roll back 130000 + 120000 → re-apply all 3 | Every suite passes at every step (neighbors 12, compliance 4, clubs 18, poll 2, social_follows 11, private_profile_photos 11, build13_compat 9, social_resilience 9) and the race drill passes after both applies |
| Privilege sweep | No table without RLS, no definer function without `search_path`, no new function executable by `anon`, cleanup functions `service_role` only |
| Jest | **48/48 suites, 419/419 tests**, incl. `resilience.test.tsx` (lost response, app restart, interrupted batch, conflict, cleanup re-upload, account switch, expiry, legacy fallback, comment retry) and `ComposerRepeatedTaps.test.tsx` |
| TypeScript, ESLint | Pass |
| `expo export --platform ios` | Pass (JavaScript bundle only) |
| Native iOS Simulator regression | **BLOCKED**: no macOS in the cloud session; the Mac is not connected |

Test drivers note: the drill's first runs failed because of the drill itself (shared fixtures; a `head -1` pipe that killed `psql` and rolled back the cleanup transaction). It was corrected before the passing runs; the guard was never changed for it.

## Remaining risks
1. **Native retries, interruptions and account switching are unverified on a device.** Logic is covered by Jest with real AsyncStorage persistence semantics; needs the Simulator.
2. **No scheduled cleanup job exists yet.** The claim/finish functions are ready; a job (Edge Function with the service role, or the operator script) must call claim → delete files → finish. Until then abandoned uploads just stay (private, owner-only).
3. **Real Storage API behaviour is untested.** The guard checks `storage.objects` rows; on Supabase the API writes that row on upload and deletes it on remove, which matches, but this should be confirmed against the local Supabase stack.
4. **Composer drafts aren't persisted.** After the app is killed, the user re-enters the post. The persisted id still prevents a duplicate if it is the same content (`existing`), and publishes a new post if the content changed.
5. **Legacy path.** Build 13 and any client calling the old direct insert get the photo guard but not idempotency.

## Release blockers
1. Merge with Codex's local work and patches (including the iOS 27 lifecycle fix) on the Mac; resolve conflicts in `src/backend/*`, the composers and the image components.
2. Native Simulator regression on the merged tree: posts and comments with repeated taps, network drop after commit (e.g. Network Link Conditioner), kill/relaunch, account switch, interrupted photo batch.
3. Supabase Security's hosted migration and recovery guidance (pending).
4. Owner approval for production migrations 20261109120000, 20261109130000 and **20261110090000**. Production gate closed; nothing applied.
5. A cleanup job (risk 2) before relying on automatic removal of abandoned uploads.
