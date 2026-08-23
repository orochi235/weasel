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

`drawLayers` keeps the previous `DrawCommand[]` per layer id and reuses it when `deps` is
shallow-equal to the last call. The renderer still dispatches every layer every frame; what is
skipped is rebuilding the tree — walking state, allocating arrays, flattening paths. A layer
that omits `deps` rebuilds every frame, so this is opt-in and nothing changes for a layer that
doesn't ask.

This lands in `core/layers/render.ts` and serves every `SceneCanvas` consumer, not only
labkit.

**What this does not do** is skip GPU dispatch for a clean layer. That would need
render-to-texture per layer and compositing, which the renderer has no concept of. Whether
dispatch alone is expensive enough to want that is a measurement nobody has taken; take it
before building it.

## Renderer gaps to close

Two things a 2D layer can express and `DrawCommand` cannot. Both are features the target is
missing, and both block layers that would otherwise port mechanically:

- **Dashed strokes.** Nothing in `DrawCommand.ts` or `draw.ts` carries a dash pattern. Add
  `dash?: number[]` to `Stroke`, dashing at flatten time so a dash length stays in world units
  under zoom.
- **Hairlines.** 2D layers set `lineWidth = 1 / zoom` to hold a stroke at one pixel. Under a
  view-applied group transform the layer no longer knows the zoom at draw time. Add a
  screen-space stroke width — `width: { px: 1 }` against the existing world-unit number.

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

No WebGL in the suite — assert on the command trees `drawLayers` returns.
