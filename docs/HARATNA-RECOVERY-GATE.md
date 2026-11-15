# Haratna recovery gate: scope, evidence and limits (2026-11-15)

Status: **customer-owned database recovery VERIFIED. The full recovery plan is NOT complete.**
The open items are in section 6. The gate for production migrations is still closed.
It opens only with the owner's written approval (section 7).

Project: `ckqwziutmqohihrenstz` (Pro plan, daily physical backups, PITR off).
Production migration head: `20261108142118`, unchanged. No production change was made for this work.

## 1. Supabase Security response (ticket SU-545749)

The owner received this answer from Supabase Security on ticket **SU-545749**:

- Supabase maintains its managed roles (`postgres`, `supabase_admin`, `authenticator`,
  `anon`, `authenticated`, `service_role`, `supabase_*_admin`, `pgbouncer`, `pgsodium_*`,
  `dashboard_user` and others). Their attributes, memberships and grants can change
  without notice.
- Supabase does not support an exact offline copy of those roles. Do not recreate them by hand.
- Acceptance criteria should cover **customer-owned** schemas, data, functions, policies
  and custom roles.
- `supabase db dump --role-only` can help identify custom roles.
- Test JWT role switching, Auth and Storage account deletion, and migration permissions
  in a **separate hosted project or a preview branch**.
- A Managed Restore to a New Project cannot be isolated before it starts up. Its
  services, webhooks and scheduled jobs start as soon as it is live.

### What this changes

| Item | Before | Now |
|---|---|---|
| Exact role, owner and attribute parity with production, including managed roles | Required (blocked) | **Out of scope** for offline recovery. Not a failure. |
| Customer-owned objects (schemas `public` and `private`, Haratna policies on `storage.objects`, custom roles) | Required | Required: **verified**, section 3 |
| Restored data | Required | Required: **verified**, section 3 |
| JWT switching, account deletion, Storage permissions, migration permissions | Simulated locally | Must be tested in a **hosted** staging environment: see `HARATNA-HOSTED-STAGING-PLAN.md` |
| Managed Restore to a New Project as a rehearsal | Considered | **Not used** until an isolation plan is approved separately |

`docs/HARATNA-MANAGED-ROLE-RECOVERY.md` is on Codex's Mac and has not been pushed. When it
is merged, its managed-role parity criteria should point to this section and be marked
out of scope. That document was not edited here.

## 2. Role inventory (production, read-only, 2026-11-15)

Production has 31 roles. 30 of them are Supabase platform roles (out of scope, not modified).

**One custom role exists: `haratna_backup`.**

| Attribute | Value |
|---|---|
| Login | no (`NOLOGIN`) |
| `BYPASSRLS` | **yes** |
| Connection limit | 3 |
| Valid until | 2026-11-09 22:59:41 UTC (expired, and it cannot log in anyway) |
| Member of | `postgres` |
| Grants | `SELECT` on tables in `auth`, `public`, `storage` and `supabase_migrations`, plus `USAGE` on those schemas |
| Owns objects | none |

It looks like it was left over from the backup work on 2026-11-09. Right now it cannot be
used to sign in. It is still a privileged role that the app does not need, and its
membership in `postgres` means anyone who can `SET ROLE` to it inherits those rights.
**It was not changed.** The owner decides whether to keep it, or to drop it after a
backup (section 7, item 6). It is not part of the app's migrations.

## 3. Evidence: customer-owned recovery

### 3.1 Fresh logical export

Read-only export, run as `supabase_read_only_user` inside a read-only transaction:

- Snapshot: **2026-11-15 07:31:46.021654 UTC**, one consistent snapshot. Server 17.6.
  Migration head `20261108142118`.
- Coverage: **102 tables, 8,681 rows** from `public`, `private`, `auth`, `storage`
  (metadata only) and `supabase_migrations`.
- Integrity: each table's row count and an order-independent md5 of its rows, recorded at
  export time.
