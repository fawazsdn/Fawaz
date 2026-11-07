# Haratna website (حارتنا)

The official website and support portal for the Haratna app: Arabic first, English second, built with Next.js (App Router), TypeScript and Tailwind CSS. It lives in `web/` next to the Expo app and has its own dependencies.

## Pages

| Arabic               | English              | Purpose                                                   |
| -------------------- | -------------------- | --------------------------------------------------------- |
| `/ar`                | `/en`                | Home                                                      |
| `/ar/support`        | `/en/support`        | Support center: help topics, searchable FAQ, contact form |
| `/ar/faq`            | `/en/faq`            | FAQ by category (with FAQPage structured data)            |
| `/ar/contact`        | `/en/contact`        | Contact: support, privacy requests, general inquiries     |
| `/ar/privacy`        | `/en/privacy`        | Privacy policy                                            |
| `/ar/terms`          | `/en/terms`          | Terms of service                                          |
| `/ar/guidelines`     | `/en/guidelines`     | Community guidelines                                      |
| `/ar/delete-account` | `/en/delete-account` | Account deletion instructions                             |

Short root URLs redirect to the Arabic page: `/`, `/support`, `/privacy`, `/terms`, `/guidelines`, `/delete-account`, `/contact` and `/faq`.

The legal text is the same text the app shows. `scripts/sync-content.mjs` copies `../src/content/legal.json` and `legal-config.json` into `src/content/shared/` before every `dev` and `build`. Edit the app's copy, never the synced one.

## How the support form works

1. The browser validates the form (`src/lib/validation.ts`).
2. `POST /api/support` checks, in order:
   - the request comes from the same origin
   - the body size
   - a honeypot field and a minimum fill time (3 seconds)
   - a per-network rate limit: 5 requests per 10 minutes, keyed by a hash of the IP address; raw IP addresses are never stored
   - the same validation again
3. It then calls the Supabase function `submit_public_support_request()` with the **publishable** key, server-side.
4. That database function validates again and enforces its own limits: 3 per email per hour, 10 per email per day, 200 website tickets per hour in total. It stores the ticket in `support_requests` (`source = 'website'`), notifies Haratna admins and moderators in the app, and returns a reference such as `HR-1A2B3C4D`.
5. Staff see website tickets in the app (Settings → Support requests), with the sender's email. They reply by email, then record the reply there.
6. Optional: set the `RESEND_*` variables to also email each ticket to the support inbox.

Anonymous visitors cannot read any ticket back. The database function and its RLS behaviour are covered by `../supabase/tests/public_support.sql`. If the database cannot be reached, the visitor sees an error saying the request was **not** saved, with the in-app alternative. Nothing is dropped silently.

Attachments are intentionally not supported. Anonymous uploads would need a public write path to storage, which is an abuse risk. Users who need to send a screenshot can use the in-app support form.

## Environment variables

See `.env.example`.

| Variable                                                     | Required   | Notes                                                                                                                                                                                       |
| ------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`                                               | yes        | `https://ckqwziutmqohihrenstz.supabase.co`                                                                                                                                                  |
| `SUPABASE_PUBLISHABLE_KEY`                                   | yes        | The `sb_publishable_…` key from Supabase → API keys. Never a service-role or secret key.                                                                                                    |
| `NEXT_PUBLIC_SITE_URL`                                       | for launch | e.g. `https://<your-domain>`. Until it is set **and** `src/content/legal-config.json` is complete, every page shows a pre-launch banner and `noindex`, and `robots.txt` disallows crawling. |
| `RESEND_API_KEY`, `SUPPORT_NOTIFY_FROM`, `SUPPORT_NOTIFY_TO` | optional   | Email copy of each ticket to the support inbox.                                                                                                                                             |

## Commands

```sh
npm install
npm run dev          # http://localhost:3000
npm run lint
npm run typecheck    # run `npx next typegen` once first on a fresh checkout
npm test             # unit tests (validation, rate limiter)
npm run build
npm run e2e          # Playwright against the production build: pages, RTL/LTR, redirects, links, form validation, API hardening, headers, SEO, axe
E2E_LIVE=1 npx playwright test e2e/delivery.spec.ts   # files ONE real ticket through the form (labelled as a test)
```

## Deploying on Vercel

1. Create a new Vercel project from the GitHub repository `fawazsdn/Fawaz`:
   - set **Root Directory** to `web`
   - framework: Next.js
   - leave the build and install commands at their defaults
   - keep "Include files outside the root directory" on, so the legal text syncs from `../src/content` (if it is off, the committed copies are used)
2. Add the environment variables above for Production and Preview.
3. Deploy a preview and check the pages, the language switch and one real support request.
4. Production: add your domain under Settings → Domains, set `NEXT_PUBLIC_SITE_URL`, fill `src/content/legal-config.json`, then redeploy.

The site sets these security headers:

- CSP (same-origin only)
- HSTS
- `X-Frame-Options: DENY`
- `nosniff`
- `Referrer-Policy`
- `Permissions-Policy`

