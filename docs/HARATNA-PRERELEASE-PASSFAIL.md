# Haratna pre-release PASS/FAIL report (2026-11-15)

**Overall: NOT READY FOR RELEASE APPROVAL.** Every check that can run offline passes. The
hosted, Mac and native checks have **not run**: hosted staging is waiting for
authorization, and the Mac is not connected to the cloud session. A NOT RUN row is not a
PASS.

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
| Encrypted backup of Storage bytes, with restore check | PASS (fake API) | NOT RUN on the Mac |

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

## 6. Native resilience (iOS Simulator, Mac only)

The Mac is not connected, so the Codex patches are not integrated and none of these ran.

| Case | Status |
|---|---|
| Post committed with lost response, then retry: exactly 1 post | NOT RUN |
| Comment committed with lost response: 1 comment, 1 notification | NOT RUN |
| Rapid repeated taps (Publish, comment send): 1 row each | NOT RUN |
| Kill the app during publish, relaunch, retry: 1 post (operation id persisted) | NOT RUN |
| Switch account during a request: no cross-account reuse | NOT RUN |
| Multi-photo upload interrupted, retry: only the remaining photos uploaded, 1 post | NOT RUN |
| Cleanup while publishing: published photos untouched | NOT RUN |
| Arabic/English navigation and back gestures; "posting paused" error against an old server | NOT RUN |
| iOS 27 scene lifecycle fix preserved | NOT RUN |
| Unit tests on the Mac (tsc, eslint, jest) | NOT RUN on the Mac. The cloud session runs them on Linux. |

## 7. What is needed to fill the NOT RUN rows

1. **Owner authorization to provision Option A staging.** Then follow `supabase/staging/README.md`.
   The reports go to `docs/social-validation/staging-main.md` and `staging-cleanup.md`.
2. **Mac session:** run the encrypted backup and the restore check
   (`HARATNA-ENCRYPTED-BACKUP.md`), integrate the four Codex patches, and run section 6.
3. Then this report is updated and release approval is requested.
