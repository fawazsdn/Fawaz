# Haratna Google and Ajyal readiness

Build 10 remains the owner-tested baseline. This feature branch is based on PR #3.

## Cloud configuration

Google Cloud project `haratna-production` lists the active Haratna Supabase OAuth web client and the earlier unused client. Keep the active client and its existing Supabase callback. The current audience is External / Testing. The live test-user table is empty. Google exempts authentication that uses only OpenID, email and profile scopes from the test-user allowlist. [Google audience documentation](https://support.google.com/cloud/answer/15549945) The live Supabase provider previously redirected to Google using `https://ckqwziutmqohihrenstz.supabase.co/auth/v1/callback`. Haratna uses `haratna://auth/callback` for the return from Supabase. The current candidate explicitly requests openid, email, and profile and tests callback validation and cancellation locally. Before publishing the consent screen, confirm branding, support contact, authorized domains, privacy policy URL and Google verification status. Public use requires a separate consent publication decision.

## Mapping decision

On November 8, 2026 the owner withdrew approval for the Google Maps Platform pilot. The Google Cloud billing and enabled-service pages confirm there is no linked billing account and neither Maps SDK for iOS nor Places API (New) is enabled. The feature branch removes the conditional native Google provider, iOS key configuration, and disabled Places research endpoint. The existing native map uses Apple Maps on iOS, retaining neighborhood boundaries, pins, filters, location controls, previews, clustering, and Apple Maps directions. The `react-native-maps` dependency remains in use.

Google Sign-In is separate. The dedicated `google-testflight` EAS profile enables the button under Apple Sign-In for the internal iOS candidate. The normal production profile still defaults to hiding it. The live provider check confirmed S256 PKCE, the active Google web client, both registered callback URLs and the three identity scopes.

## Independent Ajyal coverage

Reviewed November 8, 2026. Thirteen supplied candidates were tracked, with three existing verified entries and ten pending. No new publication. A separate outside-Ajyal pharmacy search result was excluded. No closure was confirmed. Ajyal Mall was added as a separate research lead.

| Candidates | Status | Evidence or missing evidence |
| --- | --- | --- |
| Domino’s, Knock Café, Soma Grape Leaves | Existing verified directory entries | Merchant sources in the existing migration. Domino’s has a boundary-checked pin. Coordinates for Knock and Soma remain unset. |
| Tamimi Markets | Pending | The [Ajyal neighborhood council](https://ajyalcouncil.org.sa/أسواق-التميمي-تفتتح-فرعاً-جديداً-بحي-أ/) confirms an opening on Jeddah Street. Verify current operation and an authoritative branch coordinate. |
| Razeen | Pending | The [operator](https://razeen.sa/razeen-al-dhahran-2/) confirms a commercial complex in Ajyal, and [Enjoy Ajyal](https://www.enjoyajyal.org/) documents recent events there. Verify the pin and distinguish the venue from its tenants. |
| UMQ Coffee (قهوة عُمق), branch 1.4 | Staff review candidate | The [operator’s active branch directory](https://umqcoffee.com/ar) lists Ajyal branch 1.4. Confirm the Dhahran address and independently verify the storefront pin and current hours before publishing. The site phone is customer service, not a verified branch number. |
| 7 Grams Drive Thru (٧ جرام) | Staff review candidate | [Saudi Coffee Crafters](https://saudicoffeecrafters.com/ar/listing/7-grams-drive-thru-ajyal/) identifies the branch on Jeddah Street in Ajyal. The [Seven Grams ordering site](https://7grams.order.sa/) confirms the brand. Seek merchant confirmation of current operation and branch pin before publishing. |
| Swip Truck, Krab, 8oz Coffee, Specialty Bean, أسواق بيت الغذاء الراقي, تباريك | Pending | Current authoritative branch evidence, operating status and boundary-checked coordinates are incomplete. |
| Ajyal Mall | Pending | The [Ajyal neighborhood council](https://ajyalcouncil.org.sa/أجيال-مول-قريباً-في-حي-أجيال/) describes a planned opening. Current opening and an authoritative coordinate are unconfirmed. |
| Nahdi pharmacy in Doha Al Janubiyah | Excluded from Ajyal | The [branch location lead](https://www.waze.com/ar/live-map/directions/sa/almntqh-alshrqyh/alzhran/sydlyh-alnhda?to=place.ChIJ3778aqDnST4RKywGliL1PVA) identifies a different neighborhood. |

Production publication and schema changes need separate authorization. The feature branch preserves the existing verification and staff claim workflows. Use merchant sources, permitted public sources, and community submissions. Record an evidence URL and date, confirm the branch is operating, and check any proposed pin against the existing Ajyal boundary. Keep uncertain records in staff review. The existing suggestion, correction and ownership-claim workflows remain available.

## Google Sign-In device acceptance

Apple accepted and processed Haratna 1.0.0 (12), signed from `0d8b55e`. App Store Connect reports it as VALID and IN_BETA_TESTING for Team (Expo). Build 11 remains available in the same group. The signed build 12 bundle includes the Google button below Apple. [EAS build](https://expo.dev/accounts/fawazsdn/projects/haratna/builds/596340bb-820e-4d4f-aaaa-582741c3d446) · [App Store Connect TestFlight](https://appstoreconnect.apple.com/apps/6821993919/testflight/ios)

1. Install Haratna 1.0.0 (12) from the internal Team (Expo) group. On the sign-in screen, tap **Continue with Google**, then cancel. Haratna should return to the sign-in screen without authenticating.
2. Try again with a Google account you control whose email has never been registered in Haratna. Complete consent in the iOS browser. Haratna should reopen and route to profile and neighborhood setup.
3. Finish onboarding, close and reopen the app, then confirm the session persists. Sign out and relaunch to verify the sign-in screen returns.
4. Use the same Google account again. Confirm the same profile and neighborhood are restored. A Google account whose verified email already belongs to a Haratna account may link to that existing account.
5. Verify Apple Sign-In and a separate fresh Gmail signup with its OTP. Enter credentials and codes only in their normal device prompts.

All 347 mobile tests passed, including the Google button, callback rejection, cancellation and failure messaging. TypeScript and iOS export passed. ESLint had four existing warnings and no errors. The existing production email/password review account passed a smoke check. Physical-iPhone account creation, token exchange, returning sign-in and persistence require the device owner's confirmation. Keep the Google button restricted to internal candidates until that verification is complete.
