---
'@weasel-js/history': patch
---

A failed undo or redo of a committed journal mixing a coalesced run with other edits returns to where it started, running those edits once.

<!-- entry: fix -->
