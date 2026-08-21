# Privacy Data Map

What Haratna collects, where it lives today, and what changes once a real
backend exists. This describes the current frontend-only build (no real
network calls, no real backend) plus the intended production behavior —
each row says which is which. Values marked **TBD** are genuinely
undecided, not omitted by accident; do not treat this document as a
finished privacy policy — it's the input to writing one.

| Data category | Collected today? | Stored where (today)? | Purpose | Public / private | Retention (today) | Deletion behavior (today) | Third-party processor | Production plan |
|---|---|---|---|---|---|---|---|---|
| Account identity (name, avatar, bio) | Yes (mock) | Device only — Zustand store persisted to `AsyncStorage` | Display identity to neighbors | Public (per user's `namePrivacy` setting: full / first+last-initial / first-only) | Until app uninstalled or "Reset demo data" | "Delete account" resets local demo state only — **not real deletion**, see below | None | Backend account table; real deletion = server-side delete/anonymize per **TBD** retention policy |
| Phone number | Yes (mock, e.g. `+9665xxxxxxxx` entered at onboarding) | Device only, `AsyncStorage` | OTP login only (demo: mock code `123456`) | Private | Same as above | Same as above | None | Real SMS/OTP provider — **TBD** which one; number stored server-side for auth only, never shown to other users |
| Neighborhood membership (region/city/neighborhood id) | Yes (real Saudi geography ids, see README "Saudi Geography") | Device only, `AsyncStorage` | Scope feed/events/issues/marketplace to a neighborhood | Public (shown on profile, posts) | Same as above | Same as above | None | Backend `neighborhood_memberships` table (see `src/types/geography.ts`) |
| Approximate location (chosen city/neighborhood) | Yes | Device only, `AsyncStorage` | Same as above | Public (city/neighborhood level only) | Same as above | Same as above | None | Same |
| Precise device coordinates | **No** — the demo "use my current location" button uses a hardcoded fixed coordinate, not the device's real GPS; no `expo-location` dependency is installed | N/A | N/A | N/A | N/A | N/A | None | If a real implementation ships, precise coordinates must be resolved to a neighborhood server-side and **never stored or shown** as a resident's exact position — see README "Saudi Geography" § location privacy, and item below |
| Post/comment/message location context (event pins, issue pins, "approx distance") | Yes (mock) | Device only, `AsyncStorage` | Show a general area for events/issues on the map placeholder | Public, deliberately approximate (see `MapPlaceholder`, no real GPS pins) | Same as above | Same as above | None | Approximate coordinates only; never a resident's home address/exact GPS |
| Photos (posts, profile avatar, marketplace listings) | Yes, via `expo-image-picker`, requested contextually (only when the user taps "add photo") | Device-local URI only in this build — never uploaded anywhere (no backend) | Attach to posts/listings/profile | Public (whatever the post/listing is) | Local only | Removed if the post/listing is deleted locally | None yet | Real image storage/CDN — **TBD** provider; must strip EXIF/GPS metadata before storage |
| Posts, comments, reactions | Yes (mock) | Device only, `AsyncStorage` | Core social feature | Public within the neighborhood (or city, per post's `audience`) | Same as above | `deletePost`/`deleteComment` remove locally; **TBD** real moderation-log retention | None | Backend `posts`/`comments` tables with real moderation queue |
| Direct messages | Yes (mock) | Device only, `AsyncStorage` | 1:1 and event-group messaging | Private to participants | Same as above | Local only | None | Backend messaging store — **TBD** encryption-at-rest posture, retention |
| Events, issues, marketplace listings, help requests, lost & found | Yes (mock) | Device only, `AsyncStorage` | Core features | Public within neighborhood/city | Same as above | Local only | None | Backend tables per domain; issues in particular may eventually forward to a real municipal reporting integration — **TBD**, not built |
| Reports (report user/post/comment/listing) | Yes (mock) | Device only, `AsyncStorage` | User-generated-content moderation | Private (reporter identity hidden from reported party in UI) | Same as above | Local only | None | Backend moderation queue; **TBD** real enforcement (block/remove) must be server-side, not just client-hidden — see "User-generated content safety" in the architecture notes |
| Blocked / muted user lists | Yes (mock) | Device only, `AsyncStorage` | Let a user hide another user's content from themselves | Private to the blocking user | Same as above | Local only | None | Must become server-enforced (hide content both directions, prevent messaging) — **TBD**, currently client-only |
| Device identifiers | No | N/A | N/A | N/A | N/A | N/A | None | Not currently planned; would need justification + disclosure if ever added |
| Push notification tokens | No — no push notification integration exists yet | N/A | N/A | N/A | N/A | N/A | None | Expo Push / APNs — **TBD**, see "Push notification architecture" in the release checklist; must ship with granular per-category opt-in, not "everything on by default" |
| Analytics / usage tracking | No — no analytics SDK is installed | N/A | N/A | N/A | N/A | N/A | None | If added, prefer privacy-conscious first-party/product analytics; no advertising tracking or cross-app fingerprinting is planned. Flag any future SDK against Apple's App Tracking Transparency requirements before adding it |
| Crash diagnostics | No — no crash-reporting SDK is installed | N/A | N/A | N/A | N/A | N/A | None | **TBD** — evaluate a privacy-respecting crash reporter before a production build ships |

## Notes

- **Nothing described above currently leaves the device.** This build has
  no backend, no network writes of user data, and no third-party SDKs.
  Everything under "Stored where (today)" is `AsyncStorage` on the
  device, wiped by uninstalling the app or tapping Settings → Reset demo
  data (a developer-only control — see `src/config/devFeatures.ts` — not
  present in a production build).
- **"Delete account" is not yet real deletion.** The current UI (Settings
  → Delete Account) resets local demo state and signs out; it does not
  delete anything from a server because there is no server. The service
  interface (`src/services/*`) is structured so a real backend
  implementation can replace this with genuine server-side
  deletion/anonymization without changing the screen — but until that
  lands, do not describe this build's delete-account button as performing
  real data deletion.
- **Location precision is a deliberate architectural choice, not an
  oversight.** The geography layer (`src/types/geography.ts`,
  `GeographyService`) only ever models Region → City → Neighborhood, plus
  an approximate neighborhood centroid for map pins — never a resident's
  home address or exact GPS. See the README "Saudi Geography" section and
  `GeographyService.resolveApproxCityFromCoordinates`'s doc comment for
  why the demo "use my location" affordance is explicitly city-level only.
