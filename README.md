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
npm run test       # jest (102 tests)
npm run validate:geography  # structural checks on the Saudi geography dataset
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

## Saudi Geography

The onboarding location picker (Region → City → Neighborhood) is backed by
a real, sourced national geography dataset — not a small hand-curated
sample.

**Source:** [`homaily/Saudi-Arabia-Regions-Cities-and-Districts`](https://github.com/homaily/Saudi-Arabia-Regions-Cities-and-Districts)
(GPL-2.0 licensed), which republishes public data collected from
[maps.address.gov.sa](https://maps.address.gov.sa/) — Saudi Arabia's
official National Address / Saudi Post geospatial platform. The repo's own
description claims full national coverage (13 regions, 4,581 cities, 3,732
districts).

> **License note:** the source repository is GPL-2.0. This project vendors
> its data (not its code) into `src/data/saudi/*.json` via
> `scripts/import-saudi-geography.mjs`, which is a normalizing transform,
> not a derivative of the source's own code. If this project is ever
> distributed commercially, this data dependency and its license should be
> reviewed by whoever owns that decision — it is called out here rather
> than silently assumed to be a non-issue.

**Coverage as imported:** 13 regions, 4,581 cities/governorates, 3,732
neighborhoods/districts — every one carrying `source`, `sourceId`, and a
computed centroid for traceability (see `src/types/geography.ts`). 152 of
the 4,581 cities have district-level (neighborhood) data on record; the
rest are city-level only, which the onboarding flow handles via a
"continue with city only" fallback rather than fabricating districts that
aren't in the source. **Broad Saudi coverage is implemented; complete
national coverage could not be independently verified** — the upstream
repo claims completeness, but this project has not cross-checked it
against a second authoritative source.

**Re-importing:** `npm run import:geography` re-fetches and re-normalizes
the three source files, validates referential integrity, strips district
boundary polygons (kept as a computed centroid + a `hasBoundary` flag —
see the script for why), and rewrites `src/data/saudi/*.json`. It aborts
without writing anything if validation fails. `npm run validate:geography`
re-checks the currently-committed data for duplicate ids, orphan
references, and missing names at any time.

**Architecture:** `src/services/geography/GeographyService.ts` is the one
interface every screen reads location data through (`MockGeographyService`
today, swappable for a real API later without touching a screen). See
`src/types/geography.ts` for how the models map onto a future backend's
`regions` / `cities` / `neighborhoods` / `neighborhood_boundaries` /
`neighborhood_memberships` tables.

**Search:** `src/utils/searchNormalize.ts` normalizes Arabic alef variants
(أ/إ/آ → ا), taa marbuta/haa (ة/ه), alef maksura/yaa (ى/ي), diacritics,
punctuation, and case/whitespace — for comparison only. Official names are
always displayed exactly as sourced; normalization never touches what's
rendered.

**Performance:** `MockGeographyService` builds a flat, pre-normalized
search index once, lazily, on first use (not at import time, not
per-render) and reuses it for every subsequent `search()` call; results
are capped by a `limit` (default 50). Region/city/neighborhood lookups use
memoized `Map`-based indices rather than scanning the full arrays.

**Backend integration point:** every domain has a `Service` interface in
`src/services/<domain>/index.ts` (e.g. `PostService`, `EventService`,
`IssueService`, `MessageService`). Each is currently backed by the local
Zustand store; replacing an implementation with real HTTP/Supabase calls
requires touching only that one file — no screen imports mock data
directly. `src/store/useStore.ts` is the one file that would eventually
shrink to just session/UI-preference state once a real backend owns the
domain data.

## Testing

`npm run test` runs 102 tests across 10 suites:

- `src/utils/__tests__/format.test.ts` — currency/distance/relative-time/
  display-name formatting.
- `src/store/__tests__/useStore.test.ts` — core store logic: creating a
  post, event join/waitlist/leave-promotes-next, poll one-vote-per-user,
  block/unblock, thanking a neighbor, offering help.
- `src/store/__tests__/geographySession.test.ts` — onboarding location
  session state: switching cities clears a stale neighborhood selection
  (invalid-state guard), recent-city tracking, neighborhood suggestions
  are stored locally without becoming official locations.
- `src/i18n/__tests__/useI18n.test.ts` — locale defaults to Arabic/RTL and
  switches correctly.
- `src/components/__tests__/Button.test.tsx`,
  `StatusTimeline.test.tsx` — component rendering and press handling.
- `src/features/polls/__tests__/PollBlock.test.tsx` — voting flow end to
  end through the store.
- `src/services/geography/__tests__/geography.test.ts` — hierarchy
  validity (no orphan cities/neighborhoods, no duplicate ids, every
  neighborhood's region matches its city's region), Arabic/English/
  spelling-variant search, city and region filtering, Eastern Province +
  Khobar neighborhood coverage, popular-city resolution, and a search
  performance sanity check (200 searches over the full ~8,300-record
  dataset stays well under a second, proving the search index is
  memoized rather than rebuilt or rescanned per call).
- `src/__tests__/selectLocationFlow.test.tsx` — UI test of the Region →
  City → Neighborhood → Continue onboarding flow, plus jumping straight
  to a neighborhood from national search.
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
