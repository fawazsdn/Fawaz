# Apple App Store compliance audit — Haratna 1.0.0

Audited 2026-10-14 on branch `claude/haratna-frontend-build-bdy51c`, from
the source code, `app.json`, `eas.json` and the production Supabase project
(`ckqwziutmqohihrenstz`).

**Limits of this audit.** It was done in a Linux container: no Mac, no
Xcode, no iOS Simulator, no physical iPhone, and no EAS login. Statements
about native behaviour come from configuration and code review, Jest tests
and the JavaScript export, not from a running iOS app. Nothing here
guarantees App Review approval.

Official sources (current at audit time):

- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Offering account deletion: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- App privacy details: https://developer.apple.com/app-store/app-privacy-details/
- Privacy manifest files: https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
- Required-reason APIs: https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api
- Age ratings: https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions
- Screenshot specifications: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
- Upcoming requirements (SDK minimums): https://developer.apple.com/news/upcoming-requirements/
- Human Interface Guidelines, Sign in with Apple: https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple

Legend: ✅ verified in code/tests · 🔧 fixed in this pass · 🟡 needs owner action or device test · ⛔ blocker

---

## A. App functionality (Guideline 2.1 App Completeness)

| Check                                     | Result                                                                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fake or mock production data              | ✅ The mock layer was replaced with real Supabase data earlier. The app shows only rows from the database.                                                 |
| Placeholder buttons / unfinished features | ✅ Every button on the audited screens calls a real action. Notifications are in-app only; no push is advertised.                                          |
| Loading / empty / error states            | ✅ Shared `EmptyState`, `ErrorState` and loading components on lists. Action errors are translated through `useAction`.                                    |
| Offline handling                          | ✅ `sync.ts` checks `expo-network` and shows an offline state instead of a blank screen.                                                                   |
| Forms, scrolling, keyboard                | ✅ Forms use react-hook-form + zod; scroll and keyboard handling was fixed earlier. 🟡 Not exercised on a device.                                          |
| Crashes, blank screens                    | 🟡 Jest suites render the main screens without throwing, and `expo export --platform ios` builds. Crash-freedom on iOS can only be proven with TestFlight. |

## B. Authentication (Guidelines 4.8, 5.1.1)

| Check                              | Result                                                                                                                                                                                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email sign-up, verification, reset | ✅ Implemented with Supabase Auth and `haratna://` deep links; covered by Jest. 🟡 Real email delivery depends on the SMTP setup in Supabase. The default Supabase mailer is rate-limited and not meant for production.                                                                                 |
| Sign in with Apple                 | ✅ `expo-apple-authentication` with `usesAppleSignIn: true`, offered next to Google. Guideline 4.8 requires an equivalent login option when third-party login is used; Sign in with Apple meets it. 🟡 Confirm the Apple provider in Supabase Auth and the Sign in with Apple capability on the App ID. |
| Google sign-in                     | ✅ Code path present. 🟡 Provider configuration not verifiable from here.                                                                                                                                                                                                                               |
| Session persistence / logout       | ✅ AsyncStorage session; sign-out clears the store (including the new neighbor and support state).                                                                                                                                                                                                      |
| Terms acceptance                   | 🔧 Sign-up now requires ticking agreement to the Terms and Community Guidelines (Guideline 1.2 asks for published terms). Sign-in shows the notice.                                                                                                                                                     |
| **Not claimed**                    | Authentication was **not** tested end-to-end on an iPhone in this pass.                                                                                                                                                                                                                                 |

## C. Account deletion (Guideline 5.1.1(v))

✅ Settings → Delete account calls the `delete-account` Edge Function (v4).
It removes the user's storage objects, runs `purge_account_data`, revokes
sessions and deletes the auth user. The button is not a fake.

🟡 **One fix is waiting for owner approval:**
`supabase/migrations/20261014110000_pending_owner_approval.sql`. When a
deleted user owns a club, the current function can hand ownership to any
member (even someone who did not declare 18+) and leaves their role
unchanged. The fix picks an adult successor or archives the club. It was not
applied because applying it from here needs a destructive-statement
confirmation. Apply it in the SQL editor after review.

## D. User-generated content (Guideline 1.2)

Guideline 1.2 requires four things: a filter for objectionable material, a
way to report content with timely responses, a way to block abusive users,
and published contact information.

