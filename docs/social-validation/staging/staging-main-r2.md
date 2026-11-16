# Haratna hosted staging: main phase

Staging `qcinkzciwjmiavptlfxy` · 2026-11-15 20:05 UTC

| Area | Case | Result | Detail |
|---|---|---|---|
| JWT | anon cannot read posts | PASS | HTTP 401 |
| JWT | anon cannot publish | PASS | HTTP 401 |
| JWT | forged service_role JWT rejected | PASS | HTTP 401 |
| JWT | authenticated cannot call legacy_avatar_inventory | PASS | HTTP 403 |
| JWT | authenticated cannot call count_abandoned_post_photos | PASS | HTTP 403 |
| JWT | authenticated cannot call claim_abandoned_post_photos | PASS | HTTP 403 |
| JWT | authenticated cannot call finish_post_photo_cleanup | PASS | HTTP 403 |
| JWT | service_role can call count_abandoned_post_photos | PASS | HTTP 200 |
| JWT | authenticated reads own social profile | PASS | HTTP 200 |
| Storage | verified user uploads to own posts folder | PASS |  |
| Storage | upload into another user's folder denied | PASS |  |
| Storage | unverified user cannot upload post photos | PASS |  |
| Storage | wrong file type rejected (profile-photos) | PASS |  |
| Exactly-once | publish created | PASS | {'outcome': 'created', 'post_id': '8d6fc46f-9c94-4435-9af2-612df2698bec'} |
| Exactly-once | same op_id returns existing, same post | PASS | {'outcome': 'existing', 'post_id': '8d6fc46f-9c94-4435-9af2-612df2698bec'} |
| Exactly-once | same op_id with different content is a conflict | PASS | {'outcome': 'conflict', 'post_id': '8d6fc46f-9c94-4435-9af2-612df2698bec'} |
| Exactly-once | comment retry returns existing, same comment | PASS | {'outcome': 'existing', 'comment_id': 'ec9b7312-e85a-4e54-8925-c13ae38a52d1'} |
| Exactly-once | exactly one post row for the op | PASS | [{'n': 1}] |
| RLS | follow a public account is immediate | PASS | following |
| RLS | public post visible to verified user in another city | PASS |  |
| RLS | public post hidden from unverified user | PASS |  |
| RLS | public post hidden from blocked user | PASS |  |
| RLS | followers post visible to accepted follower | PASS |  |
| RLS | followers post hidden from non-follower | PASS |  |
| RLS | neighborhood post visible to verified neighbor | PASS |  |
| RLS | neighborhood post hidden from other neighborhood | PASS |  |
| Storage | permitted viewer gets a working signed URL | PASS | sign 200 fetch 200 |
| Storage | unverified user cannot sign the photo | PASS |  |
| Storage | blocked user cannot sign the photo | PASS |  |
| Storage | no public URL for private bucket | PASS | HTTP 400 |
| Storage | owner uploads private profile photo | PASS |  |
| RLS | follow a private account creates a request | PASS | requested |
| RLS | pending request: private account's post hidden | PASS |  |
| Storage | pending request: profile photo not signable | PASS |  |
| RLS | accepted request: post visible | PASS |  |
| Storage | accepted request: profile photo signable | PASS |  |
| Cleanup | deleted post: other users can no longer sign its photo | PASS |  |
| Cleanup | deleted post: photo kept during the 24-hour grace | PASS | HTTP 200 |
| Cleanup | abandoned upload staged | PASS |  |
| Cleanup | cleanup function refuses a user JWT | PASS | HTTP 403 |
| Account deletion | delete-account-v2 succeeds | PASS | HTTP 200 {'deleted': True, 'sessions_revoked': True} |
| Account deletion | Auth user removed | PASS | HTTP 404 |
| Account deletion | profile removed | PASS | [{'follows': 0, 'profiles': 0}] |
| Account deletion | follows removed | PASS | [{'follows': 0, 'profiles': 0}] |
| Account deletion | community-media object removed | PASS | HTTP 400 |
| Account deletion | profile-photos object removed | PASS | HTTP 400 |
| Account deletion | repeat call with old session is refused safely | PASS | HTTP 401 |

**47 PASS, 0 FAIL**
