---
'@weasel-js/core': minor
---

`frameInverts` and `storesEdits` say whether a pose or a path edit can be stored under a frame without moving it.

`frameInverts(adapter, id, composition)` reads the frame at or above `id`, true for the root; `storesEdits(scene, node)` asks it of a node's own frame. Both are false for a singular frame.

<!-- entry: api new -->
