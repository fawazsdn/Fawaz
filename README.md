# حارتنا — Haratna

**حارتك، مجتمعك. — Your neighborhood. Your community.**

A frontend-only, production-quality prototype of a Saudi neighborhood
community app: a digital majlis + neighborhood bulletin board + local events
platform. Built with Expo Router, React Native, and TypeScript. There is no
backend — every interaction runs against an in-memory mock data layer that
persists to the device via `AsyncStorage`.

## Run it

```bash
npm install
npm run start      # Expo dev server — press i / a / w, or scan the QR code
npm run web        # web directly
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test       # jest (75 tests)
npm run format     # prettier --write
```

Requires Node 18+. No environment variables, API keys, or backend of any
kind are needed to run the full app.

## Demo credentials

Authentication is entirely mocked. On the phone screen, enter any Saudi
mobile number; on the OTP screen, enter:

```
123456
```

Any other code is rejected as "incorrect" so you can also see that state.
This is clearly a demo affordance, not real auth — see
`src/services/auth/index.ts`.

## What's built

Every screen and flow listed in the product brief is implemented and wired
to local mock state — nothing is a static screenshot or a dead button:

- **Onboarding** — animated splash, 5-page onboarding (welcome/community/
  help/events/privacy), language switch on page 1.
- **Auth** — phone entry (+966), 6-digit OTP with auto-advance/paste/resend
  countdown/wrong-code state, profile creation (React Hook Form + Zod),
  searchable city picker, neighborhood picker (list + map view + "use my
  location"), verification simulator (not_started → checking → verified/
  failed, with manual-review and "future feature" affordances).
- **Home** — greeting header, neighborhood switcher, unread badges on
  messages/notifications, Neighborhood Pulse (animated stat counters),
  "Happening Now" carousel, AI-styled-but-deterministic daily summary card,
  Ramadan banner (togglable), live feed with pull-to-refresh/skeletons.
- **Social** — post composer (text/images/category/audience), image
  galleries (1/2/3/4+ layouts) with a fullscreen swipeable viewer, comments
  with reply/edit/delete/like, reactions, save, share, report/block/hide,
  full profile pages with reputation tiers and a thank-your-neighbor flow.
- **Community utility** — 5-step issue reporter, issue detail with a status
  timeline and moderator-only dev controls to advance status, help
  requests ("I can help" → confirmation → chat), polls with animated result
  bars, lost & found.
- **Events** — sectioned events tab (today/week/sports/family/community/
  upcoming) with filter chips, full event detail with join/leave/waitlist/
  cancel, an event-scoped group chat, and a create-event form with a
  lightweight custom date/time picker.
- **Discover** — search bar entry point, quick links to the map and the
  neighborhood assistant, and sectioned previews of events/trending posts/
  issues/services/marketplace/lost & found.
- **Search** — cross-entity mock search (posts/events/people/services/
  marketplace) with tabs, history, and empty states.
- **Map** — a frontend-safe map placeholder (grid + projected pins) with a
  filter sheet, standing in for a real map SDK so the app runs with zero
  credentials; swapping in a real `MapView` only touches one component.
- **Local economy** — marketplace (for sale/free/wanted, saved items),
  listing detail and creation, borrow-from-a-neighbor, business/service
  profiles with community recommendations.
- **Messaging** — inbox with search/filters/unread badges, a DM screen with
  image attachments, a simulated typing indicator + canned auto-reply, read
  receipts, and event group chats.
- **Trust & community** — notification center (grouped Today/Yesterday/
  Earlier, deep links), member directory, community tab with live stats,
  community groups, institution pages (mosque/school/club/center — clearly
  labeled as demo content), neighborhood alerts, and a moderator console
  (reported content, remove/warn/dismiss) gated behind the demo-role
  switcher.
- **Settings** — account, language/theme/notifications/Ramadan-mode,
  privacy (who-can-message, activity visibility, blocked users), app info
  pages, sign-out/delete-account (with confirmation), and a demo-mode panel
  to switch role (resident/moderator/organizer/business) and reset all mock
  data back to its seed state.
