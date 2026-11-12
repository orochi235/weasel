---
'@weasel-js/core': patch
---

Undoing a reparent puts the node back under the parent it had, read from the adapter, even when the op was built with a stale `fromParentId`.

<!-- entry: fix -->