- File checksums (sha256), for later identification only:
  - `data.json`: `ce1c0d764fc55cbbec3282abefe1814233db97d960da561454248ead61aec9dd`
  - `schema.sql`: `0f2785ed50d97578db6f6084cbc9ba257a15d4a370dc0f249416581ccee4db57`
  - `manifest.json`: `d58e19b53e74ad1e126e169a354b1e578fabed2c1f0d3e82e30458d70dc378ab`

### 3.2 Independent restore

The export was restored into a fresh PostgreSQL 16 + PostGIS database in the cloud session.
It never touched production.

- **VERIFY OK:** all 102 tables and 8,681 rows restored, and every count and checksum
  matches the production snapshot.

### 3.3 Object fingerprint (production compared with the restored copy)

The same read-only catalog query ran on both databases. It covers only customer-owned
objects: schemas `public` and `private`, policies on `storage.objects`, and the grants
those objects give to `anon`, `authenticated` and `service_role`. Extension-owned
functions are excluded.

| Object class | Count | Result |
|---|---|---|
| Functions (full definition) | 129 | match |
| RLS policies (`public`, `private`, `storage`) | 152 | match |
| RLS enabled flags | 64 | match |
| Table grants to API roles | 176 | match |
| Function `EXECUTE` grants to API roles | 84 | match |
| Schema usage | 3 | match |
| Triggers | 56 | match |
| Indexes | 198 | match |
| Columns (type, nullability, default, generated) | 562 | match |
| Constraints | 380 | 377 identical. 3 differ only in how PG16 and PG17 print parentheses in the `approx_coords` check. Same meaning. |

PostgreSQL 17's `MAINTAIN` privilege does not exist in 16, so it was left out of the comparison.

### 3.4 Migration and rollback rehearsal on the restored copy

Script steps: apply the three pending migrations in order, run every suite, run the race
drill, roll back in reverse order, and run the suites again. A suite that prints
`ERROR: ALL_PASS` raised that error on purpose, to roll back its own test data.

| Stage | Result |
|---|---|
| Before migrations | neighbors 12, compliance 4, clubs 18, poll 2: all pass |
| After applying `20261109120000`, `20261109130000` and `20261110090000` | the four above plus social_follows 11, private_profile_photos 11, build13_compat 9, social_resilience 10: all pass. Concurrency race drill: `RACE_ALL_PASS` |
| After full rollback | the four existing suites all pass |
| Data after apply and full rollback | **101 of 102 tables byte-identical** to the snapshot. `storage.buckets` has one extra row: the `profile-photos` bucket, which the rollback keeps on purpose so no uploaded private photo is lost. |

Existing data after the migrations: 5 profiles, 1 post, 0 private accounts, every media
attachment `attached`, 0 follows. Nothing became hidden or orphaned.

The restored copy needed column defaults on `storage.objects` (`id`, `created_at`,
`updated_at`) and storage grants. Production has these because Supabase provides them; a
plain database does not. This stand-in exists only for the local test. It does not affect
the migrations.

## 4. Backup and restore runbook (logical, customer-owned scope)

Tooling: `scripts/backup/logical_backup.py` and `scripts/backup/verify_bootstrap.sql` on
branch `claude/haratna-backup-tooling`. They are not part of the release candidate.

1. **Export (read-only).** Run `logical_backup.py export` with a Management API token on
   the session's environment. It sends `read_only: true` queries, so it cannot write. Output:
   `manifest.json`, `data.json`, `schema.sql`, `platform.sql` and `restore.sql`.
2. **Encrypt and store.** Encrypt with `age` or `gpg` to the owner's key. Store in two
   places the owner controls (section 6, item 1). Never in GitHub.
3. **Verify.** On an empty PostgreSQL with PostGIS, run `verify_bootstrap.sql`, then
   `restore.sql`, then `logical_backup.py verify <dir>`. It must print `VERIFY OK`.
