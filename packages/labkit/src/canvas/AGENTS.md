# Canvas — Agent Guide

The `src/canvas/` directory implements the layered canvas primitive used by the `canvas` instrument capability.

For a renderer labkit does not own — three.js, raw WebGL, anything with its own
render loop — see `src/surface/AGENTS.md` instead. `CanvasStack` is 2D and
schedules its own layers; a foreign renderer wants rects and dirtiness only.

`useOrbit` also lives here, as the 3D peer of `usePanZoom`. It produces a trial
view (`{ yaw, pitch, distance, target }`) rather than a matrix — turning that
into a camera is the host's job.

## Files

| File | Role |
|---|---|
| `CanvasStack.tsx` | Layered `<canvas>` container; owns sizing, pan/zoom handlers, and per-layer canvas refs |
| `CanvasStackContext.ts` | React context exposing the current `view` to descendants |
| `useLayerScheduler.ts` | DPR-aware rAF scheduler; redraws dirty layers on view/state changes |
| `usePanZoom.ts` | Pointer + wheel handlers that mutate `view` via `onViewChange` |
| `camera.ts` | `zoomAt` (fixed-point zoom) and `centerOn` (put a world point at a viewport's middle) |
| `canvasCoords.ts` | Pure `screenToWorld` / `worldToScreen` helpers |
| `worldSpec.ts` | The instrument's declared coordinate system, and the camera derived from it |
| `CanvasStack.less` | Container + canvas + overlay positioning |

## Props (`<CanvasStack>`)

```ts
interface CanvasStackProps {
  layers: CanvasLayerDescriptor[];      // { id, visible, render(ctx, view) }
  view: ViewTransform;                  // { zoom, pan: { x, y } }
  onViewChange: (v: ViewTransform) => void;
  worldSpec?: WorldSpec;                // origin + y direction; default top-left, y down
  onResize?: (size: ViewportSize) => void;
  minZoom?: number;                     // default 0.1, forwarded to usePanZoom
  maxZoom?: number;                     // default 32, forwarded to usePanZoom
  width?: number | string;              // default '100%'
  height?: number | string;             // default '100%'
  className?: string;
  onHitTest?: (worldPos: Point) => void;  // fired on tap (no drag)
  children?: ReactNode;                 // rendered into the overlay layer
}
```

## How rendering works

1. The container measures itself with `ResizeObserver` and reports `{width, height, dpr}`.
2. `useLayerScheduler` watches `layers`, `view`, and `size`, and on any change schedules a single `requestAnimationFrame` redraw.
3. Each layer's `render(ctx, view)` is called with a fresh transform: the canvas is sized to `width * dpr × height * dpr` so coordinates are in CSS pixels. A `CanvasLayerDescriptor` gets the whole `view` and places its own geometry; an instrument's `CanvasLayer.draw` is called with the camera already applied — see below.
4. Layers with `visible: false` are skipped and their canvas is `display: none` (DOM is preserved to avoid remounts).

## Adding a new layer type

A layer is defined by the instrument's `canvas.layers[]` (type `CanvasLayer`), then translated to a `CanvasLayerDescriptor` inside `Trial.tsx` before being passed to `<CanvasStack>`. To add a layer, push it into `instrument.canvas.layers`:

```ts
canvas: {
  worldSpec: { origin: { x: 0.5, y: 0.5 }, yAxis: 'up' },   // optional
  layers: [
    {
      id: 'grid',
      draw: (ctx, { state, config, zoom }) => { /* ... */ },
    },
  ],
}
```

`draw` receives the context with the camera already applied, so its coordinates are world coordinates — `Trial.tsx` calls `applyCamera(ctx, view, frame)` before calling it. `zoom` is still passed so a layer can keep line widths and handle sizes from growing: divide by it (`ctx.lineWidth = 1 / zoom`).

That is the difference between the two layer types. The lower-level `CanvasLayerDescriptor.render(ctx, view, frame)` gets the raw view, the resolved frame and an untransformed context, which is what screen-space chrome wants.

Layer order in the array = paint order (first drawn = bottom).

## Overlay (children)

The `children` prop renders in `.lk-canvas-stack__overlay`, which is `position: absolute; inset: 0; pointer-events: none`. Direct children re-enable pointer events. Use this for HUDs, scale indicators, or interactive overlays that don't belong in a canvas layer.

## The world spec

An instrument's world does not have to be labkit's. `CanvasCapability.worldSpec`
declares two things, and everything that maps between world and screen reads
them:

```ts
worldSpec: { origin: { x: 0.5, y: 0.5 }, yAxis: 'up' }   // centred, y upward
```

`origin` is a **fraction of the viewport** — where world (0,0) sits at `pan`
zero — so "centre" is `0.5` and needs no knowledge of the canvas size. `yAxis`
is `'down'` (default) or `'up'`. Omitting the spec entirely gives the original
convention: origin at the element's top-left, y downward.

`resolveFrame(spec, size)` turns a spec plus a measured viewport into a
`WorldFrame` — `{ originPx, yDir }` — which is what the rest of the directory
actually consumes. `CanvasStack` owns the measurement, so it owns the frame and
hands it to `usePanZoom`, to the scheduler, and to every `render`.

**Every world↔screen path must go through the frame.** There are four, and each
one is a silent wrong answer if it is missed: `worldToScreen` / `screenToWorld`,
the camera (`applyCamera`), the wheel anchor in `usePanZoom`, and
`DragDropRuntime`'s drop position. A miss produces geometry that is off by a
constant, or a wheel that drifts — never an error.

## Coordinate conversions

- `screenToWorld({x, y}, view, frame?)` → world coords given a CSS-pixel offset relative to the container's top-left
- `worldToScreen({x, y}, view, frame?)` → inverse
- `applyCamera(ctx, view, frame?)` → puts a 2D context into world coordinates; the exact inverse of `screenToWorld`

All pure, and all default to `DEFAULT_FRAME` (top-left, y down).

## Pan/zoom behavior

Implemented in `usePanZoom`. Mouse-wheel zoom is anchored at the cursor; primary-button drag pans. `isDragging()` is exposed so consumers can suppress click handlers during a pan.

The anchor is taken **in frame space** (`cursor - frame.originPx`), because
`pan` is measured from the frame's origin. Anchoring at the raw cursor instead
drifts by `(1 - ratio) * originPx` on every wheel step for any frame that moves
the origin — around 180x110 px per step on a centred 1430x870 canvas, with no
error raised. The anchoring itself is `zoomAt` in `camera.ts`, which the loupe's wheel also
uses — one fixed-point zoom rather than a copy per caller. Do not reach for
`zoomAt` from `@weasel-js/core` instead: that one clamps
`min(max, max(min, scale * factor))` per axis with positive defaults, so a y-up
view (`scale.y` negative) comes back at `+0.1` — flipped and collapsed. labkit's
holds one scalar zoom and keeps the y direction in the frame, so it has no such
axis to invert.

`CanvasCapability.initialView` may be a function of the viewport size instead of
a literal. labkit then leaves the trial's view `null` until the canvas is first
measured and places it from `onResize` — so an instrument framing content it can
only size against the viewport does not need a "have I centred yet" sentinel of
its own. Reset nulls the view again, which re-frames.

Zoom is clamped to `[minZoom, maxZoom]` (defaults 0.1 / 32), settable via `CanvasStack`'s props and, for an instrument's own canvas, `CanvasCapability.minZoom` / `maxZoom`. The clamp always widens to admit whatever zoom the canvas opened at — an instrument declaring `initialView.zoom: 1600` with the default range is not clamped down to 32 on the first wheel event.

## Testing notes

JSDOM does not provide a real `CanvasRenderingContext2D`. Tests in `CanvasStack.test.tsx` rely on the scheduler's defensive checks; they do not assert pixels. For pixel testing, use Storybook's `chromatic` or visual snapshots in a real browser.