| Requirement          | Result                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filtering            | 🔧 **New:** a server-side word filter (`moderation_terms` plus triggers on 13 content tables) rejects posts, comments, messages, profiles, activities, listings, clubs and more. Tested in `supabase/tests/compliance.sql`. 🟡 The seed list is a small starter. The owner must review and extend it (Arabic dialect terms especially). |
| Reporting            | ✅ Posts, comments, messages, profiles, clubs and members already had Report. 🔧 Report was **added** to marketplace listings and activities.                                                                                                                                                                                           |
| Blocking             | ✅ Block on profiles. Blocking removes neighbor connections and requests, and blocks direct messages (server-side).                                                                                                                                                                                                                     |
| Moderation           | ✅ The admin/moderator queue reviews reports; clubs need approval before they appear.                                                                                                                                                                                                                                                   |
| Timely response      | 🔧 **New:** an in-app support form (`support_requests`) with a staff inbox at `/admin/support`; staff are notified. 🟡 **Owner:** someone must hold the admin/moderator role and check the queue daily.                                                                                                                                 |
| Published guidelines | 🔧 Community Guidelines are now in the app (Settings) and on the website.                                                                                                                                                                                                                                                               |
| Contact information  | 🔧 In-app Contact support, plus the website support page. 🟡 A public support email is still missing.                                                                                                                                                                                                                                   |

## E. Child safety (Guidelines 1.2, 1.3, 5.1.4)

- ✅ Club organizers must declare they are 18+. The date of birth is private.
  The app and the policies call it **self-declared, not verified**.
- ✅ Messaging is limited to connected neighbors (mutual acceptance) or a
  specific activity or listing context, and blocking ends it.
- ✅ Discovery is opt-in, off by default, and limited to the same
  neighborhood. No addresses, coordinates, phone numbers or emails are
  exposed.
- ⚠️ **Risk:** the app helps nearby strangers meet in person. Recommend a
  **16+** age rating (see `age-rating-and-privacy.md`) and adding
  "meet in public places" advice in the Guidelines, which are already
  included. This is an owner/legal decision.
- The app is **not** in the Kids category and must not be described as
  being for children.

## F. Location privacy (Guidelines 5.1.1, 5.1.5)

- ✅ Only **when-in-use** permission is used (`requestForegroundPermissionsAsync`),
  at the moment the user taps Verify or sets an activity location. There is
  no background location and no `UIBackgroundModes`.
- ✅ Verification sends the coordinates once to the server, checks them
  against the polygon, and does not store them. Pins for activities, posts
  and listings are rounded to about 100 m.
- ✅ When permission is denied, the screen explains why and offers to try
  again.
- 🔧 The purpose string was rewritten to say exactly this. Arabic and English
  versions are in `locales/`.
- 🔧 A native prebuild showed that the `expo-location` plugin was adding
  default "Always" location and motion purpose strings in English
  ("Allow $(PRODUCT_NAME) to …"). The plugin is now configured explicitly:
  background location is off, and those strings (which the app never
  triggers) state in Arabic and English that Haratna does not use background
  location or motion data. They stay present because the module links those
  APIs; a missing key can cause an ITMS-90683 upload error.

## G. Photos and media (Guideline 5.1.1(ii))

- ✅ The photo picker is used only when the user taps add-photo. There is no
  bulk library access.
- ✅ The camera is **not used** by the app today. The `NSCameraUsageDescription`
  key stays because the image-picker module links camera APIs and App Store
  Connect rejects binaries without the string. 🔧 The string was reworded so
  it is accurate.
- 🔧 The microphone purpose string that `expo-image-picker` added by default
  was **removed** (`microphonePermission: false`), because the app never
  records video or audio. Verified in the prebuild Info.plist.
- ✅ Uploads go to Supabase Storage with per-user path policies. The bucket
  limits were checked in production: avatars are 5 MB and community-media
  is 10 MB (private), both JPEG, PNG, WebP or HEIC only.

## H. Data privacy (Guidelines 5.1.1, 5.1.2; privacy manifests)

- ✅ No analytics, crash-reporting, advertising or attribution SDK is in
  `package.json`. There is no IDFA or ATT, and no tracking.
- 🔧 `ios.privacyManifests` was added: tracking false, collected data types,
  and required-reason API declarations (UserDefaults CA92.1, FileTimestamp
  C617.1, SystemBootTime 35F9.1, DiskSpace E174.1). Expo merges it with the
  manifests of the SDK pods.
- 🔧 The privacy policy was rewritten from the actual data flows (AR/EN),
  in the app and on the website.
- 🟡 Questionnaire answers are in `age-rating-and-privacy.md`. The owner
  must confirm the precise-location and date-of-birth choices.
- 🟡 Owner values are still blank: data region, email provider, backup
  retention (`src/content/legal-config.json`).

## I. Payments (Guideline 3.1)

✅ There are no in-app purchases, subscriptions, premium features or digital
goods. The marketplace is for physical items between neighbors and has no
payment processing. That is allowed under 3.1.3(e)/3.1.5 (goods and
services outside the app). Nothing paid is advertised.

## J. Metadata (Guidelines 2.3, 5.1.1(i))

