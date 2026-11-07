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
