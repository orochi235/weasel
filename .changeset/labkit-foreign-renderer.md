---
'@weasel-js/labkit': patch
---

A lab can drive a renderer labkit does not own

`CanvasStack` paints into a 2D context and schedules its own layers, so a
three.js viewer — which brings its own `WebGLRenderer`, its own context and its
own render loop — had nowhere to go. Five additions, each of which two separate
labs had already hand-written.

**`useTiledSurface`** publishes every tile's rect, marks tiles dirty, delivers
DPR and container size, and coalesces a burst of invalidations into one
`onFrame`. The consumer keeps the GL: `preserveDrawingBuffer`, the scissor loop
and the scene graph stay outside the package, because a scheduler that knew about
them would stop working for a shared 2D surface. `onFrame` carries every tile's
rect rather than only the dirty ones, since a scissored draw has to know where it
is drawing relative to a surface that may have resized under it.

The registry's unit is a **rect**, not a trial. A trial holding a drawn pane
beside an undrawn one registers one; a trial with nothing to draw registers none.

**A tile that only moves reports nothing to a `ResizeObserver`**, so `Workspace`
now invalidates rects off the grid's own `node.placementChanged`. Only labkit can
see that a tile moved, which left hosts polling until the rects held still.

**`toDeviceRect`** flips a DOM rect to a GL viewport's bottom-left origin and
snaps both edges to the device-pixel grid. Unsnapped, a tile and its neighbour
round apart and strand a hairline column between them.

**A trial's `view` is now opaque to labkit.** It was `{ zoom, pan }`, and it is
the only camera state labkit persists, restores on Reset and shows in the
sidebar — so a 3D lab kept a parallel view in a ref and forfeited all three.
`TrialRecord` takes a view type parameter, and labkit persists the value without
reading into it. Nothing written against the 2D view changes; `as2DView` narrows
for the parts that are inherently 2D, and `RenderContext.trial` gains `view` and
`setView` beside the existing `zoom` / `setZoom`.

**`TrialStatusBarContext.zoom` is now `number | null`.** The default status bar
omits the zoom section rather than reporting 100% for a view that has no zoom.
A custom `statusBar` slot reading `ctx.zoom` must handle null.

**`useOrbit`** is the 3D peer of `usePanZoom`: drag to turn, wheel or pinch to
dolly, double-click to go home. Trigonometry only — it imports no renderer, and
produces a trial view rather than a matrix.

**A `job` capability** for work too slow to do during a render. The runtime
starts it, aborts on unmount and on a `key` change, discards results from a
superseded run, counts progress, and renders a readout and a cancel control into
the trial chrome. Per-item failure is a first-class event rather than a thrown
error, because a run with two failed items is a partial success and its other
items are worth showing.

Two new subpaths: `@weasel-js/labkit/surface` and `@weasel-js/labkit/job`.
