# Haratna hosted staging: Option A runbook

**Do not start until the owner has explicitly authorized provisioning.**
Production (`ckqwziutmqohihrenstz`) is never changed by anything here. Every tool here
refuses to run against it.

Plan and owner decisions: `docs/HARATNA-HOSTED-STAGING-PLAN.md`. Data rules: synthetic
accounts (`@example.test`) and synthetic neighborhoods only. No production rows, users,
photos or credentials.

## Files

| File | What it does |
|---|---|
| `bootstrap_config.sql` | Buckets with production's settings, the starter moderation term list (repository seed), and the 31 production migration versions marked as applied. Contains no data. |
| `seed_synthetic_geography.sql` | 1 region, 2 cities and 4 neighborhoods (`stg-n1`…`stg-n4`), each with a ~1 km square boundary, all `source = 'synthetic'`. Refuses to run if non-synthetic geography exists. |
| `staging_kit.py` | `guard`, `users`, `matrix`, `cleanup`. HTTP only, over staging's own API. Writes PASS/FAIL reports. |

## Steps (about 3 days in total, including the 1-hour cleanup wait)

0. **Confirm before creating:** the organization name (a new Free-plan organization),
   that no production member, key or integration is in it, and the region
   `ap-southeast-1`. Expected cost: $0.
1. **Create the project.** Claude through the Supabase tools, after authorization. Save
   its anon and service keys only to the Mac Keychain or the session's secure secret
   store, never in chat or Git.
2. **Extensions:** enable `postgis`, `pg_trgm`, `pgcrypto`, `uuid-ossp` and `http` in schema
   `extensions`, the same as production.
3. **Schema only.** Load `schema.sql` from a read-only export. Use that one file only: it
   holds no rows. Never load `data.json` or `restore.sql`. Do not create or alter any
   Supabase-managed role. Do not load `verify_bootstrap.sql` or `platform.sql`; they are
   local stand-ins for a plain Postgres.
4. Run `bootstrap_config.sql`, then `seed_synthetic_geography.sql`.
5. **Auth:** email and password, auto-confirm on, no SMTP, no Apple or Google providers.
6. **Migrations, as the hosted `postgres` role** (this is test 5.6):
   `supabase link --project-ref <staging>`, then `supabase db push`. It should apply
   exactly `20261109120000`, `20261109130000` and `20261110090000`. Run the security and
   performance advisors afterwards and record any new finding.
7. **SQL suites on hosted.** Run each `supabase/tests/*.sql` and the race test with the
   synthetic fixtures:
   `PGOPTIONS="-c haratna.test_nb=stg-n1 -c haratna.test_nb2=stg-n2" NB=stg-n1`.
   `business_directory.sql` needs production's real Ajyal neighborhood, so it is skipped
   in staging. It is covered on the restored copy.
8. **Edge Functions, staging only:** deploy `supabase/functions/delete-account` as slug
   **`delete-account-v2`** (the slug the app calls), and `cleanup-post-photos`. Set no
   Apple secret. Synthetic users are email-only.
9. **Users and test matrix:**
   ```
   export STAGING_REF=<ref> STAGING_ANON_KEY=... STAGING_SERVICE_KEY=...   # from the Keychain
   python3 -I supabase/staging/staging_kit.py users
   python3 -I supabase/staging/staging_kit.py matrix  --report docs/social-validation/staging-main.md
   # at least 65 minutes later:
   python3 -I supabase/staging/staging_kit.py cleanup --report docs/social-validation/staging-cleanup.md
   ```
10. **Rollback and recovery on hosted** (test 5.7):
    - Run `supabase/tests/rollback/seed.sql`, then the three rollbacks in reverse order,
      then `check_rolled_back.sql`.
    - Re-push the migrations, then run `restore_20261109_social_data.sql` and `check.sql`.
    - Take a logical export of staging and run `logical_backup.py verify` on it locally.
11. **Teardown after day 3:** commit the reports (they contain synthetic ids only), delete
    the project, and remove its keys from the Keychain and secret store.

## Rehearsed locally (2026-11-15)

- Used a structure-only copy plus `bootstrap_config.sql` and the synthetic seed, with no
  production rows.
- The synthetic boundaries pass validity checks, and `resolve_neighborhood_at` returns
  `stg-n1` and `stg-n4` for their centers. Both scripts can be re-run safely, and each
  refuses to run where non-synthetic geography exists.
- Suites before migrations, after the 3 migrations and after rollback: neighbors 12,
  compliance 4, clubs 18, poll 2, social_follows 11, private_profile_photos 11,
  build13_compat 9, social_resilience 10, `RACE_ALL_PASS`.
- `staging_kit.py guard` refuses: the production ref, a production URL, a mismatched host,
  a missing ref, and non-synthetic geography. It also blocks `users` against production.
  It accepts a synthetic-only target.
- **Not yet run:** `users`, `matrix` and `cleanup`. They need the hosted project.
