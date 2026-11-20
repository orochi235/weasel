---
'@weasel-js/core': minor
---

A layout strategy can resize its container on any rearrangement through the new optional `LayoutStrategy.fit`.

`fit` returns the resting arrangement with the bounds it needs, and the scene calls it in place of `childPoses`.

<!-- entry: api -->
