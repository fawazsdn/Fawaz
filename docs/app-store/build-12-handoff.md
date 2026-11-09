# Haratna App Store draft and capture handoff

Verified November 9, 2026. App Store Connect version 1.0 is in Prepare for Submission with build 12 selected and manual release enabled. The English (U.S.) listing name is حارتنا. Apple rejected Haratna because the name is already in use on another account. The draft has a saved subtitle, description, keywords, Social Networking primary category, age-rating answers, copyright, review contact and review login. The privacy and support URLs returned HTTP 200. Export compliance is saved as no non-exempt encryption. Saudi Arabia is the only enabled storefront. The current Saudi price is SAR 0.00.

## Account deletion

Apple registered the dedicated Haratna Apple Account Revocation key for the primary App ID. Supabase lists `HARATNA_APPLE_CLIENT_SECRET`. The JWT was signed locally and sent directly to Supabase, with a 90-day lifetime. Rotate it before February 7, 2027. The Apple private key is stored in the owner-only Haratna Credentials directory under macOS Application Support. The approved v2 function is active and authenticated capability discovery passed. The legacy endpoint remains on v5. The compatible iOS client is in the handoff branch.

For rotation, use the dedicated Sign in with Apple key associated with the primary App ID for `sa.haratna.app`. Generate the ES256 client-secret JWT locally with the Apple key ID as `kid`, the team ID as `iss`, `https://appleid.apple.com` as `aud`, and `sa.haratna.app` as `sub`. Set a short operational expiry within Apple's six-month limit and track its rotation. Install the JWT in Supabase Edge Function Secrets as `HARATNA_APPLE_CLIENT_SECRET`. Keep the private key outside Supabase, the app bundle, Git and logs. Verify the key association and secret name without retrieving the secret value. Deploying the replacement function and deleting a disposable production account each require separate approval. A coordinated rollout needs a safe server prerequisite and a device test for the linked Apple account and data cleanup.

[Apple client secret](https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret) · [Apple token revocation](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple) · [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)

## App Store screenshots complete

The owner approved five genuine iPhone 15 Pro Max captures from Haratna 1.0.0 (12). Apple accepted all five 1290 × 2796 PNGs in the English (U.S.) large iPhone set. The saved order is Home, Explore, Neighborhood Map, Local Businesses, and Neighborhood Assistant. The older simulator image was removed after Apple finished processing the replacement set.

[Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)

## App Privacy

The eleven saved answers include Precise Location and linked Other Data for App Functionality without tracking. The new Other Data answer covers date of birth stored for club eligibility. App Store Connect still shows Publish. The live GPS function records the result and timestamp without inserting the raw coordinates into its tables. Confirm request-log retention before narrowing the existing precise-location disclosure, and reconcile policy and retention wording. Confirm whether the User ID and Other User Content personalization purposes accurately describe the release, then publish the reconciled answers with owner sign-off.

[Apple App Privacy details](https://developer.apple.com/app-store/app-privacy-details/)

## Final verification still to run

- For live support delivery, use one approved recipient and a synthetic support ticket. Send one reply from the admin dashboard. Confirm Resend acceptance and mailbox receipt or the provider delivery event. Check dashboard status and use the provider message ID to confirm duplicate prevention.
- For the community check, use two authorized accounts in a test neighborhood. Publish a labeled test post with the first account and verify visibility with the second. Connect the accounts, send a synthetic message, and confirm receipt. Report the test item and verify it appears in the staff queue. Block the first account from the second, then verify messaging and neighbor requests are denied and that unrelated content remains accessible.
- Before asking for submission approval, verify Apple processed the replacement build and that the device acceptance pass is complete. Confirm the draft selects that exact build, manual release, Saudi Arabia only, SAR 0, the Arabic listing name, approved screenshots, published privacy answers, verified review access and no open App Store Connect requirements.

The account-deletion deployment order and rollback instructions are in [the rollout plan](account-deletion-rollout.md).
