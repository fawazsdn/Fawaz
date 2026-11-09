# Rollback drill (local replica only)

Proves that rolling back 20261109130000 and 20261109120000 loses no social data
and that re-applying + `supabase/rollbacks/restore_20261109_social_data.sql`
returns it exactly. Never run against production.

1. Load a schema-only replica of production and apply both migrations (each as one transaction, `psql -1`).
2. `psql -1 -f seed.sql`, then `psql -At -f check.sql > before.txt`.
3. Run the 130000 rollback: it must stop ("rollback stopped: … private photo").
4. Give private-only photos a public link (what `scripts/migrate-avatars-to-private.mjs --restore-public --apply` does), run both rollbacks, then `check_rolled_back.sql`: everything saved in `private.rollback_20261109_*`, audiences `neighborhood`, files kept, archived link back.
5. Re-apply both migrations, run the restore script, `check.sql > after.txt`; `diff before.txt after.txt` must be empty.
