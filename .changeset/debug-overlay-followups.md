---
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

`<SceneCanvas debug>` now reaches the overlay. It had been swallowed, so only the `?debug=` URL flag ever turned the overlay on through `SceneCanvas`; the prop takes `<Canvas debug>`'s `DebugConfig` plus SceneCanvas's own `slops`. `<Canvas>` also keys its debug sink on the config's content, so an inline `debug={{ … }}` no longer throws away what the sink recorded on every render.

New `viewport` debug feature: the last pan or zoom, drawn as the viewport it started from (outlined in the current view), the world point it held fixed, and a readout of the pan delta or zoom factor. `DebugSink` gains `recordViewport(kind, from, to, anchor?)`; a hand-written sink must add it. Actions reach the sink through a new `debug` dep that `<SceneCanvas>` provides, and `viewport.dragPan`, `viewport.wheelPan`, `viewport.zoom` and `viewport.pinchZoom` record into it. `SceneCanvasApi` / `CanvasExtensionApi` gain `getDebug()`, which returns the sink, or null while `debug` is off.

The `fps` panel now shows the frame interval and, per paint, CPU time and GL draw calls in total and per render layer, in decimal-aligned columns. The numbers come from new renderer seams: `WeaselRenderer.render(commands, viewMatrix, { spans })` and `lastFrameStats()`, and a `spans` out-parameter on `drawLayers`. `?debug=` now parses `ids`, `fps` and `viewport`, and `?debug=all` turns them on.

`renderDebugSnapshot({ scene, view, size, pixelRatio, debug, config, … })` rasterizes the scene and the debug overlay into one image, the way the canvas showed them, for a bug report; `rasterToPng(image)` encodes any `RasterImage` as a PNG `Blob`. It is built on `renderSceneToPixels`, which gains an `overlay` option: commands drawn over the scene in output-pixel space. `buildDebugOverlayCommands` exposes the overlay's commands for a snapshot.
