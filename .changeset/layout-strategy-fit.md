---
'@weasel-js/core': minor
---

A layout strategy can resize its container on any change, not only when children join or leave: the optional `LayoutStrategy.fit` returns the resting arrangement with the bounds it needs, and the scene calls it in place of `childPoses`.

<!-- entry: api -->
