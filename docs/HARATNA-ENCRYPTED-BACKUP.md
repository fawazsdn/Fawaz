# Haratna encrypted, durable backup: owner procedure (Mac + offsite)

Tooling: branch `claude/haratna-backup-tooling`, folder `scripts/backup/`. The tooling is
not part of the app or the release candidate.
Every production call is **read-only**: database queries run with `read_only: true`,
Storage objects are only fetched (GET), and config is only read (GET).
Status: tested end-to-end in the cloud session against a fake API and the real
2026-11-15 export (results in section 6). It has **not yet run on the Mac**.

## 1. What one archive contains

| Part | Source | Sensitive |
|---|---|---|
| `db/` | `logical_backup.py`: 102 tables of `public`, `private`, `auth`, `storage` metadata and `supabase_migrations`, schema DDL, and checksums | yes: personal data, password hashes |
| `storage/` | `storage_backup.py`: **every object's bytes** (today 5 objects, about 2 MB, in `avatars` and `community-media`), bucket settings, and a sha256 for each file | yes: private photos |
| `config/` | `config_backup.py`: Auth, Postgres, pooler, PostgREST, Storage, Realtime, network restrictions, SSL, the Edge Function list and deployed bundles, Edge Function secrets (as the API returns them), role inventory (no passwords) and the Vault secret count | yes: provider and SMTP secrets |

Vault currently holds **0 secrets**, so there is nothing to export. If Vault is ever used,
keep its values in the owner's password manager. The backup records only the count.

**Not in the archive.** Re-issue these from the dashboard if they are ever needed:
the project's API keys and JWT secret, the database password, and Supabase-managed roles
(out of scope per SU-545749).

## 2. One-time Mac setup (owner)

1. **FileVault on**: System Settings → Privacy & Security → FileVault.
2. **Encrypted APFS volume** `HaratnaBackup`: Disk Utility → + Volume → *APFS (Encrypted)*,
   with a strong passphrase kept in the password manager. It mounts at `/Volumes/HaratnaBackup`.
3. **Tools**: `brew install age python postgresql@17`, plus Docker Desktop for the restore
   check. Postgres.app with PostGIS also works (set `HARATNA_PG`).
4. **age key pair** (the private key never leaves the owner's control):
   ```
   mkdir -p ~/.config/haratna && chmod 700 ~/.config/haratna
   age-keygen | age -p -o ~/.config/haratna/age-identity.age     # asks for a passphrase
   age -d ~/.config/haratna/age-identity.age | age-keygen -y > ~/.config/haratna/age-recipients.txt
   ```
   Keep a second copy of `age-identity.age` and its passphrase **offline**: a printed
   paper key or a USB drive in a safe. Losing both makes every archive unreadable.
5. **Keychain items.** Type the values into the Keychain prompts. Never paste them in chat:
   ```
   security add-generic-password -s haratna-supabase-mgmt -a backup -w   # Management API personal access token
   security add-generic-password -s haratna-supabase-svc  -a backup -w   # service-role / secret key (Storage GET only)
   ```
   These stay on the Mac. The scripts read them only into the running process and never
   print them.
6. **Offsite destination**, one owner-controlled place. Any of these is fine, because the
   archive is already end-to-end encrypted:
   - an encrypted external SSD kept somewhere other than home (mounted, for example, at
     `/Volumes/HaratnaOffsite`), or
   - a cloud-synced folder the owner controls (iCloud Drive with Advanced Data Protection,
     or a private bucket). The provider only ever sees ciphertext.

## 3. Take a backup

```
cd <repo checkout of claude/haratna-backup-tooling>
HARATNA_OFFSITE=/Volumes/HaratnaOffsite scripts/backup/mac/haratna-backup.sh
```

The script stops (`STOP: …`) unless all of these are true: FileVault is on, the volume
is an encrypted APFS volume, the offsite destination is mounted, age is installed, and
the recipients file holds only public keys.

Plaintext exists only in `/Volumes/HaratnaBackup/work/<stamp>` while the script runs. It is
streamed through `tar | age` (no plaintext tarball) and removed on exit, even on failure.
The offsite copy is checked by sha256.

## 4. Prove it restores (required after every backup)

```
scripts/backup/mac/haratna-restore-check.sh /Volumes/HaratnaBackup/archives/haratna-<stamp>.tar.age /Volumes/HaratnaOffsite
```

The script runs these checks:
1. The sha256 of both copies, and that the two copies are byte-identical.
2. Decryption with the passphrase-protected identity.
3. Storage bytes and config against their manifests.
4. The database restored into a throwaway **local** PostGIS container on 127.0.0.1:55432.
   The tool refuses any non-local host, so it can never write to a hosted project.
5. Every table checksum against the production snapshot.

Plaintext and the container are removed at the end. It must print `RESTORE CHECK PASSED`.

Keep at least the last **7 daily** and **4 weekly** archives in both places. Take one
within 24 hours before any production migration.

## 5. Recovering Storage bytes, secrets and config (if ever needed)

- **Storage objects.** Re-upload from `storage/objects/<bucket>/<path>` to the **same path**
  with the Storage API or `supabase storage cp`, using `upsert=false` so nothing is
  overwritten. Do this only with the owner's approval, and into staging first. Compare
  the result with `storage/manifest.json`.
- **Edge Function secrets.** Re-enter the values from the password manager with
  `supabase secrets set` (or the dashboard). Use `config/function-secrets.json` to check
  the names.
- **Auth, API, Storage and Realtime settings.** Reapply them from the `config/*.json` files
  in the dashboard, or with the Management API `PATCH` endpoints, one setting at a time and
  reviewed. Never replay the files wholesale.
- **Edge Functions.** Deploy from the repository source. The `config/functions/*.body`
  files are a reference showing exactly what was live.
- **Roles.** Never recreate Supabase-managed roles. Recreate custom roles only from a
  reviewed script.

## 6. Test results (cloud session, 2026-11-15)

- Mac scripts end-to-end, with macOS commands stubbed and a fake API for Storage and config.
  Database part from the real 2026-11-15 export:
  - Backup written to both destinations. The archive header is `age-encryption.org/v1`.
  - 0 plaintext files left behind.
  - Restore check: `STORAGE VERIFY OK`, `CONFIG VERIFY OK`, `VERIFY OK: 102 tables, 8681 rows`,
    `RESTORE CHECK PASSED`. 0 plaintext files left behind.
  - Wrong age identity: `RESTORE CHECK FAILED: decrypt`.
  - Tampered offsite copy: `RESTORE CHECK FAILED: offsite checksum`.
  - A Storage key mismatch stopped the backup before encryption, and plaintext was cleaned up.
- A corrupted Storage file is detected by `storage_backup.py verify`.
- The portable `logical_backup.py verify` over TCP (`HARATNA_PG`) gave `VERIFY OK`. A
  non-local host is refused.
- **Not yet tested:** the real FileVault, Keychain and Docker on the Mac, and real Storage
  downloads with the service key.

## 7. The temporary cloud export

The 2026-11-15 export in this cloud session's scratchpad is **unencrypted**. It has been
locked to owner-only file permissions (0700/0600). It has never been printed, committed or
uploaded. It is **not** copied to the Mac: the Mac takes its own fresh export (section 3).

It will be deleted only after **both** of these are true:
1. `haratna-restore-check.sh` prints `RESTORE CHECK PASSED` for a Mac archive, with both copies.
2. The owner confirms it.

It will also disappear on its own if this cloud container is reset. That does not make
the data any less safe, but it does mean it can't be relied on as a backup.
