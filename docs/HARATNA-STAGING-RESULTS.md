# Haratna hosted staging: results (2026-11-15)

Project `qcinkzciwjmiavptlfxy` ("haratna-staging"), organization "حارتنا"
(`vpnxfxukaqeirgkxwxvp`, Free), region `ap-southeast-1`, Postgres 17.11. Production
(`ckqwziutmqohihrenstz`, Postgres 17.6) was **not contacted** to build or test staging (see the
incident in `HARATNA-RECOVERY-GATE.md` §2.1 for the earlier CLI role change, before this work).

Evidence: `docs/social-validation/staging/`.

## 1. How staging was built

| Step | Result |
|---|---|
| Identity check before the first write | `qcinkzciwjmiavptlfxy`, empty (0 tables, 0 users, 0 buckets). Every write after that went through a wrapper that refuses any linked project but staging, and every SQL file starts with a guard that refuses a database not marked `haratna-staging` (set once, only on the verified-empty project) |
| Structure source | The verified 2026-11-09 local backup (`production.dump`, sha256 `1d059d69…`, matches `SHA256SUMS`). Structure only: 974 of 1,459 entries; **0 data entries** (all 102 table-data entries excluded); Supabase-managed `auth`/`storage` internals skipped; 65 grants to production's custom `haratna_backup` role removed (the role was not recreated) |
| Migration head | `20261108142118`, 31 versions; recorded on staging as versions and names only |
| Load | One transaction (`postgis` in `extensions` + the structure). First attempt rolled back cleanly (Supabase-managed default privileges can't be changed by `postgres`; those lines dropped). Result: 64 tables, 129 app functions (= production), 152 policies, 57 triggers |
| Grants | Staging's newer default privileges added `TRIGGER`/`TRUNCATE` on the 64 baseline tables at load time, which production's tables don't have. Repaired: revoke on baseline tables, re-apply production's exact 176 table grants, replay the migrations' 49 GRANT/REVOKE statements. Verified equal to production on the locked tables |
| Geography | Public reference data from the repository (National Address via the homaily dataset): 13 regions, 4,581 cities, 3,732 neighborhoods; 3,706 with real boundaries, 26 invalid rings cleared. `resolve_neighborhood_at` returns the right neighborhood at test points in two regions (incl. Riyadh) |
| Storage and moderation | Buckets exactly as in the backup (`avatars` public 5 MB, `community-media` private 10 MB; JPEG/PNG/WebP/HEIC); repository moderation seed (18 terms). No production files |
| Auth | Email and password, confirmations off (auto-confirm), site URL `haratna-staging://`, no SMTP, no Apple or Google. See §5 for an over-broad config push |
| Migrations (hosted `postgres`) | `20261109120000`, `20261109130000`, `20261110090000`, `20261115100000` applied in order, each in its own transaction with an order check. `supabase db push` deliberately **not** used (it would also apply the unapproved `20261014110000`). Storage policy DDL succeeds under hosted permissions |
| Edge Functions (staging only) | `delete-account-v2` (from `supabase/functions/delete-account`) and `cleanup-post-photos`. Not scheduled |
| Accounts | 7 synthetic `@example.test` accounts (kit), real neighborhoods (Ajyal ×2, Al Amal Riyadh); drill accounts removed afterwards |

## 2. Drift review: production backup vs repository

- The 12 repository migrations at or below the head are all in production's history, except
  `20261014110000_pending_owner_approval`, which says "NOT YET APPLIED, needs the owner's
  approval" (destructive). Production confirms it never ran (`profile_interests` still exists);
  its account-deletion part was superseded by `20261108105341`. **Hazard:** `supabase db push`
  would apply it. Apply future migrations explicitly, or resolve this file first.
- 92 functions defined in those migrations: **79 identical**, 12 differ only by SQL comments
  stripped on apply, 1 (`send_neighbor_request`) only by redundant parentheses. No logic drift.
- 19 production migrations (the original August/September foundation) are not in the
  repository; production is the source of truth for them.

## 3. Hosted test results

| Area | Result | Evidence |
|---|---|---|
| SQL security suites (13), after the migrations | **13/13 PASS** incl. `business_directory` and `neighborhood_locking`, which never passed on the local replica | `sql-suites-initial.txt` |
| JWT role switching (9) | **PASS**: anon refused; forged service JWT refused; residents refused on service-only RPCs; service role allowed | `staging-main.md` |
| RLS over PostgREST (11) | **PASS**: audiences (public Saudi-wide, followers, neighborhood), private accounts, pending requests, blocks | `staging-main.md` |
| Storage (11) | **PASS**: own-folder uploads, unverified refused, wrong type refused, private profile photo rules, signed URLs | `staging-main.md` |
| Exactly-once (5) | **PASS**: same op id → existing; changed content → conflict; one row per op | `staging-main.md` |
| Account deletion (7) | **PASS**: `delete-account-v2` removes Auth user, profile, follows, community and profile photos; repeat call refused | `staging-main.md` |
| Cleanup job | **FAIL → FIXED → PASS.** The deployed function refused the real service role (HTTP 403): it compared the `Authorization` header to the injected key as an exact string, and on hosted they differ. Fixed to accept the gateway-verified `service_role` claim (or the exact key). Retest: dry run counts 1; resident token refused; run claims and deletes 1; record removed; file gone after the CDN window; published photo untouched; second run no-op | `staging-cleanup-first-run.md`, `cleanup-retest.txt` |
| Post deletion and its photos | **FAIL (design gap):** deleting a post is a soft delete and its photos stay in Storage indefinitely; no retention cleanup covers them. Nobody else can sign them after deletion; a link already issued works until it expires (post photos: 15 min) | `staging-main.md` |
| Migration rollback and re-apply (synthetic data) | **PASS.** The 20261115100000 rollback restores the old rule (its suite fails again, as expected); 130000 rollback **stops** on a private-only photo and continues once it has a public link; while rolled back all audiences are `neighborhood`, social data saved, no files removed, baseline suites pass; re-apply + restore: **before = after, identical** | `rollback-drill.log` |
| After the round trip | **13/13 suites PASS**; grants still equal production; hosted matrix **45 PASS, 2 FAIL** (the post-deletion gap) | `sql-suites-after-roundtrip.txt`, `staging-main.md` |
| Advisors | No ERROR. WARN: 80 definer functions callable by signed-in users (the app's RPCs, by design); 1 callable by anon (`submit_public_support_request`, intentional, pre-existing); leaked-password protection off; few MFA options. INFO: 35 unused indexes, 18 unindexed foreign keys | `advisors-summary.txt` |

## 4. Findings for production

1. **Cleanup function authorization bug** (fixed in this round; deploy only after approval).
2. **Cleanup counted unconfirmed deletions as deleted** (defensive fix: only objects Storage
   reports as deleted drop their records; others are retried). Not reproduced on staging, where
   deletes succeeded; covered by a unit test.
3. **Rollback prerequisite can't run in production:** `scripts/migrate-avatars-to-private.mjs
   --restore-public` reads and updates `profiles` with the service key, but production's
   `service_role` has no table privileges (`permission denied for table profiles`, reproduced on
   staging). A 130000 rollback would stop unless that step is redone in SQL or the owner accepts
   `haratna.allow_photo_fallback=on` (initials instead of photos).
4. **Deleted posts keep their photos** indefinitely (owner decision: retention rule).
5. **`supabase db push` hazard** (`20261014110000`, §2).
6. Production's `service_role` has no table privileges; anything server-side must use granted
   definer functions (the hosted kit was adapted to this).
7. Pre-existing: `authenticated` holds `TRUNCATE`/`TRIGGER` on many production tables (not
   reachable through PostgREST); leaked-password protection is off.

## 5. Deviations during setup (staging only)

- A `supabase config push` intended as a preview was applied (the CLI auto-confirms for
  automated callers). It also set email OTP length 6 / frequency 1s, an SMS template, and
  Storage "vector" on. OTP settings were restored deliberately; afterwards every section reported
  "up to date". All further CLI calls used `--agent no`.
- The staging kit (`supabase/staging/staging_kit.py`) was adapted: guard for public geography
  (refuses any project with non-`@example.test` accounts), real neighborhood ids, SQL oracle and
  setup through the guarded staging wrapper, uploads recorded like the app, CDN wait.
- `supabase/tests/social_follows.sql`: the "photo listing leaks" check now counts only the
  suite's own accounts' files (it failed whenever any legitimate public photo existed).

## 6. Not done

- The kit's cleanup phase was not re-run end to end after the fix (it needs another 65-minute
  window); the same steps were run directly (`cleanup-retest.txt`).
- Hosted JWT gateway behavior for the app build, and device tests, follow with the TestFlight
  staging build.
