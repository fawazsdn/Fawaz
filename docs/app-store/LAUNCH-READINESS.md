# Haratna 1.0.0: App Store launch readiness report

Date: 2026-10-14 · Branch: `claude/haratna-frontend-build-bdy51c` · Bundle
id: `sa.haratna.app` (unchanged) · Supabase project: `ckqwziutmqohihrenstz`

## Honest assessment

**Not ready to submit yet.** The code-side work is done: the Neighbors
feature, the Apple-required safety features (filter, report, block, contact),
in-app account deletion, legal documents, privacy manifest, review access and
metadata. **Four blockers remain, and only the owner can clear them:**

1. A public URL for the privacy policy and support pages.
2. A support email address.
3. Real screenshots.
4. An EAS production build tested on TestFlight.

Nothing has been run on a real iPhone. Apple approval cannot be guaranteed.

---

## 1. Neighbors features implemented

- Mutual connections: Add Neighbor → Request Sent / Cancel Request →
  Accept / Decline → Neighbors ✓ / Remove Neighbor. The states are Not
  Connected, Request Sent, Request Received, Connected and Blocked. The server
  enforces each step, so a duplicate request, self-request, forged acceptance
  or request to a blocked person is refused, and requests are rate-limited.
- Neighbors page (`/neighbors`) with Discover, My Neighbors, Requests and
  Sent tabs.
- Opt-in discovery: "Allow neighbors to find me" / «السماح للجيران بالعثور
  عليّ» is **off by default**.
- Privacy settings: allow requests, show neighbor count, show interests, show
  shared clubs, allow messages from neighbors. There are 12 interests.
- Profiles show photo, name, neighborhood, bio, interests, mutual neighbors
  and shared clubs, plus the state-aware button. Message appears only when
  allowed, and the ⋯ menu has Report and Block.
- Messaging requires an accepted connection or an activity, listing, help,
  borrow or lost & found context. Club chats are unchanged.
- Invite Neighbors / «دعوة الجيران» to activities and clubs. Invitees are
  never auto-enrolled, and duplicates are skipped.
- Entry points:
  - Home card "Meet Your Neighbors" / «تعرّف على جيرانك»
  - Explore tile
  - Settings → My Neighbors
  - Activity page → Invite Neighbors
  - Club page → invite
  - Club members → Add Neighbor
- Still 5 tabs, with the existing design system.

## 2. Privacy protections implemented

- The old implicit resident directory is closed. Profiles are readable only
  by connected neighbors, opted-in neighbors in the same neighborhood, and
  people who share a club, conversation or activity.
- Addresses, GPS, phone numbers, email, neighbor lists and private club
  memberships are never exposed (enforced by RLS and RPCs, and tested).
- Discovery is limited to the same verified neighborhood.
- Location is when-in-use only; coordinates are not stored.
- Blocking removes the connection and pending requests and stops direct
  messages.
- A server-side objectionable-content filter covers 13 content tables.

## 3. Files changed

- **Committed in the Neighbors commit (`22375db`):** Neighbors migrations
  and tests, models, store, sync, actions, the neighbors feature folder,
  `app/neighbors`, `app/settings/neighbors`, profile, event, club, home,
  explore and settings screens, and i18n.
- **This commit:**
  - `supabase/migrations/20261014120000_compliance.sql`
  - `supabase/tests/compliance.sql`
  - `src/content/legal.json`, `legal-config.json`, `legal.ts`
  - `app/settings/info/[key].tsx`, `app/settings/support.tsx`, `app/admin/support.tsx`
  - `src/features/auth/ConsentNotice.tsx` plus sign-in and sign-up
  - Report buttons in `app/marketplace/[id].tsx` and `app/event/[id].tsx`
  - `src/backend/actions.ts`, `src/hooks/useAction.ts`, `src/i18n/*`
  - `app.json`: privacy manifest, localized purpose strings, explicit
    location and image-picker plugin config, `supportsTablet: false`
  - `locales/ar.json`, `locales/en.json`
  - `scripts/build-website.mjs` and the generated `website/`
  - `docs/app-store/*`
  - `src/features/compliance/__tests__/compliance.test.tsx`

## 4. Database migrations

