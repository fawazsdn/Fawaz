# Haratna pre-release PASS/FAIL report (2026-11-15, Mac update)

**Overall: NOT READY FOR RELEASE APPROVAL.** Offline and Mac checks pass: the four Codex
patches are integrated (branch `rc/integration`), every SQL suite and the race drill pass
on a production-like replica, and all eight native iOS 27 Simulator resilience cases pass
with synthetic accounts. Still **NOT RUN**: hosted staging (awaiting authorization) and the
encrypted Mac backup (awaiting owner-only setup: age key, Keychain tokens, encrypted
`HaratnaBackup` volume and offsite destination). A NOT RUN row is not a PASS.

**Found and fixed on the Mac:** `20261110090000` redefined `private.guard_post_write()` with
calls into schema `private`, undoing Codex's fix in `20261109120000`. On a replica where
clients have no `private` usage (as in production), **every direct post insert failed**,
including all of build 13's (`permission denied for schema private`). The cloud replica
granted that usage, so it passed there. Fixed in commit "Keep Codex's posts-guard fix in the
resilience migration"; rollback script updated; full rehearsal re-run.

Status values:
- **PASS**: ran, and passed.
- **FAIL**: ran, and failed.
- **NOT RUN**: has not been executed yet.

"Offline" means a local PostgreSQL 16 + PostGIS database built one of two ways:
- **(R)** a restored copy of the production snapshot taken 2026-11-15 07:31:46 UTC;
- **(S)** structure only plus synthetic geography, built the way staging will be.

Production head: `20261108142118`, unchanged. PR #5 is not merged. No production functions
deployed. No cleanup scheduled. Nothing uploaded to TestFlight. Build 13 remains the fallback.

## 1. Hosted permissions (JWT role switching, RLS)

| Case | Offline | Hosted staging |
|---|---|---|
| `anon` cannot read social tables or call write RPCs | Partial PASS (R, S): anonymous profile-photo reads denied. Other tables are not covered offline. | NOT RUN |
| Forged `service_role` JWT rejected | n/a: only a real gateway checks signatures | NOT RUN |
| `authenticated` denied the service-only RPCs | PASS (R, S) for `legacy_avatar_inventory`, `claim_abandoned_post_photos` and `count_abandoned_post_photos`. `finish_post_photo_cleanup` is not covered offline. | NOT RUN |
| `service_role` can call the cleanup RPCs | Not covered offline (suites call them as the database owner) | NOT RUN |
| Audiences: public (verified users across Saudi Arabia), followers-only, neighborhood | PASS (R, S): social_follows 11 | NOT RUN |
| Private account: pending request sees nothing; accepted sees posts and photo | PASS (R, S): social_follows, private_profile_photos 11 | NOT RUN |
| Blocked users see nothing | PASS (R, S) | NOT RUN |
| Build 13 client queries still work after the migrations | PASS (R, S): build13_compat 9 | NOT RUN |

## 2. Migrations (as the hosted admin role) and rollback

| Case | Offline | Hosted staging |
|---|---|---|
| `20261109120000`, `20261109130000` and `20261110090000` apply in order | PASS (R, S) | NOT RUN: `supabase db push` as `postgres` |
| Existing suites unchanged after the migrations (neighbors 12, compliance 4, clubs 18, poll 2) | PASS (R, S) | NOT RUN |
| Full rollback leaves data byte-identical | PASS (R): 101/102 tables identical; the profile-photos bucket is kept by design | NOT RUN |
| Restore of social data after re-apply | PASS (R): rollback suite | NOT RUN |
| No new security or performance advisor findings | n/a | NOT RUN |
| Customer-owned recovery (data and structure fingerprint) | PASS (R): `HARATNA-RECOVERY-GATE.md` | n/a |

## 3. Auth and account deletion