- **Localization** — full Arabic/English strings with a manual RTL/LTR
  mirroring system (not just translated text — layouts, icons, and message
  bubbles flip too), and Arabic-tuned typography (Tajawal) alongside Plus
  Jakarta Sans for Latin text.
- **Theming** — light/dark/system modes with a purpose-built dark palette
  (not an inversion), driven entirely through design tokens.

## Architecture

```
app/            Expo Router file-based routes (screens only — thin)
src/
  components/   Design-system primitives (Button, Card, BottomSheet, ...)
  features/     Screen-level building blocks, grouped by domain
  models/       TypeScript types + Zod schemas — the shared contract
  mocks/        Seed data (users, posts, events, issues, ...)
  store/        One Zustand store holding session/settings + all entities,
                persisted to AsyncStorage
  services/     One folder per domain (posts/, events/, issues/, ...),
                each exporting a typed interface + a mock implementation
                that wraps the store behind a small artificial delay
  hooks/        useAsync — loading/refreshing/error wrapper around services
  theme/        Design tokens, typography scale, useTheme()
  i18n/         ar.ts / en.ts dictionaries + useI18n()
  utils/        format/haptics/id helpers
```

**Backend integration point:** every domain has a `Service` interface in
`src/services/<domain>/index.ts` (e.g. `PostService`, `EventService`,
`IssueService`, `MessageService`). Each is currently backed by the local
Zustand store; replacing an implementation with real HTTP/Supabase calls
requires touching only that one file — no screen imports mock data
directly. `src/store/useStore.ts` is the one file that would eventually
shrink to just session/UI-preference state once a real backend owns the
domain data.

## Testing

`npm run test` runs 75 tests across 7 suites:

- `src/utils/__tests__/format.test.ts` — currency/distance/relative-time/
  display-name formatting.
- `src/store/__tests__/useStore.test.ts` — core store logic: creating a
  post, event join/waitlist/leave-promotes-next, poll one-vote-per-user,
  block/unblock, thanking a neighbor, offering help.
- `src/i18n/__tests__/useI18n.test.ts` — locale defaults to Arabic/RTL and
  switches correctly.
- `src/components/__tests__/Button.test.tsx`,
  `StatusTimeline.test.tsx` — component rendering and press handling.
- `src/features/polls/__tests__/PollBlock.test.tsx` — voting flow end to
  end through the store.
- `src/__tests__/routes.test.ts` — walks every file under `app/` and
  asserts it exports a default component, as a lightweight substitute for
  mounting a full navigator (62 routes covered).

`npx expo export --platform web` was also run as a full-bundle sanity
check — every route above compiled and statically rendered successfully.

## Known deviations from a from-scratch build

- **Styling approach:** a StyleSheet + design-token system (`useTheme()`)
  was used instead of NativeWind, for more predictable runtime
  light/dark/RTL control without relying on CSS-variable dark-mode
  semantics.
- **RTL:** mirrored manually via `theme.row()` / `theme.text()` rather than
  `I18nManager.forceRTL`, since the latter needs a full app reload to take
  effect — manual mirroring makes the language switch instant and visible
  in-session, which matters for a demo.
- **Map:** a custom `MapPlaceholder` component instead of a real map SDK,
  since no credentials are available in this environment; it is isolated
  behind one component boundary for an easy swap later.
- **Forms:** React Hook Form + Zod are wired into the two profile forms
  (onboarding profile-setup and settings/edit-profile), which are the ones
  with real shared validation rules. The various single-field composers
  (post/event/issue/listing/poll) intentionally use local `useState`
  instead — pulling in RHF there would add indirection without a
  user-visible benefit.
- **Data fetching:** a small `useAsync` hook (loading/refreshing/error)
  was used instead of TanStack Query, since the "backend" is a synchronous
  in-memory store — a client cache layer isn't solving a real problem here.
  The service-interface boundary is what actually matters for a future
  backend swap, and that's in place regardless of which fetching hook sits
  on top of it.

## Remaining backend work (intentionally out of scope)

Real phone/OTP verification, an actual database (Supabase or otherwise),
row-level security / auth, push notifications, a real map SDK integration,
image upload/storage, and a real LLM-backed assistant/summary service —
all of these are meant to replace the mock `Service` implementations in
`src/services/*`, one folder at a time, without touching any screen.
