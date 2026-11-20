---
'@weasel-js/loupe': patch
---

A captured `CanvasSource` captured at zero size answers no frame, rather than its last copy.

Its frame subscribers hear of it.

<!-- entry: fix -->