4. **Fingerprint.** Run the catalog fingerprint (section 3.3) on production (read-only)
   and on the restored copy. Then diff them.
5. **Rehearse.** Apply the pending migrations, run the suites and the race drill, roll back,
   and confirm the result in 3.4.
6. **Recover for real (if ever needed).** Supabase's daily physical backup is the main
   path, and it covers the parts that 1–5 do not. Use this logical export for one table
   or one row, loaded into a scratch schema and copied over on purpose. Never load it over
   live tables wholesale.

Never: recreate Supabase-managed roles, change `postgres` ownership or attributes, restore
into an active hosted project without an approved isolation plan, or copy production data
into staging.

## 5. Hosted-only tests (moved out of the offline gate)

These cannot be proven offline. They run in hosted staging with synthetic data only.
See `docs/HARATNA-HOSTED-STAGING-PLAN.md`.

JWT switching between `anon`, `authenticated` and `service_role`. RLS allow and deny over
PostgREST. Sign-up, sign-in and account deletion through `delete-account-v2`. Storage
private and public bucket rules, signed URLs and cleanup. Migrations run as the hosted
admin role. Rollback and recovery on hosted.

## 6. Remaining limits (why the full plan is NOT complete)

1. **No durable backup location.** The 2026-11-09 encrypted export was lost when the cloud
   container was reset. The 2026-11-15 export is only in the session's temporary scratchpad,
   unencrypted, and will be lost the same way. **The owner must pick an encrypted,
   owner-controlled location** (for example, an encrypted folder on the Mac plus one
   offsite copy). Until then, the logical backup is evidence, not a recovery asset.
2. **No Storage object bytes.** The export holds `storage.objects` metadata only. Avatars,
   post photos and profile photos are not copied. Recovering them depends on Supabase
   Storage durability. A per-bucket download (`supabase storage cp -r`, run by the owner)
   is needed for full coverage.
3. **No Vault secrets.** `vault.secrets` and decrypted values are left out on purpose.
   Restore them from the owner's secret manager.
4. **Project configuration is not in the export:** Auth settings (providers, redirect URLs,
   SMTP, rate limits, leaked-password protection), API settings, Edge Function secrets,
   bucket CDN settings, custom domains and network restrictions. Record these by hand or
   with the CLI config.
5. **Hosted services are not in the export:** Edge Function code as deployed (the repository
   source is the reference; production `delete-account` v1 matches the base), Realtime
   settings, cron and webhooks, and extension-owned tables (for example `pg_net`, `cron`).
6. **Platform-managed roles: out of scope**, per SU-545749.
7. **No PITR.** The physical recovery point is up to 24 hours old. Turning on PITR is a
   paid owner decision.
8. **Hosted staging tests (section 5) have not run.** They need the owner to approve a
   staging environment.

## 7. Gate checklist

| # | Criterion | Status |
|---|---|---|
| 1 | Supabase guidance received and recorded (SU-545749) | done |
| 2 | Customer-owned objects match between production and restored copy | done (3.3) |
| 3 | Restored data matches the production snapshot | done (3.2) |
| 4 | Migrations and rollbacks rehearsed on restored production data | done (3.4) |
| 5 | Platform-managed role parity | out of scope (SU-545749) |
| 6 | Custom role `haratna_backup`: decide keep or drop | **owner decision** |
| 7 | Encrypted backup in a durable, owner-controlled location, taken within 24 hours of the migration | **open** |
| 8 | Storage object bytes copied | **open** (owner) |
| 9 | Auth, API, Edge Function secrets and Vault configuration recorded | **open** (owner) |
| 10 | Hosted staging matrix passes | **open** (needs approval) |
| 11 | Owner's written approval for the three migrations | **open** |

Recovery plan status: **partially complete (items 1–5).** Do not treat it as complete
until items 6–11 are closed.
