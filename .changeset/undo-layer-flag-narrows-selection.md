---
'@weasel-js/core': patch
---

Undoing a `setLayerVisible` or `setLayerLocked` that showed or unlocked a layer drops its nodes from every editing session's selection, as hiding or locking it does.

<!-- entry: fix -->
