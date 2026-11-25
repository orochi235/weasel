---
'@weasel-js/history': patch
---

The `coalesce` step `observe` reports for a keyed `recordEntry` run gives the entry's whole forward ops as `ops`, the redo it now holds, rather than only the ops just recorded.

<!-- entry: fix -->
