# Haratna hosted staging: cleanup phase

Staging `qcinkzciwjmiavptlfxy` · 2026-11-15 19:36 UTC

| Area | Case | Result | Detail |
|---|---|---|---|
| Cleanup | dry run counts the abandoned upload | PASS | HTTP 200 {'dryRun': True, 'claimed': 0, 'deleted': 0, 'failed': 0, 'batches': 0, 'preview': {'deleting': 0, 'staged_abandoned': 2}} |
| Cleanup | dry run deletes nothing | PASS | HTTP 200 |
| Cleanup | cleanup run succeeds | PASS | HTTP 200 {'dryRun': False, 'claimed': 2, 'deleted': 2, 'failed': 0, 'batches': 1} |
| Cleanup | abandoned upload removed | FAIL | HTTP 200 |
| Cleanup | photo of a published post untouched | PASS | HTTP 200 |
| Cleanup | no attachment row left for the removed file | PASS | [{'n': 0}] |
| Cleanup | second run is a no-op | PASS | HTTP 200 {'dryRun': False, 'claimed': 0, 'deleted': 0, 'failed': 0, 'batches': 0} |

**6 PASS, 1 FAIL**
