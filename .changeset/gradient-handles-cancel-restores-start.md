---
'@weasel-js/ui': patch
---

A canceled `GradientHandles` or `MeshHandles` drag sends `onInput` the exact value it began from, and nothing at all when the press never moved.

<!-- entry: fix -->
