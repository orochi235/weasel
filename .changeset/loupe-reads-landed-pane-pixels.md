---
'@weasel-js/core': patch
'@weasel-js/loupe': patch
'@weasel-js/hud': patch
---

The loupe reads the pixels it is aimed at. Two fixes:

- **Its color comes off the frame after the aim.** `loupe.color` and `onColorChange` were read at aim time, which returns the frame before the aim. They now settle on the next frame to land. `pick()` still answers immediately, and now returns `null` if no frame has landed yet. On `@weasel-js/loupe`, a `LoupeSurface` that offers `subscribeFrame` gets this deferred sampling; a surface without it is sampled at aim time, as before.
- **It works over a pane of a shared canvas.** `CanvasExtensionApi.getSurfaceRect()` returns the rect of `surface` the canvas paints into: the pane's rect under `paintInto`, otherwise the whole canvas. Pass it as `createLoupe`'s new `region` option. The readback then offsets the aim by the pane's origin and stays inside the pane. Before, the loupe over a `paintInto` pane magnified whatever sat at the same offset from the shared canvas's corner.

Anything that implements `CanvasExtensionApi` by hand now has to supply `getSurfaceRect`.
