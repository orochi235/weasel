# Per-axis Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `View.scale` from `number` to `{ x: number; y: number }` and expose per-axis zoom through the viewport primitives (`zoomAt`, `fitViewToBounds`) and built-in tools (`useWheelZoomTool`, `useKeyboardZoomTool`).

**Architecture:** State (`View.scale`, `ViewTransform.zoom`) is always a 2-vector. Input convenience types `ZoomFactor = number | {x,y}` and `ZoomBound = number | {x,y}` let scalar inputs mean "uniform". A new helper `meanScale(s) = Math.sqrt(s.x * s.y)` collapses per-axis scale to a scalar for chrome hit-test fallbacks (proper elliptical hit shapes deferred). Built-in tools gain an `axis: 'both' | 'x' | 'y'` option; modifier-key bindings stay out of the kit. `fitViewToBounds` gains a `mode: 'contain' | 'fill' | 'stretch'` option.

**Tech Stack:** TypeScript, React, Vitest. Kit imports use the path alias `core/viewport/...`. Tests run via `npm test`. Typecheck via `npm run typecheck`. Release-gate equivalent: `npm run prepublishOnly`.

**Spec:** `docs/superpowers/specs/2026-05-16-per-axis-zoom-design.md`

---

## File Structure

**New files:**
- `src/core/viewport/meanScale.ts` — `meanScale({x,y}) => Math.sqrt(x*y)`
- `src/core/viewport/meanScale.test.ts`
- `demo/demos/PerAxisZoomDemo.tsx`

**Modified files (types & primitives):**
- `src/core/viewport/view.ts` — `View.scale` → `{x,y}`; export `ZoomFactor`, `ZoomBound`
- `src/core/viewport/viewTransform.ts` — `ViewTransform.zoom` → `{x,y}`; per-axis `worldToScreen`/`screenToWorld`
- `src/core/viewport/zoomAt.ts` — `factor: ZoomFactor`, per-axis `opts.min`/`opts.max: ZoomBound`
- `src/core/viewport/fitViewToBounds.ts` — per-axis fit + `mode` option
- `src/core/viewport/clampView.ts` — per-axis visible rect
- `src/core/viewport/useViewTween.ts` — per-axis lerp
- `src/renderer/math/viewToMat3.ts` — per-axis diagonal entries
- `src/index.ts` (the barrel) — export `ZoomFactor`, `ZoomBound`, `meanScale`

**Modified files (consumer call-site sweep):**
- All viewport-primitive tests in `src/core/viewport/*.test.ts`
- `src/affordances/composeAffordanceLayer.ts` + test
- `src/canvas/Canvas.tsx`, `src/canvas/SceneCanvas/PointerProviderIfRoot.tsx`
- `src/core/pointer/stylus.ts`
- `src/debug/createDebugOverlayLayer.ts`
- `src/features/grid/layer.ts` + test
- `src/features/guides/layer.ts`
- `src/features/paths/penEditOverlay.ts`, `penPreviewLayer.ts`
- `src/features/selection/overlay.ts`
- `src/interactions/gestures/shared/strategies/guides.ts`
- `src/interactions/gestures/usePointerGestures.ts` (only comment refs)
- `src/tools/builtin/marquee.ts` + test
- `src/tools/builtin/useHandTool/useHandTool.test.ts`
- `src/tools/builtin/usePenTool/penEdit/hitOverride.ts`
- `src/tools/builtin/usePenTool/usePenTool.ts`
- `src/tools/builtin/useSelectTool/useSelectTool.ts`
- `src/tools/builtin/useWheelPanTool/useWheelPanTool.ts`
- `src/tools/builtin/useKeyboardZoomTool/useKeyboardZoomTool.ts` (just the `{ x: 0, y: 0, scale: 1 }` reset fixture; per-axis input option lands in Task 4)
- All `*.test.ts` files under `src/` carrying a `{ scale: <number> }` fixture (~189 occurrences)
- `apps/swillustrator/src/App.tsx`
- `demo/demos/ViewportDemo.tsx`, `ViewportLayerDemo.tsx`, `ZoomDemo.tsx`
- `demo/registry.ts` (description text)

---

## Task 1: Land the breaking type change

This task lands the entire `View.scale: number → {x, y}` migration atomically. Intermediate sub-steps may leave the type-checker red; the task is complete only when `npm run typecheck` and `npm test` are both green.

**Why one big task:** the type change ripples through ~76 read sites and ~189 test fixtures. Splitting across commits would leave the build red between them. The migration ships as one commit per the spec's migration section.

**Files: see "File Structure" above.**

- [ ] **Step 1: Update `src/core/viewport/view.ts`**

Replace the file with:

```ts
import type { ViewTransform } from './viewTransform';

/**
 * Viewport state. `(view.x, view.y)` is the **world point currently
 * rendered at the canvas top-left**; `view.scale.x` / `view.scale.y` is
 * pixels per world unit on each axis (default `{ x: 1, y: 1 }`). So:
 *
 *   screenX = (worldX - view.x) * view.scale.x
 *   screenY = (worldY - view.y) * view.scale.y
 *   worldX  = screenX / view.scale.x + view.x
 *   worldY  = screenY / view.scale.y + view.y
 *
 * `scale` is always a 2-vector. Input convenience types
 * {@link ZoomFactor} and {@link ZoomBound} let callers pass a scalar
 * when they want both axes treated the same.
 */
export interface View {
  x: number;
  y: number;
  scale: { x: number; y: number };
}

/**
 * Input convenience for zoom primitives. A `number` is treated as a
 * uniform factor applied to both axes; a `{x, y}` vector applies
 * per-axis factors.
 */
export type ZoomFactor = number | { x: number; y: number };

/**
 * Input convenience for zoom-clamp ranges. A `number` is applied as the
 * same bound on both axes; a `{x, y}` vector applies per-axis bounds.
 */
export type ZoomBound = number | { x: number; y: number };

/**
 * Bridge `View` into the legacy `ViewTransform` shape so chrome can keep
 * calling `worldToScreen` / `screenToWorld`. `View` and `ViewTransform`
 * use opposite sign conventions for the translation half (`view.x` is
 * camera position; `panX` is canvas translation), so the adapter flips
 * the sign and multiplies by per-axis scale.
 */
export function viewToTransform(view: View): ViewTransform {
  return {
    panX: -view.x * view.scale.x || 0,
    panY: -view.y * view.scale.y || 0,
    zoom: { x: view.scale.x, y: view.scale.y },
  };
}
```

