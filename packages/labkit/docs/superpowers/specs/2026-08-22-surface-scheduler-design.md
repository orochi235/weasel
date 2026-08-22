# Panels over one surface — design spec

**Date:** 2026-08-22
**Status:** Draft
**Package paths:** `src/canvas/`
**Depends on:** the vocabulary refresh — this spec uses `trial` for what the
code calls a workspace today.

`WorkspaceGrid` gives every tile its own DOM subtree and `CanvasStack` gives
one container a stack of 2D canvases. Neither fits a lab whose tiles are
GPU-rendered: klieg's tube lab draws sixteen panels from a *single*
`WebGLRenderer`, one scissor rect per panel, because sixteen canvases would
exhaust the browser's WebGL context budget.

This adds the piece labkit is missing — rects, dirtiness and scheduling —
and leaves the drawing to the consumer.

## Scope

labkit owns four things: the trial-rect registry, per-trial dirty marking,
device-pixel-ratio and container-size delivery, and rAF coalescing so a
burst of invalidations costs one frame.

The consumer owns the surface. WebGL, `preserveDrawingBuffer`, the scissor
loop and any renderer library stay outside the package — a scheduler that
knows about them stops working for a shared 2D surface, which is the same
problem with a different backend.

## The primitive

```ts
useSurfaceScheduler({
  tiles,                                   // readonly TileId[]
  onFrame: (frame: SurfaceFrame) => void,
});

interface SurfaceFrame {
  dirty: ReadonlySet<TileId>;              // never empty
  rects: ReadonlyMap<TileId, Rect>;        // every tile, in surface space
  dpr: number;
  size: { width: number; height: number }; // the surface's own box, CSS px
}
```

`onFrame` fires at most once per animation frame, and only when something is
dirty. It receives every tile's rect, not only the dirty ones, because a
scissored draw needs to know where it is drawing relative to a surface that
may have resized under it.

`useSurfaceScheduler` returns the invalidators and provides them on a
context, so the surface owner has them directly and a trial nested anywhere
below reads them with `useSurface()`:

```ts
const { invalidate, invalidateAll, invalidateRects } = useSurface();
```

`invalidate(id)` marks one trial. A DPR change, a surface resize, or a
change to the tile set marks everything — the surface owner resizes once and
redraws all, which is what those events mean.

## Publishing a rect

```ts
const ref = useSurfaceTile(id);   // attach to the trial's own element
```

The hook measures the element and composes it against the surface
container's origin, so every rect arrives in one coordinate space regardless
of what nests between them. This is the same composition windease's flow
`GeometrySource` does for focus navigation, and it is worth keeping the two
readable against each other.

## Known limit: a trial that reflows without resizing

Nothing fires. A `ResizeObserver` sees a box change size, not a box move,
so a sibling's reflow that slides a trial sideways leaves its rect stale
until something else invalidates.

Mitigated, not solved: rects are recomputed whenever the tile set changes,
and `invalidateRects()` forces a remeasure for a host that knows it moved
something. windease shipped the same gap today in its flow render mode, and
the fix — whatever it is — should land in one place and be copied, not
invented twice.

## Refactoring `useLayerScheduler`

`useLayerScheduler` is canvas-per-layer to the bone: it takes a
`Map<string, HTMLCanvasElement>`, calls `getContext('2d')` itself, and
`clearRect`s before each layer draws. None of that survives a shared
surface, where clearing is scissored and acquiring the context is the
surface owner's job.

What the two *do* share is a dirty set and a rAF loop that coalesces into
one tick. Extract that as `useDirtyFrames` and put both schedulers on it.
Two independently-maintained rAF loops in one package drift, and the drift
shows up as a dropped frame nobody can reproduce.

`useLayerScheduler`'s public behavior does not change.

## What needs no new mechanism

**Pointer events.** Trials are real DOM elements, so a trial hit-tests
itself and forwards world coordinates the way it does today. The surface
never sees a pointer.

**Chrome.** Labels, badges and hover hints stay DOM, composed above the
surface, which sits behind the grid. The surface owns pixels and nothing
else.

## Testing

Headless, with a fake `onFrame` — no WebGL in the suite.

- Three invalidations in one tick produce one `onFrame` carrying all three.
- A clean tick fires nothing.
- A DPR change marks every tile dirty and reports the new `dpr`.
- Rects compose correctly through a nested offset parent.
- Adding or removing a trial remeasures every rect.
- `useLayerScheduler`'s existing tests pass unchanged on the extracted core.
