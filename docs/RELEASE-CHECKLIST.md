# Haratna — next TestFlight build checklist

## 1. Supabase dashboard (project `Haratna`, ref `ckqwziutmqohihrenstz`)

These can't be set from the app or via SQL; do them once in the dashboard.

**Authentication → URL Configuration → Redirect URLs** — add:

- `haratna://auth/callback` (email confirmation + Google OAuth)
- `haratna://auth/reset-password` (password reset)

**Authentication → Sign In / Providers → Email**

- Enable *Email* provider, keep **Confirm email = ON**.
- Minimum password length ≥ 8 (the app also enforces 8 + letter + number).

**Authentication → Emails → SMTP Settings — required before inviting real users.**
Supabase's built-in email sender only delivers to members of your Supabase
organization and is heavily rate-limited. Configure a custom SMTP provider
(e.g. Resend, Postmark, Amazon SES) or confirmation/reset emails will not reach
residents.

**Authentication → Providers → Google / Apple** — only if you want those buttons
to work: Google needs a Web client ID/secret; Apple needs the Services ID / key
for `sa.haratna.app`. (Sign in with Apple on iOS uses the native token, which
needs the Apple provider enabled with `sa.haratna.app` as an authorized client ID.)

## 2. Build & upload (on your Mac, from the repo)

```bash
git pull                              # this branch
npm ci
npx eas-cli login                     # your Expo account
npx eas-cli build -p ios --profile production
npx eas-cli submit -p ios --latest    # uploads to App Store Connect → TestFlight only
```

- Bundle identifier stays `sa.haratna.app`.
- `eas.json` uses `appVersionSource: local` + `autoIncrement`; EAS bumps
  `ios.buildNumber` in `app.json` and you should commit that bump. If TestFlight
  already has a build number ≥ the bumped value, set `ios.buildNumber` in
  `app.json` above the latest TestFlight build first.
- New native modules in this build (require a fresh native build, not OTA):
  `react-native-maps`, `expo-image-manipulator`,
  `@react-native-community/datetimepicker`, `expo-network`.
- `eas submit` only uploads to TestFlight; nothing is released to the App Store.

## 3. Smoke test on iPhone (TestFlight)

1. Sign up with email → confirmation email arrives → tapping the link opens the app signed in.
2. Sign out → Forgot password → reset link opens the app → set new password → signed in.
3. Profile setup with a photo (crop/zoom/rotate editor) → choose Dhahran → Ajyal (search "أجيال" or "Ajyal").
4. Verify with location **while physically inside Ajyal** (the server checks the official boundary).
5. Create an activity with a pinned location and a 7:00 PM start → it shows "7:00 PM" (not 19:00), appears on the Map; tap marker → "View Activity".
6. Create a poll, vote A, change to B → total stays 1, percentages move.
7. Ask the assistant in English and in Arabic → each answer in the question's language.
8. Create menu scrolls to the last option on the smallest supported iPhone.
