---
'@weasel-js/core': patch
---

A layer group whose `effects` function throws no longer loses the whole frame.

It is reported through `onLayerError` under the group's id, and its layers composite without effects.

<!-- entry: fix -->
