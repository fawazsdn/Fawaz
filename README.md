# حارتنا — Haratna

Saudi Arabia's neighborhood community app (Expo SDK 57, React Native 0.86,
expo-router, Supabase). Arabic-first with full English support.

Everything shown in the app comes from the Haratna Supabase project
(`ckqwziutmqohihrenstz`) under Row Level Security. There is **no seeded or
demo content** in the app bundle — a new neighborhood genuinely starts empty
and shows empty states until residents post. Test fixtures live only in
`src/testing/` and are guarded out of production by
`src/__tests__/noProductionFixtures.test.ts`.

## Run

```bash
npm ci
npx expo start          # dev client / simulator
npm run typecheck && npm run lint && npm test
```

Production iOS builds go through EAS (`eas build -p ios --profile production`,
then `eas submit -p ios --latest`). See *TestFlight* below.

## Architecture

```
app/                 expo-router screens
src/backend/         the only place that talks to Supabase
  sync.ts            loads everything the signed-in resident may see (RLS) into the store,
                     realtime subscriptions, signed media URLs
  actions.ts         every write (posts, activities, RSVPs, poll votes, messages, ...)
  media.ts           uploads to Storage (community-media is private; avatars public)
  location.ts        GPS + server point-in-polygon against official district boundaries
src/store/useStore   Zustand; entities start empty and are filled only by sync.
                     Only settings + session pointers are persisted.
src/services/assistant   Neighborhood Assistant: replies in the language of the user's
                     latest message, grounded in live Supabase reads (never invents data)
src/services/geography   Official Saudi geography (address.gov.sa) bundled offline
src/components/imageEditor   crop / zoom / reposition / rotate / preview editor
supabase/migrations  SQL applied to the project (tracked in schema_migrations)
supabase/tests       SQL RLS/RPC tests (self-rolling-back)
```

### Auth

Email + password via Supabase Auth (PKCE), plus Sign in with Apple and Google.
Email confirmation and password-reset links deep-link to
`haratna://auth/callback` and `haratna://auth/reset-password`.
Account deletion calls the `delete-account` Edge Function.

### Neighborhood membership & privacy

Choosing a neighborhood creates a *pending* membership (`select_neighborhood`).
Neighborhood content (posts, activities, marketplace, profiles) is readable only
by **verified** members; verification is a server-side point-in-polygon check
(`verify_neighborhood_location`) against the official boundary. Map pins are
opt-in and rounded to ~110 m; homes are never shown.

### Times

All times are displayed in Asia/Riyadh with a 12-hour clock ("7:00 PM" /
"٧:٠٠ م") and stored as UTC timestamps.

## Required Supabase dashboard configuration

See `docs/RELEASE-CHECKLIST.md`.
