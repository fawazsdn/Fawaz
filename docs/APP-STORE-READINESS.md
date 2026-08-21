# App Store Readiness Audit

**Status: App-Store-oriented architecture. Not ready to submit.**

Those are two different claims. This build's architecture — navigation,
permissions model, privacy design, config, dev/prod separation — is built
so a future production version doesn't need a rewrite. That is not the
same as having a submittable app today: there is no backend, no real
auth, no published legal documents, no server-side moderation
enforcement, and no physical-device testing has been performed in this
session. Do not read anything below as "ready to submit."

| Area | Status | Notes |
|---|---|---|
| Native compatibility (no web-only APIs) | READY | Audited for `window`/`document`/`localStorage`/hover-only interactions in `app/` and `src/` — none found outside the web platform boundary (Expo's own web build tooling). All photo picking goes through `expo-image-picker`, contextually requested. |
| Expo/EAS configuration | PARTIAL | `app.json` has name, slug, scheme, version, iOS bundle id, Android package, build number/version code, permission usage strings, icon/splash config. `eas.json` now defines development/preview/production build profiles. Still missing: a confirmed-final bundle identifier, Apple Team ID, and any EAS project linkage — all of which require the app owner's Apple Developer account, not something to invent. |
| Navigation (Expo Router) | READY | Onboarding → auth → profile → city/region/neighborhood → verification → tabs redirect chain in `app/index.tsx` is linear and can't strand a user in an invalid stack; back gestures and modal/stack nesting use Expo Router defaults, unmodified. |
| Safe areas | PARTIAL | Every screen reviewed uses `useSafeAreaInsets()` consistently (this was already the established pattern before this pass, not introduced now); not re-verified against a physical device with a Dynamic Island in this session — see "Physical-device testing" below. |
| Keyboard handling | PARTIAL | `KeyboardAvoidingView` is used in composer/messaging screens (already established pattern); not re-audited screen-by-screen in this pass, and not verified on a physical iPhone. |
| Permissions architecture | PARTIAL | Photo/camera permissions are requested contextually (only when the user taps "add photo") — confirmed in code, not just by convention. The location usage string in `app.json` (`NSLocationWhenInUseUsageDescription`) is currently unused — no `expo-location` dependency exists, and the "use my location" onboarding button uses a hardcoded coordinate, never a real permission prompt. Decide before shipping: implement real geolocation (then this becomes READY) or remove the unused string (see `docs/APP-STORE-RELEASE.md`). |
| Location privacy | READY (architecture) | The geography model (`src/types/geography.ts`) never carries a resident's exact address/GPS — only Region/City/Neighborhood plus an approximate centroid. Documented in `docs/PRIVACY-DATA-MAP.md`. |
| User-generated content moderation | PARTIAL | Report/block/mute/remove-content flows exist and are fully wired in the UI (`src/components/ReportSheet.tsx`, `app/moderation/index.tsx`, block/mute in settings) — but all enforcement is client-side against mock state; nothing is server-enforced because there is no server. BLOCKED on backend work. |
| Account deletion | PARTIAL | UI flow exists (Settings → Delete Account, with confirmation) and its service call is structured so a real backend can replace the mock implementation without changing the screen — but today it only resets local demo state, not a real deletion. See `docs/PRIVACY-DATA-MAP.md`. |
| Authentication | PARTIAL | OTP flow UI is complete and clearly demo-only (fixed code `123456`, documented in the README's "Demo credentials" section). No production phone-auth provider is integrated — that's real backend work, not yet started per this task's constraints. |
| Secrets | READY | Repo scanned for committed secrets/keys/credentials — none found. `.env.example` added (placeholders only); `.env`/`.env.local` added to `.gitignore` (previously only `.env*.local` was ignored — a plain `.env` file would not have been). No privileged/service-role-style variables exist anywhere in client code today. |
| Deep linking | PARTIAL | `app.json` declares the `haratna://` scheme (`expo.scheme`) and Expo Router's file-based routing gives every screen a real path already (`/post/[id]`, `/event/[id]`, etc.) — not newly re-verified in this pass that every dynamic route degrades gracefully for a deleted/invalid id; that was part of the original build, not re-audited here. |
| Push notifications | NOT YET IMPLEMENTED | No push SDK, no token registration, no server to send from. `NotificationService`'s current shape is mock-only. |
| Arabic / RTL | READY | This was the primary design constraint of the whole app from its first phase — manual RTL mirroring (`theme.row()`/`theme.text()`), Arabic-first display by default, Tajawal typography. Not re-audited screen-by-screen in this pass, but no regressions introduced by this task's changes (the new geography screens follow the same pattern and were built RTL-first). |
| Accessibility | NOT YET IMPLEMENTED (as a dedicated pass) | No dedicated VoiceOver/dynamic-type/reduced-motion audit has been performed at any point in this project. Interactive elements generally use `accessibilityRole`/`accessibilityLabel` where the base components (`Button`, `Chip`, etc.) already set them, but this has never been verified with an actual screen reader. |
| Production/dev separation | READY | New in this pass: `src/config/devFeatures.ts` (`IS_DEV_BUILD = __DEV__`) is the single gate for developer-only UI. Settings' demo-role switcher and "reset demo data" controls are now wrapped behind it — they render in a Metro/dev-client session and are compiled out of every EAS build profile (`development`/`preview`/`production` all build in release mode). The moderator-gated screens (`app/moderation`, issue status controls) are left as legitimate role-gated production code — moderation itself is a real feature; only the ability to self-assign that role from the client was dev-only, and that ability no longer exists in a release build. |
| Icons / splash assets | PARTIAL | `assets/icon.png`, `assets/splash-icon.png`, Android adaptive icon layers, and `assets/favicon.png` exist and are wired into `app.json` — but they were generated during initial development as placeholders, not final brand artwork. Replace before submission. |
| Legal screens | PARTIAL | Routes exist (`app/settings/info/[key].tsx`) for About/Help/Terms/Privacy and render clearly-labeled placeholder copy in both languages (the copy itself says "this is demo/placeholder text"). No real legal documents, company name, or support address have been fabricated anywhere — that's intentional per this task's constraints, not an oversight. |
| Backend dependencies | NOT YET IMPLEMENTED | No backend exists. Every domain has a `Service` interface (`src/services/*`) specifically so this is a swap, not a rewrite, once one does. |
| Physical-device testing | NOT YET IMPLEMENTED (this session) | This pass validated the app via `npx expo export --platform web` served locally and driven with a headless Chromium browser (Playwright) — real runtime, real rendered UI, real console-error monitoring — plus the Jest/RNTL test suite. That is not physical-iPhone testing. No physical device was used in this session; do not treat the web/simulator verification as a substitute. |
| TestFlight | NOT YET IMPLEMENTED | No EAS project has been created or linked; no build has been submitted anywhere. |
| App Store submission | NOT YET IMPLEMENTED | Not attempted, as instructed. |

## Pre-submission blockers (explicit)

Everything that must happen before an actual App Store submission is
possible, in no particular order — all of these are BLOCKED or NOT YET
IMPLEMENTED above:

1. A real backend (auth, data storage, moderation enforcement, account
   deletion) — currently 100% mock/local.
2. A confirmed final iOS bundle identifier and Apple Developer account
   ownership — `sa.haratna.app` is a placeholder pending the app owner's
   decision.
3. Real, published Privacy Policy and Terms of Service (with a real
   support URL) — current in-app copy is explicitly-labeled placeholder.
4. Server-side enforcement of block/report/remove-content — currently
   client-only.
5. Final app icon and splash artwork — current assets are development
   placeholders.
6. A decision on the unused `NSLocationWhenInUseUsageDescription` string
   — implement real geolocation or remove it.
7. Physical iPhone testing (Dynamic Island/notch, keyboard, gestures,
   crash behavior) — not performed in this or any prior session.
8. TestFlight distribution and internal testing.
9. App Store Connect app record, App Privacy questionnaire, age rating —
   all depend on the backend/SDK decisions above being final first.

Nothing in this document should be read as "App Store ready." It is
"architected so that becoming ready doesn't require rebuilding the app."
