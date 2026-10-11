---
'@weasel-js/core': patch
---

`renderSceneToPixels` and `RasterSession.render` now throw when the requested raster is larger than the WebGL context's drawing buffer, naming both sizes. A context clamps a buffer it cannot allocate, so a poster-size export came back as a full-size `RasterImage` that was transparent past the clamp, with no error. The same check covers a caller-supplied `gl` whose buffer is smaller than the render.
