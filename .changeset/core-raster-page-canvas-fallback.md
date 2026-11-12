---
'@weasel-js/core': patch
---

`renderSceneToPixels` and a raster session draw on a page canvas where the browser's `OffscreenCanvas` will not open WebGL 2, instead of throwing that WebGL 2 is unavailable.

<!-- entry: fix -->
