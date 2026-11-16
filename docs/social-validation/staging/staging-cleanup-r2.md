# Haratna hosted staging: cleanup phase

Staging `qcinkzciwjmiavptlfxy` · 2026-11-16 11:27 UTC

| Area | Case | Result | Detail |
|---|---|---|---|
| Cleanup | dry run counts the abandoned upload | PASS | HTTP 200 {'dryRun': True, 'claimed': 0, 'deleted': 0, 'failed': 0, 'batches': 0, 'preview': {'deleting': 0, 'staged_abandoned': 3, 'deleted_post_photos': 1}} |
| Cleanup | dry run deletes nothing | PASS | HTTP 200 |
| Cleanup | cleanup run succeeds | PASS | HTTP 200 {'dryRun': False, 'claimed': 4, 'deleted': 4, 'failed': 0, 'batches': 1} |
| Cleanup | abandoned upload removed | PASS | HTTP 400 |
| Cleanup | photo of a published post untouched | PASS | HTTP 200 |
| Cleanup | no attachment row left for the removed file | PASS | [{'n': 0}] |
| Cleanup | deleted post's photo removed after the grace | PASS | HTTP 400 |
| Cleanup | old signed URL of the deleted post no longer works (it has also expired by now) | PASS |  |
| Cleanup | no attachment row left for the deleted post's photo | PASS | [{'n': 0}] |
| Cleanup | second run is a no-op | PASS | HTTP 200 {'dryRun': False, 'claimed': 0, 'deleted': 0, 'failed': 0, 'batches': 0} |

**10 PASS, 0 FAIL**
