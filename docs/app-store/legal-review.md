# Privacy policy and legal documents — status

The privacy policy, terms of use, community guidelines and account-deletion
pages (Arabic and English) are in `src/content/legal.json`. The app
(Settings → Privacy, Terms, Community Guidelines) and the website
(`node scripts/build-website.mjs`) both render from that file, so the two
always match.

**Status: DRAFT. Needs legal review before launch.** The policy was written
from Haratna's actual data flows and was prepared with the Saudi Personal
Data Protection Law (PDPL) in mind. It **does not claim** PDPL compliance,
SDAIA registration or any certification. A qualified Saudi lawyer should
review it.

## Owner values to fill in `src/content/legal-config.json`

Until these are filled, the app shows "in-app support" wording and the
website shows a red DRAFT banner with `noindex`.

| Key                         | What                                                       | Example format (not a real value)           |
| --------------------------- | ---------------------------------------------------------- | ------------------------------------------- |
| `operatorEn` / `operatorAr` | Legal entity that operates Haratna (controller under PDPL) | "<Company name> (CR <number>)"              |
| `supportEmail`              | Public support/privacy email (not a personal inbox)        | support@<your domain>                       |
| `dataRegion`                | Supabase project region                                    | Check Supabase → Project Settings → General |
| `emailProvider`             | SMTP provider used for auth emails                         | Your SMTP provider's name                   |
| `backupRetention`           | How long backups keep deleted data                         | Per your Supabase plan's backup retention   |
| `websiteBaseUrl`            | Public website origin                                      | https://<your domain>                       |

Then run `node scripts/build-website.mjs`, rebuild the app, and update the
App Store Connect URLs.

## Questions for counsel

1. **Cross-border transfer:** if the Supabase region is outside the Kingdom,
   PDPL transfer rules and their implementing regulation apply. Confirm the
   legal basis and the wording.
2. **Controller registration:** whether Haratna must register with SDAIA's
   national data governance platform, or appoint a DPO.
3. **Legal bases:** contract performance for core features; consent for
   optional location verification and discovery. Confirm.
4. **Age:** minimum age for accounts, and whether 16+ (recommended) is the
   right store rating. The date of birth is self-declared.
5. **Retention periods** after account deletion: reports and moderation
   records are kept for safety. Confirm the duration.
6. **Breach notification** wording and the 72-hour SDAIA timeline.
7. **Marketplace liability:** the terms say Haratna is not a party to
   sales. Confirm.
8. **Address dataset licence** for the neighborhood boundaries.
9. **Governing law and dispute venue** in the terms (currently general).
