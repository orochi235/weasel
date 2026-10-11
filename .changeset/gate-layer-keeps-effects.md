---
'@weasel-js/core': patch
---

`gateLayer` dropped the wrapped layer's `effects`, `deps`, and `hitTest`, so a gated layer lost its blur pass and stopped being hittable. It now carries every member of the layer through; the hit-test answers only while the layer is visible, and the cache key includes visibility.
