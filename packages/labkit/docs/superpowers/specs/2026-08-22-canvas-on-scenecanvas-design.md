# labkit's canvas on SceneCanvas — design spec

**Date:** 2026-08-22
**Status:** Draft
**For:** whoever implements the port.
**Answers:** what replaces `CanvasStack`, how a layer declares when it needs redrawing, and
where the view lives.
**Package paths:** `src/canvas/`, `src/trial/`, `src/instrument/`, and `packages/core/src/`
for the renderer changes.
**Depends on:** the vocabulary refresh — this spec uses `trial` for what older code calls a
workspace.

labkit's `canvas` capability runs its own 2D stack: one `<canvas>` per layer, its own
pan/zoom, its own rAF scheduler. weasel already has a canvas — WebGL2, one surface, a
command-tree renderer, and a viewport module with fit, clamp, pinch and inertia. Keeping both
means labkit instruments can never be edited, because selection, affordances and direct
manipulation all live on the side labkit isn't on.

This replaces the 2D stack with `SceneCanvas`, and gives the renderer the per-layer
invalidation the 2D scheduler was reaching for and never achieved.

## What changes

`CanvasStack`, `usePanZoom` and `useLayerScheduler` are deleted. The `canvas` capability
keeps its name and its place in the instrument spec, and changes what a layer is:

```ts
interface CanvasCapability<TS, TC> {
  layers: CanvasLayer<TS, TC>[];
  initialView?: { zoom: number; pan: Point } | { fit: Bounds };
  scene?: Scene;
}

interface CanvasLayer<TS, TC> {
  id: string;
  draw: (args: { state: TS; config: TC; view: View; dims: Dims }) => DrawCommand[];
  deps?: (state: TS, config: TC) => readonly unknown[];
  space?: 'world' | 'screen';
}
```

`draw` returns a command tree instead of painting into a 2D context. World-space layers emit
world coordinates and the renderer applies the view — the same contract `RenderLayer` already
states, so a labkit layer *is* a `RenderLayer` with the instrument's state bound in.

An instrument that supplies `scene` gets weasel's selection chrome, affordances and tools over
the same surface. One that omits it gets a canvas that is nothing but its own layers. Both
paths are the same component.

## Per-layer invalidation

`drawLayers` calls `layer.draw(...)` unconditionally on every frame
(`core/layers/render.ts:147`), so a static layer rebuilds its command tree as often as a hot
one. The 2D scheduler tried to solve this with a dirty set, but `Trial` rebuilt every layer
closure on any state change, so the set was always full — the mechanism worked and never had
anything to discriminate.

Caching moves to the command tree, keyed on what the layer says it depends on:

```ts
deps: (state) => [state.contour, state.centre]
```

`deps` belongs on `RenderLayer`, not on labkit's wrapper — the caching is in core and serves
every `SceneCanvas` consumer, so labkit's `CanvasLayer.deps` is passed straight through rather
than interpreted.

`drawLayers` is a pure function and cannot hold the cache itself. The cache is owned by the
canvas instance and threaded in as a parameter — `drawLayers(..., cache)` where `cache` is a
`Map<string, { deps: readonly unknown[]; cmds: DrawCommand[] }>` held in a ref beside
`glRendererRef`. Entries are dropped when a layer unregisters, so a registered-then-detached
layer cannot leak its tree. A caller that passes no cache gets today's behavior exactly.

A hit reuses the previous `DrawCommand[]` when `deps` is shallow-equal to the last call. The
renderer still dispatches every layer every frame; what is skipped is rebuilding the tree —
walking state, allocating arrays, flattening paths. A layer that omits `deps` rebuilds every
frame, so this is opt-in and nothing changes for a layer that doesn't ask.

**The trees must be treated as immutable.** A cached command tree is handed to the renderer
again on the next frame, so a layer that mutates what it previously returned corrupts the
cache silently rather than erroring. Document it on `RenderLayer.deps`.

**What this does not do** is skip GPU dispatch for a clean layer. That would need
render-to-texture per layer and compositing, which the renderer has no concept of. Whether
dispatch alone is expensive enough to want that is a measurement nobody has taken; take it
before building it.

## What the renderer already gives a ported layer

Both things a 2D layer needs and an earlier draft of this spec claimed were missing already exist;
do not build them again.

