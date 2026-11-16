# Haratna Explore: Community & Friends — recovery and review

Branch `recovery/codex-community-friends` (local, not pushed), based on `bf9be21`.
Staging only (`qcinkzciwjmiavptlfxy`). Production, build 13 and the live app are unchanged.

## 1. Recovery

Codex built the feature in a temporary copy without Git, `/private/tmp/haratna-explore.cBCNvf`,
and stopped at its usage limit (2026-11-16 19:58, local time) without committing anything.

| Commit | Content |
|---|---|
| `cf5d013` | The credential-isolation patch approved for and used by staging build 14 (sha256 `6cddd511…a8ad1b`), byte-identical to Codex's base |
| `915a814` | Codex's feature work, recovered unchanged (17 files) |
| `ef14439` and the report commit | Review fixes, tests, evidence (this document) |

A full snapshot of Codex's copies, logs and transcript is in `~/Downloads/haratna-codex-recovery-20261116`
(mode 700, not in Git). It includes the local anon key of the Docker test stack, so it must stay local.

## 2. What the feature does

- **Explore tab (staging variant only).** `stagingExploreEnabled` is true only when
  `extra.appVariant === 'staging'`. Production builds keep the previous Discover screen, which moved
  unchanged to `ExploreDirectory` and is also reachable from the grid icon at `/explore/directory`.
- **Two feeds with a switcher and horizontal paging.** The page order follows RTL. Each feed has
  pull-to-refresh, pagination (16 per page), loading, empty and error-with-retry states.
- **`public.explore_social_feed(feed, page_offset, search_text)`.** `security invoker`, so every
  table's RLS applies. It is granted to authenticated users only.
  - **Community:** verified viewer; posts from the viewer's neighborhood, plus *public* posts within
    25 km in the same city; last 90 days; no private accounts (other than the viewer's own); no
    followers-only posts.
  - **Ranking:** local first, then freshness plus an engagement boost capped at 24 h.
  - **Friends:** accepted follows only, newest first.
  - **Both feeds:** exclude blocks in either direction and deleted posts. No `location_label`,
    coordinates or address fields are returned.
- **Photos in the feed** are downloaded through authenticated Storage requests (RLS checked on each
  request) and shown as in-memory data URIs. No shareable signed URL is created, and nothing is
  written to the disk cache.
- **Notifications (staging variant).** They are reloaded from the server, and a new restrictive RLS
  policy hides notifications from blocked actors or about posts the viewer can no longer see.
  Previews of post notifications are hidden.
- **Search and post detail (staging variant).** Results and posts are rechecked on the server
  before they are shown.

## 3. Review findings and fixes

| # | Finding | Status |
|---|---|---|
| 1 | Codex's last privacy test failed ("local before nearby"). The cause was the test fixture: it used a seed neighborhood with no coordinates, so nothing could be nearby. The feed was correct. | Fixed: the test creates its own area with a center |
| 2 | The notification policy compared `'/post/' \|\| p.id` against every post for each notification row, a full scan. | Fixed: exact UUID match, strict pattern |
| 3 | Comment counts included blocked users (reactions already excluded them). | Fixed |
| 4 | Missing tests: far neighborhoods, nearby private accounts, notifications of deleted posts. The suite also left data behind. | Added; the suite now rolls itself back |
| 5 | No rollback file. | Added `supabase/rollbacks/20261116163254_explore_social_feed.sql` |

## 4. Test results

- **SQL, hosted staging:** all 16 suites pass. Explore has 14 checks; the 15 existing suites show no regressions.
- **SQL, local Docker stack:** Explore passes 14/14. Five older suites fail there both with and without
  Explore, because that local database lacks later migrations. They pass on staging.
- **Client:** Jest 452/452, `tsc` clean, ESLint 0 errors (6 existing warnings).
- **API, as a synthetic viewer** (Auth plus PostgREST, `demo_check.py`):
  - Community returns local posts, then nearby ones. The private-account and blocked-user posts are absent.
  - Friends returns exactly the three followed posts.
  - No location fields are returned. An anonymous call gets 401.
- **Bundle built for the Simulator:**
  - only the staging host and the staging anon JWT;
  - no production URL or production key;
  - no service key.
- **iOS Simulator, XCUITest walkthrough** (`RcExplore.swift`), Arabic and English: **both passed**.
  The walkthrough covers Community, scrolling to the nearby post, Friends, swiping back, pull to
  refresh, and post detail with comments. It also asserts that private and blocked posts never appear.
  Screenshots are in `docs/social-validation/explore/`.

## 5. Remaining issues before a staging build

1. **Authors from other neighborhoods show as "Neighbor" / "جار".** This applies to nearby
   Community posts. Their profile isn't in the local store, so the card falls back to the generic
   label. It is privacy-conservative but poor UX. Decision needed: return a display name from the
   feed (profile RLS already allows it for public authors), or keep it.
2. **English screen title is "Discover" while the tab is labeled "Explore".** This is an existing
   string, not new.
3. **Offset pagination.** New posts arriving while scrolling can shift pages. Duplicates are removed
   on the client, but a post can be skipped until the next refresh.
4. **Photos are fetched as base64 data URIs.** That is safe (nothing reusable is cached), but uses
   more memory than file URLs. Acceptable for private testing; measure before production.
5. **Neighborhoods without a center coordinate get local posts only.** Staging has 3,732
   neighborhoods with centers.
6. **Changes that also reach production code paths** (low risk; review them):
   - `PhotoCarousel` keys are index-based.
   - `fetchPost` drops a result if the account switched during the request.
   - `imageCachePolicy` returns `none` for data URIs.
   - `PostCard` has new optional props.
7. **Test data on staging.** Older posts from the test matrix show empty photo frames (placeholder
   bytes, data only). The synthetic demo accounts (`demo-*@example.test`) remain on staging until
   `demo_seed.py cleanup` is run.

## 6. Staging changes made

- **Migration `20261116163254_explore_social_feed`** applied to staging only, through the guarded
  wrapper (staging marker, previous version present, not already applied).
  Rollback: `staging-work/sql/drill/rb_20261116163254.sql`.
- **Seven synthetic demo accounts and seven posts** (`demo-*@example.test`), with one follow pair,
  one private account and one block. The owner's own TestFlight account on staging was not read
  beyond its id and creation time, and was not touched.
