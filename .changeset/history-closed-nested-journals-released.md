---
'@weasel-js/history': patch
---

A journal lets go of each journal opened inside it once that one commits or cancels. A long session opening one per edit no longer holds every finished one's history.

<!-- entry: fix perf -->
