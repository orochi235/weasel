# Viewport follow-ups: inertial pan, animated zoom, touch pinch + SceneCanvas API reshape

**Date:** 2026-05-07

## Overview

Three additive viewport features (deferred from Phase 2c) plus a breaking reshape of the `SceneCanvas` prop surface. Per-axis zoom remains deferred.

## 1. Primitive layer

Four new hooks in `src/features/viewport/`.

### `useVelocityTracker()`

- `record(dx: number, dy: number, timestamp: number)` — call on each drag move.
- `getVelocity(): { vx: number; vy: number }` — average delta-per-ms over the last ~100ms of samples.
- `reset()` — clears samples.
- Stateless between `record` calls; no RAF involvement.
- Returns `{ record, getVelocity, reset }`.

### `useDecayLoop(config)`

```ts
type DecayLoopConfig = {
  velocity: { vx: number; vy: number };
  friction?: number;     // default 0.92
  minSpeed?: number;     // default 0.01 (world units/ms)
  boundary?: 'stop' | 'bounce'; // default 'stop'
  viewBounds?: ClampBounds;
  onTick: (dx: number, dy: number) => void;
  onEnd?: () => void;
};
```

- Starts a RAF loop on mount; multiplies velocity by `friction` each frame; calls `onTick(dx, dy)` with the frame delta.
- `boundary: 'stop'`: when `viewBounds` is supplied and the view hits the boundary, zeroes the relevant velocity component and clamps.
- `boundary: 'bounce'`: reflects the velocity component on boundary hit.
- Stops when speed (magnitude of velocity vector) drops below `minSpeed`.
- Returns `{ cancel: () => void }`.
- Cleans up RAF on unmount.

### `useViewTween(setView)`

```ts
function useViewTween(setView: (v: View) => void): {
  animateTo: (from: View, to: View, opts?: { duration?: number; easing?: (t: number) => number }) => void;
  cancel: () => void;
  isAnimating: React.RefObject<boolean>;
};
```

- Default duration: `250ms`.
- Default easing: ease-out-cubic, `(t) => 1 - Math.pow(1 - t, 3)`.
- Interpolates `x`, `y`, `scale` linearly with easing applied to the `t` parameter.
- Calls `setView` each frame.
- Cancels any in-flight tween when `animateTo` is called again.
- Cleans up RAF on unmount.

### `usePinchGesture(canvasRef, onPinch)`

```ts
function usePinchGesture(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onPinch: (anchor: { x: number; y: number }, scaleFactor: number) => void
): void;
```

- Attaches `pointermove`, `pointerup`, `pointercancel` listeners to the canvas element.
- Tracks up to two active pointer IDs in a `Map<number, { x: number; y: number }>`.
- When a second pointer goes down: records start distance and midpoint.
- While two pointers are active: on each `pointermove`, calls `onPinch(screenMidpoint, currentDistance / startDistance)`.
  - `scaleFactor` is delta-based (resets baseline each frame; not accumulated from pinch start).
  - `anchor` is in screen (CSS pixel) coordinates — callers convert to world coords via `clientToCanvas` + `screenToWorld`.
- Resets on pointer count dropping below 2.
- Cleans up listeners on unmount.

## 2. Tool layer

### `useHandTool` — gains `inertia` option

```ts
inertia?: false | { friction?: number; boundary?: 'stop' | 'bounce'; minSpeed?: number };
```

- Default: `inertia: false` (opt-in).
- On `drag.onMove`: `velocityTracker.record(dx, dy, Date.now())`.
- On `drag.onEnd`: reads `velocityTracker.getVelocity()`, starts `useDecayLoop` which calls `ctx.setView` with accumulated pan each frame; passes `ctx.viewBounds` as boundary bounds.
- On next `drag.onStart`: cancels any running decay loop.
- `velocityTracker.reset()` called on each `drag.onStart`.

### `usePinchZoomTool` — new ambient tool

