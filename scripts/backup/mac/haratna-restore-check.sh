#!/bin/bash
# Proves an encrypted Haratna archive can be decrypted and independently restored.
#
#   scripts/backup/mac/haratna-restore-check.sh <archive.tar.age> [offsite_dir]
#
# 1. Checks the archive's sha256 (and the offsite copy's, if given).
# 2. Decrypts it with the owner's age identity, inside the encrypted volume only.
# 3. Verifies Storage bytes and hosted config against their manifests.
# 4. Restores the database into a throwaway LOCAL Postgres+PostGIS (Docker on
#    127.0.0.1:55432, or HARATNA_PG for Postgres.app) and compares every table checksum.
# 5. Deletes the plaintext and stops the container.
# Prints RESTORE CHECK PASSED only if every step passes. Nothing touches production.
#
#   HARATNA_AGE_IDENTITY  age identity file (default ~/.config/haratna/age-identity.age,
#                         passphrase-protected: age asks for the passphrase)
#   HARATNA_PG            optional local libpq URL instead of Docker
set -euo pipefail
umask 077

HERE="$(cd "$(dirname "$0")/.." && pwd)"
ARCHIVE="${1:?archive path}"
OFFSITE="${2:-}"
VAULT="${HARATNA_VAULT:-/Volumes/HaratnaBackup}"
IDENTITY="${HARATNA_AGE_IDENTITY:-$HOME/.config/haratna/age-identity.age}"
WORK="$VAULT/restore-check/$(date -u +%Y%m%dT%H%M%SZ)"
CONTAINER=""

die() { echo "RESTORE CHECK FAILED: $*" >&2; exit 1; }
cleanup() {
  [ -d "$WORK" ] && rm -rf "$WORK"
  [ -n "$CONTAINER" ] && docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

diskutil info "$VAULT" | grep -Eq "FileVault: +Yes" || die "$VAULT is not an encrypted APFS volume"
NAME="$(basename "$ARCHIVE")"
( cd "$(dirname "$ARCHIVE")" && shasum -a 256 -c "$NAME.sha256" ) || die "primary checksum"
if [ -n "$OFFSITE" ]; then
  ( cd "$OFFSITE" && shasum -a 256 -c "$NAME.sha256" ) || die "offsite checksum"
  cmp -s "$ARCHIVE" "$OFFSITE/$NAME" || die "offsite copy differs"
fi

mkdir -p "$WORK"
age -d -i "$IDENTITY" "$ARCHIVE" | tar -C "$WORK" -xf - || die "decrypt"

python3 -I "$HERE/storage_backup.py" verify "$WORK/storage" || die "storage bytes"
python3 -I "$HERE/config_backup.py" verify "$WORK/config" || die "hosted config"

if [ -z "${HARATNA_PG:-}" ]; then
  command -v docker >/dev/null || die "neither HARATNA_PG nor Docker is available"
  PGPW="$(openssl rand -hex 16)"
  CONTAINER="haratna-restore-check-$$"
  docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD="$PGPW" -p 127.0.0.1:55432:5432 \
    postgis/postgis:17-3.5 >/dev/null
  for _ in $(seq 60); do docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
  sleep 2
  export PGPASSWORD="$PGPW" HARATNA_PG="postgresql://postgres@127.0.0.1:55432"
fi
python3 -I "$HERE/logical_backup.py" verify "$WORK/db" || die "database restore"

echo "RESTORE CHECK PASSED: $NAME decrypts, Storage and config match, database restores with every checksum matching"
