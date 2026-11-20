---
'@weasel-js/core': patch
---

Undoing an `ops.delete` built from a stale copy of a node puts it back in its sibling slot, not at the end.

<!-- entry: fix -->
