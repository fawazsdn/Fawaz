# Haratna release candidate — integration status and Mac runbook (2026-11-11)

## Branches (GitHub, fawazsdn/Fawaz)

| Branch | Head | Content |
|---|---|---|
| `claude/haratna-social-profiles` | `4cf273c` | PR #5 (draft), unchanged |
| `claude/haratna-photo-privacy-hardening` | `2f611c5` | short links, no disk cache, photo rotation (+ backup tool commit) |
| `claude/haratna-social-resilience` | `25eac13` | exactly-once posts/comments, photo guard |
| **`claude/haratna-rc-integration`** | see `git log` | **integration branch**: resilience + fail-closed + cleanup job, backup tool and `.pyc` removed |
| `claude/haratna-backup-tooling` | `08e88fe` | backup tool kept separately (not part of the release), `.pyc` removed |

No branch was reset or force-pushed. PR #5 was not changed or merged.

## Integration with Codex's Mac work: DONE on the Mac (2026-11-15)
- Branch `rc/integration` (local worktree `haratna-rc`) = this branch + five commits: the four
  Codex patches in order (1–3 applied cleanly, 4 reconciled) and the posts-guard fix below.
- Patch 4 reconciliation: Composer keeps the ref guard and draft-until-confirmed, plus Codex's
  rule of not clearing text typed during a send; a failed reload after a confirmed comment no
  longer reports failure; the `uploadPostPhotos` → `discardUploads` hunk was dropped (no callers,
  and client deletion after an ambiguous response is what the cleanup protocol replaces);
  `commentSync.test.ts` drives `add_post_comment` instead of a plain insert.
- **Regression found and fixed:** `20261110090000` redefined `private.guard_post_write()` with
  `private.*` calls, undoing Codex's `20261109120000` fix. Clients have no `private` usage, so
  every direct post insert (build 13) failed. Photo attachment moved to a security-definer
  trigger `posts_guard_write_photos`; the rollback restores Codex's guard.
- Codex's patches, handoff, checklist and `docs/social-validation/` evidence are now committed.
- Results: `HARATNA-PRERELEASE-PASSFAIL.md` §6 and `docs/social-validation/rc-integration/`.

## Done in the cloud (on `claude/haratna-rc-integration`)

| Risk (Step 3) | Resolution | Evidence |
|---|---|---|
| 1. Silent fallback to non-idempotent inserts | Removed. Posting and commenting **require** `publish_post` / `add_post_comment`. A one-time probe (null operation id, always rejected by the real function, creates nothing) runs before any upload. If the server is outdated: localized "posting is paused while Haratna is updated" error, no upload, no insert. An offline probe isn't cached. | Jest: fail-closed, probe-once, offline-probe tests |
| 2. UUID persistence across retries, termination, account switch | Persisted (AsyncStorage) per account and draft before any network call; reused on retry; new after success, conflict, or 24 h; never shared between accounts. | Jest `resilience.test.tsx`. **Device run: Mac** |
| 3. Committed photos vs cleanup, direct Storage deletes, concurrency | Server lock protocol plus restrictive RLS on `storage.objects` and `media_attachments` deletes; posts guard on every insert path. | SQL `social_resilience` 10/10; real-session race drill RACE_ALL_PASS |
| 4. Cleanup job and safe retries | `claim` → Storage remove → `finish(deleted, failed)`. A claimed upload is **never publishable again**; failed deletes stay claimed and are retried next run; a crashed run's claims are recovered after `stale_after`; read-only preview. Edge Function `cleanup-post-photos` (service role only, **not deployed**, no schedule). | SQL §9; Deno 5/5; `deno check` |
| 5. Unrelated artifacts | Backup tool and `scripts/backup/__pycache__/*.pyc` removed from the release branch; `__pycache__/`, `*.pyc` ignored. Tool preserved on `claude/haratna-backup-tooling`. | `git ls-files` shows no `scripts/backup` and no `.pyc` |
| 6. Build 13 compatibility | `build13_compat.sql` replays build 13's calls after all three migrations; passes. Build 13 still uses direct inserts (photo guard applies, idempotency doesn't), so a lost-response retry on build 13 can still duplicate, as it can today. | Cycle below |

## Migration and rollback rehearsal
Development database: a schema-only replica of production, with synthetic data.

| Step | Result |
|---|---|
| 1. Baseline (production schema) | neighbors 12, compliance 4, clubs 18, poll 2: PASS |
| 2. Apply 20261109120000 + 20261109130000 + 20261110090000 | All 8 suites PASS (incl. social_follows 11, private_profile_photos 11, build13_compat 9, social_resilience 10) + RACE_ALL_PASS |
| 3. Roll back 20261110090000 | 7 suites PASS |
| 4. Roll back 130000 + 120000 | 4 baseline suites PASS |
| 5. Re-apply all three | All 8 suites PASS + RACE_ALL_PASS |