- **Dashed strokes.** `Stroke.dash` (`core/paint-types.ts:134`) split at flatten time by
  `splitForDash` (`features/paths/tessellate/stroke.ts:329`), with the pattern in the stroke mesh
  cache key. It carries anchor parameters across dash boundaries and handles closed subpaths.
- **Hairlines.** `RenderLayer.draw` receives `(data, view, dims)`, so a layer computes
  `1 / meanScale(view.scale)` itself — `features/grid/layer.ts:78` does.

`Stroke.width: { px }` was added on top of these as sugar: it moves that division into the renderer
and lets the mesh cache key see the resolved width. It resolves against the **accumulated**
transform scale during traversal, not the view — groups nest and compose, so a path two groups deep
is scaled by the product. Under a non-uniform transform one scalar is a known lie, the same one
`core/viewport/pxExtent.ts` documents.

**Known defect.** `splitForDash` flushes a closed subpath's final run as its own open sub-polyline,
so when the pattern does not divide evenly into the perimeter the last and first dashes meet as two
butt-capped runs at the start vertex instead of one dash wrapping around.

## Where the view lives

`record.view` stays in the trial record. It is persisted, Reset restores it, and the sidebar
reads it — none of which the instrument can do for itself. What changes is that labkit stops
*applying* it and starts *supplying* it: `SceneCanvas` receives `view` and reports changes
back through `onViewChange`, exactly as `CanvasStack` did.

This resolves the `initialView.pan` note that prompted the work. `pan` is a screen offset, so
`{ x: 0, y: 0 }` puts world origin at the trial's top-left corner, and an instrument is
authored long before a viewport exists. `initialView: { fit: Bounds }` is resolved by the
runtime through `fitViewToBounds` once the trial element has non-zero size — labkit hosts that
element, so it is the only party that can. `RenderContext.trial` grows `view` and
`fitTo(bounds)` alongside the existing `zoom` / `setZoom`, so an instrument whose subject
changes can recentre as it goes.

**Prerequisite:** `computeFitView` is exported twice from core's public entry —
`index.ts:115` star-exports the viewport one from `useAutoCenter`, `index.ts:366` explicitly
exports a different one from `canvas/minimapMath`, and the explicit export shadows the star, so
the viewport version is unreachable. labkit's `weasel-canvas` passthrough re-exports the
minimap version under a name that reads like the viewport one. Rename one before anything
reaches for it.

## The other capabilities

`layers` and `dragDrop` are wired through the canvas path today and have to move with it.

**`layers`.** Visibility and order are applied inside `Trial`'s layer memo. `drawLayers`
already takes `visibility` and `order` and honors `alwaysOn` and `defaultVisible`, so labkit
passes its maps straight through and deletes its own filtering. `LayerDescriptor.alwaysOn`
gains a meaning it never had.

**`dragDrop`.** `useDragDrop` needs a view to turn a drop point into the `worldPos` that
`onDrop` receives; it keeps getting one, since labkit still owns `record.view`. The synthetic
`__lk_drag_feedback` canvas layer becomes a DOM overlay next to `DragOverlay` — it draws a
ring at a screen position and never needed to be inside the canvas.

## Two surface paths, deliberately

`2026-08-22-surface-scheduler-design.md` gives labkit a scheduler for labs that own their
surface — rects, dirty marking, DPR, rAF coalescing — and states that the renderer stays
outside the package. That is not in tension with this spec; it is the other path, for a lab
whose surface cannot be one `SceneCanvas` per trial. A lab tiling many panels from a single
GL context is the case that path exists for, since one `SceneCanvas` per trial is one WebGL
context per trial.

The capability is the default. The scheduler is the escape hatch. A lab picks one.

## Testing

- A layer's command tree is rebuilt when `deps` change and reused when they don't.
- A layer with no `deps` rebuilds every frame.
- `initialView: { fit }` produces a view that centres the bounds once the element has size,
  and does not refit on later resizes.
- `fitTo(bounds)` from an instrument recentres mid-session.
- View survives a reload; Reset restores `initialView`.
- Hiding a layer through the sidebar removes its commands; an `alwaysOn` layer ignores it.
- A drop reports world coordinates under a non-identity view.
- Dashed strokes hold their world-unit pattern across a zoom change.
- A layer that mutates a returned tree is not silently rewarded: the cache returns the same
  array identity, so the test asserts identity rather than deep equality.

No WebGL in the suite — assert on the command trees `drawLayers` returns.