- [ ] **Step 2: Update `src/core/viewport/viewTransform.ts`**

```ts
/** Pan offset (in pixels) plus per-axis zoom (pixels per content unit). */
export interface ViewTransform {
  panX: number;
  panY: number;
  zoom: { x: number; y: number };
}

/** Project a world-space point to screen-space pixels through a `ViewTransform`. */
export function worldToScreen(
  worldX: number,
  worldY: number,
  view: ViewTransform,
): [number, number] {
  return [view.panX + worldX * view.zoom.x, view.panY + worldY * view.zoom.y];
}

/** Inverse of `worldToScreen` — recover the world-space point under a screen-space pixel. */
export function screenToWorld(
  screenX: number,
  screenY: number,
  view: ViewTransform,
): [number, number] {
  return [(screenX - view.panX) / view.zoom.x, (screenY - view.panY) / view.zoom.y];
}
```

- [ ] **Step 3: Create `src/core/viewport/meanScale.ts`**

```ts
/**
 * Geometric mean of a per-axis scale. Used as a scalar fallback for chrome
 * hit-test radii and hairline stroke widths under non-uniform zoom.
 * Degenerates to `s.x` (or `s.y`) when the two axes are equal; otherwise
 * sits between them.
 *
 * Under non-uniform zoom a circular screen-pixel hit region projects to
 * an ellipse in world space (and vice versa). The geometric-mean
 * approximation is intentionally a v1 fallback — proper axis-aware
 * elliptical hit shapes are a future follow-up.
 */
export function meanScale(s: { x: number; y: number }): number {
  return Math.sqrt(s.x * s.y);
}
```

- [ ] **Step 4: Create `src/core/viewport/meanScale.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { meanScale } from './meanScale';

describe('meanScale', () => {
  it('returns the scale when both axes are equal', () => {
    expect(meanScale({ x: 1, y: 1 })).toBe(1);
    expect(meanScale({ x: 2.5, y: 2.5 })).toBe(2.5);
  });

  it('returns sqrt(x * y) when axes differ', () => {
    expect(meanScale({ x: 1, y: 4 })).toBe(2);
    expect(meanScale({ x: 9, y: 4 })).toBe(6);
  });

  it('lies between the two axes', () => {
    const m = meanScale({ x: 2, y: 8 });
    expect(m).toBeGreaterThan(2);
    expect(m).toBeLessThan(8);
  });
});
```

- [ ] **Step 5: Update `src/core/viewport/zoomAt.ts`**

```ts
import type { View, ZoomFactor, ZoomBound } from './view';

/** Optional clamp bounds for `zoomAt`. Defaults: min=0.1, max=8 (per axis). */
export interface ZoomClampOpts {
  min?: ZoomBound;
  max?: ZoomBound;
}

/**
 * Pure zoom primitive. Returns a new `View` whose `scale` is multiplied
 * by `factor` (per-axis, clamped) and whose translation is adjusted so
 * that the world point currently under `anchor` (screen coords relative
 * to the canvas top-left) stays under the same screen pixel after the
 * zoom — independently on each axis.
 *
 * `factor: number` means "apply uniformly to both axes". `factor: {x, y}`
 * applies per-axis factors. Likewise for `opts.min` / `opts.max`.
 */
export function zoomAt(
  view: View,
  anchor: { x: number; y: number },
  factor: ZoomFactor,
  opts?: ZoomClampOpts,
): View {
  const fx = typeof factor === 'number' ? factor : factor.x;
  const fy = typeof factor === 'number' ? factor : factor.y;
  const minX = typeof opts?.min === 'number' ? opts.min : opts?.min?.x ?? 0.1;
  const minY = typeof opts?.min === 'number' ? opts.min : opts?.min?.y ?? 0.1;
  const maxX = typeof opts?.max === 'number' ? opts.max : opts?.max?.x ?? 8;
  const maxY = typeof opts?.max === 'number' ? opts.max : opts?.max?.y ?? 8;

  const nextX = Math.min(maxX, Math.max(minX, view.scale.x * fx));
  const nextY = Math.min(maxY, Math.max(minY, view.scale.y * fy));

  const worldX = anchor.x / view.scale.x + view.x;
  const worldY = anchor.y / view.scale.y + view.y;
  return {
    scale: { x: nextX, y: nextY },
    x: worldX - anchor.x / nextX,
    y: worldY - anchor.y / nextY,
  };
}
```

- [ ] **Step 6: Update `src/core/viewport/clampView.ts`**

Replace the body of `clampView`:

```ts
export function clampView(view: View, bounds: ClampBounds, canvas: CanvasSize): View {
  const visW = canvas.width / view.scale.x;
  const visH = canvas.height / view.scale.y;

  let x: number;
  if (visW >= bounds.width) {
    x = bounds.x + (bounds.width - visW) / 2;
  } else {
    const minX = bounds.x;
    const maxX = bounds.x + bounds.width - visW;
    x = view.x < minX ? minX : view.x > maxX ? maxX : view.x;
  }

  let y: number;
  if (visH >= bounds.height) {
    y = bounds.y + (bounds.height - visH) / 2;
  } else {
    const minY = bounds.y;
    const maxY = bounds.y + bounds.height - visH;
    y = view.y < minY ? minY : view.y > maxY ? maxY : view.y;
  }

  return x === view.x && y === view.y ? view : { x, y, scale: view.scale };
}
```

Also update the doc comment to say `canvas.width / view.scale.x` and `canvas.height / view.scale.y`.

- [ ] **Step 7: Update `src/core/viewport/useViewTween.ts`**

Replace the `lerpView` helper:

```ts
function lerpView(from: View, to: View, t: number): View {
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    scale: {
      x: lerp(from.scale.x, to.scale.x, t),
      y: lerp(from.scale.y, to.scale.y, t),
    },
  };
}
```

- [ ] **Step 8: Update `src/core/viewport/fitViewToBounds.ts` (per-axis only — mode option lands in Task 2)**

