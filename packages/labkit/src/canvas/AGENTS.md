# Canvas — Agent Guide

The `src/canvas/` directory implements the layered canvas primitive used by the `canvas` instrument capability.

For a renderer labkit does not own — three.js, raw WebGL, anything with its own
render loop — see `src/surface/AGENTS.md` instead. `CanvasStack` is 2D and
schedules its own layers; a foreign renderer wants rects and dirtiness only.

## Files

| File | Role |
|---|---|
| `CanvasStack.tsx` | Layered `<canvas>` container; owns sizing and per-layer canvas refs |
| `CanvasStackContext.ts` | React context exposing the current `view` to descendants |
| `useLayerScheduler.ts` | DPR-aware rAF scheduler; redraws dirty layers on view/state changes |
| `CameraInput.tsx` | Pan, zoom, tap and home routed through weasel's gesture dispatcher; `CameraContext`; publishes the pointer |
| `Orbit.tsx` / `Orbit.less` | The 3D camera: kernel3d's orbit actions on a `camera3d` dep, through the same dispatcher |
| `orbitZoom.ts` | An orbit as a 2D `CameraView`, so the lab's zoom chrome dollies it |
| `cameraGestures.ts` / `cameraTouch.less` | Which gestures a camera takes, and the `touch-action` that follows from them |
| `cameraRegistry.ts` | Cameras by trial id, so chrome outside a trial (the lab header's zoom) can drive the focused one, 2D or orbit |
| `cameraView.ts` | The camera as a weasel `View` over frame-local coordinates, and the anchored zoom clamp |
| `LinkedCursor.tsx` | The crosshair on the camera's element while the pointer is over another view |
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
  minZoom?: number;                     // default 0.1; the opening zoom stays reachable
  maxZoom?: number;                     // default 32
  width?: number | string;              // default '100%'
  height?: number | string;             // default '100%'
  className?: string;
  onHitTest?: (worldPos: Point) => void;  // fired on tap (no drag)
  gestures?: CameraGestures;            // { pan, wheel: 'plain' | 'mod' | false, pinch, tap }
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
hands it to the camera (`useCameraView`), to the scheduler, and to every `render`.

**Every world↔screen path must go through the frame.** There are four, and each
one is a silent wrong answer if it is missed: `worldToScreen` / `screenToWorld`,
the camera (`applyCamera`), the camera as a weasel `View` (`cameraView.ts`), and
every action on the camera's dispatcher that reads a world point — the tap, and
`DragDropRuntime`'s palette drop — through `frameLocalToWorld`. A miss produces geometry that is off by a
constant, or a wheel that drifts — never an error.

## Coordinate conversions

- `screenToWorld({x, y}, view, frame?)` → world coords given a CSS-pixel offset relative to the container's top-left
- `worldToScreen({x, y}, view, frame?)` → inverse
- `applyCamera(ctx, view, frame?)` → puts a 2D context into world coordinates; the exact inverse of `screenToWorld`

All pure, and all default to `DEFAULT_FRAME` (top-left, y down).

## Pan/zoom behavior

Routed through the dispatcher by `<CameraInput>`. Mouse-wheel zoom is anchored at the cursor; primary-button drag pans.

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

`gestures` (on `<CanvasStack>`, `<Stage>`, `<Orbit>`, `<CameraInput>`, an
instrument's `canvas`, `stage` or `orbit`, and `<Lab>`, whose keys win) turns
each gesture off on its own: a drag, the wheel (`'plain'`, `'mod'` or `false`),
a pinch (`true`, or `'trackpad'` or `'touch'` alone — two fingers are pointers,
so a camera leaving every press to its content keeps the trackpad's), a tap,
and `home`, a double click
back to where the camera opened. A gesture the camera does not bind is never
claimed, so the page gets it: an unbound wheel scrolls, and the host's
`touch-action` (from `data-lk-touch`) hands one finger to the page once the
camera does not take a drag. `home` defaults on only for an orbit; a 2D
camera's double clicks usually belong to its content.

## The orbit

`<Orbit>` is the 3D camera, the sibling of `<Stage>`. Its view is kernel3d's
`Camera3d`, and its gestures are kernel3d's actions — `camera.orbit`,
`camera.pan` (Shift+drag), `camera.dolly`, `camera.pinchDolly`, `camera.home` —
on a `camera3d` dep its input scope provides, with an identity `clientToWorld`
as kernel3d expects. Its `viewport` prop names the element the scene is
drawn in when that is less than the orbit's own: the dispatcher binds there,
`data-lk-touch` goes there, and `camera3d.size()` measures it, which is what
`camera.pan` and `camera.dolly` scale and anchor against. It provides no
`CameraContext`, whose `view` is 2D, so the
loupe, the overview and `LinkedCursor` stay out of it; it publishes itself to
the camera registry as an `orbitZoomView`, whose scale is home distance over
distance, so the lab's zoom steps dolly it and its reset returns to the home
distance. `CameraView.zoomOf(view)` reads that zoom off a stored view rather
than the camera, so chrome rendering beside the trial is never a change late.

**A 3D view in a trial draws through the trial's orbit camera.** Whatever
renders it — three.js or raw GL in the instrument's DOM, or a surface tile —
calls `useOrbitView()` (`src/trial/useOrbitView.tsx`) for the camera and a
`viewportRef` for the pane the scene is drawn in. `useTrialOrbit()` is the
reader for chrome, and declares nothing.

A trial whose instrument leaves `orbit` undeclared and draws 3D anyway has a
camera nothing labkit owns can move, and Clone, Reset, and the zoom controls
pass it by. In development it warns once per instrument and marks its title
bar "no camera". It learns of a 3D view three ways: a `useOrbitView()` call;
a three.js `WebGLRenderer` whose canvas sits in the trial's DOM — three
announces each one on `__THREE_DEVTOOLS__`, which `src/trial/watch3d.ts`
defines or joins; and WebGL depth testing turned on for a canvas there, which
weasel's own 2D renderer never does. A raw WebGPU view is not seen. Declaring
`orbit` in any form ends it:

| Declared | Meaning |
|---|---|
| `orbit: {}` | The trial's orbit camera, with its gestures |
| `orbit: { fixed: true }` | The trial's camera, binding no gestures |
| `orbit: false` | The instrument keeps a camera of its own |

Raw GL that skips `useOrbitView`, and three's `WebGPURenderer`, which
announces nothing, go unnoticed. GL is no evidence of 3D — weasel's own
renderer is WebGL2 and 2D — and probing a canvas with `getContext` would
create a context.

Zoom is clamped to `[minZoom, maxZoom]` (defaults 0.1 / 32), settable via `CanvasStack`'s props and, for an instrument's own canvas, `CanvasCapability.minZoom` / `maxZoom`. The clamp always widens to admit whatever zoom the canvas opened at — an instrument declaring `initialView.zoom: 1600` with the default range is not clamped down to 32 on the first wheel event.

## Testing notes

JSDOM does not provide a real `CanvasRenderingContext2D`. Tests in `CanvasStack.test.tsx` rely on the scheduler's defensive checks; they do not assert pixels. For pixel testing, use Storybook's `chromatic` or visual snapshots in a real browser.