| Item                                                          | Status                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Name, subtitle, description, keywords, promo text, What's New | ✅ `metadata.md`; lengths measured. Only built features are described.                           |
| Screenshots                                                   | 🟡 Kit and captions are ready in `screenshots/`. **No captures yet; they need a Mac or iPhone.** |
| Age rating                                                    | 🟡 Answers prepared; owner chooses 16+ (recommended) or the computed rating.                     |
| Privacy Policy URL                                            | ⛔ Needs a public URL: deploy `website/` to the owner's domain.                                  |
| Support URL                                                   | ⛔ Same, plus a support email in `legal-config.json`.                                            |
| App Review information                                        | 🟡 `review-notes.md`: create the two accounts and verify them with `admin_verify_member`.        |
| Export compliance                                             | ✅ `ITSAppUsesNonExemptEncryption: false` (HTTPS only).                                          |
| Content rights                                                | 🟡 Owner to confirm the licence for the Saudi address dataset.                                   |
| Copyright                                                     | 🟡 Legal entity name needed.                                                                     |

## K. Technical compatibility

| Item                                | Status                                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expo SDK / React Native             | ✅ SDK 57 / RN 0.86 (current). `expo-doctor` results are in the launch report.                                                                                |
| iOS SDK minimum                     | ✅ Apple has required the iOS 26 SDK (Xcode 26) since April 2026. EAS build images for SDK 57 use Xcode 26. 🟡 Confirmed only once an EAS build runs.         |
| Deployment target                   | ✅ SDK 57 default (no override).                                                                                                                              |
| Signing, provisioning, entitlements | 🟡 Managed by EAS credentials (not overwritten). Entitlements: Sign in with Apple only. No push, no associated domains.                                       |
| Privacy manifest                    | 🔧 Added (see H).                                                                                                                                             |
| App Transport Security              | ✅ No ATS exceptions; every endpoint is HTTPS.                                                                                                                |
| Deep links                          | ✅ `haratna://` scheme for auth callbacks. No universal links are used, so no AASA file is needed.                                                            |
| Push notifications                  | ✅ Not used, and no aps-environment entitlement.                                                                                                              |
| Icon / launch screen                | ✅ The 1024 icon exists. ⚠️ The icon is blue and does not use the brand palette (#0D4939…). Owner design decision. The splash background is #FAF6EF.          |
| Orientation / devices               | ✅ Portrait. 🔧 `supportsTablet: false`, so the app is not judged on iPad layouts (Guideline 2.4.1 still lets iPhone apps run on iPad in compatibility mode). |
| Localization                        | 🔧 `locales/ar.json` and `locales/en.json` provide translated permission strings and the display name.                                                        |
| Native build                        | ⛔ Not built in this pass: there is no EAS login in this environment. A JS bundle does not prove the native app is compliant.                                 |

## L. App Review access (Guideline 2.1)

🔧 Implemented as audited manual verification (`admin_verify_member` /
`admin_revoke_membership`). It can only be called by a platform admin or
from the database SQL editor, and residents calling it get `not_authorized`
(tested). The reviewer account is placed in an **empty review
neighborhood**, so reviewers never see real residents. There is no client
flag, no hidden code and no location spoofing. Steps and notes text are in
`review-notes.md`.

## M. Guideline summary

| Guideline | Requirement                                    | Status                                        |
| --------- | ---------------------------------------------- | --------------------------------------------- |
| 1.2       | Filter, report, block, contact                 | 🔧 Implemented; owner must staff moderation   |
| 1.5       | Developer contact info                         | 🟡 Support URL and email needed               |
| 2.1       | Complete app, demo access                      | 🔧 Review access ready; 🟡 accounts to create |
| 2.3       | Accurate metadata, real screenshots            | ✅ metadata / 🟡 screenshots                  |
| 3.1       | IAP for digital goods                          | ✅ N/A (no digital sales)                     |
| 4.8       | Login services                                 | ✅ Sign in with Apple offered                 |
| 5.1.1(i)  | Privacy policy in app and in App Store Connect | ✅ in app / ⛔ public URL                     |
| 5.1.1(ii) | Purpose strings, consent                       | 🔧 Reworded and localized                     |
| 5.1.1(v)  | In-app account deletion                        | ✅ Real deletion; 🟡 successor fix pending    |
| 5.1.2     | Data use and sharing                           | ✅ No tracking or sharing beyond processors   |
| 5.1.5     | Location services                              | ✅ When-in-use, purposeful, not stored        |

## Remaining manual actions

The ordered, complete list is in the final launch readiness report. The
blockers are:

1. A public privacy and support URL (deploy `website/`).
2. A support email.
3. Real screenshots.
4. An EAS production build and TestFlight run, after the owner approves.
