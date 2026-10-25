---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
'@weasel-js/hud': patch
'@weasel-js/minimap': patch
---

`cullDrawCommands` now culls a group with effects: it drops one whose children's bound, grown by
how far its effects reach and cut by its clip, misses the cull rect, and keeps it whole otherwise. A
group whose effects do not say how far they reach is still always kept. Effect reach is in device
pixels, so `cullDrawCommands` takes the density as a new, required fourth argument, `dpr`.

That density reaches a layer through a new `LayerDims` type, `Dims` plus `dpr`, which is what
`RenderLayer.draw` and `deps`, `drawLayers`, `drawOneLayer`, `CanvasViewHandle.draw` and hud's
`HudContentCtx.dims` now take. A layer written against `Dims` still type-checks; code that calls
`draw` itself must pass `dpr`. `SceneViewCull` gains `dpr` too, which `sceneViewFrame` and
`renderSceneToCanvas` fill from their `dpr` argument. These are breaking for direct callers.
