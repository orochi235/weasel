---
'@weasel-js/core': patch
'@weasel-js/renderer': patch
'@weasel-js/font': patch
---

`<SceneViewCanvas worker>` paints its scene from a worker. The component hands its canvas to the worker with `transferControlToOffscreen`, and on each frame sends it only what changed: the changed nodes in their saved form, the pose overrides, and the view, size, and layer settings. The worker keeps its own copy of the scene and draws it with its own renderer. Hit-testing, input, and overlays stay on the page. The worker's module imports `serveSceneRender` from the new `@weasel-js/core/render-worker` entry and registers whatever paints a node there: node shapes, fonts, paint kinds, shader programs (GLSL, WGSL, or both), and the scene registry. `alphaFor` still applies: the page calls it and sends the alphas that changed, and scroll offsets cross too. `workerRef` gives `snapshot()` in place of `toBlob`, which a transferred canvas no longer allows. A host that is not React drives `startSceneRenderWorker` from its own frame loop.

The worker runs no loop of its own: it paints when the page's frame loop sends a frame, so it paints nothing while the canvas is off screen or the tab is hidden. A worker decodes raster images itself, and asks the page for an SVG source, which needs an `<img>` to rasterize.

The renderer's `canvas` option takes an `OffscreenCanvas`. The image cache's own loader decodes rasters with `fetch` and `createImageBitmap` where there is no `<img>`, and `setImageLoader` replaces it. A worker's `self.fonts` loads invalidate glyphs the way `document.fonts` loads do.
