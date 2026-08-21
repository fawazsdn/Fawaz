# App Store Release Checklist

This is a checklist, not a status report — see `docs/APP-STORE-READINESS.md`
for the current READY/PARTIAL/BLOCKED/NOT YET IMPLEMENTED audit. Nothing
here is marked done unless it's genuinely done; most of it isn't yet.

## Versioning

- **Marketing version** (`app.json` → `expo.version`): `1.0.0`. Bump per
  release per semver-ish convention (`1.0.1` for a bugfix build,
  `1.1.0` for a feature build).
- **iOS build number** (`app.json` → `expo.ios.buildNumber`): currently
  `"1"`. EAS's `production` build profile has `"autoIncrement": true` set
  in `eas.json`, so once building against a real EAS project, the build
  number increments automatically — don't hand-edit it back down or reuse
  a number.
- **Android version code** (`app.json` → `expo.android.versionCode`):
  currently `1`. Increment manually (or via EAS auto-increment, same
  caveat) on every Android build submitted anywhere, TestFlight-equivalent
  or store.

## Pre-submission checklist

Unchecked items are exactly that — not yet done, not "assumed fine":

- [ ] Apple Developer Program account enrolled
- [ ] Final bundle identifier confirmed (currently `sa.haratna.app` —
      placeholder set early in development; confirm it matches the
      Apple Developer org/domain that will actually own this app before
      registering it in App Store Connect — **this is your decision, not
      something to infer from the codebase**)
- [ ] App Store Connect app record created
- [ ] Certificates & provisioning profiles generated via
      `eas credentials` (EAS manages these — do not hand-create or commit
      any `.p12`/`.mobileprovision`/private key file)
- [ ] Production backend deployed (does not exist yet — this build is
      entirely frontend + mock data, see README)
- [ ] Privacy Policy published at a real, stable URL (current in-app
      screen is placeholder/development content — see "Legal screens"
      below)
- [ ] Terms of Service published at a real, stable URL (same caveat)
- [ ] Support URL / contact published
- [ ] Real account deletion implemented server-side (current button is a
      local-state reset only — see `docs/PRIVACY-DATA-MAP.md`)
- [ ] Final app icon supplied (current icon is a placeholder generated
      during initial development, not final brand artwork)
- [ ] Screenshots — Arabic
- [ ] Screenshots — English
- [ ] App Store "App Privacy" questionnaire answers finalized against
      `docs/PRIVACY-DATA-MAP.md` once the backend (and any analytics/
      push/crash-reporting SDKs) are actually decided — answering this
      today would describe SDKs and data flows that don't exist yet
- [ ] Age rating questionnaire completed (neighborhood social app with
      UGC — expect at least a moderation/UGC-related rating; do this once
      moderation is server-enforced, not just client-side)
- [ ] Content/moderation review — server-side enforcement of block/report/
      remove actions (current implementation is fully client-side/mock,
      see `docs/PRIVACY-DATA-MAP.md` "User-generated content safety")
- [ ] Permissions review — confirm every `Info.plist` usage string in
      `app.json` matches a permission the shipped build actually
      requests. As of this pass, `NSLocationWhenInUseUsageDescription` is
      declared but the app has no `expo-location` dependency and never
      calls a real location API (the "use my location" demo button uses
      a hardcoded coordinate) — decide whether to implement real
      geolocation before this string ships, or remove it
- [ ] TestFlight internal build distributed and used
- [ ] Physical iPhone testing performed (simulator/web export alone do
      not count — see `docs/APP-STORE-READINESS.md` "Physical-device
      testing")
- [ ] Crash testing on a physical device
- [ ] Production EAS build (`eas build --profile production --platform ios`)
- [ ] Submission (`eas submit` or manual upload)

## Legal screens

Settings → About/Help/Terms/Privacy routes exist and are functional (see
`app/settings/info/[key].tsx`) but currently render development
placeholder copy — they are not fabricated legal text pretending to be
final, but they are also not something to submit as-is. Before
submission, point these at real, reviewed legal documents and a real
support URL. Do not invent a company name, address, or legal entity here
or anywhere else in the app — that decision belongs to the app's owner.

## Build profiles (`eas.json`)

- `development` — dev client, internal distribution, for local iterating
  against native modules that don't run in Expo Go.
- `preview` — internal distribution release build, for TestFlight-style
  internal testing before a real submission.
- `production` — the build that would actually go to App Store Connect.

All three build in release mode (`__DEV__` is `false`), so the developer-
only demo-role switcher and "reset demo data" controls (gated behind
`IS_DEV_BUILD` in `src/config/devFeatures.ts`) do not appear in any of
them — only in a Metro/dev-client session. See
`docs/APP-STORE-READINESS.md` "Production/dev separation".
