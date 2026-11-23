---
'@weasel-js/renderer': patch
---

A text run whose stroke paint cannot be drawn, such as a tile pattern with no `OffscreenCanvas` to rasterize it, draws no stroke and no longer widens the text's bounds, as a path's does.

<!-- entry: fix -->
