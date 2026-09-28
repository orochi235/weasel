---
'@weasel-js/core': patch
---

`ViewportLayer.reproject` and `viewportsAt` are gone. They were the click-probe prototype from before views; a viewport that takes input is now a `<CanvasView>` (or a `views` entry, or `SceneCanvasApi.addView`), and the canvas routes pointer events into its camera through the gesture dispatcher. `createViewportLayer` stays as the paint primitive, and `layer.resolvable(outer, dims)` fed to `createViewResolver` is the seam for routing a raw viewport yourself — `clientToWorld(x, y, target.origin, target.view)` then lands where `reproject` did. Breaking: replace `reproject`/`viewportsAt` calls with a `<CanvasView>`, or with `createViewResolver` over the layers' `resolvable`.
