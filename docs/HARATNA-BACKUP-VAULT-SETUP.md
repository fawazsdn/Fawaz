# Haratna backup vault on the Mac: why the existing volume fails, and a safe setup

Companion to `HARATNA-ENCRYPTED-BACKUP.md`. Investigated on the owner's Mac on 2026-11-15.
Nothing in this document was run against the existing backup volume; it was only inspected
(metadata) and left exactly as it was.

## 1. Why `Haratna-Backup-5GB` fails the script's check

`haratna-backup.sh` and `haratna-restore-check.sh` require the vault to be an **encrypted APFS
volume**:

```sh
diskutil info "$VAULT" | grep -Eq "FileVault: +Yes"
```

The existing vault is `~/Documents/Haratna-Backup-5GB.sparsebundle`, mounted at
`/Volumes/Haratna-Backup-5GB`. It **is encrypted**: `hdiutil isencrypted` reports
`encrypted: YES`. But the encryption is at the **disk-image level** (AES-256 applied by
`hdiutil` to the image's bands), and the APFS volume inside it is a plain, unencrypted
volume. So `diskutil info` reports `Encrypted: No` and `FileVault: No`, and the check fails.
(`~/Documents/Haratna-Backup.sparsebundle` is built the same way.)

Confirmed on throwaway 50–60 MB images with random passphrases, deleted afterwards:

| Image | `diskutil` reports | Script check |
|---|---|---|
| Image-level AES-256, plain APFS inside (same as the existing vault) | `Encrypted: No`, `FileVault: No` | **FAIL** |
| Unencrypted image holding an **APFS-encrypted** volume | `FileVault: Yes` | **PASS** |

The existing volume holds `haratna-20261109T205946Z/` (a database-only export from
2026-11-09: `production.dump`, catalog and restore logs), `pg_service.conf` and the Supabase
CA certificate. It has no Storage bytes, no config inventory and no offsite copy.

## 2. Recommendation

**Keep the existing image untouched, and create a second, separate vault** that meets the
script's requirement. Don't loosen the script's check: it is the guard that keeps plaintext
off unencrypted disks while the backup runs.

| Item | Recommendation |
|---|---|
| Existing `Haratna-Backup-5GB` | Leave as is (no delete, overwrite or reformat). It remains the record of the 2026-11-09 export. Retire it only after a new archive passes `RESTORE CHECK PASSED` with both copies, and only on your decision. |
| New vault | Sparse bundle `~/Documents/HaratnaBackup.sparsebundle` holding an **APFS-encrypted** volume named `HaratnaBackup` (mounts at `/Volumes/HaratnaBackup`, the script's default). 20 GB maximum is ample (today's data is a few MB); a sparse bundle uses only what it stores. |
| Archives | Encrypted again with `age` before they leave the vault, so the offsite copy is ciphertext even if the offsite store is not encrypted. |

## 3. Steps (you type every secret; nothing is pasted into chat)

**3.1 Vault** (Terminal). The passphrase is asked for by macOS and never echoed:

```sh
hdiutil create -size 20g -type SPARSEBUNDLE -fs APFS -volname HaratnaBackup ~/Documents/HaratnaBackup.sparsebundle
hdiutil attach ~/Documents/HaratnaBackup.sparsebundle
diskutil apfs encryptVolume /Volumes/HaratnaBackup -user disk     # no -passphrase: macOS prompts for it
diskutil info /Volumes/HaratnaBackup | grep -E "FileVault|Encrypted"   # expect FileVault: Yes
```

On later use: `hdiutil attach ~/Documents/HaratnaBackup.sparsebundle`, and enter the vault
passphrase when macOS asks. Don't let Keychain remember it if others use this Mac account.

**3.2 age key pair**: as in `HARATNA-ENCRYPTED-BACKUP.md` §2.4. `age` asks for the
identity passphrase. Make an **offline** copy of `age-identity.age` and its passphrase
(paper or a USB drive in a safe). Without it, every archive is unreadable.

**3.3 Keychain items**: `security add-generic-password -s haratna-supabase-mgmt -a backup -w`
and `... -s haratna-supabase-svc ...`. `-w` without a value makes `security` prompt; type
or paste the value there, never on the command line.

**3.4 Offsite destination**: mount it, then run the backup with `HARATNA_OFFSITE=<path>`.

## 4. Decisions only you can make

1. **Vault passphrase**: a new, strong passphrase, stored in your password manager.
2. **age identity passphrase and its offline copy**: where the paper or USB copy lives.
3. **Supabase Management API token**: create a personal access token for the backup with the
   shortest practical expiry. Revoke it when not in use if you prefer.
4. **Service key used for Storage downloads**: the existing service-role key, or (preferred) a
   new secret key created for the backup so it can be revoked independently.
5. **Offsite destination**: one of
   - an encrypted external SSD kept away from home (most durable, offline); or
   - iCloud Drive (`~/Library/Mobile Documents/com~apple~CloudDocs/HaratnaBackup`). The
     archive is `age`-encrypted end to end, so iCloud only ever holds ciphertext. Advanced
     Data Protection adds a second layer but isn't required.

   Both is better than one.
6. **The 2026-11-09 export**: keep it where it is (recommended). Or, after the new vault
   exists, also encrypt it with `age` into the new vault as a historical archive.

When 1–5 are done, the backup and the restore check (`HARATNA-ENCRYPTED-BACKUP.md` §3–4) can
run. The restore check uses a throwaway local Postgres container and refuses any non-local
host.
