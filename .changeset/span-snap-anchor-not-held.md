---
'@weasel-js/core': patch
---

`SpanSnap.startHeld()` reports `false` after `anchor` places a start of its own, rather than the hold of the start it replaced.

<!-- entry: fix -->