| Case | Offline | Hosted staging |
|---|---|---|
| Synthetic sign-up and sign-in (email only, no mail sent) | n/a | NOT RUN |
| `delete-account-v2`: Auth user, profile, follows and Storage objects removed | Partial PASS: `purge_account_data` covered by suites (R, S); the function's Deno code reviewed | NOT RUN |
| Repeated deletion call refused safely | n/a | NOT RUN |
| Club successor on deletion | PASS (R, S): clubs 18 | NOT RUN |

## 4. Storage

| Case | Offline | Hosted staging |
|---|---|---|
| Upload only into your own folder; unverified users cannot upload | PASS (R, S): policy suites | NOT RUN |
| Wrong file type rejected | n/a: enforced by the Storage service | NOT RUN |
| Signed URL works for permitted viewers; refused for unverified and blocked users | Policy PASS (R, S) | NOT RUN |
| No public URL for private buckets | n/a | NOT RUN |
| Profile photo: pending request refused; accepted request allowed | PASS (R, S) | NOT RUN |
| Encrypted backup of Storage bytes, with restore check | PASS (fake API) | NOT RUN on the Mac: owner setup pending (section 7) |

## 5. Photo cleanup

| Case | Offline | Hosted staging |
|---|---|---|
| Post delete removes its photo; the old signed URL stops working (~60 s) | Object removal PASS (R, S) | NOT RUN |
| Dry run counts and deletes nothing | PASS: Deno test "dry run only previews" (5/5 pass) | NOT RUN |
| Abandoned upload (> 1 h) removed; published photos untouched | PASS: SQL claim/finish suite and Deno tests | NOT RUN: `cleanup` phase |
| Cleanup racing a publish: no post references a missing file | PASS (R, S): `RACE_ALL_PASS` | NOT RUN |
| Failed deletions retried; stuck claims recovered | PASS: social_resilience 10 | NOT RUN |
| User JWT cannot invoke the cleanup function | Code reviewed only (the service-key check in `index.ts` has no test) | NOT RUN |
| Exactly-once: same `op_id` returns `existing`; changed content returns `conflict` | PASS (R, S) | NOT RUN |

## 6. Native resilience (iOS Simulator, Mac)

Environment: Xcode 27.0 (27A266a), fresh iPhone 18 Pro Simulator, iOS 27.0 (24A434). Debug
build of `rc/integration` with a dev overlay only (bundle `sa.haratna.app.socialdev`, Apple
Sign-In off). Backend: local synthetic Supabase through a loopback fault proxy that can drop
or hold a response **after** the server committed. Synthetic accounts `rc4c4578-a/b@example.invalid`.
Each test asserts its traffic reached the RC proxy. Rows were counted directly in the
database. Evidence: `docs/social-validation/rc-integration/` (logs, `shots/`, `harness/`).

