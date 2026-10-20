---
'@weasel-js/core': patch
---

`renderSceneToPixels`, `createRasterSession().render` and `planPixelRender` now leave a scene's annotation layers (measurements, notes) out of the raster, as the SVG export does. Pass `annotations: true` to draw them. `renderDebugSnapshot` draws them by default, since it reproduces the canvas; pass `annotations: false` to leave them out.
