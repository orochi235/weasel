I couldn't write the findings file because permission to write `.skulk/out/findings.md` was denied. Here is the whole document:

## The layers panel lists hidden layers, and numbers and orders them by the raw array, not the drawn stack
- where: packages/core/src/debug/useDebugSink.ts:64 (beginDebugFrame)
- scenario: `beginDebugFrame` walks `paintLayers` as passed and calls `recordLayer(layer.id, …, i)` for every entry, skipping only the overlay. `drawLayers` (core/layers/render.ts) paints `paintedLayers(layers, visibility, order)`, which drops layers whose `layerVisibility` is false and reorders by `layerOrder`. A canvas with `layerVisibility={{ grid: false }}` and `layerOrder={['scene', 'grid', 'selection']}` gets a `?debug=layers` panel that still lists `grid`, shows the layers in array order with array indices, and does not match the stack that was painted. `RecordedLayer` is documented as "A render layer that drew during the current frame". The panel should list `paintedLayers(...)` in draw order, with draw-order indices.
- evidence: read
- severity: medium

## In worker (paint-stack) mode the frame panel never gets paint or per-layer stats
- where: packages/core/src/debug/useDebugSink.ts:72-80 (beginDebugFrame → DebugFrame.time/end)
- scenario: `end` records only when `time()` was called first. `useCanvasPaint` calls `debugFrame?.end(stats)` on the `stackRef.current` path but never calls `time()` there, so with `debug={{ fps: true }}` on a canvas painting through a paint stack, `recordFrame` never runs. `snapshot.frame` stays null, and the panel shows only fps/frame rows with no paint, draws or per-layer lines. The main-thread path does show them. The call to `end` on that path shows the stats were meant to be recorded there too. The fix is to time the stack paint (paintMs and drawCalls at least, and layers from `renderer.lastFrameStats().spans` if the stack passes them).
- evidence: read (packages/core/src/canvas/useCanvasPaint.ts:104-128)
- severity: low

## Files read
packages/core/src/debug/createDebugOverlayLayer.ts
packages/core/src/debug/createDebugSink.ts
packages/core/src/debug/defaultTheme.ts
packages/core/src/debug/features.ts
packages/core/src/debug/flag.ts
packages/core/src/debug/frameStats.ts
packages/core/src/debug/index.ts
packages/core/src/debug/overlayPanels.ts
packages/core/src/debug/override.ts
packages/core/src/debug/parseDebugFlags.ts
packages/core/src/debug/types.ts
packages/core/src/debug/useDebugSink.ts
<!-- done: 2 findings, files read: 12 -->