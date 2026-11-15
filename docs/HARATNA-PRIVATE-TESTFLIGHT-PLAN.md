# Haratna: private internal TestFlight test of the social features (2026-11-15)

Goal: the owner installs the new social features on their own iPhone through **internal**
TestFlight, safely and soon, while production and build 13 stay exactly as they are.

Status: **prepared, not built or uploaded.** Every step below that creates, uploads or
deploys anything waits for the owner's approval.

## 1. Candidate

| Item | Value |
|---|---|
| Source | `claude/haratna-rc-integration` at `bf98ade` (pushed) + local commits on top (staging app variant and production-fallback guard; **not pushed**) |
| Production app | `sa.haratna.app`, version 1.0.0, build 13 (unchanged, stays in TestFlight as the fallback) |
| Test app | **Haratna Staging**, `sa.haratna.app.staging`, version 1.0.0, **build 14**, EAS profile `staging-testflight` |
| Signing | EAS-managed iOS credentials (account `fawazsdn`, project `2475da56-…`); the new bundle ID gets its own provisioning profile from EAS at build time |
| EAS build history | Builds 6–13 for `sa.haratna.app` (13 = `google-testflight`, commit `3ce82a11`). No build above 13 exists in EAS. App Store Connect may hold builds uploaded outside EAS (owner to confirm) |

## 2. Why a separate staging app and staging backend

- **The new app can't run against today's production backend.** By design it refuses to
  post or comment without `publish_post` / `add_post_comment` (migration `20261110090000`):
  every post and comment would show "posting is paused", and the social features would be
  switched off. Production has none of the four migrations, and they aren't approved.
- **A build for the production app record (`sa.haratna.app`) built against a staging backend
  would be risky**: it would replace build 13 on the phone while installed, sit in the same
  App Store Connect record as the real app, and could be submitted for review by mistake.
- **Haratna Staging** is a separate app: it installs **beside** the production app (build 13
  stays on the phone and usable), has its own App Store Connect record and TestFlight group,
  always talks to the staging backend, and can never be released as the real app.
- The app falls back to the production backend when no backend is configured, so the
  staging build **refuses to configure** unless it names a backend that isn't production
  (`app.config.js`). Verified: no URL → refused; production URL → refused.
- **Incident found on the Mac, now guarded:** a local Release build of the staging variant,
  made right after a production Release build, embedded a **stale JavaScript bundle from
  Metro's cache** with no staging URL. It would have fallen back to production. It was never
  run. With the cache cleared the same build embeds the staging URL and no production URL.
  Guards added: the staging app reads its backend from the validated, embedded app config
  and **throws at startup** if that is missing or production (`src/lib/backendConfig.ts`,
  tested); and the pre-upload bundle check below is mandatory.

## 3. Hosted staging backend (Option A of HARATNA-HOSTED-STAGING-PLAN.md)

Feasibility: **yes.** Today the Supabase account has one organization holding production
(`Haratna`, `ap-southeast-1`) and five other projects. Option A needs a **new, separate
Free-plan organization**, which only the owner can create (dashboard). Expected cost $0.

Sequence (staging only; production is never touched):

1. **Owner:** create the organization "Haratna Staging" (Free plan) in the dashboard; add
   nobody else. Approve provisioning.
2. **Claude:** create project `haratna-staging` in that organization, region `ap-southeast-1`;
   confirm cost $0, no production member/key/integration attached.
3. **Schema without data:** load the production schema **including its GRANT/REVOKE
   statements**, no rows. Source (owner picks): (a) schema-only extract of the owner's local
   2026-11-09 production dump, or (b) a fresh read-only schema export. Mark the 31 production
   migration versions applied (head `20261108142118`). No `CREATE/ALTER ROLE`.
4. **Grant check before migrating:** `business_directory.sql` and `neighborhood_locking.sql`
   must pass (they fail on a schema without production's ACLs).
5. **Geography (owner picks):** real public neighborhood boundaries from the repository
   (`supabase/data/neighborhood_boundaries.json`, government place data, not user data) so
   the owner's iPhone can verify its real neighborhood by location; **or** the synthetic
   geography, with the owner's test account verified manually (`admin_verify_member`,
   audited).
6. **Configuration:** buckets as production defines them (no content); Auth email and
   password with auto-confirm, **no SMTP, no Apple, no Google** (no email is ever sent).
7. **Migrations, as the hosted `postgres` role:** `supabase db push` of
   `20261109120000`, `20261109130000`, `20261110090000`, `20261115100000` in order. Then the
   hosted test matrix (JWT role switching, RLS allow/deny, the SQL suites, storage, signed
   URLs, cleanup race) and the security/performance advisors.
8. **Edge Functions on staging only:** `delete-account-v2` (account deletion from Settings);
   `cleanup-post-photos` deployed but **not scheduled** (optional manual run).
