# Apple account deletion rollout

Production project is `ckqwziutmqohihrenstz`. Build 12 remains the stable TestFlight build and App Store draft selection. The owner approved the v2 deployment. Legacy cutover and deletion of the named disposable account require separate approval.

## Exact production changes

| Endpoint | Phase | Behavior |
| --- | --- | --- |
| `delete-account-v2` | First | Deployed version 1 from the reviewed `supabase/functions/delete-account/index.ts` and `apple.ts` with JWT verification enabled. Deployment ID: `fb6f8e42-ab2d-4549-8f4e-8a8e887a3c4b`. |
| `delete-account` | After the replacement passes and the owner approves legacy cutover | Deploy the same reviewed files under the legacy slug. Older Apple clients receive a reauthorization-required response and need the replacement app for in-app deletion. Assess who is affected before cutover. |

The new function authenticates the caller and checks their own linked Apple identities. Its authenticated GET reports whether the server has a revocation credential. A POST for an Apple account requires a fresh Apple authorization code. The server exchanges it using the configured client secret, verifies the returned ID token signature, issuer, audience and subject, and revokes the Apple token only if the subject matches the caller's linked Apple identity. Missing configuration, a mismatched identity or a failed Apple response stop the request before data cleanup. On success the existing cleanup removes caller-owned tracked media, runs the account purge RPC, revokes Supabase sessions and deletes the auth record. Accounts without Apple follow the existing cleanup. No database migration or cleanup job runs when the code is deployed.

The new iOS client uses the new endpoint for both Apple capability discovery and the Apple deletion request. It does not fall back to the legacy endpoint on failure. Cancelling the Apple prompt leaves the session active. Email and Google accounts retain their current deletion endpoint.

## Order and rollback

1. Completed on November 9, 2026. The live v2 files match the reviewed source byte for byte. Missing and invalid JWTs returned 401. The authenticated review account GET returned Apple capability enabled. The original slug remains on v5 with its recorded bundle hash and JWT verification.
2. Before building, check EAS and App Store Connect for existing build numbers. The checked-in baseline is 12. The existing `google-testflight` EAS profile enables Google Sign-In and increments the local build number for a signed iOS store build. Use `eas build --platform ios --profile google-testflight`. Verify the archive and actual build number, then upload that build to Team (Expo) using the existing production submit profile. Keep build 12 available and selected pending device acceptance.
3. Complete the disposable-account acceptance checks below. Review legacy cutover and the fallback for users on older builds before asking for approval to enforce revocation on the original endpoint. Verify the replacement on a physical iPhone before selecting it in the draft.
4. If the first deployment needs rollback, withdraw the replacement from testers and remove the new slug or redeploy it with an authenticated maintenance response. The original endpoint remains available. A replacement client then stops at capability discovery. Verify build 12 and the original endpoint are still available.
5. If the legacy cutover needs rollback, redeploy the preserved [production v5 source](delete-account-rollback-v5.ts.txt) as `delete-account`, with JWT verification enabled. The source was retrieved from live v5 and saved as text with normalized final line endings. The live bundle hash was `6699915968f0eca50e68d05241a9f9a31a6254f4ccdda45078fd4d71b64c2c10`. Verify the served source and non-destructive method responses. Rollback restores behavior for future requests. It cannot restore an account already deleted or Apple authorization already revoked.

## Disposable-account acceptance

- Use a new Apple test identity, a separate control account and synthetic data. Confirm the Apple subject is linked to the disposable account. Record the disposable Supabase user ID and baseline counts for its profile, membership, posts, messages and tracked media. Keep secrets, codes and personal details out of logs.
- Run cancellation and an authenticated capability check. Confirm no deletion or account change occurs. In isolation, exercise a mismatched Apple subject and provider rejection.
- After explicit approval for that exact test account, delete it from the replacement iOS build. Verify a successful Apple revoke response before cleanup, confirm the disposable auth identity and owned data are removed as intended, and check that its old session cannot refresh. Compare the control account and shared data to baseline.
- If cleanup fails after Apple revocation, inspect which steps completed before retrying. Use a fresh Apple authorization code. An Apple revocation and a Supabase data purge are separate operations.
