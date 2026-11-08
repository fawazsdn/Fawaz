# Haratna Google and Ajyal readiness

Build 10 remains the owner-tested baseline. This feature branch is based on PR #3.

## Cloud configuration

Google Cloud project `haratna-production` lists the active Haratna Supabase OAuth web client and the earlier unused client. Keep the active client and its existing Supabase callback. The prior OAuth audience audit found Testing with the project owner listed. The live Supabase provider previously redirected to Google using `https://ckqwziutmqohihrenstz.supabase.co/auth/v1/callback`. Haratna uses `haratna://auth/callback` for the return from Supabase. The current candidate explicitly requests openid, email, and profile and tests callback validation and cancellation locally. Before publishing the consent screen, confirm branding, support contact, authorized domains, privacy policy URL and Google verification status. Public use requires a separate consent publication decision.

The enabled API inventory did not list Maps SDK for iOS or Places API (New). The credentials inventory showed no API keys. The project has no linked billing account. Quotas, billing alerts, and API key restrictions therefore remain to be configured. The iOS Maps switch uses the existing react-native-maps Expo plugin and requires a key restricted to bundle `sa.haratna.app` and Maps SDK for iOS. Use a distinct server key restricted to Places API (New) and a dedicated stable egress IP if the selected host supports it. Keep the server key in its secret store. To rotate either key, provision and restrict a replacement, verify it with a candidate or server health check, then retire the old key. The iOS key replacement requires a new native build.

## Places pilot

The administrator-only same-origin POST endpoint `/admin/api/ajyal-places` defaults off. It allows only a fixed category and sector matrix and returns deduplicated Place IDs plus a completeness flag. It uses no storage and sends no resident coordinates. The research circles and rectangles can include neighboring districts. The directory requires independent evidence and a check against the official Ajyal boundary before publication. No detail lookups, paging loops, or public Google content views are enabled.

The initial run covers 5 sectors by 10 categories per method. A capped result is evidence to subdivide or review coverage, with no claim of completeness. Categories include restaurants, cafés, bakeries, supermarkets, pharmacies, gyms, salons, laundries, car washes, and parks. Clinics, specialty retail, family activities, and home services require additional research.

The pilot limits each administrator to eight requests per minute and all valid searches to 100 per server instance per rolling day. Cloud-side quotas are required because multiple server instances do not share these counters. Proposed caps where Google supports them are 20 Nearby Search calls/day, 50 Text Search calls/day, and no Details calls during the initial pilot. Apply available project method rate quotas and verify the resulting settings before activating traffic. For budget monitoring propose USD 25/month with alerts at 50%, 80%, and 100%. Alerts do not stop charges. If needed, turn off `GOOGLE_PLACES_RESEARCH_ENABLED` and redeploy, then disable the Places API or restrict the server credential through Google Cloud. No resident-facing Places traffic is proposed for this pilot.

## Monthly cost model

Model assumes 4 native map loads, 2 Nearby Search Pro calls, 2 Text Search Pro calls and 4 Place Details Pro calls per active resident. This models a potential later resident rollout, beyond the staff pilot. It excludes tax and assumes other projects do not consume shared free allowances. SAR values use 3.75 SAR per USD. Native Maps SDK loads have an unlimited no-cost SKU. The three Pro SKUs each include 5,000 monthly calls, with first-tier prices of USD 32, USD 32, and USD 17 per thousand respectively.

| Active residents | Maps loads | Nearby Pro | Text Pro | Details Pro | USD | SAR |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 500 | 2,000 | 1,000 | 1,000 | 2,000 | 0 | 0 |
| 5,000 | 20,000 | 10,000 | 10,000 | 20,000 | 575 | 2,156.25 |
| 25,000 | 100,000 | 50,000 | 50,000 | 100,000 | 4,495 | 16,856.25 |

At 5,000 residents doubling calls per resident increases this Pro estimate from USD 575 to USD 1,555. The implemented text request uses the unlimited IDs-only SKU, and Nearby Search remains Pro even with an ID mask. Details are absent from the pilot. Fields such as operating hours, phone and website can trigger Enterprise pricing. No autocomplete, geocoding, route API, photos, or Street View is included. External directions use a Maps URL.

[Google pricing](https://developers.google.com/maps/billing-and-pricing/pricing) · [Places field masks](https://developers.google.com/maps/documentation/places/web-service/choose-fields) · [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) · [Key restrictions](https://developers.google.com/maps/api-security-best-practices)

## Independent Ajyal coverage

Reviewed November 8, 2026. Thirteen supplied candidates were tracked, with three existing verified entries and ten pending. No new publication. A separate outside-Ajyal pharmacy search result was excluded. No closure was confirmed.

| Candidates | Status | Evidence or missing evidence |
| --- | --- | --- |
| Domino’s, Knock Café, Soma Grape Leaves | Existing verified directory entries | Merchant sources in the existing migration. Domino’s has a boundary-checked pin. Coordinates for Knock and Soma remain unset. |
| Tamimi Markets | Pending | The [Ajyal neighborhood council](https://ajyalcouncil.org.sa/أسواق-التميمي-تفتتح-فرعاً-جديداً-بحي-أ/) confirms an opening on Jeddah Street. Verify current operation and an authoritative branch coordinate. |
| Razeen | Pending | The [operator](https://razeen.sa/razeen-al-dhahran-2/) confirms a commercial complex in Ajyal, and [Enjoy Ajyal](https://www.enjoyajyal.org/) documents recent events there. Verify the pin and distinguish the venue from its tenants. |
| 7 Grams, UMQ Coffee, Swip Truck, Krab, 8oz Coffee, Specialty Bean, أسواق بيت الغذاء الراقي, تباريك | Pending | Current authoritative branch evidence, operating status and boundary-checked coordinates are incomplete. |
| Nahdi pharmacy in Doha Al Janubiyah | Excluded from Ajyal | The [branch location lead](https://www.waze.com/ar/live-map/directions/sa/almntqh-alshrqyh/alzhran/sydlyh-alnhda?to=place.ChIJ3778aqDnST4RKywGliL1PVA) identifies a different neighborhood. |

Production publication and schema changes need separate authorization. The feature branch preserves the existing verification and staff claim workflows. Resident Nearby results, live Place Details with attribution, and richer admin editing remain open. Keep live Google-derived content distinct from independently verified records, and review the Maps SDK privacy manifest, Apple disclosures, and location behavior on the final binary.

## Release gates

Validate the OAuth session exchange and first-time and returning user flows on a physical iPhone before exposing Google Sign-In in TestFlight. Verify native Google map rendering, privacy, quota failure handling and Ajyal discovery after billing and key configuration. TestFlight build and upload follow those gates. Public review remains a separate approval.