All 33 suite runs passed. The privilege sweep is clean: cleanup and preview functions are `service_role` only; nothing new is callable by `anon`.

## Automated results (cloud, Linux)
- TypeScript: PASS.
- ESLint: PASS.
- Jest: **48/48 suites, 421/421 tests**.
- Operator-script tests: 11/11.
- Edge Function: `cleanup-post-photos` Deno tests 5/5 and `deno check` PASS.
- `expo export --platform ios`: PASS (JavaScript bundle only).

## Mac runbook (owner or Codex)

**1. Protect the existing work.** Nothing below rewrites existing commits.
```sh
cd <Fawaz-claude-haratna-frontend-build-bdy51c>
git status && git stash list && git branch --show-current     # record everything
git switch -c codex/rc-snapshot-$(date +%Y%m%d) && git add -A && git commit -m "Snapshot Codex local work before integration"   # only if there are uncommitted changes
git fetch origin claude/haratna-rc-integration
git worktree add ../haratna-rc origin/claude/haratna-rc-integration -b rc/integration
cd ../haratna-rc
```

**2. Integrate Codex's work.** Apply the four patches and the iOS 27 lifecycle fix in their original order:
```sh
git apply --3way docs/haratna-pr5-*.patch
```
Expect conflicts in:
- `src/backend/social.ts` and `src/backend/actions.ts`: keep **both** sides' fixes, but no plain-insert fallback in `createPost` / `addComment`.
- `app/create/post.tsx` and `src/components/Composer.tsx`: keep the ref guards and draft-until-confirmed behaviour.
- The image components: keep `cachePolicy={imageCachePolicy(...)}`.
- Navigation and RTL files, and the iOS 27 scene lifecycle: keep Codex's versions.

**3. Isolated Supabase.** Start the local stack, apply the three migrations in order and run every SQL suite plus `supabase/tests/concurrency/resilience_race.sh` (set `DB` / connection for the local stack).

**4. Automated checks.** Run `npm ci`, `npx tsc --noEmit`, `npx eslint .`, `npx jest`, and the Deno tests in `supabase/functions/*`.

**5. Native iOS 27 Simulator.** Synthetic accounts only. For each case, check the rows (`posts`, `post_comments`, `media_attachments`) and the Storage objects directly:

| Case | Expected |
|---|---|
| Post committed with lost response (turn the network off right after tapping Publish, e.g. Network Link Conditioner "100% loss" after the request leaves, then retry) | exactly 1 post; retry shows it |
| Comment committed with lost response | exactly 1 comment, 1 notification |
| Rapid repeated taps (Publish confirm; comment send) | 1 row each |
| Kill the app during a publish, relaunch, publish the same content | 1 post (same operation id from storage) |
| Switch account during a request | no cross-account reuse; each account's own result |
| Interrupt a multi-photo upload (network off mid-batch), retry | only remaining photos uploaded; 1 post with all photos |
| Run cleanup (`supabase functions serve cleanup-post-photos`, then POST with the local service key) while publishing | published photos untouched; abandoned ones removed; no post references a missing file |
| Arabic/English: navigation, back gestures, comment rendering, the "posting paused" error against a server without the migration | correct direction and translations |

**6. Report.** Record PASS/FAIL per case in the merged release checklist, with screenshots and logs under `docs/social-validation/`.

## Release blockers (updated 2026-11-15)
1. ~~The Mac integration and native iOS Simulator results~~ Done 2026-11-15: all PASS
   (`HARATNA-PRERELEASE-PASSFAIL.md` §6).
2. ~~Supabase Security's guidance~~ Received (SU-545749). Customer-owned recovery is
   verified; the full plan is not complete. See `HARATNA-RECOVERY-GATE.md`.
3. Hosted staging matrix: `HARATNA-HOSTED-STAGING-PLAN.md`. Needs owner approval to provision.
4. Owner approval for migrations 20261109120000, 20261109130000 and 20261110090000.
   Production gate closed.
5. Owner decision on deploying and scheduling `cleanup-post-photos`. Without it, abandoned
   uploads stay private and owner-only, but they accumulate.
6. A durable, encrypted backup: the procedure is ready (`HARATNA-ENCRYPTED-BACKUP.md`).
   Blocked on owner-only setup on the Mac (age key, Keychain tokens, `HaratnaBackup`
   volume, offsite destination); see PASS/FAIL §7.
7. Approval to remove `haratna_backup` (`HARATNA-BACKUP-ROLE-REMOVAL.md`).
8. Then a signed build above 13 for internal testing (Expo); build 13 stays the fallback.