9. **Synthetic accounts:** alice, bob (private), carol, dave, erin, mallory, deletion
   accounts, staff — so the owner has people to follow, block and comment with.
10. **EAS environment `preview`:** `EXPO_PUBLIC_SUPABASE_URL` and
    `EXPO_PUBLIC_SUPABASE_ANON_KEY` (staging's publishable key; set by the owner or through
    the EAS CLI, never pasted into chat or Git).

## 4. Build and private TestFlight (after section 3 passes)

1. **Owner:** approve pushing `2e0ab44` (or build it from the local commit).
2. **Owner:** create the App Store Connect app record **Haratna Staging** for bundle
   `sa.haratna.app.staging` (or let `eas submit` create it with the owner's Apple login).
   Add a `submit.staging-testflight.ios.ascAppId` entry once the record exists.
3. **Build:** `eas build --platform ios --profile staging-testflight` (cloud build; EAS
   creates the provisioning profile for the new bundle ID; Sign in with Apple capability is
   synced but unused).
4. **Mandatory pre-upload check:** download the `.ipa` from EAS, unzip it, and confirm that
   `main.jsbundle` contains the staging project's URL and **does not** contain
   `ckqwziutmqohihrenstz` (production), and that `Info.plist` says
   `sa.haratna.app.staging`, build 14. Stop if either check fails.
5. **Upload:** `eas submit --platform ios --profile staging-testflight`.
6. **TestFlight:** internal testing group with only the owner. No external testers, no
   App Review submission. "What to test": staging backend, synthetic data, social features.
7. **Owner on iPhone:** install Haratna Staging from TestFlight; build 13 (Haratna) stays
   installed and unchanged.

## 5. Verified on the Mac (2026-11-15)

| Check | Result |
|---|---|
| Clean checkout of `bf98ade`: TypeScript, ESLint, Jest | PASS: tsc clean; ESLint 0 errors; Jest 50/50 suites, 441/441 |
| With the staging variant and guard (local commits): Jest | PASS: 51/51 suites, 447/447 |
| Production config unchanged by `app.config.js` | PASS: resolved prebuild config identical with and without it |
| Native **Release** build, production config (`sa.haratna.app` 1.0.0 (13), unsigned, Simulator) | PASS: BUILD SUCCEEDED; iOS 27 scene delegate present; not run (it targets production) |
| Native **Release** build, staging variant (`sa.haratna.app.staging` 1.0.0 (14)) against the local synthetic stack | PASS after clearing Metro's cache (see the incident above); the app's traffic went only to the local stack |
| English accessibility item on a **Release** build | **Still present** (1 at the top of the post screen, 7 with comments scrolled), no dev banner in Release; not attributable to an element; all other screens 0. VoiceOver check on the device remains |

## 6. On-device checklist (owner)

- [ ] Sign up with email and password (no email sent; auto-confirm), complete profile.
- [ ] Verify neighborhood (real location with real geography, or pre-verified account).
- [ ] Post with text and up to ten photos; reorder; publish; open the post; comment; like.
- [ ] Follow alice; request to follow bob (private); see the request accepted (staff/SQL).
- [ ] Private account: switch yours to private; check what dave sees.
- [ ] Block mallory; have mallory's view show "unavailable" within 30 s on an open profile.
- [ ] Airplane mode during Publish → error says the outcome is unconfirmed; retry → one post.
- [ ] Arabic and English; Settings → Language; back gestures; largest text size.
- [ ] VoiceOver on: post, comments, profile, follow controls (incl. the English post-screen
      audit item recorded in the PASS/FAIL report).
- [ ] Delete the test account from Settings.
- [ ] Build 13 still opens and works.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Build points at production by accident | Separate bundle; config refuses a missing or production URL; the app refuses to start against production; mandatory pre-upload bundle check; EAS cloud builds start without a Metro cache |
| Staging build submitted for App Review | Separate app record; internal group only |
| Staging data mistaken for real data | Synthetic accounts only; app name "Haratna Staging" |
| Free project pauses after 7 days idle | Test window 3 days; delete afterwards (plan §7) |
| Schema drift versus production | Grant check (step 4) and the hosted test matrix before the build |
| Signed links stay valid ≤ 5 min after a block; open profiles re-check every 30 s | Documented limitations |
| English post-screen accessibility item | Re-check with VoiceOver on the device |

## 8. Approvals needed

1. Create the Free organization "Haratna Staging" (owner) and authorize Claude to provision
   the staging project (section 3).
2. Choose the schema source (3.3) and geography (3.5).
3. Push the local staging-variant commits.
4. Create the App Store Connect record "Haratna Staging" and approve the EAS build and
   internal TestFlight upload.

Not part of this plan: production migrations, production functions, cleanup scheduling,
removing `haratna_backup`, merging PR #5, or any change to build 13.