- Location: `src/tools/builtin/usePinchZoomTool.ts`.
- Config: `{ min?: number; max?: number }` — same defaults as `useWheelZoomTool` (min `0.1`, max `8`).
- Uses `usePinchGesture` internally.
- On each pinch callback: converts `anchor` from screen to world coords using `clientToCanvas(ctx.canvasRef, anchor)` then `screenToWorld(anchor, viewToTransform(ctx.view))`; calls `zoomAt(ctx.view, worldAnchor, scaleFactor, { min, max })`; calls `ctx.setView(newView)`.
- Registered as ambient tool (same pattern as `useWheelZoomTool`).
- Exported from barrel alongside `useWheelZoomTool`.

### `useKeyboardZoomTool` — gains `animate` option

- New config: `animate?: boolean` (default `false`).
- When `animate: true`: instead of calling `ctx.setView(target)` directly, calls `animateTo(ctx.view, target)`.
- Cmd+0 reset uses duration `350ms`; Cmd+=/- steps use duration `200ms`.
- Uses `useViewTween(ctx.setView)` internally.

### `useViewAnimation(setView)` — new public hook

- Thin wrapper around `useViewTween(setView)`.
- Returns `{ animateTo, cancel }`.
- Location: `src/features/viewport/useViewAnimation.ts`.
- For consumers who want to programmatically fly to a view (e.g. "zoom to fit selection") outside a tool context.
- Exported from barrel.

## 3. SceneCanvas API reshape

**Breaking change**: replace flat props with grouped props.

**Removed flat props**: `moveOptions`, `resizeOptions`, `rotateOptions`, `snap`, `pickEvery`, `boundsOf`, `handleHitRadius`, `commitInsert`, `insertLayer`.

**New grouped props**:

```ts
geometry?: {
  pickEvery?: (worldX: number, worldY: number) => string | null;
  boundsOf?: (id: string) => Bounds | null;
};

selectTool?: {
  move?: UseMoveOptions<TPose>;
  resize?: UseResizeOptions<TPose>;
  rotate?: UseRotateOptions<TPose>;
  snap?: SnapStrategy<TPose>;
  handleHitRadius?: number;
};

viewport?: {
  inertia?: boolean | { friction?: number; boundary?: 'stop' | 'bounce'; minSpeed?: number };
  pinchZoom?: boolean | { min?: number; max?: number };
  animatedZoom?: boolean | { duration?: number; easing?: (t: number) => number };
};
```

`inertia: true` uses all defaults. `pinchZoom: true` uses default min/max. `animatedZoom: true` uses default duration/easing.

**SceneCanvas internals**: when `viewport` prop is present, synthesize and append the appropriate tools to the ambient list:

- `inertia` → pass inertia config to the internal `useHandTool`.
- `pinchZoom` → append `usePinchZoomTool(config)` to ambient.
- `animatedZoom` → pass `animate: true` + config to the internal `useKeyboardZoomTool`.

**Migration**: all existing demos and `apps/swillustrator/` that pass the old flat props must be updated to the new grouped shape. This is mechanical — search for `moveOptions=`, `resizeOptions=`, `snap=`, `pickEvery=`, `boundsOf=`, `handleHitRadius=`, `commitInsert=`, `insertLayer=` on `<SceneCanvas` and wrap appropriately (`commitInsert`/`insertLayer` wrap into `insertTool={{ create: ..., layer: ... }}`).

## 4. SceneCanvas insertTool reshape

**Breaking change**: collapse the flat `commitInsert` + `insertLayer` props on `<SceneCanvas>` into a single grouped `insertTool` prop, matching the shape used by `geometry`, `selectTool`, and `viewport`.

```ts
insertTool?: {
  create: (bounds: Bounds) => { pose: TPose; data: TData; id?: string } | null;
  layer?: TLayer;
};
```

- `commitInsert` is renamed to `insertTool.create`.
- `insertLayer` is renamed to `insertTool.layer`.
- `create` is required within the group — there is no sensible default factory the kit can derive (the consumer owns the `TPose`/`TData` shape).
- `layer` is optional and defaults to the trivial-form layer (same behaviour as the current `insertLayer` default).
- If `insertTool` is omitted entirely, the insert gesture is disabled (same semantic as omitting `commitInsert` today).

