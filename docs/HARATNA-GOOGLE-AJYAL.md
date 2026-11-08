# Haratna Google and Ajyal readiness

Build 10 remains the owner-tested baseline. This feature branch is based on PR #3.

## Cloud configuration

Google Cloud project `haratna-production` lists the active Haratna Supabase OAuth web client and the earlier unused client. Keep the active client and its existing Supabase callback. The prior OAuth audience audit found Testing with the project owner listed. The live Supabase provider previously redirected to Google using `https://ckqwziutmqohihrenstz.supabase.co/auth/v1/callback`. Haratna uses `haratna://auth/callback` for the return from Supabase. The current candidate explicitly requests openid, email, and profile and tests callback validation and cancellation locally. Before publishing the consent screen, confirm branding, support contact, authorized domains, privacy policy URL and Google verification status. Public use requires a separate consent publication decision.

## Mapping decision

On November 8, 2026 the owner withdrew approval for the Google Maps Platform pilot. The Google Cloud billing and enabled-service pages confirm there is no linked billing account and neither Maps SDK for iOS nor Places API (New) is enabled. The feature branch removes the conditional native Google provider, iOS key configuration, and disabled Places research endpoint. The existing native map uses Apple Maps on iOS, retaining neighborhood boundaries, pins, filters, location controls, previews, clustering, and Apple Maps directions. The `react-native-maps` dependency remains in use.

Google Sign-In is separate. Continue testing the Supabase OAuth flow before exposing its button in a TestFlight candidate.

## Independent Ajyal coverage

Reviewed November 8, 2026. Thirteen supplied candidates were tracked, with three existing verified entries and ten pending. No new publication. A separate outside-Ajyal pharmacy search result was excluded. No closure was confirmed. Ajyal Mall was added as a separate research lead.

| Candidates | Status | Evidence or missing evidence |
| --- | --- | --- |
| Domino’s, Knock Café, Soma Grape Leaves | Existing verified directory entries | Merchant sources in the existing migration. Domino’s has a boundary-checked pin. Coordinates for Knock and Soma remain unset. |
| Tamimi Markets | Pending | The [Ajyal neighborhood council](https://ajyalcouncil.org.sa/أسواق-التميمي-تفتتح-فرعاً-جديداً-بحي-أ/) confirms an opening on Jeddah Street. Verify current operation and an authoritative branch coordinate. |
| Razeen | Pending | The [operator](https://razeen.sa/razeen-al-dhahran-2/) confirms a commercial complex in Ajyal, and [Enjoy Ajyal](https://www.enjoyajyal.org/) documents recent events there. Verify the pin and distinguish the venue from its tenants. |
| 7 Grams, UMQ Coffee, Swip Truck, Krab, 8oz Coffee, Specialty Bean, أسواق بيت الغذاء الراقي, تباريك | Pending | Current authoritative branch evidence, operating status and boundary-checked coordinates are incomplete. |
| Ajyal Mall | Pending | The [Ajyal neighborhood council](https://ajyalcouncil.org.sa/أجيال-مول-قريباً-في-حي-أجيال/) describes a planned opening. Current opening and an authoritative coordinate are unconfirmed. |
| Nahdi pharmacy in Doha Al Janubiyah | Excluded from Ajyal | The [branch location lead](https://www.waze.com/ar/live-map/directions/sa/almntqh-alshrqyh/alzhran/sydlyh-alnhda?to=place.ChIJ3778aqDnST4RKywGliL1PVA) identifies a different neighborhood. |

Production publication and schema changes need separate authorization. The feature branch preserves the existing verification and staff claim workflows. Use merchant sources, permitted public sources, and community submissions. Record an evidence URL and date, confirm the branch is operating, and check any proposed pin against the existing Ajyal boundary. Keep uncertain records in staff review. The existing suggestion, correction and ownership-claim workflows remain available.

## Release gates

Validate the OAuth session exchange and first-time and returning user flows on a physical iPhone before exposing Google Sign-In in TestFlight. Verify Apple Maps rendering, directions, and existing directory behavior on the candidate. TestFlight build and upload follow the release checks. Public review remains a separate approval.
