# Haratna launch audit

This branch extends the merged iOS release at `b9c932b` and carries the authentication and account-deletion follow-up used in TestFlight build 8. The production app is `sa.haratna.app`, version 1.0.0. The next EAS production build will increment the local build baseline from 8.

## Prioritized findings

| Priority | Reproduction | Root cause | Change or release dependency |
| --- | --- | --- | --- |
| P0 | Register on iOS and tap the signup link | The live Supabase allowlist contained only staff website callbacks. Unrecognized mobile redirects fell back to the Haratna site. The app exposed resend without a code field. | Added the exact iOS callback and reset URLs to the production Auth allowlist. The saved template already contains both `ConfirmationURL` and `Token`. The app accepts eight-digit production codes and six-digit codes from environments configured for six. End-to-end email delivery, browser handoff, and iPhone verification still need a device pass. |
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

The signed build and App Store draft still need verification after the directory and support changes are ready. The production business migrations were approved and deployed after confirming a restorable scheduled database backup dated November 7, 2026 at 16:28 UTC. Supabase recorded the request migration as `20261108142118`. Production smoke checks used a rolled-back transaction and checked all three request types, RLS, and ownership approval. Existing auth-user, profile, and membership ID fingerprints matched before and after deployment. Remaining device checks cover registration and email receipt, Apple sign-in, GPS verification and change approvals, camera and upload permissions, posts and interactions, messaging and notifications, groups, clubs, marketplace, Lost & Found, reporting and blocking, and account deletion. Review privacy declarations and collect App Store screenshots on a real iPhone. Keep the App Review demo credentials in App Store Connect and the existing secure credential store.

## Dependency and App Store status

The mobile lockfile removes the critical shell-quote advisory and updates compatible transitive dependencies. After a clean install, the mobile suite passed 332 tests and iOS export succeeded. The registry audit reported zero critical and five high findings after the updates. The remaining high Expo Router chain is reported as fixed by a major Expo Router update and requires compatibility testing. The App Store Connect draft currently selects build 8, uses manual release, and has review credentials and notes saved. Its one existing screenshot is from a simulator. Real iPhone screenshots and verification of the final App Privacy declarations remain required.

## Build 10 follow-up

| Priority | Finding | State |
| --- | --- | --- |
| Critical | Fresh Gmail signup, delivery, OTP entry, login, and neighborhood onboarding on a physical iPhone | OTP autofocus, native code autofill, paste, and Change Email are in the candidate. Device confirmation is pending. |
| High | Missing back controls on the city picker, neighborhood picker, GPS verification, and authentication routes | Shared headers or the auth shell now expose back actions. The city picker has a direct-entry regression test. See the [route inventory](HARATNA-ROUTE-INVENTORY.md). |
| High | Google Sign-In was disabled in production | An OAuth test client exists in Haratna Production with the exact Supabase callback. Provider activation and device testing are pending. |
| High | Native Google Maps requires project access and billing authorization | The candidate can select the Google iOS provider when a restricted build key is configured. Google Maps directions open through the Google app or browser. The current build has no Maps SDK key. |
| Medium | Business category coverage and supply | Added bilingual category entry points and retained verified-neighborhood listing filters. Three businesses are published. Tamimi is confirmed as an Ajyal opening by the neighborhood council. Razeen is independently confirmed as an Ajyal commercial center with recent events. They remain research entries pending current branch details and approved publication. |
| Future | Improve retention without synthetic activity | Prioritize local events, invite sharing and useful empty-state actions, which are present in the app. Evaluate ranking after genuine neighborhood activity provides enough data. |

### Google Maps budget model

Assumption for a pilot month: 500 active residents, four native map opens, two Nearby Search Pro calls, two Text Search Pro calls, and four Place Details Pro calls per resident. This is 2,000 map opens and 1,000, 1,000, and 2,000 Places calls respectively. Under current published SKU allowances the modeled charge is USD 0 before tax. At 5,000 active residents with identical use, the modeled charge is USD 575 before tax. The calculation is two search SKUs at 5,000 billable calls each × USD 32 per thousand, plus 15,000 billable Details Pro calls × USD 17 per thousand.

Use a bundle-restricted key for `sa.haratna.app` and restrict it to Maps SDK for iOS. Use a separate server credential restricted to Places API (New) and an approved egress IP where available. Use narrowly scoped field masks to avoid higher-cost SKUs, set service quotas before rollout, and configure billing alerts. Budget alerts do not stop usage. Keep Place IDs as lookup identifiers and separate independently verified Haratna records from live Google content. [Google pricing](https://developers.google.com/maps/billing-and-pricing/pricing) · [Key restrictions](https://developers.google.com/maps/api-security-best-practices) · [Places billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)

### Production checks and privacy

Production Auth reported email and Apple enabled, Google disabled, and email auto-confirmation disabled. Public DNS exposed SPF for the sending subdomain, a Resend DKIM selector, and DMARC in monitoring mode. This checks DNS publication. Gmail reception and mailbox authentication results need the device test.

The older root privacy map documents the mock prototype. Use the [App Store privacy inventory](app-store/age-rating-and-privacy.md), the current bilingual policy, and the production schema to review disclosures. Supabase stores account identifiers, email, profile data, user content, support and moderation data. Neighborhood verification uses location to evaluate the boundary. Clubs collect a self-declared date of birth for age eligibility. The mobile app displays in-app notifications and declares no push-token registration or third-party analytics SDK. The auth client currently persists its session through AsyncStorage. Review actual App Store Connect answers and update disclosures before shipping a build that includes Google Maps SDK.

### Verified TestFlight and OAuth status

Apple processed 1.0.0 (10) as valid and reports internal beta testing for Team (Expo), with one tester assigned. The signed IPA reports bundle `sa.haratna.app`, display name حارتنا, and icon files identical to the signed N2 files from build 9. The physical iPhone previously reported build 9 installed. The build 10 Gmail walkthrough is awaiting the tester's result.

Google OAuth is enabled in Supabase with the Haratna Production web client. Production Auth returned a redirect to Google Accounts with `https://ckqwziutmqohihrenstz.supabase.co/auth/v1/callback` as the callback. Google consent is in Testing mode. The project owner is listed as a test user. Build 10 keeps the Google button hidden because the signed build predates provider activation. A device session exchange, sign-out, and session restoration still need testing in a Google-enabled candidate.
