#!/bin/bash
# Haratna encrypted backup, run on the owner's Mac. Read-only against production.
#
#   scripts/backup/mac/haratna-backup.sh
#
# Produces ONE age-encrypted archive (database + Storage bytes + hosted config), writes it
# to the encrypted APFS volume, copies it to the offsite destination, and checks that both
# copies are byte-identical. Plaintext exists only inside the encrypted volume while the
# script runs, and is removed at the end. Then run haratna-restore-check.sh on the archive.
#
# Settings (environment, all have defaults except HARATNA_OFFSITE):
#   HARATNA_VAULT          encrypted APFS volume (default /Volumes/HaratnaBackup)
#   HARATNA_OFFSITE        second owner-controlled destination (a mounted encrypted external
#                          drive kept off-site, or a cloud-synced folder; the archive is
#                          age-encrypted, so the provider only ever sees ciphertext)
#   HARATNA_AGE_RECIPIENTS file of age PUBLIC keys (default ~/.config/haratna/age-recipients.txt)
# Keychain items (created once by the owner; values are never printed):
#   service haratna-supabase-mgmt  account backup   Management API personal access token
#   service haratna-supabase-svc   account backup   service-role/secret key, Storage GET only
set -euo pipefail
umask 077

HERE="$(cd "$(dirname "$0")/.." && pwd)"
VAULT="${HARATNA_VAULT:-/Volumes/HaratnaBackup}"
OFFSITE="${HARATNA_OFFSITE:?set HARATNA_OFFSITE to the second destination}"
RECIPIENTS="${HARATNA_AGE_RECIPIENTS:-$HOME/.config/haratna/age-recipients.txt}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="$VAULT/work/$STAMP"
NAME="haratna-$STAMP.tar.age"

die() { echo "STOP: $*" >&2; exit 1; }
cleanup() { [ -d "$WORK" ] && rm -rf "$WORK"; unset SUPABASE_ACCESS_TOKEN SUPABASE_SERVICE_KEY; }
trap cleanup EXIT

# --- preflight: never write plaintext anywhere that is not encrypted -------------------
fdesetup status | grep -q "FileVault is On" || die "FileVault is off on this Mac"
[ -d "$VAULT" ] || die "encrypted volume $VAULT is not mounted"
diskutil info "$VAULT" | grep -Eq "FileVault: +Yes" || die "$VAULT is not an encrypted APFS volume"
[ -d "$OFFSITE" ] || die "offsite destination $OFFSITE is not available"
command -v age >/dev/null || die "age is not installed (brew install age)"
command -v python3 >/dev/null || die "python3 is not installed"
[ -s "$RECIPIENTS" ] || die "no age recipients file at $RECIPIENTS"
grep -Evq '^(age1[0-9a-z]+|#.*|)$' "$RECIPIENTS" && die "recipients file must contain only age public keys"

mkdir -p "$WORK" "$VAULT/archives"
SUPABASE_ACCESS_TOKEN="$(security find-generic-password -s haratna-supabase-mgmt -a backup -w)" \
  || die "Keychain item haratna-supabase-mgmt is missing"
SUPABASE_SERVICE_KEY="$(security find-generic-password -s haratna-supabase-svc -a backup -w)" \
  || die "Keychain item haratna-supabase-svc is missing"
export SUPABASE_ACCESS_TOKEN SUPABASE_SERVICE_KEY

# --- export (all read-only) ------------------------------------------------------------
python3 -I "$HERE/logical_backup.py" export "$WORK/db"
python3 -I "$HERE/storage_backup.py" export "$WORK/storage"
python3 -I "$HERE/config_backup.py" export "$WORK/config"
unset SUPABASE_ACCESS_TOKEN SUPABASE_SERVICE_KEY

# quick self-check before encrypting
python3 -I "$HERE/storage_backup.py" verify "$WORK/storage"
python3 -I "$HERE/config_backup.py" verify "$WORK/config"

# --- encrypt (streamed: no plaintext tarball on disk) ------------------------------------
tar -C "$WORK" -cf - db storage config | age -R "$RECIPIENTS" -o "$VAULT/archives/$NAME"
( cd "$VAULT/archives" && shasum -a 256 "$NAME" > "$NAME.sha256" )

# --- second copy ----------------------------------------------------------------------
cp "$VAULT/archives/$NAME" "$VAULT/archives/$NAME.sha256" "$OFFSITE/"
( cd "$OFFSITE" && shasum -a 256 -c "$NAME.sha256" ) || die "offsite copy does not match"

echo "ENCRYPTED BACKUP WRITTEN: $NAME"
echo "  primary: $VAULT/archives   offsite: $OFFSITE"
echo "Next: scripts/backup/mac/haratna-restore-check.sh \"$VAULT/archives/$NAME\""