| Migration                                   | Status                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261014100000_neighbors.sql`              | Applied to production and recorded                                                                                                                                                                                                                                                                       |
| `20261014120000_compliance.sql`             | Applied to production and recorded                                                                                                                                                                                                                                                                       |
| `20261014110000_pending_owner_approval.sql` | **Not applied, needs owner approval.** It fixes the account-deletion club-successor logic (adult successor or archive) and drops the unused empty `profile_interests` table. It contains DELETE/DROP statements, which this environment cannot confirm. Review it and run it in the Supabase SQL editor. |

No production rows were changed. Production has 2 accounts.

## 5. Security test results (run against production, every test rolled back)

| Suite                           | Result           |
| ------------------------------- | ---------------- |
| `supabase/tests/clubs.sql`      | **18/18 passed** |
| `supabase/tests/neighbors.sql`  | **12/12 passed** |
| `supabase/tests/compliance.sql` | **4/4 passed**   |

The compliance suite checks: the filter blocks terms in Arabic and English,
residents cannot read the term list, support requests are private, and
residents cannot self-verify.

Supabase security advisors were re-run:

- **No missing RLS** and no anon-executable SECURITY DEFINER functions.
- 55 "authenticated can execute SECURITY DEFINER" warnings. These are the
  intended RPC API; each function checks authorization internally.
- **Leaked-password protection is disabled.** This is a dashboard setting
  for the owner.

## 6. Automated test results (executed)

| Check                        | Result                                                                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit`               | Pass, 0 errors                                                                                                                                       |
| `eslint .`                   | 0 errors, 4 warnings (React Compiler notes on react-hook-form `watch()`)                                                                             |
| `prettier --check`           | Pass                                                                                                                                                 |
| `jest`                       | **34 suites, 321 tests passed**                                                                                                                      |
| `expo-doctor`                | 19/21 passed. The 2 failures are network checks (exp.host and the React Native Directory cannot be reached from this sandbox), not project problems. |
| `expo export --platform ios` | Pass: 9.7 MB Hermes bundle                                                                                                                           |
| Bundle secret scan           | No service-role key, no `sb_secret_` key, no personal email. The only `sb_secret` match is supabase-js's own prefix check.                           |

## 7. Native iOS build results

- `expo prebuild --platform ios`, run in a scratch copy, **succeeded**:
  - Bundle id `sa.haratna.app`, version 1.0.0, build 3.
  - iPhone only (`TARGETED_DEVICE_FAMILY = 1`), iOS 16.4 deployment target,
    portrait.
  - No ATS exceptions and no background modes.
  - Entitlements: Sign in with Apple only.
  - `PrivacyInfo.xcprivacy` generated (tracking false, 9 data types, 4
    required-reason APIs).
  - Arabic and English `InfoPlist.strings` generated.
- **Fixed from the prebuild:** the default English Always-location and
  motion strings are replaced with accurate localized text, and the unused
  microphone string is removed.
- **Not done:** no Xcode compile and no EAS build. This sandbox has no macOS
  and no EAS login (`eas whoami` → "Not logged in", no `EXPO_TOKEN`).

## 8. App Store metadata prepared

`metadata.md` contains:

- Name `حارتنا | Haratna`
- Arabic and English subtitles
- Category: Social Networking / Lifestyle
- Keywords, promotional text, descriptions and What's New in Arabic and
  English, with lengths measured
- URL fields, copyright, export compliance and content rights

`review-notes.md` and `age-rating-and-privacy.md` complete the set.

## 9. Screenshot assets prepared

`screenshots/` holds the six concepts with Arabic and English captions, a
brand-colored frame template, and `compose.mjs` for 6.9" (1320×2868) and
6.5" (1284×2778). Output sizes were verified with a test image. **No real
screenshots were captured**, because there is no iOS device or simulator
here. Instructions are in its README.

## 10. Privacy policy status

Written in Arabic and English from the actual data flows, shown in the app
and on the website. **Draft: needs legal review** (`legal-review.md`). It
makes no claim of PDPL compliance.

Owner values are still blank in `src/content/legal-config.json`: operator,
support email, data region, email provider, backup retention and website
URL.

## 11. Support website status

`website/` is built (`npm run build:website`): 16 pages, Arabic first with
English under `/en/`. Pages: Home, About, Help, Support, Privacy, Terms,
Community Guidelines and Delete Account, plus a 404 page. It is responsive
(no horizontal scroll at 390 px), uses the brand colors, adapts to dark
mode and includes a skip link.

It shows a **DRAFT banner and `noindex`** until the config is filled in. It
is **not deployed**: there is no Haratna hosting project (the Vercel account
has only `connectup-app` and `the-dunes-club`), and the domain is unknown.

## 12. Apple compliance issues found

The full list is in `compliance-audit.md`:

1. No objectionable-content filter (1.2).
2. No published community guidelines and no terms agreement at sign-up (1.2).
3. No developer contact or support channel (1.2, 1.5).
4. Listings and activities could not be reported (1.2).
5. The privacy policy did not match real data flows (5.1.1(i)).
6. No privacy manifest.
7. Plugin-default purpose strings were inaccurate (Always location, motion,
   microphone) (5.1.1(ii)).
8. iPad support was declared without iPad layouts (2.4.1).
9. No way to give App Review access without a site visit (2.1).
10. The implicit resident directory exposed profiles (5.1.1 and safety).
11. The account-deletion club successor could be a minor (5.1.1(v) and safety).
12. The app icon does not use the brand palette (design, not a guideline).

## 13. Apple compliance issues fixed

Issues 1–10 are fixed and verified by SQL tests, Jest tests and the prebuild
output. Issue 11 is fixed in code and waits for owner approval to apply.
Issue 12 is an owner design decision.

## 14. Remaining Apple compliance blockers

- ⛔ Privacy Policy URL and Support URL (5.1.1(i), 1.5): deploy `website/`
  to a domain you own.
