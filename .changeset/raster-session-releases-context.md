---
'@weasel-js/core': patch
---

Disposing a raster session now releases the WebGL context of the canvas it created, instead of leaving it alive until garbage collection. A loop of `renderSceneToPixels` calls piled up live contexts until the browser hit its per-page cap and took the context away from the oldest one, which is a canvas on screen. A canvas from a caller's `createCanvas`, and a caller's `gl`, are left alone.
