# Haratna launch audit

This branch extends the merged iOS release at `b9c932b` and carries the authentication and account-deletion follow-up used in TestFlight build 8. The production app is `sa.haratna.app`, version 1.0.0. Build 10 remains available through internal TestFlight alongside candidate build 11.

## Prioritized findings

| Priority | Reproduction | Root cause | Change or release dependency |
| --- | --- | --- | --- |
| P0 | Register on iOS and tap the signup link | The live Supabase allowlist contained only staff website callbacks. Unrecognized mobile redirects fell back to the Haratna site. The app exposed resend without a code field. | Added the exact iOS callback and reset URLs to the production Auth allowlist. The saved template already contains both `ConfirmationURL` and `Token`. The app accepts eight-digit production codes and six-digit codes from environments configured for six. The build 10 tester confirmed Gmail receipt and in-app OTP. The separate confirmation-link handoff remains unverified. |
| P1 | Open a later onboarding page directly or try to return from it | The onboarding navigator hid its native header and the shared page omitted a back action. | Added an RTL-aware shared back action with a welcome fallback and made content scroll on short viewports. Native swipe-back and multiple iPhone sizes still need device checks. |
| P1 | Reply to a website ticket from the native admin inbox | The mobile action wrote to Supabase without calling Resend. The website action could close the ticket before trying to send. | Route website email replies to the authenticated staff dashboard. Reply & Close waits for acceptance and checks the response still matches. The dashboard displays provider status separately from the saved reply. Local provider tests pass. Production sender verification, actual delivery and concurrent staff replies still need an end-to-end pass. |
| P1 | Create an unverified business through a direct API client and link it to a neighborhood | Existing owner-write policies permit drafts, and the resident read policy does not require the verification flag. | The deployed migration adds a restrictive read policy and staff-only verification/provenance fields. Verified on the live schema with a rolled-back transaction. |
| P1 | Open Google sign-in in build 7 | Production Supabase lists Google as disabled. Apple and email are enabled. | Build 8 and this branch use an opt-in Google button. A valid Haratna OAuth client and configuration are required to enable it. |
| P2 | Open Explore or Home in a neighborhood with little activity | The category grid and empty sections competed for space. | Grouped Explore into four destinations, hid empty Explore previews, compacted Home and added real local business links when present. |
| P2 | Tap Call in a business detail | The button had no action. | Calls now use dialable numbers only. Directions use the recorded address or coordinates. |
| P2 | Inspect iOS branding | The prior Expo asset was configured for both icon and splash. | Added a full-bleed opaque 1024 × 1024 N2 recreation. Expo resolves the production icon to the new asset. Inspect the signed build on a device. |

## Ajyal directory

The deployed migration seeds three source-confirmed branches in Ajyal, Dhahran. It uses stable UUIDs and skips an existing same-name listing in the neighborhood. The migration adds nullable provenance columns, uses a five-second lock timeout, and changes read and verification rules for business listings. It does not delete or modify existing listings. Supabase recorded the migration as `20261108142100`.