Update the scale computation to be per-axis, defaulting to today's `'contain'` behavior:

```ts
const availW = Math.max(1, viewportDims.width - padding * 2);
const availH = Math.max(1, viewportDims.height - padding * 2);
const sx = availW / bounds.width;
const sy = availH / bounds.height;
// 'contain' (today's behavior): uniform min of axes
const uniform = Math.min(sx, sy);
const scaleX = Math.min(maxScale, Math.max(minScale, uniform));
const scaleY = scaleX;

const worldCx = bounds.x + bounds.width / 2;
const worldCy = bounds.y + bounds.height / 2;
return {
  x: worldCx - viewportDims.width / (2 * scaleX),
  y: worldCy - viewportDims.height / (2 * scaleY),
  scale: { x: scaleX, y: scaleY },
};
```

Update the doc comments accordingly. The `mode` option lands in Task 2; right now the behavior is still uniform `'contain'`.

- [ ] **Step 9: Update `src/renderer/math/viewToMat3.ts`**

Update the local `View` type and the function body:

```ts
export interface View {
  x: number;
  y: number;
  scale: { x: number; y: number };
}

export function viewToMat3(view: View): Mat3 {
  const sx = view.scale.x;
  const sy = view.scale.y;
  const tx = -view.x * sx + 0;
  const ty = -view.y * sy + 0;
  return new Float32Array([
    sx, 0, 0,
    0, sy, 0,
    tx, ty, 1,
  ]) as Mat3;
}
```

- [ ] **Step 10: Update viewport-primitive tests**

Update each `src/core/viewport/*.test.ts` file with the new fixture shape and add per-axis assertions.

**`src/core/viewport/view.test.ts`** — find every `scale: <num>` literal in a `View` construction and rewrite to `scale: { x: <num>, y: <num> }`. Add a new test asserting `viewToTransform` per-axis pass-through with `scale: { x: 2, y: 3 }`.

**`src/core/viewport/viewTransform.test.ts`** — change the fixture to `const view = { panX: 10, panY: 20, zoom: { x: 2, y: 2 } }`. Add a new test:

```ts
describe('per-axis zoom', () => {
  const view = { panX: 10, panY: 20, zoom: { x: 2, y: 3 } };

  it('multiplies each coord by its axis zoom', () => {
    const [sx, sy] = worldToScreen(5, 4, view);
    expect(sx).toBe(10 + 5 * 2);
    expect(sy).toBe(20 + 4 * 3);
  });

  it('round-trips per-axis', () => {
    const [sx, sy] = worldToScreen(7, 11, view);
    const [wx, wy] = screenToWorld(sx, sy, view);
    expect(wx).toBeCloseTo(7);
    expect(wy).toBeCloseTo(11);
  });
});
```

**`src/core/viewport/zoomAt.test.ts`** — update existing fixtures (`scale: 1` → `scale: { x: 1, y: 1 }`; `next.scale` assertions become `next.scale.x` / `next.scale.y`). Add new tests:

```ts
describe('zoomAt — per-axis', () => {
  it('per-axis factor scales each axis independently', () => {
    const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const next = zoomAt(view, { x: 0, y: 0 }, { x: 2, y: 4 });
    expect(next.scale.x).toBe(2);
    expect(next.scale.y).toBe(4);
  });

  it('per-axis factor preserves the anchor on each axis', () => {
    const view = { x: 10, y: 20, scale: { x: 1, y: 1 } };
    const anchor = { x: 100, y: 50 };
    // worldX = 100/1 + 10 = 110; worldY = 50/1 + 20 = 70
    const next = zoomAt(view, anchor, { x: 2, y: 4 });
    expect(anchor.x / next.scale.x + next.x).toBeCloseTo(110);
    expect(anchor.y / next.scale.y + next.y).toBeCloseTo(70);
  });

  it('per-axis clamp bounds clamp each axis independently', () => {
    const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const next = zoomAt(view, { x: 0, y: 0 }, 100, {
      min: { x: 0.5, y: 0.25 },
      max: { x: 2, y: 5 },
    });
    expect(next.scale.x).toBe(2);
    expect(next.scale.y).toBe(5);
  });

  it('scalar clamp applies the same bound to both axes', () => {
    const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const next = zoomAt(view, { x: 0, y: 0 }, { x: 100, y: 0.001 }, { min: 0.5, max: 2 });
    expect(next.scale.x).toBe(2);
    expect(next.scale.y).toBe(0.5);
  });
});
```

**`src/core/viewport/clampView.test.ts`** — update fixtures (`scale: 0.5` → `scale: { x: 0.5, y: 0.5 }`). Add one per-axis test:

```ts
it('uses per-axis visible rect when scale axes differ', () => {
  // canvas 100x100, scale {x: 1, y: 2} -> visible world rect 100x50
  const view = { x: -10, y: -10, scale: { x: 1, y: 2 } };
  const bounds = { x: 0, y: 0, width: 200, height: 200 };
  const canvas = { width: 100, height: 100 };
  const clamped = clampView(view, bounds, canvas);
  expect(clamped.x).toBe(0); // hit left edge (visW=100 < 200)
  expect(clamped.y).toBe(0); // hit top edge (visH=50 < 200)
});
```

**`src/core/viewport/useViewTween.test.ts`** — update existing fixtures. Add per-axis lerp test:

```ts
it('lerps each scale axis independently', () => {
  // ... using existing fake-RAF setup, animate from
  // scale: { x: 1, y: 1 } to scale: { x: 4, y: 2 } over 200ms
  // at t=0.5 (after 100ms), assert scale.x ~= 2.5, scale.y ~= 1.5
  // (or whatever the existing test's easing produces at midpoint)
});
```

Match the existing test file's RAF-mocking convention. The midpoint value depends on the easing (`easeOutCubic`); compute it as `lerp(1, 4, easeOutCubic(0.5))` and `lerp(1, 2, easeOutCubic(0.5))`.

**`src/core/viewport/fitViewToBounds.test.ts`** — every `expect(v.scale)` becomes `expect(v.scale.x)` (also assert `v.scale.y` equals `v.scale.x` — still uniform until Task 2). Update fixtures (`CURRENT` becomes `scale: { x: 7, y: 7 }`).

