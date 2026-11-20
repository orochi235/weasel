---
'@weasel-js/core': patch
---

A layer group whose `effects` function throws is reported through `onLayerError` under the group's id and composites without effects, instead of losing the whole frame.

<!-- entry: fix -->
