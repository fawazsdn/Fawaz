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

## Integration with Codex's Mac work: NOT DONE
- **Codex's work is unreachable from the cloud session.** That covers the four PR #5 patches, the iOS 27 scene-lifecycle fix, `docs/HARATNA-SOCIAL-RESILIENCE-HANDOFF.md`, `docs/HARATNA-SOCIAL-RELEASE-CHECKLIST.md` and `docs/social-validation/`. They are on no GitHub branch, the Mac isn't connected, and the session has no macOS or Simulator.
- **Consequence:** conflicts with Codex's work could not be found or resolved, and native tests could not run. Everything below marked Mac must be done on the Mac.

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

## Release blockers
1. The Mac integration (steps 1–2) and native results (step 5).
2. Supabase Security's hosted migration and recovery guidance (pending).
3. Owner approval for migrations 20261109120000, 20261109130000 and 20261110090000. Production gate closed.
4. Owner decision on deploying and scheduling `cleanup-post-photos`. Without it, abandoned uploads remain private and owner-only, but they accumulate.
5. A durable home for the verified encrypted backup (snapshot 2026-11-09 17:03:21 UTC), currently only in the cloud session.
6. Then a signed build above 13 to Team (Expo); build 13 stays the fallback.
