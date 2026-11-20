---
'@weasel-js/loupe': patch
---

A captured `CanvasSource` answers no frame once its last reader releases it, and warns when read unheld.

A sampler reading a captured source through `canvasPixelSource` holds it with `retain()` for as long as it reads.

<!-- entry: fix behavior -->
