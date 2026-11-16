# Source before running the demo tools. Staging only; no secrets in this file.
W=~/Downloads/haratna-rc-worktrees/staging-work
set -a; . "$W/staging-keys.env"; set +a
export STAGING_GEOGRAPHY=public STAGING_SQL_CMD="$W/stg.sh" STAGING_SQL_GUARD="$W/sql/guard.sql" \
  STAGING_STATE=~/.haratna-staging-demo STAGING_ALLOWED_ACCOUNTS=~/.haratna-staging/allowed-accounts.json
[ "$STAGING_REF" = qcinkzciwjmiavptlfxy ] || { echo "REFUSED: not staging"; return 9 2>/dev/null || exit 9; }