It sets no cookies and loads no third-party scripts, fonts or analytics. Fonts (Tajawal and Plus Jakarta Sans, SIL Open Font License) are self-hosted from `src/fonts/`.

## App Store Connect URLs (once the domain is live)

| Field                             | URL                               |
| --------------------------------- | --------------------------------- |
| Support URL                       | `https://<domain>/support`        |
| Privacy Policy URL                | `https://<domain>/privacy`        |
| Marketing URL (optional)          | `https://<domain>/`               |
| Account deletion (reviewer notes) | `https://<domain>/delete-account` |

## Brand note

The app's current icon (`../assets/icon.png`) is Expo's default template icon, not a Haratna logo. The website therefore uses an interim mark: «ح» on brand green with a Najdi crenellation in gold (`public/brand`, `src/app/icon.png`, `public/og`). Replace these, and the app icon, once the official logo is ready.

## Admin dashboard (`/admin`)

A private support console for Haratna staff: overview statistics, the support request inbox (website and app), ticket details with replies, customers (grouped from tickets only), analytics and settings. It is Arabic-first with English, and works on desktop and mobile.

### Who can sign in

- Only accounts whose `profiles.app_role` is `admin` or `moderator` (and not deleted). These are the same rules the database uses in `private.is_admin_or_moderator()`.
- Sign-in is a one-time email link (or 6-digit code) sent through Supabase Auth with `shouldCreateUser: false`, so it works for the existing Apple-linked admin account, which has no password. It never creates accounts or grants roles, and it answers the same way whether or not an address exists.
- After sign-in the role is checked on the server. Non-staff sessions are signed out immediately.
- To check your account, run this in the Supabase SQL editor:
  `select p.app_role, p.deleted_at from public.profiles p join auth.users u on u.id = p.id where u.email = '<your email>';`
  It must return `admin` (or `moderator`) and `deleted_at` null.

### Security model

- **Session:** cookies are `httpOnly`, `Secure`, `SameSite=Lax` and scoped to `Path=/admin`. Page scripts never see a token.
- **Authorization:** `src/proxy.ts` refreshes the session and redirects signed-out visitors. Every page, server action and API route then re-checks the role (`src/lib/admin/session.ts`). Every database function checks it again and returns `not_authorized` otherwise. Only the publishable key is used; there is no service-role key.
- **CSRF:** server actions reject cross-origin POSTs, and cookies are SameSite.
- **XSS:** React escapes all output, and email HTML is escaped.
- **Rate limits:** sign-in (per IP and per email), replies, emails and status changes.
- **Not cached or indexed:** admin pages send `no-store`, `noindex` and `no-referrer`.
- **Open-request badge:** it polls a staff-only count endpoint every 30 seconds instead of using Supabase Realtime, so no access token or ticket data is exposed to browser scripts.

### Email replies (Resend)

- Replying to a website ticket saves the response, then emails it, including the reference number, in the ticket's language.
- **One send per reply:** a database claim (`claim_support_reply_email`) allows only one send at a time and refuses to re-send a reply the provider already accepted. An `Idempotency-Key` stops Resend from sending twice if a request is retried. Temporary errors (429/5xx/network) are retried automatically. Failures are stored with the provider's error and can be retried from the ticket.
- **Honest status:** "Accepted by email provider" means Resend accepted the message. "Delivered" is shown only after **Check delivery status** reads `last_event = delivered` from Resend.
- **App tickets** keep the existing in-app notification (`respond_support_request`).

### Required configuration

| Where                                                         | What                                                                                                                                                                                                                       |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel → Environment Variables                                | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (already used by the site), `RESEND_API_KEY`, `SUPPORT_REPLY_FROM` (a verified Resend domain), optional `SUPPORT_REPLY_TO`, and `NEXT_PUBLIC_SITE_URL=https://www.haratna.live` |
| Supabase → Authentication → URL Configuration → Redirect URLs | add `https://www.haratna.live/admin/auth/callback` (plus the preview URL pattern if you sign in on previews)                                                                                                               |
| Supabase → Authentication → Emails                            | Magic Link template: keep `{{ .ConfirmationURL }}`; optionally add `{{ .Token }}` to also show the 6-digit code                                                                                                            |
| Resend                                                        | verify the sending domain (`haratna.live`)                                                                                                                                                                                 |

### Tests

- `npm run e2e:admin`: 18 browser tests that run the production build against a local stub of Supabase and Resend (`e2e/admin/stub-server.mjs`). They cover sign-in (PKCE), refusal of non-staff accounts, cookie flags, rate limits, filters, replies, email failure and retry without duplicates, delivery status, status changes, customers, analytics, settings, Arabic/English and mobile layout.
- `../supabase/tests/admin_support.sql`: the real database functions, run against Supabase (rolled back).
- `npm test`: unit tests for email rendering and escaping, retries, idempotency and filter validation.
