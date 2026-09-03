---
"@weasel-js/labkit": patch
---

Let a labkit instrument declare its own coordinate system for the canvas.

`CanvasCapability.worldSpec` takes an `origin` — a fraction of the viewport, so
`{x: 0.5, y: 0.5}` means "centred" without knowing the canvas size — and
`yAxis: 'up' | 'down'`. Omitting it keeps the convention labkit has always had:
world (0,0) at the element's top-left, y running down.

The spec is resolved against the measured viewport into a `WorldFrame`, and
every path between world and screen now reads it: `worldToScreen`,
`screenToWorld`, the new `applyCamera`, `usePanZoom`'s wheel anchor, and the
drop position in `DragDropRuntime`. This is a bug fix as much as an addition —
an instrument whose world was not y-down-from-the-top-left previously had to
layer its own transform on top, and the wheel then anchored on the wrong point
and drifted by `(1 - ratio) * originPx` every step, with no error.

`CanvasCapability.initialView` also accepts a function of the viewport size.
The trial's view stays `null` until the canvas is first measured and
`CanvasStack`'s new `onResize` places it, so an instrument that frames content
against the viewport no longer needs its own "have I placed this yet" flag.

`RenderContext.trial.visibleLayers` lists the canvas layers currently shown, in
declaration order — labkit skips a hidden layer's `draw`, so this was
previously only discoverable by instrumenting every layer.

Clone and Reset move from the trial toolbar to the right edge of the trial
title bar, beside Close.

`CanvasStackContextValue` gains a required `frame`, and
`CanvasLayerDescriptor.render` takes it as a third argument.
