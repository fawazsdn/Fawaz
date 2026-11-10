# Addendum to HARATNA-SOCIAL-RELEASE-CHECKLIST.md (cloud session, 2026-11-10)

**Why a separate file:** Codex's checklist, `docs/HARATNA-MANAGED-ROLE-RECOVERY.md`, `docs/haratna-pr5-social-fixes.patch`, `docs/haratna-pr5-ios27-scene.patch` and `docs/social-validation/` exist only on the owner's Mac. None of them are on any GitHub branch; the latest pushed commit is `4cf273c`. This session could not read them or the Simulator, so nothing of Codex's has been overwritten. Merge this file into the checklist on the Mac.

## Work in this session
- Branch: `claude/haratna-photo-privacy-hardening`, based on `4cf273c` and separate from Codex's local changes.
- Private-photo hardening; see `docs/HARATNA-PHOTO-PRIVACY.md`.

## Native iOS tests (requested)
The cloud session runs Linux: no Xcode, no Simulator, no access to the Mac.

| # | Test | Result | Evidence / note |
|---|---|---|---|
| 1 | Private profile UI and privacy changes | BLOCKED | Needs the Simulator. Covered by Jest (`social.test.tsx`: private profile lock, `PrivateAccountSetting`) and SQL (`social_follows.sql` §3, §6). |
| 2 | Follow request accept, reject, unfollow | BLOCKED | Jest (`FollowButton`, accept from profile); SQL §3–§4 |
| 3 | Followers/following lists, counts refreshed after navigation | BLOCKED | Jest (follower removal), SQL counts |
| 4 | Native photo picker and Storage upload | BLOCKED | Jest (composer with mocked picker and upload path) |
| 5 | Posts with multiple photos | BLOCKED | Jest (composer review step, upload folder) |
| 6 | Likes, comments, social notifications UI | BLOCKED | SQL (`build13_compat`, `social_follows` §8) |
| 7 | Arabic back gestures, navigation, localized errors | BLOCKED | Jest RTL suites |
| 8 | Denied uploads, failed API requests, offline | BLOCKED | Jest (refusals surfaced, failed upload cleanup) |
| 9 | Account deletion via Settings with synthetic Auth/Storage cleanup | BLOCKED | Jest (routing to `delete-account-v2`); `deno check` and Apple tests |

**To run on the Mac** with synthetic accounts only. Add for this branch:
- **(a) Rotation after block.** Account B opens A's profile, A blocks B. B's old photo link should fail within about 60 seconds, and B's app should show initials.
- **(b) No disk cache.** Sign out, then check the app container's `Library/Caches` has no private photos.
- **(c) Storage `copy` allowed.** Profile-photo rotation succeeds against the local Supabase stack.

## Automated results on this branch

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | PASS |
| ESLint | PASS |
| Jest | **46/46 suites, 407/407 tests**; `routerQueryDecoding` passes with a lockfile-exact `npm ci` |
| Operator script tests (`node --test`) | 11/11 |
| SQL migration cycle on the production-schema replica (baseline, apply, roll back each, re-apply) | PASS, 27 suite runs |
| Rollback drill with seeded data | PASS: guard stops while a private-only photo exists; data identical after re-apply and restore |
| `expo export --platform ios` | PASS (JavaScript bundle; **not** a native build or Simulator launch) |
| iOS development build + Simulator launch | BLOCKED (macOS only) |

## Release readiness
**Not ready for TestFlight.** Still needed:
1. Merge Codex's local work (both patches and the iOS 27 lifecycle fix) with this branch on the Mac. Resolve any conflicts in `src/backend/*` and the image components.
2. Run the native tests above, including (a)–(c).
3. Supabase Security's managed-role recovery guidance (pending).
4. The owner's production migration approval (gate closed). A fresh, independently restorable backup exists: snapshot 2026-11-09 17:03:21 UTC, verified by a full local restore. It is held encrypted in the cloud session and still needs a durable home the owner chooses.
5. Then a signed build above 13 to Team (Expo), with build 13 kept as the fallback.

## Update — social resilience (branch `claude/haratna-social-resilience`)
See `docs/HARATNA-SOCIAL-RESILIENCE-HANDOFF.claude.md`.

| Item | Result |
|---|---|
| Duplicate submissions (posts, comments): persistent client UUIDs, server reconciliation with ownership + payload check | Implemented; SQL 9/9, Jest resilience suite pass |
| Committed photos vs abandoned-photo cleanup (server-side lock protocol, restrictive delete policies) | Implemented; SQL + concurrency drill RACE_ALL_PASS (3 runs) |
| Bug fixed: photos deleted after a committed-but-lost insert | Fixed (no client-side deletion after failure) |
| Bug fixed: comment composer sent repeatedly on fast taps; draft cleared before confirmation | Fixed (ref guard; draft kept until confirmed) |
| Migration cycle with 3 migrations incl. rollbacks | PASS at every step |
| TypeScript / ESLint / Jest | PASS / PASS / 48 suites, 419 tests |
| Native iOS Simulator regression | BLOCKED (no macOS; Mac not connected) |
| New migration needing approval | `20261110090000_social_resilience.sql` (+ rollback) |
