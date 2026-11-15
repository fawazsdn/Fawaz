# Haratna hosted staging plan: awaiting owner approval (2026-11-15)

Status: **plan approved in outline; provisioning NOT yet authorized. Nothing has been provisioned.**
The kit is ready and rehearsed locally: `supabase/staging/README.md`. Results go into `docs/HARATNA-PRERELEASE-PASSFAIL.md`. Supabase Security (ticket SU-545749)
recommended a separate hosted project or a preview branch for these tests. This document
covers the environment, cost, isolation, data and test matrix. Provisioning waits for
the owner's approval of section 2.

## 1. Constraints

- No production user data, no production credentials or keys, and no production restore
  into a hosted project. All accounts and content are synthetic.
- Production project `ckqwziutmqohihrenstz` stays untouched: no branch on it, no
  migration, no function deploy.
- Build 13 stays the stable fallback. Any staging app build points at staging only and is
  not distributed.

## 2. Environment options

| | A. New project in a **separate Free-plan organization** (recommended) | B. Preview branch of production | C. New project in the Haratna Pro organization |
|---|---|---|---|
| Isolation | Strongest: different organization, members and keys, and no billing link to production | Same organization as production, with its own database, Auth, Storage and keys | Same organization, with its own database, Auth, Storage and keys |
| Expected cost | **$0** (Free plan; uses one of the owner's two free project slots) | Micro branch $0.01344/hour (about $0.32/day, about $10/month if left on). **Not covered by compute credits or the spend cap.** | Micro $0.01344/hour (same as B). Compute credits already cover production, so this is extra. |
| Fit for these tests | Good. Postgres 17, the same Auth, Storage and Edge Functions stack. Free limits (500 MB database, 1 GB Storage, pauses after 7 days idle) are fine for synthetic tests. | **Poor.** A branch replays migrations from the repository, which has 16 of production's 31 (none from before `20261012100000`), so it would not build the full schema. | Good, but not free |
| Teardown | Delete the project | Delete the branch | Delete the project (billing stops) |

**Recommendation: A.** It costs nothing and gives the strongest isolation. If the owner
prefers to keep everything in one organization, C costs about $1 for a 3-day test window.
Region: `ap-southeast-1`, the same as production, so latency and features match.

## 3. Building the staging schema (no production data)

1. Create the project (owner approves; created through the Supabase tools or by the owner).
2. Load the **schema-only** dump of customer schemas (`public` and `private`, with Haratna
   storage policies) taken from production with the read-only tool. It contains no rows.
   Do not run `CREATE ROLE`, `ALTER ROLE` or anything that touches managed roles.
3. Load the public geography reference data (regions, cities, neighborhoods and boundary
   geometry). It is government place data, not user data. If the owner prefers, use a
   small synthetic geography of 2 cities and 4 neighborhoods instead.
4. Mark the 31 production migration versions as applied in
   `supabase_migrations.schema_migrations`, so the staging history matches the production
   head `20261108142118`.
5. Create the `profile-photos` bucket and the other buckets exactly as production defines
   them (names, public flag, size and type limits). This is configuration, not content.
6. Set Auth to email and password with auto-confirm on, and no external email. No Apple or
   Google providers, and no SMTP, so no external email is ever sent.
7. Deploy `delete-account-v2` and `cleanup-post-photos` to **staging only**, with staging
   secrets set through the dashboard or the secure form, never in chat or Git.

## 4. Synthetic accounts

Create through the staging Auth admin API. Names and emails use a reserved domain such
as `@example.test`, so no mail can be delivered.

| Account | Purpose |
|---|---|
| `alice` (public, verified, neighborhood N1) | author |
| `bob` (private account, N1) | private-account and follow-request paths |
| `carol` (N1, follows alice) | follower |
| `dave` (N2, verified, not following) | Saudi-wide public audience |
| `erin` (unverified) | denial paths |
| `mallory` (blocked by alice) | block paths |
| `deleteme1`, `deleteme2` | account deletion |
| staff | admin and moderation paths |

## 5. Test matrix

Each case records PASS or FAIL with the request, the response code and a row check, in
`docs/social-validation/staging-<date>.md`.

### 5.1 JWT role switching
- `anon` key: only public reference reads work. Every social table and RPC is denied
  (`401`/`403`, or zero rows).
- `authenticated` (each synthetic user's JWT): `auth.uid()` scoping; `publish_post` and
  `add_post_comment` succeed for the caller only.
- `service_role` is used only server-side (Edge Functions and the test harness), never in
  the app. The `legacy_avatar_inventory` and `count_abandoned_post_photos` RPCs are
  service-only: calling them with `authenticated` must be denied.
- A forged JWT (wrong secret) and an expired JWT: rejected.

### 5.2 RLS allow and deny over PostgREST (re-runs the four social suites hosted)
- Audiences: public → every verified user in Saudi Arabia; followers-only → accepted
  followers only; neighbors → verified neighbors in the same neighborhood.
- Private account: a pending request sees no posts and no profile photo. Accepted sees both.
- Block: blocked users see nothing either way.
- Build 13 compatibility: the old client's queries still work after the migrations.

### 5.3 Auth and account deletion
- Sign up, sign in and sign out for the synthetic users.
- `delete-account-v2` for `deleteme1` (has posts, photos, follows and comments): the Auth
  user is gone, rows are purged or anonymised per `purge_account_data`, Storage objects
  in `post-photos`, `profile-photos` and its own folders are removed, and follows and
  notifications are cleaned up. Repeat the call: idempotent.
- `deleteme2` owns a club: the successor is assigned.

### 5.4 Storage permissions
- Private `profile-photos` and `post-photos`: owner and permitted viewers can create
  signed URLs. Others get `403`. A direct public URL fails.
- Public avatars (legacy): still readable by build 13. They are not deleted in this test
  plan.
- Upload limits: wrong MIME type and oversize are rejected. A path outside the user's
  folder is rejected.

### 5.5 Photo upload, signed URLs and cleanup
- Multi-photo post: upload, attach and publish. A retry with the same op id returns
  `existing` and does not duplicate anything.
- A signed URL works until it expires. After the post is deleted, the object is gone and
  the URL fails within about 60 seconds (CDN).
- Abandoned upload (staged, never attached), with a short cutoff: run
  `cleanup-post-photos` in dry run (count only), then for real. Abandoned files are
  removed and attached ones are never touched. Run it at the same time as a publish: no
  post references a missing file.

### 5.6 Migrations under hosted admin permissions
- Apply `20261109120000`, `20261109130000` and `20261110090000` with the CLI
  (`supabase db push`) or `apply_migration`, as the hosted `postgres` role, not
  `supabase_admin`. This checks that ownership, `SECURITY DEFINER` and storage policy
  statements succeed with the permissions customers actually have.
- Run the advisors (security and performance) after the migrations. No new errors.

### 5.7 Rollback and recovery
- Seed synthetic social data, then run the rollbacks in reverse order. Run
  `supabase/tests/rollback/check_rolled_back.sql`, then re-apply and run
  `restore_20261109_social_data.sql`. Synthetic data survives the round trip.
- Recovery drill: a logical export of staging, restored into a second empty schema or a
  local database, then the fingerprint diff.

## 6. Access isolation and teardown

- Staging keys live only in the staging project and in the session environment's secure
  network-secret store. They are never committed or shown in chat.
- The app's staging configuration is local only and never shipped. Build 13 and production
  stay as they are.
- Production access stays read-only. No staging tool ever holds a production write
  credential.
- When the tests are done: export the results document, then **delete the staging project**
  (or pause it on Free). Remove the staging network secret.

## 7. Owner decisions (2026-11-15)

1. **Option A**: a new project in a separate Free-plan organization. Expected cost $0.
2. **Claude creates it**, only after the owner explicitly authorizes provisioning.
   Not yet authorized.
3. **Synthetic accounts and synthetic neighborhoods only.** Step 3.3 uses the synthetic
   geography (2 cities, 4 neighborhoods). No production reference data is copied.
4. **Test window: 3 days.** After that, export the results and delete the project.
5. The production project stays completely untouched.

Before provisioning, Claude will confirm three things:
- the organization name;
- that no production organization member, key or integration is attached;
- the region, `ap-southeast-1`.
