# Haratna Explore: Community & Friends — recovery and review

Branch `recovery/codex-community-friends`, a backup branch based on `bf9be21`. Not merged.
Staging only (`qcinkzciwjmiavptlfxy`). Production, build 13 and the live app are unchanged;
no production migration was applied, and build 15 has not been started.

## 1. Recovery

Codex built the feature in a temporary copy without Git, `/private/tmp/haratna-explore.cBCNvf`,
and stopped at its usage limit (2026-11-16 19:58, local time) without committing anything.

| Commit | Content |
|---|---|
| `cf5d013` | The credential-isolation patch approved for and used by staging build 14 (sha256 `6cddd511…a8ad1b`), byte-identical to Codex's base |
| `915a814` | Codex's feature work, recovered unchanged (17 files) |
| `ef14439`, `3c1623e` | Round 1: test-fixture fix, notification and comment checks, first report |
| `254c786`, `123e4a4` and the report commit | Round 2: the owner's decisions (section 3) |

A full snapshot of Codex's copies, logs and transcript is kept **outside Git** in
`~/Downloads/haratna-codex-recovery-20261116` (mode 700). It includes the local anon key of the
Docker test stack and Codex's logs, so it must never be pushed.

## 2. What the feature does

- **Explore tab (staging variant only).** `stagingExploreEnabled` is true only when
  `extra.appVariant === 'staging'`. Production builds keep the previous screen, now
  `ExploreDirectory`, which is also reachable from the grid icon at `/explore/directory`.
- **Two feeds with a switcher and horizontal paging.** The page order follows RTL. Each feed has
  pull-to-refresh, cursor pagination, and loading, empty and error-with-retry states.
