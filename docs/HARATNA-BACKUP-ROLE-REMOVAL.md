# Removing the obsolete role `haratna_backup`: audit, procedure, risk (2026-11-15)

Recommendation: **remove it.** Status: **not modified**. Removal needs the owner's
separate written approval.

## 1. Read-only audit (production, as `supabase_read_only_user`, read-only transaction)

| Check | Result |
|---|---|
| Attributes | `NOLOGIN`, **`BYPASSRLS`**, not superuser, no CREATEROLE/CREATEDB/REPLICATION, `NOINHERIT`, connection limit 3, password set but expired 2026-11-09 22:59:41 UTC |
| Per-role setting | `default_transaction_read_only=on` |
| Member of other roles | **none** |
| Members | `postgres` only (admin option, `SET` false): the automatic link from creating the role. `postgres` cannot `SET ROLE` to it. |
| Owns objects (tables, functions, schemas, types) | **0** |
| Shared dependencies | 87, all privilege grants (`a`): 83 tables, 3 schemas, 1 database |
| Table grants | `SELECT` on 64 `public`, 16 `auth`, 2 `storage` and 1 `supabase_migrations` tables, all granted by `postgres` |
| Schema `USAGE` | `public`, `storage`, `supabase_migrations` (**not** `auth`, so its `auth` grants are unusable) |
| Database | `CONNECT` on `postgres` |
| Column, function and sequence grants | 0 |
| Default privileges | none |
| Policies naming it | 0 |
| Function bodies mentioning it | 0 |
| Active sessions | 0 |
| Foreign-data user mappings | 0 |
| Cron / `pg_net` | not installed |
| In the app's migrations or code | no |

**Conclusion.** Nothing depends on it. Removing it only revokes its own grants and
deletes the role. No data, function, policy or Supabase-managed role is affected.

## 2. Risk assessment

| | Keep the role | Remove the role |
|---|---|---|
| Security | Low but needless. It can't log in now, but anyone with `postgres` could re-enable it (`ALTER ROLE … LOGIN`, new password) and get a read-everything account that bypasses row-level security. | That attack path is gone |
| Operations | None | None found. Backups use `supabase_read_only_user` through the Management API, not this role. |
| Failure modes | none | (a) The role gains an object or session between the audit and removal: the script's checks abort and nothing changes. (b) A lock wait on a busy table: the 5-second `lock_timeout` aborts, and you retry later. (c) A permission error: the transaction rolls back, nothing changes. |
| Undo | n/a | Recreate it from the audit above (not needed for any current workflow) |

**Overall risk of removal: very low.**

## 3. Removal procedure (only after approval)

Script: `supabase/ops/drop_haratna_backup_role.sql`. It is **not** a migration, so
`db push` never runs it.

1. Take a fresh encrypted backup and pass the restore check (`HARATNA-ENCRYPTED-BACKUP.md`).
2. Re-run the read-only audit and confirm it matches section 1.
3. Run the script as `postgres` (SQL editor, or `psql` with the owner's own connection).
   It runs as one transaction:
   - Checks that the role exists, owns nothing, cannot log in, has no session, belongs to
     no role, has no member except `postgres`, and appears in no policy, default ACL or
     function body.
   - Runs `DROP OWNED BY haratna_backup` (revokes its grants only, since it owns nothing),
     then `DROP ROLE haratna_backup`.
   - Confirms the role is gone, then commits. Any failed check aborts the transaction
     with nothing changed.
4. Verify read-only: `select count(*) from pg_roles where rolname='haratna_backup'` returns
   0. Run the security advisors: no new findings. The app and build 13 behave the same.

## 4. Rehearsal (local restored copy, 2026-11-15)

- The role was recreated with the same attributes, setting and grants: 104 dependencies
  locally. The script removed it, and the role count went to 0.
- A second run stopped cleanly: `haratna_backup does not exist: nothing to do`.
- Guard test: the role was given ownership of a table. The script aborted with
  `owns 3 objects: stop`, and the role was still there afterwards.
