# Haratna social resilience handoff

The release candidate can create duplicate posts and comments when the server commits an insert and the client loses the response. The disposable stack reproduced two rows for each operation. A retry using the same client-generated UUID and frozen payload reconciled to one row through the existing primary key. The mobile candidate still needs that protocol wired into its normal composer paths.

## Reproduce the isolated evidence

Run [the probe](../scripts/test-social-resilience.py) with Python 3 and a disposable loopback Supabase instance that has the two social migrations. Set `LOCAL_SUPABASE_URL`, `LOCAL_ANON_KEY`, `LOCAL_SERVICE_KEY` and `LOCAL_RESILIENCE_FIXTURE` privately. The fixture is an owner-only JSON file with `owner` and `other` objects containing synthetic `email` and `password` values, and a `neighborhood_id` string. Both accounts need verified membership in the same neighborhood. The script adds deliberately synthetic rows and images. It forwards writes only to the supplied loopback server, drops selected responses after it observes HTTP 201, and compares stored rows and bytes without printing credentials or account IDs. [Probe results](social-validation/final-resilience.log)

## Idempotent writes

- Assign a UUID before the first write and keep it with the signed-in user and frozen draft through reconnection and restart. Use it as the existing post or comment primary key. A new intentional submission gets a fresh UUID.
- Retry the same insert under the active authenticated session. Reconcile a duplicate key only after reading by UUID and author under RLS and verifying the expected payload. A missing row, a foreign owner, or a payload mismatch remains an error. A legacy caller may continue using the server-generated ID.
- An earlier post can be edited, soft-deleted, or become invisible before retry. The tested protocol rejects those mismatches safely without creating a second row. If the product must recognize completed operations after edits or deletion, use a private receipt keyed by actor, operation type, and UUID. Write the receipt and content in one transaction, preserve a fingerprint and result, and retain receipts for the supported retry window. A replay must never resurrect deleted content.
- After a response is lost, reconcile before deleting any attempted post's photos. The current composer treats a failed insert response as a cleanup signal. The probe reproduced this sequence against a synthetic post. The post row survived while its owner cleanup call removed its linked file. The new client path must distinguish a definitive rejection from an unknown outcome.
- Verify the integrated protocol through the iOS composer for pre-commit failure, committed response loss, app restart, repeated taps, payload changes, sign-out, and replay by a different user.

## Partial photo batches

The tested retry used one deterministic object path per frozen file under `posts/<uid>/` with the operation UUID in the filename. It reused the first object only after comparing its bytes, uploaded the missing second file, and reconciled the completed post after another lost response. Keep uploads non-overwriting and persist the file identity and upload progress for the supported retry window. An authenticated owner cleanup request removed its own abandoned object but did not remove the other owner's file. The service-worker probe selected only synthetic unreferenced paths belonging to the intended owner. It removed the remaining abandoned file and verified that both linked files and the other owner's file survived.

The current post trigger also accepted a reference after the worker deleted the file. A scan followed by deletion therefore has a race. Before adding a background worker, give each batch a server-owned lifecycle with a bounded retry period. Have publication and cleanup lock the same batch record. Publication can link only files owned by the actor in an open batch. Cleanup first atomically claims an expired uncommitted batch, preventing publication of its paths. A cleanup claim is permanent across retries. The worker rechecks references, then deletes through the Storage API. Use a delay or another sweep for uploads already in flight when a batch closes, and keep a record of failed deletions so the worker can retry. Reserve the worker's credentials for the server, scope its selection to the post-photo bucket and claimed paths, and preserve any references including soft-deleted content until retention rules explicitly permit removal. Retain metadata when object removal fails. Do not schedule a broad orphan sweep against the existing candidate. [Supabase Storage deletion guidance](https://supabase.com/docs/guides/storage/management/delete-objects)

## Patch and build handoff

Start at PR #5 commit `4cf273c3d84787fa52acfec0df9e4bc6b1e636be`. Apply these patches in order.

1. [Social fixes](haratna-pr5-social-fixes.patch)
2. [iOS 27 scene support](haratna-pr5-ios27-scene.patch)
3. [Native blockers](haratna-pr5-native-blockers.patch)
4. [Final native acceptance](haratna-pr5-final-acceptance.patch)

The applied Git diff covers 16 files. It contains the scene plugin and its lockfile entries, the social write-policy correction and SQL regression, the native screens and composer changes, and their tests. The scene patch also records the existing postinstall hook in npm's lockfile. The release diff contains no Simulator credentials, proxy, synthetic data, or EAS profile changes. The resilience probe and this handoff are separate from the four patches. [Diff inventory](social-validation/handoff-diff.log) · [Patch hashes and verification](social-validation/handoff-checks.log)

The reviewed source has version `1.0.0`, bundle ID `sa.haratna.app`, and local build number `13`. Prepare the next candidate with build 14 or the next unused number after checking App Store Connect. The existing `google-testflight` profile extends `production`, enables Google Sign-In, and inherits auto-increment. Confirm the effective number so it is incremented exactly once. Verify the scene lifecycle, N2 icon, splash, and native authorization flows in a signed local build after the resilience fixes pass. Record the commit, patch hashes, effective build number, artifact checksum, and test results. Keep build 13 available as fallback. Any hosted build, upload, distribution, migration, deployment, or production data operation requires separate approval.

## Release gates and residual risks

- **Blocker.** Integrate and retest the UUID protocol in the actual app and prevent ambiguous post responses from triggering photo deletion.
- **Blocker.** Add and test an atomic publication versus cleanup fence before enabling background cleanup. Rehearse interrupted Storage deletion, repeated worker runs, and preservation of referenced and foreign objects.
- **Blocker.** Resolve the managed-role recovery gap and verify hosted migration permissions after Supabase Security responds. Review production rollout and rollback separately.
- **Pending candidate checks.** Hosted JWT gateway behavior, Apple reauthorization and revocation, and physical iPhone acceptance remain in the release checklist.
- **Residual exposure for review.** Blocking denies new private-photo access under RLS. Previously issued URLs and cached copies remain usable until their applicable expiry. Build 13 compatibility also depends on retaining legacy public avatars under the existing policy. These are documented risks awaiting release acceptance.