**`src/core/viewport/useViewAnimation.test.ts`** — fixture sweep only; no new behavior.

- [ ] **Step 11: Run viewport-only tests to confirm green**

Run: `npx vitest run src/core/viewport/`
Expected: PASS for all suites in that directory.

If failures: fix the test fixtures or primitive code. Do not proceed until green.

- [ ] **Step 12: Sweep `view.scale` reads outside `core/viewport/`**

Each call site below replaces `view.scale` with either a per-axis expression (`view.scale.x` / `view.scale.y`) or with `meanScale(view.scale)`. Use the categorization below.

Add the import `import { meanScale } from 'core/viewport/meanScale';` to any file in the second list.

**Per-axis (axis-aware) sites** — `view.scale` decomposes into per-coord factors:

| File | Line context | Replacement |
|---|---|---|
| `src/canvas/Canvas.tsx` | `worldX = (cx - rect.left) / view.scale + view.x` (×2 sites) | `/ view.scale.x` for x; `/ view.scale.y` for y |
| `src/canvas/SceneCanvas/PointerProviderIfRoot.tsx` | `worldX/Y` derivation | per-axis |
| `src/core/pointer/stylus.ts` | `worldX: screenX / ctx.view.scale + ctx.view.x` | per-axis |
| `src/debug/createDebugOverlayLayer.ts` | (audit; per-axis where coords differ) | per-axis |
| `src/features/guides/layer.ts` | `sx = (g.offset - view.x) * view.scale` (vertical guide), `sy = (g.offset - view.y) * view.scale` (horizontal) | vertical guide: `.x`; horizontal guide: `.y` |
| `src/features/paths/penEditOverlay.ts` | `(wx - view.x) * view.scale`, `(wy - view.y) * view.scale` | x-coord: `.x`; y-coord: `.y` |
| `src/features/paths/penPreviewLayer.ts` | same pattern | same |
| `src/features/selection/overlay.ts` | `b.width * view.scale`, `b.height * view.scale` | `b.width * view.scale.x`, `b.height * view.scale.y` |
| `src/tools/builtin/marquee.ts` | `bounds.width * view.scale`, `bounds.height * view.scale` | `.x` / `.y` |
| `src/tools/builtin/useSelectTool/useSelectTool.ts` | `const sw = w * view.scale; const sh = h * view.scale;` | `w * view.scale.x`; `h * view.scale.y` |
| `src/tools/builtin/useWheelPanTool/useWheelPanTool.ts` | `dx = e.deltaX / v.scale; dy = e.deltaY / v.scale` | `dx = e.deltaX / v.scale.x; dy = e.deltaY / v.scale.y`. The `newView` constructor at lines 78-82 takes `scale: v.scale` — that already passes the per-axis vector unchanged. Update the inertia `next.scale: cur.scale` similarly (already correct after `View` reshape). Update the `viewRef.current = { x: 0, y: 0, scale: 1 }` initialization at line 51 to `scale: { x: 1, y: 1 }`. Update the JSDoc comment that says `(deltaX / view.scale, deltaY / view.scale)`. |

**Scalar (geometric-mean) sites** — `view.scale` is used as a single scalar for hit radii / hairline strokes:

| File | Line context | Replacement |
|---|---|---|
| `src/affordances/composeAffordanceLayer.ts` | `region.shape.hitRadiusPx / view.scale` (×2) | `/ meanScale(view.scale)` |
| `src/features/grid/layer.ts` | `const px = 1 / Math.max(0.0001, view.scale)` | `1 / Math.max(0.0001, meanScale(view.scale))` |
| `src/tools/builtin/usePenTool/penEdit/hitOverride.ts` | `ANCHOR_HIT_RADIUS_PX / view.scale`, `HANDLE_HIT_RADIUS_PX / view.scale`, `SEGMENT_HIT_RADIUS_PX / view.scale` | each `/ meanScale(view.scale)` |
| `src/tools/builtin/usePenTool/usePenTool.ts` | `optsRef.current.closeHitRadius / view.scale` (×2 sites — one uses `view`, one uses `ctx.view`) | `/ meanScale(view.scale)` and `/ meanScale(ctx.view.scale)` |
| `src/interactions/gestures/shared/strategies/guides.ts` | guide trigger radius (audit; uses `view.scale` from `getView()`) | `/ meanScale(view.scale)` |

**Comment-only sites** — no code change needed; if you want the comments to match the new shape, update the prose:

- `src/affordances/composeAffordanceLayer.test.ts` line 203 (test name)
- `src/affordances/types.ts` line 16
- `src/interactions/gestures/usePointerGestures.ts` line 93

- [ ] **Step 13: Sweep test fixtures across all of `src/`**

Find every `scale: <number>` literal in `src/` test files outside `core/viewport/` and rewrite to `scale: { x: <number>, y: <number> }`. Confirm with:

```
grep -rEn "scale: [0-9.]+(\b|,|\s|})" src/ --include="*.test.ts" --include="*.test.tsx" | grep -v "scale: { x:"
```

After the sweep, the command should return zero hits (or only matches inside string literals / comments — verify visually).

Key test files to update (this is the ~189-occurrence sweep):

- `src/affordances/composeAffordanceLayer.test.ts`, `cornerResize.test.ts`, `rotationHandle.test.ts`
- `src/canvas/buildSceneTree.test.ts`
- `src/debug/createDebugOverlayLayer.test.ts`
- `src/features/grid/layer.test.ts`
- `src/interactions/gestures/usePointerGestures.test.ts`, `edit-anchors/overlay.test.ts`, `shared/strategies/guides.test.ts`, `resize/geometry.test.ts`, `resize/behaviors/snapToGuides.test.ts`
- `src/renderer/math/viewToMat3.test.ts`
- `src/tools/dispatcher.test.ts`, `dispatcher.hitOverride.test.ts`
- `src/tools/routing/defineTool.test.ts`, `defineViewportTool.test.ts`
- `src/tools/builtin/marquee.test.ts`, `useHandTool/useHandTool.test.ts`, `useKeyboardZoomTool/useKeyboardZoomTool.test.ts`, `useWheelZoomTool/useWheelZoomTool.test.ts`, `usePinchZoomTool/usePinchZoomTool.test.ts`, `integration.test.tsx`
- `src/core/pointer/stylus.test.ts`
- `src/core/layers/render.test.ts`