- **`public.explore_social_feed(feed, cursor, search_text)`.** `security invoker`, so every table's
  RLS applies. It is granted to authenticated users only.
  - **Community:** verified viewer; posts from the viewer's neighborhood, plus *public* posts within
    25 km in the same city; last 90 days; no private accounts (other than the viewer's own); no
    followers-only posts.
  - **Ranking:** local first, then freshness plus an engagement boost capped at 24 h.
  - **Friends:** accepted follows only, newest first.
  - **Both feeds:** exclude blocks in either direction and deleted posts.
  - **Each row** carries the author's display fields and the neighborhood name. No address,
    `location_label` or coordinates are returned.
- **Notifications, search and post detail (staging variant).** They are rechecked on the server. A
  restrictive RLS policy hides notifications from blocked actors and about posts the viewer can no
  longer see.

## 3. Owner decisions (2026-11-16) and how they were implemented

| # | Decision | Implementation | Evidence |
|---|---|---|---|
| 1 | Show public names and photos where privacy allows | Rows include `author` from the caller's **RLS-visible** profile row. The last name is masked by the author's own `name_privacy`, using the existing `private.masked_last_name`. `avatar_path` is included only when the existing `private.can_view_profile_photo` allows it. Profile photos are downloaded through Storage RLS into memory, with no signed URL. Post detail uses the existing `social_profile` RPC, which applies the same masking and gates. | SQL check "masked author"; API checks: nearby author `Reem H.` with photo, display fields only, private account's photo path hidden and its file refused to a non-follower (HTTP 400); screenshots |
| 2 | English navigation says "Explore" | `discover.title` changed from "Discover" to "Explore", matching the tab. "Discover Neighbors" is a separate feature for finding neighbors and is unchanged. | Screenshots `en-*` |
| 3 | Stop pagination from skipping posts | Keyset cursor instead of an offset. The first page fixes a snapshot (`as_of`). Later pages pass the last row's `feed_cursor`. Posts created after the snapshot are excluded, and likes and comments are counted only up to it, so a rank can't move above the cursor. | SQL: 20-post, two-page walk while new posts and likes arrive between pages returns exactly the 20, in order. A mutation test (likes not frozen) makes the suite fail, so the check is meaningful. |
| 4 | Lower photo memory, no persistent cache | Photos load only for cards on or next to the screen, and only the visible carousel photo and its neighbors. They're released when the card moves away. Placeholders keep the card height, so scrolling doesn't jump. The list keeps few rows mounted (`windowSize` 5). Photos remain memory-only data URIs (cache policy `none`) fetched through Storage RLS. | 4 component tests (`ExplorePostCard.test.tsx`): load window, release on swipe, release off-screen, nothing loaded far away. Memory was not profiled numerically on a device (staging has few photos). |
| 5 | Review shared production code paths | Section 6 | — |
| 6 | Keep the owner's staging account; narrow, auditable allowance | `staging_kit.py` accepts `STAGING_ALLOWED_ACCOUNTS`: a 0600 file outside Git with at most 3 entries. Each entry needs `id`, exact Auth `created_at`, `reason`, `approved_by` and `approved_on`. Admin calls naming an allowed account are refused. Each use is appended to `<STATE>/allowance-audit.log`, with counts and reasons only. The demo seeder's ad-hoc allowance was removed; it now uses this guard. | Guard tests: no allowance → STOP; wrong `created_at` → STOP; exact allowance → OK, "1 allowed real account left untouched" |
| 7 | Keep demo accounts for now; prepare removal | `demo_seed.py cleanup-dry-run` lists exactly the 7 demo accounts. `cleanup` deletes only accounts in the demo tool's own state, and never an allowed account. | Dry run: "would delete 7 demo accounts: faisal, huda, khalid, majed, noura, reem, sara" |
| 8 | Recovery backup stays outside Git | See section 1. The secret scan covers every commit on the branch. | Section 5 |

## 4. Test results (round 2)

- **SQL, hosted staging:** all 16 suites pass. Explore has **17 checks**:
  - local before nearby; keyset pagination; 20-post multi-page walk; masked author;
  - nearby audience; far neighborhood; nearby private account; no profile exposure; search;
  - deleted posts; pending, accepted and private follows; blocks;
  - notification RLS (block, deleted post); unverified viewer; anonymous caller.

  The 15 existing suites show no regressions. One existing check in `social_resilience` ("preview
  count") began failing during this round because of time, not code: it expected zero photo records
  in `deleting`, but its own global claim calls also pick up any real staging photo that has passed
  the 24-hour grace, and two photos from the previous day's test matrix had just crossed it. Proven
  by rerunning with those two deletions moved back inside the grace (rolled back): PASS. The check
  now compares the preview with the actual number of `deleting` records, which is what it means to
  verify.
- **API on staging, as a synthetic viewer** (`demo_check.py`): 15/15 PASS.
- **Client:** TypeScript clean, ESLint 0 errors (6 warnings, all in untouched files), Jest 458/458.
- **Bundle built for the Simulator:**
  - staging host only; the one embedded JWT is the staging anon key;
  - no production URL, production key or service key.

  The bare production ref appears once, as the guard constant.
- **iOS Simulator, XCUITest walkthrough** (`RcExplore.swift`), Arabic and English: see section 7.

## 5. Security results

- **Secret scan of every commit on the branch** (`bf9be21..HEAD`, added lines and new files) checked:
  - the actual staging service key, the local test key, all synthetic passwords, the owner's account
    id and the App Store Connect key ID;
  - every embedded JWT, decoded;
  - private-key blocks and common token formats;
  - signing, env and log file types;
  - real email addresses.

  **Result: PASS.** The only JWT is the production *anon* key that `bf9be21` already contained (it
  is public by design and protected by RLS); the approved isolation patch moved it into its own
  file. 12 PNG screenshots of synthetic data only.
- **Privacy rules exercised:** private accounts, followers-only audience, pending vs accepted
  follows, blocks in both directions, deleted posts, unverified viewers, anonymous callers, far
  neighborhoods, name masking, photo-path gating, Storage refusal of a private photo, no location
  fields.

## 6. Changes that reach shared (production) code paths

Everything else is behind `stagingExploreEnabled` or used only by the staging feed.

| File | Change | Production impact |
|---|---|---|
| `src/i18n/en.ts` | `discover.title` "Discover" → "Explore" | **Visible** in the next production build: the English Explore screen title matches the tab (owner decision 2) |
| `app/(tabs)/discover.tsx` → `ExploreDirectory.tsx` | Old screen moved unchanged; wrapped in a full-size `View` | None visible: same content, same background |
| `app/explore/directory.tsx` | New route | Exists in production but nothing links to it there |
| `src/features/feed/PostCard.tsx` | Optional discovery props; `run(...)` calls go through `update(...)`, which also calls `onChanged` when given | None: without the props, output and actions are identical |
| `src/features/social/PhotoCarousel.tsx` | Optional `onIndexChange`; empty-string placeholders; the viewer skips placeholders; data URIs keyed by index | None for URLs: keys, rendering and viewer are as before |
| `src/backend/social.ts` `fetchPost` | Optional `resolvePhotos`; drops the result if the account switched during the request | Slightly safer: a post fetched for a previous account is never shown to the next |
| `src/backend/mediaPrivacy.ts` | `data:` images use cache policy `none` | Production never shows data URIs |
| `src/lib/supabase.ts`, `metro.config.js`, `*PublishableKey.ts` | Approved build-14 isolation patch | Production resolves the same production key; only `APP_VARIANT=staging` swaps it |
| Migration `20261116163254` | New function and a restrictive notifications policy | **Not applied to production.** If approved later, notifications about deleted or no-longer-visible posts, or from blocked users, would disappear for all users |

## 7. iOS Simulator walkthrough (round 2)

Hosted staging, synthetic viewer, app built from this branch. Screenshots are in
`docs/social-validation/explore/` (`ar-01…06`, `en-01…06`):
1. Community;
2. scrolled to the nearby post: author name, photo and area;
3. Friends;
4. swiped back;
5. pull to refresh;
6. post detail with comments.

The test asserts that the private-account and blocked-user posts never appear, that the nearby
author shows as "Reem H." (not "Neighbor"), and that comments load.

**Result: both runs passed** (Arabic 259 s, English 267 s). In each run:
- Community was selected first; the nearby post was found;
- the nearby author was named "Reem H.", and the generic "Neighbor" label was absent;
- swiping returned to Community; post detail showed the comment.

The screenshots also show profile photos for Noura, Khalid, Reem and Faisal, area names for the
nearby (Ad Danah Al Janubiyah) and Riyadh (Al Amal) posts, the English title "Explore", and
right-to-left tab order in Arabic.

## 8. Remaining items

1. **Old test-matrix posts on staging show empty photo frames** (placeholder bytes; data only).
2. **Neighborhoods without a center coordinate get local posts only.** Staging has 3,732
   neighborhoods with centers.
3. **Memory has not been profiled on a physical device.** Do this during build-15 testing, by
   scrolling a feed with many photos.
4. **The Explore migration is on staging only.** A production rollout needs separate approval.
5. **Synthetic demo accounts stay until final visual testing.** Remove them with
   `demo_seed.py cleanup` (dry run first) before any broader release.

## 9. Staging changes made

- **Migration `20261116163254_explore_social_feed`:** applied and then replaced by the round-2
  version, on staging only, through the guarded wrappers (staging DB marker, expected prior state).
  Rollback: `staging-work/sql/drill/rb_20261116163254.sql`.
- **Synthetic demo data:** 7 accounts (`demo-*@example.test`), 7 posts, 5 synthetic profile photos,
  one follow pair, one private account and one block.
- **The owner's account was not modified.** Its id and exact creation time are stored only in the
  0600 allowance file outside Git.