- ⛔ A public support email (1.5).
- ⛔ Real screenshots (2.3.3).
- ⛔ A native build, verified on TestFlight (2.1).

## 15. TestFlight build status

**No build was made or uploaded.** There is no EAS login, and your rule says
not to upload without your approval. `eas.json` production uses
`autoIncrement` with `appVersionSource: local`, so the next
`eas build -p ios --profile production` raises the build number from 3 to 4
and writes it back to `app.json`.

## 16. Public App Store submission readiness

**Not ready.** Do not submit until every "NEEDS OWNER ACTION" item below is
done and a TestFlight build has passed the QA journeys on a real iPhone.

## 17. Exact manual steps for the owner

1. **Legal and config:**
   - Fill `src/content/legal-config.json` with the operator name, support
     email, data region (Supabase → Project Settings), SMTP provider, backup
     retention and website URL.
   - Have counsel review `src/content/legal.json` (see `legal-review.md`).
2. **Website:** run `npm run build:website`, then deploy `website/` to your
   domain (any static host). Check that `/privacy/`, `/en/privacy/`,
   `/support/` and `/delete-account/` load.
3. **Supabase dashboard:**
   - Turn on leaked-password protection.
   - Configure custom SMTP.
   - Confirm the Apple and Google providers and their redirect URLs
     (`docs/RELEASE-CHECKLIST.md`).
4. **Pending migration:** review
   `supabase/migrations/20261014110000_pending_owner_approval.sql` and run it
   in the SQL editor, then record it in `supabase_migrations.schema_migrations`.
5. **Staff:** give yourself the admin role:
   `update public.profiles set app_role = 'admin' where id = '<your user id>';`
   Then check Reports, Club applications and Support requests daily.
6. **Moderation list:** review and extend `moderation_terms`, including
   Gulf-dialect terms, with `select public.admin_add_moderation_term('…');`.
7. **Build:** run `eas login`, then
   `eas build -p ios --profile production`. Install it from TestFlight.
8. **Device QA on an iPhone:**
   - Sign up (email, Apple, Google), confirm the email, reset the password.
   - Verify a neighborhood.
   - Post, comment, add a photo and vote in a poll.
   - Create and join an activity; invite neighbors.
   - Apply for a club, approve it as admin, join it and use the club chat.
   - Neighbors: request, accept, message, remove, block.
   - Report something, contact support, delete the account.
   - Switch between Arabic and English, and test dark mode.
9. **Review access:** follow `review-notes.md`. Create the review and helper
   accounts, verify them with `admin_verify_member` in an empty
   neighborhood, and add honest team content.
10. **Screenshots:** capture them with the review accounts and compose them
    (`screenshots/README.md`).
11. **App Store Connect** (existing app record, do not create a new one):
    - Paste the metadata, URLs and review notes.
    - Answer the age rating (16+ recommended) and App Privacy questions
      from `age-rating-and-privacy.md`.
    - Set copyright to your legal entity.
12. **Optional:** a brand-palette app icon.
13. **Submit for review** only after steps 1–11 are done. That decision is
    yours.

---

## Launch checklist

### READY

- [x] Neighbors system with server-enforced states, opt-in discovery and privacy settings
- [x] Implicit resident directory closed (RLS)
- [x] Objectionable-content filter, server-side
- [x] Report on every content type; block; moderation queue
- [x] In-app support requests with a staff inbox
- [x] Terms and Guidelines agreement at sign-up
- [x] In-app account deletion (real deletion)
- [x] Legal documents in the app (Arabic and English, draft)
- [x] Privacy manifest and accurate localized purpose strings
- [x] iPhone-only, portrait, no ATS exceptions, no tracking, no IAP needed
- [x] Secure, audited App Review access mechanism
- [x] App Store metadata (Arabic and English) with measured lengths
- [x] Age-rating and App Privacy answers prepared
- [x] Screenshot captions, template and compositor
- [x] Website generated (Arabic first, English, responsive)
- [x] tsc, eslint, jest (321), SQL security suites (34 checks), iOS export, iOS prebuild

### NEEDS OWNER ACTION

- [ ] Fill `legal-config.json`; legal review of the policy and terms
- [ ] Choose a domain and deploy `website/`
- [ ] Public support email
- [ ] Apply the pending migration (club successor on deletion)
- [ ] Assign the admin role; staff moderation and support
- [ ] Extend the moderation term list
- [ ] Leaked-password protection and SMTP in Supabase
- [ ] Confirm the Apple and Google sign-in providers
- [ ] Create and verify the review accounts; add honest sample content
- [ ] Age-rating decision (16+ recommended); App Privacy answers
- [ ] Copyright entity; address-dataset licence confirmation
- [ ] Optional brand-palette app icon

### BLOCKED (cannot be done from this environment)

- [ ] EAS production build: needs your EAS login and approval
- [ ] TestFlight upload and device QA: needs a build and an iPhone
- [ ] Real screenshots: need a Mac or an iPhone
- [ ] Public App Store submission: needs everything above and your approval