**`sceneToAdapter` is unchanged**: `SceneToAdapterOptions` keeps its internal `commitInsert` field name. Only the `<SceneCanvas>` prop surface changes — `sceneToAdapter` stays a lower-level seam consumers can target directly.

**Migration**: wrap existing usages —

```tsx
// before
<SceneCanvas
  commitInsert={(bounds) => ({ pose: bounds, data: { kind: 'rect' } })}
  insertLayer={myLayer}
/>

// after
<SceneCanvas
  insertTool={{
    create: (bounds) => ({ pose: bounds, data: { kind: 'rect' } }),
    layer: myLayer,
  }}
/>
```

## 5. File layout

New files:

```
src/features/viewport/useVelocityTracker.ts
src/features/viewport/useDecayLoop.ts
src/features/viewport/useViewTween.ts
src/features/viewport/usePinchGesture.ts
src/features/viewport/useViewAnimation.ts
src/tools/builtin/usePinchZoomTool.ts
```

Modified files:

```
src/tools/builtin/useHandTool.ts          (inertia option)
src/tools/builtin/useKeyboardZoomTool.ts  (animate option)
src/canvas/SceneCanvas.tsx                (geometry/selectTool/insertTool/viewport props)
src/index.ts                              (new exports)
```

No new demo files. Existing `HandToolDemo` or `SwillustratorDemo` validates the happy path.

## 6. Exports (barrel additions)

```ts
export { useVelocityTracker } from './features/viewport/useVelocityTracker';
export { useDecayLoop } from './features/viewport/useDecayLoop';
export type { DecayLoopConfig } from './features/viewport/useDecayLoop';
export { useViewTween } from './features/viewport/useViewTween';
export { usePinchGesture } from './features/viewport/usePinchGesture';
export { useViewAnimation } from './features/viewport/useViewAnimation';
export { usePinchZoomTool } from './tools/builtin/usePinchZoomTool';
```

## 7. Testing

- **`useVelocityTracker`**: unit tests — record deltas with known timestamps, assert `getVelocity()` returns correct average; assert samples older than 100ms are excluded.
- **`useDecayLoop`**: fake RAF — assert `onTick` receives decaying deltas each frame; assert stops below `minSpeed`; assert `boundary: 'stop'` zeroes velocity at bounds; assert `boundary: 'bounce'` reflects it; assert `cancel()` stops the loop.
- **`useViewTween`**: fake RAF — assert interpolated views hit expected waypoints at `t=0`, `t=0.5`, `t=1`; assert second `animateTo` cancels first mid-flight.
- **`usePinchGesture`**: fire synthetic `PointerEvent`s on a mock canvas element; assert `onPinch` is called with correct `scaleFactor` and `anchor`; assert resets correctly when a pointer lifts.
- **`usePinchZoomTool`**: integration test via `useTools` — synthetic two-pointer sequence, assert `setView` called with `zoomAt` result.
- **`useHandTool` inertia**: assert decay sequence fires after `pointerup`; assert cancelled on next `pointerdown`.

## 8. Deferred (do not implement now)

- Per-axis zoom (`scaleX`/`scaleY`) — see TODO entry; deferred again explicitly.
- `useDecayLoop` `boundary: 'bounce'` with spring overshoot — v1 is linear reflection only.
- Animated zoom for `useKeyboardZoomTool` Cmd+0 with `zoomTo(bounds)` fit-to-selection — that's a separate `animateTo` call sites problem.
- Inertia on `useWheelPanTool` — the velocity-tracker primitive makes this possible later; not in scope now.
- `insertTool.create` returning a typed discriminated union for multi-type insert (e.g. rect vs image vs ellipse from a single `<SceneCanvas>`). The current shape is single-factory; multi-type canvases wire their own `tools` array (one `useInsertTool` per type) instead of folding the variant switch into `create`.
