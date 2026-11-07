---
'@weasel-js/core': patch
'@weasel-js/renderer': patch
'@weasel-js/font': patch
'@weasel-js/animator': patch
'@weasel-js/labkit': patch
---

`<SceneViewCanvas worker>` paints its scene from a worker. The component hands its canvas to the worker with `transferControlToOffscreen`, and on each frame sends it only what changed: the changed nodes in their saved form, the pose overrides, and the view, size, and layer settings. The worker keeps its own copy of the scene and draws it with its own renderer. Hit-testing, input, and overlays stay on the page. The worker's module imports `serveSceneRender` from the new `@weasel-js/core/render-worker` entry and registers whatever paints a node there: node shapes, fonts, paint kinds, shader programs (GLSL, WGSL, or both), and the scene registry. `alphaFor` still applies: the page calls it and sends the alphas that changed, and scroll offsets cross too. `workerRef` gives `snapshot()` in place of `toBlob`, which a transferred canvas no longer allows. A host that is not React drives `startSceneRenderWorker` from its own frame loop.

The worker runs no loop of its own: it paints when the page's frame loop sends a frame, so it paints nothing while the canvas is off screen or the tab is hidden. A worker decodes raster images itself, and asks the page for an SVG source, which needs an `<img>` to rasterize.

The renderer's `canvas` option takes an `OffscreenCanvas`. The image cache's own loader decodes rasters with `fetch` and `createImageBitmap` where there is no `<img>`, and `setImageLoader` replaces it. A worker's `self.fonts` loads invalidate glyphs the way `document.fonts` loads do.

A worker view runs its own animator. The worker module registers animation programs by key (`serveSceneRender({ animations })`), and the page plays them through `workerRef.current.animator.play(key, params)` and steers them by id or key; their vertex-color and trim overrides paint as an `animator` does on the page. The animator moves on the page's frames, so it stops while the canvas is unseen, and given `clock` it follows a page clock: its pause holds the animations, and a seek back plays them backward. `hostAnimator` in `@weasel-js/animator` is that animator for any host that runs its own frames.

An image node can draw a `bitmapSrc` bitmap in a worker view: the worker asks the page for it and is sent a copy. `bitmapSrc` names now carry a token of the realm that minted them, and `adoptBitmapSrc` puts a bitmap minted in another realm into the image cache under its name.

`<SceneCanvas worker>` paints the scene layers from a render worker and the rest of the layer stack on the page: the layers below the scene and above it (grid, ghosts, selection and path-edit chrome, consumer layers) each paint into a page canvas of their own, stacked with the worker's, and the top one takes input. A page layer placed between two scene layers gives each part of the scene its own worker. The handle's `readIds` and `pickAt` read every canvas of the stack, the worker's a round trip away and in the page's `scenePickIds` numbering, and `readIdsSync` answers `null` there, so `geometry.picking: 'pixels'` walks the shapes. A prop worker mode cannot honor is a type error: `animator`, `paintInto`, `inputElement`, `backend`, and a scene slot's functions; the worker's canvas and the page's beside it paint with WebGL 2. The handle's `worker` gives the worker's animator and a snapshot of the whole stack.

This changes `SceneCanvasProps` and `SceneViewCanvasProps` into unions of a page-painted and a worker-painted branch, which breaks a wrapper that writes `Omit<SceneCanvasProps<…>, K>`: an `Omit` of a union merges its branches, and the merged props are assignable to neither. Distribute it instead, `SceneCanvasProps<…> extends infer P ? (P extends unknown ? Omit<P, K> : never) : never`, as `LeanSceneCanvasProps` and labkit's `TrialSceneCanvasProps` now do. `SceneViewCanvas` also takes `dpr`.