- [Soma Grape Leaves](https://www.soma.sa/ajyal) confirms the branch, address, phone, and 24-hour opening.
- [Knock Café](https://linktr.ee/knock.saudi) lists its Ajyal branch and address.
- [Domino’s Pizza](https://store.dominos.sa/ar/almntk%D8%A9-alshrky%D8%A9/althhran/domino-s-pizza-domynoz-bytza-169) lists its Ajyal branch, address, phone, and hours.
- [Tamimi Markets](https://ae.linkedin.com/posts/tamimi-markets_%D8%AA%D9%85-%D8%A8%D8%AD%D9%85%D8%AF-%D8%A7%D9%84%D9%84%D9%87-%D8%B5%D8%A8%D8%A7%D8%AD-%D8%A7%D9%84%D9%8A%D9%88%D9%85-%D8%A7%D9%81%D8%AA%D8%AA%D8%A7%D8%AD-%D9%81%D8%B1%D8%B9-%D8%AC%D8%AF%D9%8A%D8%AF-activity-7031630821849456640-Nura) announced the branch. Confirm current branch details before adding it.

The Domino’s pin is the center of the Plus Code published on its branch page, checked against the repository’s Ajyal boundary. Soma and Knock use the merchant-provided address for directions. Other named candidates and service categories remain unverified. The directory uses the resident’s verified neighborhood scope. Residents can file suggestions, corrections, and claims for staff review. A platform administrator can approve an unowned business claim. Suggestions and corrections record the decision while staff verifies and edits the listing separately.

## Verification

- Mobile TypeScript and Jest, including Arabic/Persian code normalization, onboarding, neighborhood location, sign-in fallback, routes, and safe back.
- Website build and unit tests. Playwright website coverage includes mobile viewport checks and Arabic/English direction. Admin Playwright uses local Supabase and Resend stubs for acceptance, failure, retry, deduplication, delivery status, and Reply & Close.
- Local PostgreSQL 16 fixture ran the directory migration and checked the Ajyal seed, draft isolation, rejected self-verification on insert and update, and staff verification.
- Read-only production inspection confirmed anonymous users cannot read neighborhood change requests and authenticated users cannot directly update verification records.
- iOS Metro export and Expo config validation. Neither verifies signing or native device behavior.

## Release gate

The signed build and App Store draft still need verification after the directory and support changes are ready. The production business migrations were approved and deployed after confirming a restorable scheduled database backup dated November 7, 2026 at 16:28 UTC. Supabase recorded the request migration as `20261108142118`. Production smoke checks used a rolled-back transaction and checked all three request types, RLS, and ownership approval. Existing auth-user, profile, and membership ID fingerprints matched before and after deployment. Remaining device checks include Apple sign-in, GPS verification and change approvals, camera and upload permissions, posts and interactions, messaging and notifications, groups, clubs, marketplace, Lost & Found, reporting and blocking, and account deletion. Review final privacy declarations. The physical-iPhone screenshot set is complete. Keep the App Review demo credentials in App Store Connect and the existing secure credential store.

## Dependency and App Store status

The mobile lockfile removes the critical shell-quote advisory and updates compatible transitive dependencies. After a clean install, the mobile suite passed 332 tests and iOS export succeeded. The registry audit reported zero critical and five high findings after the updates. The build 11 candidate subsequently addressed the high findings while retaining Expo SDK 57. See the current audit below. The App Store Connect draft selects build 12 and uses manual release. Five approved physical-iPhone screenshots are accepted. Final App Privacy publication remains pending.

## Build 10 follow-up

| Priority | Finding | State |
| --- | --- | --- |
| Critical | Fresh Gmail signup, delivery, OTP entry, login, and neighborhood onboarding on a physical iPhone | OTP autofocus, native code autofill, paste, and Change Email are in the candidate. The build 10 tester confirmed Gmail delivery, manual OTP entry and successful verification, sign-out, and sign-in. Autofill, resend, and deep-link handling were not separately confirmed. |
| High | Missing back controls on the city picker, neighborhood picker, GPS verification, and authentication routes | Shared headers or the auth shell now expose back actions. The city picker has a direct-entry regression test. See the [route inventory](HARATNA-ROUTE-INVENTORY.md). |
| High | Google Sign-In was disabled in production | An OAuth test client exists in Haratna Production with the exact Supabase callback. Supabase provider activation and the Google redirect are verified. Device testing is pending. |
| High | Verify the Apple Maps experience on the release candidate | The map uses the native Apple provider on iOS. Automated regressions cover the boundary, clustering and pin selection. Device rendering and Apple Maps directions require a physical iPhone pass. |
| Medium | Business category coverage and supply | Added bilingual category entry points and retained verified-neighborhood listing filters. Three businesses are published. Tamimi is confirmed as an Ajyal opening by the neighborhood council. Razeen is independently confirmed as an Ajyal commercial center with recent events. They remain research entries pending current branch details and approved publication. |
| Future | Improve retention without synthetic activity | Prioritize local events, invite sharing and useful empty-state actions, which are present in the app. Evaluate ranking after genuine neighborhood activity provides enough data. |

### Apple Maps for iOS

Paid Google Maps and Places were canceled. PR #4 retains the Apple Maps provider, neighborhood polygons, markers and clustering, and opens business directions in Apple Maps. It removes the conditional Google Maps key and the Places research endpoint. Google OAuth remains separate.

### Production checks and privacy

Production Auth reported email, Apple, and Google enabled, and email auto-confirmation disabled. Public DNS exposed SPF for the sending subdomain, a Resend DKIM selector, and DMARC in monitoring mode. The build 10 tester confirmed Gmail receipt. Mailbox authentication results and delivery of live support replies are separate checks.

The older root privacy map documents the mock prototype. Use the [App Store privacy inventory](app-store/age-rating-and-privacy.md), the current bilingual policy, and the production schema to review disclosures. Supabase stores account identifiers, email, profile data, user content, support and moderation data. Neighborhood verification uses location to evaluate the boundary. Clubs collect a self-declared date of birth for age eligibility. The mobile app displays in-app notifications and declares no push-token registration or third-party analytics SDK. The auth client currently persists its session through AsyncStorage. Reconcile the saved App Store Connect answers with data and partner handling on the final build.

### Verified TestFlight and OAuth status

Apple processed 1.0.0 (10) as valid and reports internal beta testing for Team (Expo), with one tester assigned. The signed IPA reports bundle `sa.haratna.app`, display name حارتنا, and icon files identical to the signed N2 files from build 9. The tester confirmed these eight checks on a physical iPhone running build 10.

1. N2 icon on the Home Screen.
2. Fresh Gmail registration.
3. Verification email received.
4. OTP entered and verified inside Haratna.
5. Choose Your City back button.
6. Navigation on the other pages the tester exercised. Their routes were not individually identified.
7. Sign-out and sign-in.
8. Explore and the Ajyal directory.

The [route inventory](HARATNA-ROUTE-INVENTORY.md) records navigation mechanisms. Routes outside the reported device checks remain unverified on an iPhone.

Google OAuth is enabled in Supabase with the Haratna Production web client. Production Auth returned a redirect to Google Accounts with `https://ckqwziutmqohihrenstz.supabase.co/auth/v1/callback` as the callback. Google consent is in Testing mode. The project owner is listed as a test user. Build 10 keeps the Google button hidden because the signed build predates provider activation. A device session exchange, sign-out, and session restoration still need testing in a Google-enabled candidate.


### Public release gates after the build 10 device pass

| Gate | Evidence | Remaining verification |
| --- | --- | --- |
| Apple Sign-In | Enabled in production. The iOS configuration declares Apple Sign-In and the app uses the native credential flow. | Complete first sign-in, return sign-in, cancellation, sign-out and session restoration on a physical iPhone. Use a disposable identity if deletion will follow. |
| Account deletion | Settings calls the delete-account Edge Function and checks its successful response before clearing local auth. The club successor change passed local rollback checks. Production Edge Function v4 revokes Supabase sessions but has no Sign in with Apple REST token revocation. | Implement and validate Apple token revocation for Apple accounts. Exercise the full Edge Function on a named disposable account. Verify its old credentials fail and the account's data and media follow the documented deletion or retention rules. |
| Posting, messaging, moderation and blocking | SQL regressions cover prohibited text, moderation-term permissions, accepted connections, and the messaging block. The suite and code are backend evidence, separate from a device test. | With two consenting test accounts, exercise post create/edit/delete, report and staff review, accepted-connection messaging, and block from the other account. Check that a blocked user cannot send another message and that unrelated content remains accessible. |
| Support email | Web tests use Resend stubs for acceptance, rejection, and idempotent retry. Gmail signup receipt validates a separate email flow. | Submit a controlled support ticket, send one live staff reply to a named test mailbox, verify receipt or a provider delivery event, and confirm acceptance and close status in the dashboard. |
| Dependency security | Build 11 candidate audit reports 0 critical, 0 high, 4 moderate and 8 low findings. Expo SDK 57 includes the CLI fix and a scoped decoder upgrade with a CommonJS compatibility patch. | Recheck the registry and retire the decoder compatibility patch when the supported Expo Router drops the affected dependency. |
| App Privacy | The live draft has 10 saved data types including precise location. It marks Other User Content and User ID for personalization and app functionality. The code sends a precise coordinate for a live boundary check and stores the declared date of birth for club eligibility. | Confirm log retention, assess Other Data disclosure for the date of birth, reconcile purposes against the final app, and obtain owner sign-off before publishing. |
| App Store assets and review | The live draft is in Prepare for Submission with manual release, build 12 selected, saved demo credentials and review notes, and five accepted physical-iPhone screenshots. | Select the final approved build after device verification. |

### Approval gates

- Authorize deletion of a specifically named disposable account before executing a live deletion. An owner can also perform the deletion on their own disposable account and report the result.
- Authorize one live support reply to a specified test mailbox. Use synthetic content and verify the resulting delivery separately from acceptance.
- Sign off on the final App Privacy declarations, review instructions and exact build before authorizing public App Store submission. Manual release remains a separate authorization.
- Authorize any new production listing writes or other production database changes separately. Paid Google Maps and Places are canceled.

The Google provider is enabled for the testing project. The builds hide the button pending a complete iPhone OAuth exchange. Additional Ajyal entries remain staff review candidates. See [mapping and directory evidence](HARATNA-GOOGLE-AJYAL.md).

[Apple App Privacy guidance](https://developer.apple.com/app-store/app-privacy-details/) · [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)

## Build 11 verification

The signed TestFlight candidate is Haratna 1.0.0 (11), bundle `sa.haratna.app`,
built from `3a0e44038c940fcc3bf681723be529d785ceb8f4`.
[EAS build](https://expo.dev/accounts/fawazsdn/projects/haratna/builds/45ee522b-04c1-4196-a77e-9963b29da518)

Apple accepted the upload and reports build 11 as VALID and IN_BETA_TESTING for
Team (Expo), with one tester. Build 10 remains valid and assigned to that group.
Build 11 has no external group assignment or physical-iPhone test result.
[App Store Connect TestFlight](https://appstoreconnect.apple.com/apps/6821993919/testflight/ios)

- Mobile: 346 tests passed, TypeScript and geography validation passed, ESLint reported four existing warnings and no errors, and the iOS bundle exported. Expo Doctor passed 20 of 21 checks and listed eight same-SDK patch-version mismatches.
- Website: 14 unit tests, 20 stubbed admin browser tests and 63 public-site browser tests passed. Two tests were skipped, including the live support delivery test. Website lint, TypeScript and the production build passed.
- Database: local neighborhood-locking and account-deletion rollback checks passed. Fresh local fixtures verified the three Ajyal listings, resident visibility and staff-only approval and ownership assignment. The full directory integration suite needs an Auth-backed Supabase schema. A read-only production check confirmed the four relevant migration versions, three sourced listings and one coordinate pin. Residents cannot directly update the request queue or execute the account purge. The Supabase advisor still flags security-definer grants and disabled leaked-password protection.
- Auth: the live review-account password and verified membership passed a read-only smoke check. The Google authorize endpoint redirected to the expected Google host and Supabase callback with the expected scopes. The candidate hides the button pending a successful native OAuth exchange.
- Archive: the iPhone N2 icon file matches the build 10 archive byte for byte. The signed app includes the Apple Sign-In entitlement and the app privacy manifest. It has no Google Maps SDK configuration or named Maps/Places resources.
- App Store Connect: the draft selects build 12 and manual release. It has the saved support and privacy URLs, review account and notes, age-rating answers and copyright. The privacy questionnaire has eleven saved data types and shows a Publish action. Five accepted physical-iPhone screenshots replaced the older simulator image.

### Physical iPhone checks for build 11

1. Verify the TestFlight build number and Home Screen N2 icon. In both app languages, try registration or existing sign-in, the OTP screen, and back or swipe-back in onboarding.
2. Open Explore and the Ajyal listings. On the map, zoom to group nearby markers, tap a cluster, open a pin and confirm the neighborhood boundary. Open directions from a verified listing with an address or pin and check the destination in Apple Maps.
3. Exercise Apple Sign-In, sign-out and session restoration. Keep Google Sign-In in a separate OAuth validation pass before enabling the button.
4. With two designated test accounts, verify posting, reporting, moderation, messaging and blocking. Verify account deletion and live support delivery only with separate approval for the named test account and mailbox.
5. Preserve the approved English (U.S.) iPhone screenshot set. Select the final build in the App Store draft after device verification. Public App Review requires explicit approval.

## App Store submission audit · November 9, 2026

- **Screenshots complete.** App Store Connect shows exactly five accepted English (U.S.) screenshots at 1290 × 2796. The saved order is Home, Explore, Neighborhood Map, Local Businesses, and Neighborhood Assistant. The older simulator screenshot is absent.
- **Draft verified.** حارتنا 1.0 selects build 12 and shows Prepare for Submission with manual release. The description, keywords, subtitle, primary category, copyright, age-rating answers, support and privacy URLs, and reviewer login and notes are saved. The previously verified launch settings are Saudi Arabia only and SAR 0.
- **Account deletion pending.** Production runs the legacy `delete-account` v5 and the approved `delete-account-v2` v1 with JWT verification. The deployed v2 source matches the reviewed files. Anonymous and invalid JWT requests returned 401, and authenticated capability discovery passed. The compatible iOS client uses the new endpoint only for Apple deletion and checks capability before opening the Apple prompt. Mobile TypeScript and 354 tests passed. Deno type checking and three revocation tests passed. The current npm production audit reports zero critical and high findings, four moderate and eight low. The rollout and rollback steps are in the [account-deletion plan](app-store/account-deletion-rollout.md).
- **Privacy pending publication.** Eleven data types are saved. Other Data covers the linked date of birth used for club eligibility. Retain the existing Precise Location answer while request-log retention is unverified. Keep the existing personalization purposes for User ID and Other User Content. The signed-in identity and neighborhood determine the feed shown, and saved posts and favorites customize what users can access. Confirm the final declarations and approve publication.
- **Final acceptance pending.** The endpoint capability checks passed. Preparing the compatible internal TestFlight build is the next release step. Verify Apple revocation and data cleanup only with separate approval for the named disposable account. Live support delivery and the two-account community checks still need their authorized fixtures. Select the final build only after the physical-iPhone pass.
