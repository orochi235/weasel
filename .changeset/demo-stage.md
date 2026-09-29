---
'@weasel-js/core': patch
---

`<DrawCanvas>`, additive: a sized, DPR-correct WebGL2 canvas that paints a `DrawCommand` list with no scene, tools or dispatcher behind it.

`draw` takes a command array, which repaints on the next frame when it changes, or a function called on every paint with the surface's CSS size. `view` sets a camera over the commands (identity by default), `background` fills the surface beneath them, `redrawOn` repaints on external sources as it does on `<SceneCanvas>`, and `dpr`, `className` and `canvasRef` behave as they do on `<SceneViewCanvas>`. It paints through the same per-canvas renderer as `<SceneViewCanvas>`, runs its frames behind the visibility gate, and frees its GL objects on unmount.

`<SceneViewCanvas>` and `<MinimapCanvas>` now repaint when an image finishes decoding, a deferred glyph bake or font load lands, or a paint kind registers late, as `<SceneCanvas>` already did. Before, text or images that were not ready on a detached view's first frame stayed blank until something else repainted it.