A safe Edit-tool pattern per file: use `replace_all` with `old_string: "scale: 1"` and `new_string: "scale: { x: 1, y: 1 }"`, then repeat for each numeric value in that file (`scale: 2`, `scale: 0.5`, `scale: 7`, etc.). Verify each file's tests still parse after the rewrite.

In `useKeyboardZoomTool.ts` line ~78 there's a reset target literal `{ x: 0, y: 0, scale: 1 }` in production code — update that too.

- [ ] **Step 14: Update apps/swillustrator**

`apps/swillustrator/src/App.tsx`:

| Line | Original | Replacement |
|---|---|---|
| 1087 | `centerOnDoc(view.scale)` | `centerOnDoc(view.scale.x)` (chip is single-number — pick x as canonical) |
| 1537 | `PICK_RADIUS_PX / view.scale` | `PICK_RADIUS_PX / meanScale(view.scale)` (import `meanScale`) |
| 1784–1785 | `worldX: (localX - view.x) / view.scale, worldY: (localY - view.y) / view.scale` | per-axis |
| 1826–1827 | `doc.size.width * view.scale`, `doc.size.height * view.scale` | per-axis (`.x` / `.y`) |
| 2339–2340 | `worldX = (e.clientX - rect.left) / view.scale + view.x` | per-axis |
| 2484 | `<span>zoom: {(view.scale * 100).toFixed(0)}%</span>` | `view.scale.x` |
| 2806 | `value={Math.round(p.view.scale * 100)}` | `p.view.scale.x` |

Search the file for any other `view.scale` references with `grep -n "view\.scale" apps/swillustrator/src/App.tsx`.

Also: anywhere in the app that constructs an initial `View` literal (e.g. `{ x: 0, y: 0, scale: 1 }`), update to `scale: { x: 1, y: 1 }`. Look in:
- `apps/swillustrator/src/App.tsx`
- `apps/swillustrator/src/state/*.ts` (any view-state shape)
- `apps/swillustrator/src/recorder.ts`, `replay.ts` (serialized snapshots — be careful: if recordings are persisted with the old shape, you may need a small migration; check whether the JSON shape is exposed externally)

- [ ] **Step 15: Update demos**

`demo/demos/ViewportDemo.tsx` lines 72, 84: `14 / view.scale` and `1.5 / view.scale` → both `meanScale(view.scale)` (these are screen-pinned scalar divisors). Import `meanScale`.

`demo/demos/ViewportLayerDemo.tsx`:
- Lines 86–87: `worldW = W / view.scale`, `worldH = H / view.scale` → `W / view.scale.x`, `H / view.scale.y`
- Line 135: `×{view.scale.toFixed(2)}` → `×{view.scale.x.toFixed(2)}` (chip is single-number; pick x)

`demo/demos/ZoomDemo.tsx`:
- Line 24 (comment about `2 / view.scale`): if there's actual code using `2 / view.scale` for a stroke width, change to `2 / meanScale(view.scale)` and update the comment.
- Line 46: `scale: {view.scale.toFixed(2)}` → `scale: ({view.scale.x.toFixed(2)}, {view.scale.y.toFixed(2)})`
- Line 54: comment update only

`demo/registry.ts` line 399: prose description references `view.scale` — light copy-edit to read as "divides lineWidth by `meanScale(view.scale)`" (or rephrase as "by the geometric mean of the view scale").

Any demo that constructs an initial `View` literal — sweep with `grep -n "scale: [0-9]" demo/demos/`.

- [ ] **Step 16: Update kit barrel `src/index.ts`**

Add `ZoomFactor`, `ZoomBound`, `meanScale` to the exports. Locate the viewport section (search for `worldToScreen`) and add alongside:

```ts
export { meanScale } from 'core/viewport/meanScale';
export type { ZoomFactor, ZoomBound } from 'core/viewport/view';
```

If the barrel uses re-exports through `src/subpaths/`, also update `src/subpaths/viewport.ts` (if present) and `tsup.config.ts` if a new entry is needed. Check with: `ls src/subpaths/ 2>/dev/null` and verify the viewport subpath shape.

- [ ] **Step 17: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — no errors.

If errors: each error pinpoints a missed call site. Fix and re-run. Common misses: `View` constructed inline with `scale: 1`, `view.scale` used as a number in arithmetic, type-only imports of `View` from `core/viewport/view` in test files.

- [ ] **Step 18: Run the full test suite**

Run: `npm test`
Expected: PASS — all suites green.

If failures: most likely a test fixture that was missed. Fix and re-run.

- [ ] **Step 19: Run the demo build**

Run: `npm run build:demo`
Expected: PASS.

This catches Vite-side resolution issues that `tsc --noEmit` doesn't (see TODO: "Demo build not in `prepublishOnly`").

- [ ] **Step 20: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(viewport): per-axis scale (View.scale: {x, y})

View.scale and ViewTransform.zoom become {x, y} vectors. zoomAt accepts
ZoomFactor = number | {x, y} and per-axis min/max clamps. Adds meanScale
helper for chrome hit-test scalars (proper elliptical hit shapes
deferred). All ~76 consumer sites and ~189 test fixtures migrated.

fitViewToBounds stays uniform-'contain' behavior; mode option lands in
follow-up. useWheelZoomTool / useKeyboardZoomTool stay uniform; axis
option lands in follow-ups.

Spec: docs/superpowers/specs/2026-05-16-per-axis-zoom-design.md
EOF
)"
```

---

## Task 2: `fitViewToBounds` mode option

**Files:**
- Modify: `src/core/viewport/fitViewToBounds.ts`
- Modify: `src/core/viewport/fitViewToBounds.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `fitViewToBounds.test.ts`:

```ts
describe('fitViewToBounds — mode', () => {
  it("'fill' picks the larger axis ratio (uniform, overflows one axis)", () => {
    // bounds 10x100 in viewport 200x200 with padding 0:
    //   sx = 200/10 = 20 (would clamp to maxScale 10)
    //   sy = 200/100 = 2
    //   'fill' = max → 10 (clamped); bounds overflow on x axis
    const v = fitViewToBounds(
      { x: 0, y: 0, width: 10, height: 100 },
      { width: 200, height: 200 },
      CURRENT,
      { padding: 0, mode: 'fill' },
    );
    expect(v.scale.x).toBe(10);
    expect(v.scale.y).toBe(10);
  });

  it("'stretch' uses per-axis fit (non-uniform, bounds match viewport exactly)", () => {
    const v = fitViewToBounds(
      { x: 0, y: 0, width: 10, height: 100 },
      { width: 200, height: 200 },
      CURRENT,
      { padding: 0, mode: 'stretch' },
    );
    expect(v.scale.x).toBe(10); // clamped by maxScale
    expect(v.scale.y).toBe(2);
  });

  it("'contain' is the default and matches today's behavior", () => {
    const v = fitViewToBounds(
      { x: 0, y: 0, width: 10, height: 100 },
      { width: 200, height: 200 },
      CURRENT,
      { padding: 0 }, // no mode -> default 'contain'
    );
    expect(v.scale.x).toBe(2);
    expect(v.scale.y).toBe(2);
  });

  it("'stretch' clamps each axis to minScale/maxScale independently", () => {
    const v = fitViewToBounds(
      { x: 0, y: 0, width: 1000, height: 0.01 },
      { width: 100, height: 100 },
      CURRENT,
      { padding: 0, mode: 'stretch', minScale: 0.5, maxScale: 5 },
    );
    expect(v.scale.x).toBe(0.5);  // sx = 0.1, clamped up
    expect(v.scale.y).toBe(5);    // sy = 10000, clamped down
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run src/core/viewport/fitViewToBounds.test.ts -t "mode"`
Expected: FAIL (mode option not implemented yet).

- [ ] **Step 3: Add the mode option to fitViewToBounds**

In `src/core/viewport/fitViewToBounds.ts`, update `FitViewToBoundsOptions`:

```ts
export interface FitViewToBoundsOptions {
  padding?: number;
  maxScale?: number;
  minScale?: number;
  /**
   * Fit mode:
   * - `'contain'` (default): uniform scale = `min(availW/w, availH/h)`. Bounds fit entirely; one axis has letterboxing.
   * - `'fill'`: uniform scale = `max(...)`. Bounds overflow viewport on one axis.
   * - `'stretch'`: per-axis scale. Bounds match viewport exactly; scale is non-uniform.
   */
  mode?: 'contain' | 'fill' | 'stretch';
}
```

Replace the scale-computation block from Task 1 Step 8 with the mode-aware version:

```ts
const availW = Math.max(1, viewportDims.width - padding * 2);
const availH = Math.max(1, viewportDims.height - padding * 2);
const sx = availW / bounds.width;
const sy = availH / bounds.height;

let rawX: number;
let rawY: number;
switch (opts.mode ?? 'contain') {
  case 'fill': {
    const u = Math.max(sx, sy);
    rawX = u;
    rawY = u;
    break;
  }
  case 'stretch':
    rawX = sx;
    rawY = sy;
    break;
  case 'contain':
  default: {
    const u = Math.min(sx, sy);
    rawX = u;
    rawY = u;
    break;
  }
}
const scaleX = Math.min(maxScale, Math.max(minScale, rawX));
const scaleY = Math.min(maxScale, Math.max(minScale, rawY));

const worldCx = bounds.x + bounds.width / 2;
const worldCy = bounds.y + bounds.height / 2;
return {
  x: worldCx - viewportDims.width / (2 * scaleX),
  y: worldCy - viewportDims.height / (2 * scaleY),
  scale: { x: scaleX, y: scaleY },
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/core/viewport/fitViewToBounds.test.ts`
Expected: PASS, including the new `mode` block AND the existing contain-only tests.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/viewport/fitViewToBounds.ts src/core/viewport/fitViewToBounds.test.ts
git commit -m "feat(viewport): fitViewToBounds mode option (contain/fill/stretch)"
```

---

## Task 3: `useWheelZoomTool` axis option

**Files:**
- Modify: `src/tools/builtin/useWheelZoomTool/useWheelZoomTool.ts`
- Modify: `src/tools/builtin/useWheelZoomTool/useWheelZoomTool.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `useWheelZoomTool.test.ts` (match the file's existing dispatcher/synthetic-event pattern — read the file first to find the helper for firing a wheel event and capturing `setView` calls):

```ts
describe('useWheelZoomTool — axis option', () => {
  it("axis: 'x' only changes scale.x (scale.y unchanged)", () => {
    // ... using the file's existing wheel-event helper, with:
    //   useWheelZoomTool({ axis: 'x' })
    //   initial view: { x: 0, y: 0, scale: { x: 1, y: 1 } }
    //   wheel event: ctrlKey: true, deltaY: -100, clientX/Y at center
    // assert the resulting setView call has nextView.scale.y === 1
    // and nextView.scale.x > 1 (matches the default wheelStep, ~1.1).
  });

  it("axis: 'y' only changes scale.y (scale.x unchanged)", () => {
    // mirror of above
  });

  it("axis: 'both' (default) zooms both axes uniformly", () => {
    // existing default behavior; assert scale.x === scale.y after the wheel event
  });
});
```

(Use the actual fire/assert mechanics from the existing test file; pattern-match what's already there. If the file uses a dispatcher harness, follow it; if it fires events on a fake `ctx`, follow that.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tools/builtin/useWheelZoomTool/useWheelZoomTool.test.ts -t "axis option"`
Expected: FAIL (no `axis` option supported yet).

- [ ] **Step 3: Add the axis option**

Edit `src/tools/builtin/useWheelZoomTool/useWheelZoomTool.ts`. Add to `WheelZoomToolOpts`:

```ts
/**
 * Which axes the wheel event zooms.
 * - `'both'` (default): uniform zoom on both axes.
 * - `'x'`: zoom only the x axis (y scale unchanged).
 * - `'y'`: zoom only the y axis (x scale unchanged).
 *
 * Modifier-key bindings (e.g. shift+wheel → x-only) are intentionally not
 * baked into the kit — register a separate tool instance with a `when`
 * predicate, or wrap this tool, to express that policy.
 */
axis?: 'both' | 'x' | 'y';
```

Inside the wheel handler, construct the `ZoomFactor` based on `axis`:

```ts
const axis = opts.axis ?? 'both';
// ...
const factor = Math.pow(wheelStep, -e.deltaY / 100);
const zf: ZoomFactor =
  axis === 'both' ? factor :
  axis === 'x'    ? { x: factor, y: 1 } :
                    { x: 1, y: factor };
ctx.setView(zoomAt(ctx.view, anchor, zf, { min, max }));
```

Add `import type { ZoomFactor } from 'core/viewport/view';` to the imports. Add `axis` to the `useMemo` deps array.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/tools/builtin/useWheelZoomTool/`
Expected: PASS — both new and existing tests.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tools/builtin/useWheelZoomTool/
git commit -m "feat(tools): useWheelZoomTool axis option (both | x | y)"
```

---

## Task 4: `useKeyboardZoomTool` axis option

**Files:**
- Modify: `src/tools/builtin/useKeyboardZoomTool/useKeyboardZoomTool.ts`
- Modify: `src/tools/builtin/useKeyboardZoomTool/useKeyboardZoomTool.test.ts`

This mirrors Task 3 for keyboard zoom. Cmd+= / Cmd+- / Cmd+0 keystrokes respect the `axis` option.

- [ ] **Step 1: Write the failing tests**

Add a block to the existing test file (match its synthetic-keydown / dispatcher pattern):

```ts
describe('useKeyboardZoomTool — axis option', () => {
  it("axis: 'x' Cmd+= only zooms scale.x", () => {
    // initial view: { x: 0, y: 0, scale: { x: 1, y: 1 } }
    // fire Cmd+= keydown; assert setView called with scale.x > 1, scale.y === 1
  });

  it("axis: 'y' Cmd+= only zooms scale.y", () => {
    // mirror
  });

  it("axis: 'both' (default) Cmd+= zooms both axes uniformly", () => {
    // assert scale.x === scale.y after Cmd+=
  });

  it("Cmd+0 reset always sets scale to { x: 1, y: 1 } regardless of axis", () => {
    // axis: 'x', Cmd+0 should still reset both axes
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tools/builtin/useKeyboardZoomTool/ -t "axis option"`
Expected: FAIL.

- [ ] **Step 3: Add the axis option**

Edit `src/tools/builtin/useKeyboardZoomTool/useKeyboardZoomTool.ts`. Add to `KeyboardZoomToolOpts`:

```ts
/**
 * Which axes the +/- keys zoom. See `useWheelZoomTool` for semantics.
 * Cmd+0 reset always resets both axes to scale 1 regardless of this option.
 */
axis?: 'both' | 'x' | 'y';
```

Inside `stepZoom`, build the `ZoomFactor` from `axis`:

```ts
const axis = opts.axis ?? 'both';
const zf: ZoomFactor =
  axis === 'both' ? factor :
  axis === 'x'    ? { x: factor, y: 1 } :
                    { x: 1, y: factor };
const target = zoomAt(ctx.view, center, zf, { min, max });
```

Add `import type { ZoomFactor } from 'core/viewport/view';`. Add `axis` to the `useMemo` deps.

Leave `resetZoom` unchanged — `{ x: 0, y: 0, scale: { x: 1, y: 1 } }` resets both axes regardless of `axis`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/tools/builtin/useKeyboardZoomTool/`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tools/builtin/useKeyboardZoomTool/
git commit -m "feat(tools): useKeyboardZoomTool axis option (both | x | y)"
```

---

## Task 5: `PerAxisZoomDemo`

**Files:**
- Create: `demo/demos/PerAxisZoomDemo.tsx`
- Modify: `demo/registry.ts`

- [ ] **Step 1: Write the demo**

Create `demo/demos/PerAxisZoomDemo.tsx`. This follows the `ZoomDemo.tsx` pattern (useScene + SceneCanvas + ambient tools), with sliders for per-axis scale and a mode-selectable fit button. The fitViewToBounds import comes from `@weasel-js/core`:

```tsx
import { useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  useHandTool,
  useWheelZoomTool,
  useWheelPanTool,
  useKeyboardZoomTool,
  fitViewToBounds,
} from '@weasel-js/core';
import type { DrawCommand } from '../../src/renderer';
import type { View } from '../../src/core/viewport/view';

interface NodeData { color: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 600, H = 400;
// Non-square bounds so 'contain' / 'fill' / 'stretch' look visibly different.
const IMAGE_BOUNDS = { x: 0, y: 0, width: 400, height: 200 };

export function PerAxisZoomDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: 'image' as never, kind: 'leaf', layer: 'default',
        pose: { x: 0, y: 0, width: 400, height: 200 },
        data: { color: '#7fb069' } },
    ],
  });
  const selection = useSelection();
  const [view, setView] = useState<View>({ x: -100, y: -100, scale: { x: 1, y: 1 } });
  const [mode, setMode] = useState<'contain' | 'fill' | 'stretch'>('contain');

  const hand = useHandTool();
  const wheelZoom = useWheelZoomTool();   // default axis: 'both'
  const wheelPan = useWheelPanTool();
  const keyZoom = useKeyboardZoomTool();

  const setScaleX = (sx: number) => setView({ ...view, scale: { ...view.scale, x: sx } });
  const setScaleY = (sy: number) => setView({ ...view, scale: { ...view.scale, y: sy } });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontFamily: 'monospace' }}>
          scale.x:{' '}
          <input
            type="range" min={0.25} max={4} step={0.05}
            value={view.scale.x}
            onChange={(e) => setScaleX(parseFloat(e.target.value))}
          />{' '}
          {view.scale.x.toFixed(2)}
        </label>
        <label style={{ fontFamily: 'monospace' }}>
          scale.y:{' '}
          <input
            type="range" min={0.25} max={4} step={0.05}
            value={view.scale.y}
            onChange={(e) => setScaleY(parseFloat(e.target.value))}
          />{' '}
          {view.scale.y.toFixed(2)}
        </label>
        <label>
          mode:{' '}
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            <option value="contain">contain</option>
            <option value="fill">fill</option>
            <option value="stretch">stretch</option>
          </select>
        </label>
        <button onClick={() => setView(fitViewToBounds(IMAGE_BOUNDS, { width: W, height: H }, view, { mode }))}>
          Fit
        </button>
        <button onClick={() => setView({ x: -100, y: -100, scale: { x: 1, y: 1 } })}>
          Reset
        </button>
      </div>
      <span style={{ fontSize: 12, color: '#888' }}>
        Wheel still zooms uniformly (useWheelZoomTool default axis: 'both'). Set axis: 'x' or 'y' to make wheel-zoom single-axis.
      </span>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        view={view}
        onViewChange={setView}
        ambient={[hand, wheelZoom, wheelPan, keyZoom]}
        layers={{
          scene: {
            drawOne: (n, p): DrawCommand[] => [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              fill: { color: n.data.color },
              stroke: { paint: { color: '#d4c4a8' }, width: 2 },
            }],
          },
          selectionOverlay: { handles: false },
        }}
      />
    </div>
  );
}
```

Note: the demo uses a named export `PerAxisZoomDemo` (NOT default) because the registry imports demos by name. The actual `<SceneCanvas>` prop names (`view`, `onViewChange`, `ambient`, `layers`) and the `useScene` shape come from copying `demo/demos/ZoomDemo.tsx` verbatim — verify that file's import shape before pasting if the kit's surface has shifted.

- [ ] **Step 2: Register the demo in `demo/registry.ts`**

Add a named import alongside the others (search for `ZoomDemo,` to find the import block):

```ts
import { PerAxisZoomDemo } from './demos/PerAxisZoomDemo';
```

Add a `Full` re-export following the existing convention (if `ZoomDemoFull` is a separate component, you can omit `full` from the registry entry — it's optional). Then add the entry alongside the existing Viewport-category entries (after `zoom`, before `viewport`):

```ts
{
  id: 'per-axis-zoom',
  title: 'Per-axis zoom',
  category: 'Viewport',
  description: 'View.scale is {x, y} — the sliders drive each axis independently. The mode dropdown toggles fitViewToBounds between contain (uniform min), fill (uniform max — bounds overflow one axis), and stretch (per-axis exact fit, non-uniform scale). Wheel still zooms uniformly via useWheelZoomTool default axis: both.',
  hint: 'Drag the scale.x / scale.y sliders · pick a mode and click Fit · Reset returns home.',
  Component: PerAxisZoomDemo,
  path: 'demo/demos/PerAxisZoomDemo.tsx',
},
```

(If the registry's `Component:` field is required to be present and there's no `Full` analog, leave `full` off. Match what the surrounding entries do.)

- [ ] **Step 3: Run the demo build**

Run: `npm run build:demo`
Expected: PASS.

- [ ] **Step 4: Smoke the demo locally**

Run: `npm run dev` (or whatever the demo dev script is — check `package.json` `scripts`)

Open `http://localhost:<port>/#per-axis-zoom` and confirm:
- Sliders for scale.x and scale.y respond and stretch the rendered content
- Mode dropdown changes the fit behavior
- Wheel still zooms uniformly
- No console errors

- [ ] **Step 5: Commit**

```bash
git add demo/demos/PerAxisZoomDemo.tsx demo/registry.ts
git commit -m "feat(demo): PerAxisZoomDemo (#per-axis-zoom)"
```

---

## Task 6: TODO.md update

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: Mark per-axis zoom as shipped under "Viewport follow-ups"**

In `docs/TODO.md`, find the "Per-axis zoom" bullet under "## Viewport follow-ups" (around line 69) and replace with:

```markdown
- [x] **Per-axis zoom** (`scaleX` ≠ `scaleY`). *Shipped 2026-05-16.* `View.scale` is now `{x, y}`. `zoomAt` accepts `ZoomFactor = number | {x, y}` and per-axis `ZoomBound` clamps. `fitViewToBounds` gained `mode: 'contain' | 'fill' | 'stretch'`. `useWheelZoomTool` and `useKeyboardZoomTool` gained `axis: 'both' | 'x' | 'y'`. Chrome hit-test scaling uses `meanScale(view.scale)` (geometric-mean fallback); proper elliptical hit shapes are an open follow-up. Spec: `docs/superpowers/specs/2026-05-16-per-axis-zoom-design.md`. Plan: `docs/superpowers/plans/2026-05-16-per-axis-zoom.md`. Demo: `#per-axis-zoom`.
```

- [ ] **Step 2: Add a new open follow-up for axis-aware elliptical hit shapes**

Append under the same "Viewport follow-ups" section (or under "Tool primitive follow-ups" — pick whichever group fits best given the surrounding entries):

```markdown
- **Axis-aware elliptical hit shapes under non-uniform zoom.** Surfaced 2026-05-16 by the per-axis zoom landing. ~50 chrome hit-test sites today use `pxRadius / meanScale(view.scale)` (geometric-mean fallback). At non-uniform zoom this projects a circular screen-pixel hit region to an ellipse in world space — visually accurate handles but the pickable region is slightly too large along one axis and slightly too small along the other. Fix: refactor `composeAffordanceLayer` and the per-tool ad-hoc hit-tests (`penEdit/hitOverride`, `usePenTool` close-hit, `useSelectTool` multi-resize, snap-guide trigger zones) to either compare against an ellipse `(dx/rx)² + (dy/ry)² < 1` or transform the hit-test into screen space. Grid hairline strokes (`1 / meanScale(view.scale)`) have no obvious axis-aware analog — separate judgment call. Worth ~1 day; deferred from per-axis-zoom v1 spec to keep the migration atomic.
```

- [ ] **Step 3: Commit**

```bash
git add docs/TODO.md
git commit -m "docs(todo): mark per-axis zoom shipped, log elliptical-hit-shape follow-up"
```

---

## Final verification

After all six tasks land:

- [ ] **Step 1: Full release-gate run**

Run: `npm run prepublishOnly`
Expected: PASS — typecheck + test + build + build:demo all green.

This is the canonical CI gate per project memory (`feedback_run_prepublish_before_push`).

- [ ] **Step 2: Open a draft PR (do not merge until user reviews)**

The branch already exists: `feat/per-axis-zoom-spec` carries the spec commit. The implementation commits ride on top. Push the branch and ask the user whether to open the PR or merge directly.