| Case | Status | Evidence |
|---|---|---|
| Post committed with lost response, then retry: exactly 1 post | **PASS**: `COMMITTED 200 publish_post -> response dropped`; error shown, draft kept; retry returned the existing post. posts=1 | `native-cases-1-5.log`, `shots/lost-post-*` |
| Comment committed with lost response: 1 comment, 1 notification | **PASS**: comments=1, notifications=1 | `native-cases-1-5.log`, `shots/lost-comment-*` |
| Rapid repeated taps (Publish, comment send): 1 row each | **PASS**: 6 send taps and repeated Publish/confirm during a 4 s held response; one RPC call each; 1 comment, 1 post | `shots/rapid-*` |
| Kill the app during publish, relaunch, retry: 1 post (operation id persisted) | **PASS**: killed after `COMMITTED 200`; relaunch and same content returned the existing post; 1 post, 1 op id | `shots/kill-relaunch-publish.png` |
| Switch account during a request: no cross-account reuse | **PASS**: A's commit lost; B got its own comment; A's retry reconciled. A=1, B=1, 2 op ids | `shots/switch-*` |
| Multi-photo upload interrupted, retry: only the remaining photos uploaded, 1 post | **PASS**: second upload cut; retry uploaded only the missing photo; 1 post with 2 photos, 2 objects, 0 orphans | `native-cases-6-9.log`, `shots/photo-*` |
| Cleanup while publishing: published photos untouched | **PASS**: job ran during a held, committed publish: `claimed 1, deleted 1, failed 0`; planted abandoned upload removed; published photos and records intact; 0 dangling references. The in-flight post was text-only; the photo lock race is covered by `RACE_ALL_PASS` | `native-cases-6-9.log`, `shots/cleanup-during-publish.png` |
| "Posting paused" against a server without the migration (Arabic and English) | **PASS**: comment and post show the localized message in both languages; 0 rows, 0 uploads | `shots/paused-*-ar.png`, `shots/paused-*-en.png` |
| Arabic/English comment rendering and back gestures | **PASS**: comments render in both directions; English left-edge and Arabic right-edge swipes return | `shots/english-*`, `shots/arabic-*` |
| iOS 27 scene lifecycle fix preserved | **PASS**: fresh prebuild with `expo-build-properties` (`enableSceneSupport`); built app declares `EXExpoAppSceneDelegate`; cold launch on a fresh device reached the Arabic welcome screen and every flow above | `shots/`, build log |
| Unit tests on the Mac | **PASS**: tsc PASS; ESLint 1 error in the docs-only harness script `rc-fixture.cjs`, 0 in app code (corrected below and fixed); Jest 49/49 suites, 423/423 tests (2 timing-sensitive suites fail only under heavy machine load and pass alone, 21/21); Deno 8/8 and `deno check` PASS | `automated-checks.log` |
| SQL suites and race drill on a production-like replica (clients have no `private` usage) | **PASS**: baseline → apply 3 → roll back 090000 → roll back 130000+120000 → re-apply; every suite ALL_PASS, `RACE_ALL_PASS` twice; privilege sweep clean | `sql-rehearsal.log` |

Follow-up fixes (2026-11-15, after the native run), each re-verified:

| Finding | Status | Evidence |
|---|---|---|
| After a lost response the alert said "nothing was saved — try again", although the server may have committed | **FIXED**: the generic offline message now says the outcome couldn't be confirmed; posts and comments (exactly-once) say retrying is safe and won't post twice. Re-run of the lost-response case on iOS 27: new Arabic message shown, still exactly 1 post | Jest `resilience.test.tsx` (+5 tests); `shots/lost-post-alert-after-message-fix.png` |
| In Arabic, Latin names rendered as ".RcAlpha S" (period on the wrong side) | **FIXED**: `displayName` / the neighbors list append an invisible LEFT-TO-RIGHT MARK to left-to-right names ending in punctuation; Arabic names unchanged. Re-run on iOS 27 shows "RcAlpha S." | Jest `format.test.ts` (+4 tests); `shots/arabic-comments-before-bidi-fix.png` → `shots/arabic-comments-after-bidi-fix.png` |
| `business_directory` and `neighborhood_locking` privilege suites fail on the local synthetic replica | **NOT A PRODUCT DEFECT; replica drift.** The replica was loaded without production's GRANT/REVOKE statements, leaving `authenticated` with Supabase's broad default grants. Re-applying only the migrations' own ACL statements to a throwaway clone makes both suites pass. Production's grants (ACL entries read from the owner's local 2026-11-09 dump, no row data, no production access) are narrow: `authenticated` has `SELECT` only on the four tables; the two directory functions are revoked from `PUBLIC`. The staging README now runs both suites before migrating, so a staging copy without ACLs is caught | `supabase/staging/README.md` step 4 |

After the fixes: tsc PASS, Jest 49/49 suites and 432/432 tests. **Correction:** ESLint was reported as 0 errors at `d7f80b6` and `75f45da`; it actually had 1 error, in the docs-only harness script `rc-fixture.cjs` (`__dirname` undefined; not app code). Fixed in the next commit.

## 6b. Final native checks (2026-11-15, iOS 27 Simulator, synthetic accounts)

Evidence: `docs/social-validation/rc-final/`. App in Arabic unless stated.

| Case | Status | Evidence |
|---|---|---|
| Select and reorder ten photos, publish | **PASS.** 11 picker taps produced exactly 10 drafts (the picker limit refused the 11th; "١٠ من ١٠ صور"). Reordered ("move later" on photo 1, "move earlier" on photo 10). The stored post's photo order, decoded from each uploaded file's aspect ratio, is `[10, 11, 9, 8, 7, 6, 5, 4, 2, 3]`, exactly the UI order | `ten-photos.log`, `shots/ten-*` |
| Photo controls while the keyboard is open | **FAIL → FIXED.** The first tap on a photo's move/remove control only closed the keyboard (the nested photo strip lacked `keyboardShouldPersistTaps`). After the fix every tap acts and the keyboard stays | `shots/photo-move-first-tap-before-fix.png`, `…-after-fix.png` |
| VoiceOver: profiles, posts, comments, follow controls | **PARTIAL → mostly FIXED.** `performAccessibilityAudit` (all types) plus element inspection. VoiceOver itself can't be driven by XCTest, so no spoken-output test. Before: the post card was one accessibility element, so VoiceOver couldn't reach like/comment/save/share/author; 9 icon buttons had no description; several labels were hard-coded English (`send`, `more`, `close`, `dismiss`). After: every post-card button is reachable with a localized label and state; comment avatar, like and menu labeled; 0 unlabeled elements on the post, followers, profile and composer screens. **Remaining:** 14 small hit areas on the post screen (icon buttons below 44 pt; comment-row icons now have a larger touch slop the audit can't measure); `SearchBar` "clear" and `HaratnaMap` "map" labels are still English (no strings exist yet) | `accessibility-audit.log`, `shots/audit-screens.png` |
| Largest accessibility text size (AX5), Arabic and English | **PASS with defects.** Post, comments, profile and composer scale and stay usable in both directions. Defects: the profile stats labels overlap and clip ("منشورات متابِعون", "PostsFollowe"); in Arabic at normal size the profile's Follow / Add-neighbor buttons truncate ("متاب…", "إضافة…"); headers and chips truncate; icons don't scale | `shots/large-text-arabic.png`, `shots/large-text-english.png`, `shots/audit-screens.png` |
| Private profile photo after blocking (API) | **PASS, residual measured.** While allowed: signing and fetching work. Right after B blocks A: new signing **denied**, direct download **denied**, `social_profile` returns nothing. The already-issued link keeps working (HTTP 200 at +1 s, +120 s, +290 s) and **expires at ~300 s (HTTP 400)**, the 5-minute TTL | `signed-url-after-block.log` |
| Private profile photo after blocking (app, cache) | **PASS with residual.** Same screen re-linked: still shows the profile and photo (no refetch). After navigating away and back: refetch returns nothing and the private sections and follow button disappear, **but the name and photo stay visible from local data** (signed link, memory-only image cache). After relaunch: "هذا الملف غير متاح" (profile unavailable). No disk cache | `shots/block-*.png` |
| Language choice persists across relaunch | **PASS** | test17 |

Privacy design question (not a regression): under the neighborhood rule, a **private** account
with any live post, of **any audience**, in the shared neighborhood shows its profile and photo to
every verified neighbor (`private.profile_visible_in_neighborhood`). Owner decision: should only
neighborhood-audience activity count?

## 7. What is needed to fill the NOT RUN rows

1. **Owner authorization to provision Option A staging.** Then follow `supabase/staging/README.md`.
2. **Encrypted Mac backup (owner-only setup first):** create the encrypted APFS volume
   `HaratnaBackup` (the existing `Haratna-Backup-5GB` disk image is AES-encrypted, but the
   script requires a volume diskutil reports as `FileVault: Yes`), create the age key with
   its passphrase, add the two Keychain items, and choose the offsite destination. Then
   run `haratna-backup.sh` and `haratna-restore-check.sh` (`HARATNA-ENCRYPTED-BACKUP.md`).
3. Then this report is updated and release approval is requested.
