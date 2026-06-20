# Geometry Migration (Phase 2–3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-point the geometry seams onto the `@weasel-js/geom` kernel (Phase 2, behavior-preserving), then fix the resize/move/flip "anchor bug" so a node's data-held geometry follows its pose — turning the red geometry contract gate green (Phase 3).

**Architecture:** Two complementary layers, per the confirmed design decision (both layers):
1. **Lazy-derive (seam-1):** `pathInPoseFrame` rebases a polygon's bounds into the pose box via a `boxToBox` affine instead of translating only. This is what turns BOTH contract gates green — the stub harnesses read `pathInWorld(data.path, pose)` on **unmutated** `data.path`, so the world geometry must be *derived* correctly.
2. **Eager-sync (`geometryProjection` seam):** a new optional public `SceneCanvas` hook lets pose-transform actions (resize/move/nudge/flip) also rewrite `data.path` via a consumer-supplied `transform(node, m: Mat3)`, committing the pose op AND a `createSetDataOp` in one undoable batch. **Strictly opt-in:** the data op is emitted ONLY when the dep is present (apps/draw wires it), so the gate stubs — which implement only `setPose` — never see a `setData` op. Verified by a dedicated new test.

**Tech Stack:** TypeScript, Vitest, React (kit + apps/draw), `@weasel-js/geom` kernel (`boxToBox`, `transformCoords`, `Mat3`, `cubicBounds`, `pointInPolygon`, `segmentsCross`, `invert`, `applyToPoint`, `rotateAboutPoint`).

**Branch:** `feat/geometry-migration` (carries the red gate at `ae66e096`). Execute in an isolated worktree off this branch.

---

## Orientation (read before starting)

**The red gate (do NOT weaken):**
- `src/interactions/actions/__tests__/geometryContract.test.ts` — kit-level, 22 RED / 32 PASS.
- `apps/draw/src/__tests__/geometryContract.test.ts` — apps/draw mirror, 16 RED / 20 PASS.

Both build a node with a bare-AABB pose (`{x,y,width,height,rotation?}`, no `kind`) plus geometry in `data.path`, drive the real action descriptors over a stub scene whose adapter implements **only `setPose`**, then assert:
- `afterWorld = pathInWorld(data.path, after.pose)` is the affine image of `beforeWorld` under the same map the pose underwent (compared as a point SET), and
- `boundsOfPath(afterWorld) ≈ aabbOf(after.pose)` (contents fill the pose box; skipped for rotate).

`data.path` is never mutated by the stub (no `setData` on the adapter). **Therefore the gate goes green only via the seam-1 boxToBox rebase — never via the data op.**

**Key current code (verified on branch):**
- `src/features/paths/pathInWorld.ts` — `pathInPoseFrame` polygon branch is translate-only (the bug); `pathInWorld` = `pathInPoseFrame` ∘ rotation.
- `src/features/paths/transform.ts` — `scalePathToBounds(path, target)` (computes src via `boundsOfPath`, scales) and `scalePolygon` (manual per-coord scale); `translatePath`.
- `packages/geom/src/mat3.ts` — `boxToBox(sx,sy,sw,sh,dx,dy,dw,dh): Mat3` (guards `sw===0`/`sh===0` → scale 1); `Mat3 = [a,b,c,d,e,f]` (DOMMatrix order: `x' = a*x + c*y + e`, `y' = b*x + d*y + f`); `invert`, `applyToPoint`, `rotateAboutPoint`.
- `packages/geom/src/affine.ts` — `transformCoords(coords, m): Float64Array`.
- `packages/geom/src/curve.ts` — `cubicBounds(x0..y3): Box`. `packages/geom/src/polyline.ts` — `pointInPolygon(coords, px, py)`, `segmentsCross(...)` (flat-coord forms). `packages/geom/src/box.ts` — `boundsOfCoords`.
- `src/core/ops/setData.ts` — `createSetDataOp<TData>({id, from, to, label, coalesceKey})` **already exists**.
- `src/interactions/actions/defaultCommitAdapter.ts` — adapter already has `setData(id, data)`.
- `src/interactions/actions/depSchema.ts` — `DepSchema` interface (declaration-merged); `resizePolicy?` is the canonical optional dep.
- `src/canvas/deps/resizePolicy.ts` — `useResizePolicy` → `useDepSource('resizePolicy', …)`; the threading template.
- `PolygonPath = { kind: 'polygon'; commands: Uint8Array; coords: Float32Array; fillRule: PathFillRule }` (`src/features/paths/types.ts`).

**Commit discipline:** TDD, one logical change per commit, run the named suite after each. Commit message trailer:
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

# PHASE 2 — Kernel re-points (behavior-preserving)

Each Phase-2 task keeps every existing suite green and leaves the gate RED. These are mechanical re-points onto the kernel; the gate does not move until Phase 3.

## Task 2.1: Add public `transformPath(path, m: Mat3)` helper

The foundation both seam-1 and the `geometryProjection` consumer reuse: apply a `Mat3` to a `Path`, keeping rects as rects under axis-aligned maps and promoting to a polygon under rotation/shear.

**Files:**
- Create: `src/features/paths/transformPath.ts`
- Modify: `src/features/paths/index.ts` (barrel export)
- Modify: `src/index.ts` (re-export `transformPath` and the `Mat3` type from `@weasel-js/geom`)
- Test: `src/features/paths/transformPath.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/paths/transformPath.test.ts
import { describe, it, expect } from 'vitest';
import { boxToBox, rotateAboutPoint } from '@weasel-js/geom';
import { rectPath } from './builder';
import { PathBuilder } from './builder';
import { boundsOfPath } from './bounds';
import { transformPath } from './transformPath';

describe('transformPath', () => {
  it('keeps a rect a rect under an axis-aligned box→box map', () => {
    const r = rectPath(0, 0, 10, 20);
    const m = boxToBox(0, 0, 10, 20, 100, 50, 30, 40); // 3× / 2×
    const out = transformPath(r, m);
    expect(out).toEqual({ kind: 'rect', x: 100, y: 50, width: 30, height: 40 });
  });

  it('normalizes a mirrored rect (negative scale) to positive extent', () => {
    const r = rectPath(0, 0, 10, 10);
    const m = boxToBox(0, 0, 10, 10, 0, 0, -10, 10); // flip x about 0
    const out = transformPath(r, m);
    expect(out).toEqual({ kind: 'rect', x: -10, y: 0, width: 10, height: 10 });
  });

  it('promotes a rotated rect to a polygon with baked corners', () => {
    const r = rectPath(0, 0, 10, 10);
    const m = rotateAboutPoint(5, 5, Math.PI / 4);
    const out = transformPath(r, m);
    expect(out.kind).toBe('polygon');
    const b = boundsOfPath(out);
    expect(b.width).toBeCloseTo(10 * Math.SQRT2, 4);
  });

  it('maps polygon coords and preserves commands + fillRule', () => {
    const p = new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).close().build();
    const m = boxToBox(0, 0, 10, 10, 0, 0, 20, 10); // x×2
    const out = transformPath(p, m);
    if (out.kind !== 'polygon') throw new Error('expected polygon');
    expect(out.fillRule).toBe(p.fillRule);
    expect(Array.from(out.commands)).toEqual(Array.from(p.commands));
    expect(out.coords[2]).toBeCloseTo(20, 5); // (10,0) -> (20,0)
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/paths/transformPath.test.ts`
Expected: FAIL — `transformPath` is not defined / module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/paths/transformPath.ts
import { type Mat3, transformCoords } from '@weasel-js/geom';
import { PathBuilder } from './builder';
import { type Path, type PolygonPath } from './types';

/** Apply an affine `Mat3` to a path's geometry.
 *
 * Axis-aligned maps (no rotation/shear, i.e. `m[1] === 0 && m[2] === 0`) keep a
 * `RectPath` a rect — the four corners stay axis-aligned, so we transform the
 * two diagonal corners and normalize negative extent (mirror). Rotation or
 * shear promotes the rect's four corners to a `PolygonPath`. Polygon paths map
 * every coord via the kernel's `transformCoords`, preserving the command stream
 * and `fillRule`. Never mutates the input. */
export function transformPath(path: Path, m: Mat3): Path {
  const [a, b, c, d, e, f] = m;
  if (path.kind === 'rect') {
    if (b === 0 && c === 0) {
      const x0 = a * path.x + e;
      const y0 = d * path.y + f;
      const x1 = a * (path.x + path.width) + e;
      const y1 = d * (path.y + path.height) + f;
      return {
        kind: 'rect',
        x: Math.min(x0, x1),
        y: Math.min(y0, y1),
        width: Math.abs(x1 - x0),
        height: Math.abs(y1 - y0),
      };
    }
    // Rotation/shear: bake the four corners into a polygon, then map.
    const poly = new PathBuilder()
      .moveTo(path.x, path.y)
      .lineTo(path.x + path.width, path.y)
      .lineTo(path.x + path.width, path.y + path.height)
      .lineTo(path.x, path.y + path.height)
      .close()
      .build();
    return transformPolygon(poly, m);
  }
  return transformPolygon(path, m);
}

function transformPolygon(path: PolygonPath, m: Mat3): PolygonPath {
  const mapped = transformCoords(path.coords, m); // Float64Array
  return { ...path, coords: Float32Array.from(mapped) };
}
```

- [ ] **Step 4: Add barrel + top-level exports**

In `src/features/paths/index.ts` add:
```typescript
export { transformPath } from './transformPath';
```
In `src/index.ts`, ensure `transformPath` is re-exported (it flows through the `features/paths` barrel if that barrel is re-exported; otherwise add an explicit `export { transformPath } from './features/paths'`). Also ensure the `Mat3` type is publicly available:
```typescript
export type { Mat3 } from '@weasel-js/geom';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/paths/transformPath.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/paths/transformPath.ts src/features/paths/transformPath.test.ts src/features/paths/index.ts src/index.ts
git commit -m "feat(geom): public transformPath(path, Mat3) helper on the kernel"
```

---

## Task 2.2: Re-point `scalePolygon` onto kernel `boxToBox` + `transformCoords`

Replace the hand-rolled per-coord scaling in `transform.ts` with the kernel affine, so the box→box math has one owner. Behavior-preserving.

**Files:**
- Modify: `src/features/paths/transform.ts:78-97` (`scalePolygon`)
- Test: `src/features/paths/transform.test.ts` (existing suite is the guard)

- [ ] **Step 1: Run the existing suite to capture the green baseline**

Run: `npx vitest run src/features/paths/transform.test.ts`
Expected: PASS (record the count).

- [ ] **Step 2: Re-point `scalePolygon`**

Replace the body of `scalePolygon` (`transform.ts:78-97`) with:
```typescript
import { boxToBox } from '@weasel-js/geom';
import { transformPath } from './transformPath';
// ...
function scalePolygon(path: PolygonPath, src: RectPath, dst: RectPath): PolygonPath {
  const m = boxToBox(src.x, src.y, src.width, src.height, dst.x, dst.y, dst.width, dst.height);
  // src/dst are axis-aligned, so the polygon stays a polygon.
  return transformPath(path, m) as PolygonPath;
}
```
(`boxToBox` already guards `src.width === 0`/`src.height === 0` → scale 1, matching the old `=== 0 ? 0` guard's intent of "don't blow up on a degenerate axis"; the prior code scaled by 0, which collapsed the axis. Verify the existing tests still pass in Step 3 — if a test pinned the collapse-to-zero behavior, prefer the kernel's scale-1 and update that test's comment, noting the degenerate case is now a no-op on that axis rather than a collapse.)

- [ ] **Step 3: Run the suite to verify still green**

Run: `npx vitest run src/features/paths/transform.test.ts`
Expected: PASS (same count as Step 1). If a degenerate-axis test fails, reconcile per the note above.

- [ ] **Step 4: Commit**

```bash
git add src/features/paths/transform.ts
git commit -m "refactor(geom): scalePolygon composes on kernel boxToBox+transformCoords"
```

---

## Task 2.3: Re-point `boundsOfPath` cubic/quadratic extrema onto kernel `cubicBounds`

Seam 4. Delete the inlined `includeCubicExtrema`/`solveQuadratic` math in `bounds.ts`; compute tight cubic bounds via the kernel. Quadratics elevate to cubic (the kernel's one curve type). Behavior-preserving (tight bounds either way).

**Files:**
- Modify: `src/features/paths/bounds.ts`
- Test: `src/features/paths/bounds.test.ts` (existing guard)

- [ ] **Step 1: Capture green baseline**

Run: `npx vitest run src/features/paths/bounds.test.ts`
Expected: PASS (record count).

- [ ] **Step 2: Re-point the C/Q cases**

In `boundsOfPath`, replace the `PATH_C` case to call the kernel:
```typescript
import { cubicBounds, elevateQuadraticToCubic } from '@weasel-js/geom';
// ... inside the command loop, px/py are the current point:
case PATH_C: {
  const x1 = coords[ci], y1 = coords[ci + 1];
  const x2 = coords[ci + 2], y2 = coords[ci + 3];
  const x3 = coords[ci + 4], y3 = coords[ci + 5];
  const cb = cubicBounds(px, py, x1, y1, x2, y2, x3, y3);
  include(cb.x, cb.y);
  include(cb.x + cb.width, cb.y + cb.height);
  px = x3; py = y3; ci += 6; break;
}
case PATH_Q: {
  const qx1 = coords[ci], qy1 = coords[ci + 1];
  const qx2 = coords[ci + 2], qy2 = coords[ci + 3];
  // Elevate Q→C exactly, then reuse the cubic extrema path.
  const [c1x, c1y, c2x, c2y] = elevateQuadraticToCubic(px, py, qx1, qy1, qx2, qy2);
  const cb = cubicBounds(px, py, c1x, c1y, c2x, c2y, qx2, qy2);
  include(cb.x, cb.y);
  include(cb.x + cb.width, cb.y + cb.height);
  px = qx2; py = qy2; ci += 4; break;
}
```
Then delete the now-unused `includeCubicExtrema`, `includeQuadraticExtrema`, `evaluateCubic`, `evaluateQuadratic`, `solveQuadratic` helpers from `bounds.ts`.

(If `elevateQuadraticToCubic`'s return shape differs from the 4-tuple above, adapt — confirm its signature in `packages/geom/src/curve.ts` first; the spec lists it as a kernel export.)

- [ ] **Step 3: Run the suite to verify still green**

Run: `npx vitest run src/features/paths/bounds.test.ts`
Expected: PASS (same count). Bounds are tight in both implementations, so values match within epsilon.

- [ ] **Step 4: Commit**

```bash
git add src/features/paths/bounds.ts
git commit -m "refactor(geom): boundsOfPath composes cubic extrema on kernel cubicBounds"
```

---

## Task 2.4: Dedup `pointInPolygon` / `segmentsCross` onto the kernel

Item #11. Delete the two `{x,y}[]`-based copies and route through the kernel's flat-coord forms.

**Files:**
- Modify: `src/features/paths/polygonHitTestRect.ts` (delete local `pointInPolygon`/`segmentsCross`/`sign`)
- Modify: `src/features/paths/pathHitTest.ts` (delete local `pointInPolygon`/`segmentsCross`/`sign`)
- Test: existing hit-test suites are the guard (`*hitTest*.test.ts`)

- [ ] **Step 1: Capture green baseline**

Run: `npx vitest run src/features/paths` -- (run the path feature suite)
Expected: PASS (record count).

- [ ] **Step 2: Re-point `polygonHitTestRect.ts`**

Delete the local `pointInPolygon` (line ~13), `segmentsCross` (line ~93), and `sign` (line ~99). Import the kernel:
```typescript
import { pointInPolygon, segmentsCross } from '@weasel-js/geom';
```
At each call site, adapt the `{x,y}[]` data to flat coords. Where the polygon is a `ReadonlyArray<Vec2>`, build a flat array once:
```typescript
const flat: number[] = [];
for (const v of poly) flat.push(v.x, v.y);
// inside(px,py):
pointInPolygon(flat, px, py);
```
For `segmentsCross(a, b, c, d)` (Vec2s) → `segmentsCross(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y)`.

- [ ] **Step 3: Re-point `pathHitTest.ts`** identically (delete the byte-twin `pointInPolygon`/`segmentsCross`/`sign`, import from `@weasel-js/geom`, adapt call sites to flat coords / scalar pairs).

- [ ] **Step 4: Run the suites to verify still green**

Run: `npx vitest run src/features/paths`
Expected: PASS (same count).

- [ ] **Step 5: Commit**

```bash
git add src/features/paths/polygonHitTestRect.ts src/features/paths/pathHitTest.ts
git commit -m "refactor(geom): dedup pointInPolygon/segmentsCross onto the kernel"
```

---

## Task 2.5: New `clientToWorld` seam; re-point inline copies

Seam 7 / item #10. Add a single `clientToWorld` in `core/viewport` and re-point the inline client→world conversions onto it (or onto the existing `clientToCanvas` + `screenToWorld`).

**Files:**
- Create: `src/core/viewport/clientToWorld.ts`
- Modify (re-point each inline copy): `src/canvas/SceneCanvas.tsx:1214-1215` and `:1850-1851`; `src/canvas/CursorCoordsHud.tsx:83-84`; `src/interactions/dispatcher/useGestureDispatcher.tsx:428-429`; `src/interactions/gestures/handleDrag/handleDrag.ts:55-56`; `src/tools/dispatcher.ts:256`; `src/core/stylus/stylus.ts:153-154`; `src/features/grid/useGridFeature.ts:101-103`
- Test: `src/core/viewport/clientToWorld.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/core/viewport/clientToWorld.test.ts
import { describe, it, expect } from 'vitest';
import { clientToWorld } from './clientToWorld';

describe('clientToWorld', () => {
  it('subtracts the canvas rect origin then applies the inverse view', () => {
    const rect = { left: 10, top: 20 } as DOMRect;
    // view: scale 2, origin (5, 5). world = (client - rectOrigin)/scale + viewOrigin
    const [wx, wy] = clientToWorld(110, 220, rect, { scale: { x: 2, y: 2 }, x: 5, y: 5 });
    expect(wx).toBeCloseTo((110 - 10) / 2 + 5, 6); // 55
    expect(wy).toBeCloseTo((220 - 20) / 2 + 5, 6); // 105
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/core/viewport/clientToWorld.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/core/viewport/clientToWorld.ts
/** Convert a client (DOM) coordinate to a world coordinate: subtract the
 *  canvas rect origin to get a canvas-local screen coord, then apply the
 *  inverse view transform. The DOM rect subtraction is the irreducible glue
 *  that stays here; the screen→world math is the view inverse. */
export interface ViewLike {
  scale: { x: number; y: number };
  x: number;
  y: number;
}
export function clientToWorld(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number },
  view: ViewLike,
): [number, number] {
  return [
    (clientX - rect.left) / view.scale.x + view.x,
    (clientY - rect.top) / view.scale.y + view.y,
  ];
}
```
(Match the field names the existing copies use — verify each call site's `view` shape; several use `view.scale.x`/`view.x`. If a site uses `panX`/`zoom` instead, reuse the existing `screenToWorld` from `viewTransform.ts` for the view-inverse half and `clientToWorld` only for the rect subtraction. Do NOT invent a third convention.)

- [ ] **Step 4: Re-point each of the 8 inline copies** to call `clientToWorld` (or `clientToCanvas` + `screenToWorld`). Replace the inline arithmetic verbatim, preserving each call site's surrounding behavior. After each file, run that file's nearest test if one exists.

- [ ] **Step 5: Run the broad guard**

Run: `npx vitest run src/canvas src/interactions src/core src/features/grid`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/viewport/clientToWorld.ts src/core/viewport/clientToWorld.test.ts src/canvas/SceneCanvas.tsx src/canvas/CursorCoordsHud.tsx src/interactions/dispatcher/useGestureDispatcher.tsx src/interactions/gestures/handleDrag/handleDrag.ts src/tools/dispatcher.ts src/core/stylus/stylus.ts src/features/grid/useGridFeature.ts
git commit -m "refactor(geom): single clientToWorld seam; re-point 8 inline copies"
```

---

## Task 2.6: Export `pathInPoseFrame`; collapse `pathAtPose` + `useModality` duplicate

Item #7. Promote `pathInPoseFrame` to a public export and delete the two re-implementations in apps/draw.

**Files:**
- Modify: `src/features/paths/index.ts` and `src/index.ts` (export `pathInPoseFrame`)
- Modify: `apps/draw/src/svgExport.ts:55-72` (delete local `pathAtPose`, use `pathInPoseFrame`)
- Modify: `apps/draw/src/modality/useModality.ts:~100-120` (use `pathInPoseFrame` for the anchor-origin alignment)
- Test: existing `apps/draw/src/svgExport.test.ts` and modality tests are the guard

- [ ] **Step 1: Capture green baseline**

Run: `npx vitest run apps/draw/src/svgExport.test.ts` and `npx vitest run apps/draw/src/modality`
Expected: PASS (record counts).

- [ ] **Step 2: Export `pathInPoseFrame`** from `src/features/paths/index.ts`:
```typescript
export { pathInPoseFrame, pathInWorld, worldEditToStorage } from './pathInWorld';
```
Ensure it flows out through `src/index.ts`.

- [ ] **Step 3: Replace `pathAtPose`** in `apps/draw/src/svgExport.ts`: delete the local function (lines 55-72) and import `pathInPoseFrame` from `@weasel-js/core`, calling it where `pathAtPose(path, pose)` was used.

> ⚠️ **Behavior note:** `pathInPoseFrame` changes in Phase 3 (Task 3.1) from translate-only to box→box rebase. That is the *intended* convergence — after Task 3.1, SVG export of a resized polygon will correctly reflect the resized geometry (matching what `pathInWorld` renders). Confirm `svgExport.test.ts` still passes here in Phase 2 (rebase not yet applied), and re-confirm after Task 3.1.

- [ ] **Step 4: Replace the `useModality.ts` inline alignment** (lines ~100-120) — the manual `dx/dy` AABB-origin translation of `localAnchors` — with a call that derives the same alignment from `pathInPoseFrame`. If the anchors are point structs (not a `Path`), keep the local `dx/dy` math but compute `dx/dy` from `boundsOfPath` + pose exactly as `pathInPoseFrame` does, and add a comment pointing at `pathInPoseFrame` as the canonical owner. (Do not force a `Path` round-trip if the anchor type isn't a `Path`.)

- [ ] **Step 5: Run the guards**

Run: `npx vitest run apps/draw/src/svgExport.test.ts apps/draw/src/modality`
Expected: PASS (same counts).

- [ ] **Step 6: Commit**

```bash
git add src/features/paths/index.ts src/index.ts apps/draw/src/svgExport.ts apps/draw/src/modality/useModality.ts
git commit -m "refactor(geom): export pathInPoseFrame; collapse pathAtPose + modality dup"
```

---

## Task 2.7: Phase-2 full-suite checkpoint

- [ ] **Step 1: Run the whole suite + typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS everywhere EXCEPT the two `geometryContract.test.ts` files, which remain RED (22 + 16 failing). Confirm the red count is unchanged from `ae66e096` — Phase 2 must not have moved the gate.

- [ ] **Step 2: Commit (if any incidental fixes were needed)** — otherwise no-op.

---

# PHASE 3 — Anchor fix + `geometryProjection` seam (gate goes green)

## Task 3.1: Seam-1 box→box rebase in `pathInPoseFrame` — **GATE GOES GREEN**

This is the behavior change. The polygon branch rebases the path's bounds into the pose box instead of translating only. `boxToBox` is identity when bounds already equal the pose box, so it is behavior-preserving for coincident (path-as-pose) nodes and the fix for geometry-in-data nodes.

**Files:**
- Modify: `src/features/paths/pathInWorld.ts:48-69` (`pathInPoseFrame` polygon branch)
- Test: the two `geometryContract.test.ts` files (the gate) + `src/features/paths/pathInWorld.test.ts` (regression guard)

- [ ] **Step 1: Confirm the gate is RED and the guard is GREEN (baseline)**

Run: `npx vitest run src/interactions/actions/__tests__/geometryContract.test.ts apps/draw/src/__tests__/geometryContract.test.ts src/features/paths/pathInWorld.test.ts`
Expected: gate FAILS (22 + 16), `pathInWorld.test.ts` PASSES.

- [ ] **Step 2: Rebase the polygon branch**

In `src/features/paths/pathInWorld.ts`, replace the polygon branch of `pathInPoseFrame`:
```typescript
import { boxToBox } from '@weasel-js/geom';
import { transformPath } from './transformPath';
// ...
export function pathInPoseFrame(path: Path, pose: PathInWorldPose): Path {
  if (path.kind === 'rect') {
    if (
      path.x === pose.x && path.y === pose.y
      && path.width === pose.width && path.height === pose.height
    ) return path;
    return { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height };
  }
  // Polygon: rebase the path's own AABB into the pose box via a box→box affine.
  // Identity when the bounds already equal the pose box (path-as-pose
  // convention), so this is behavior-preserving there; for geometry-in-data
  // nodes whose pose box was resized independently, it scales the contents to
  // fill the box — fixing the anchor bug.
  const b = boundsOfPath(path);
  if (b.x === pose.x && b.y === pose.y && b.width === pose.width && b.height === pose.height) {
    return path;
  }
  const m = boxToBox(b.x, b.y, b.width, b.height, pose.x, pose.y, pose.width, pose.height);
  return transformPath(path, m);
}
```

- [ ] **Step 3: Run the gate + guard**

Run: `npx vitest run src/interactions/actions/__tests__/geometryContract.test.ts apps/draw/src/__tests__/geometryContract.test.ts src/features/paths/pathInWorld.test.ts`
Expected: **gate now PASSES (54 + 36 green)**; `pathInWorld.test.ts` still PASSES (its polygon tests use pose dims equal to path bounds → boxToBox identity; the degenerate single-point test hits the `sw===0`/`sh===0` guard → pure translate, unchanged).

- [ ] **Step 4: Run the full suite to catch any straggler that pinned translate-only behavior**

Run: `npx vitest run`
Expected: PASS. If `src/canvas/rotationParity.test.ts` or `src/canvas/deps/editAnchors.rotation.test.ts` fails, inspect: a failure there means the test encoded a pose whose dims differ from the path bounds AND expected translate-only output (i.e. it encoded the bug). Update that test to the rebased expectation and note why. Do NOT revert the rebase.

- [ ] **Step 5: Commit**

```bash
git add src/features/paths/pathInWorld.ts
git commit -m "fix(geom): pathInPoseFrame rebases polygon bounds into the pose box (anchor bug)

Turns the geometry contract gate green: pathInWorld now derives filled world
geometry from (data.path, pose) via a box→box affine instead of translating
only. Identity for coincident path-as-pose nodes; the fix for geometry-in-data."
```

> 🟢 **Milestone: the red gate is green.** The remaining Phase-3 tasks add the eager-sync layer (so stored `data.path` stays the source of truth) and clean up duplicates. The gate stays green throughout.

---

## Task 3.2: `geometryProjection` dep — emit a data op alongside the pose op (opt-in)

Add the seam to the action layer. The data op is emitted ONLY when `deps.geometryProjection` is present and `transform` returns non-null — so the gate stubs (no dep, `setPose`-only adapter) are unaffected.

**Files:**
- Modify: `src/interactions/actions/depSchema.ts` (add `geometryProjection?`)
- Create: `src/interactions/actions/geometryProjection.ts` (the dep type + a helper that builds the data op)
- Modify: `src/interactions/actions/defaults/resize.ts`, `defaults/move.ts`, `defaults/nudge.ts`, `defaults/flip.ts` (emit the data op at each commit site)
- Test: `src/interactions/actions/__tests__/geometryProjection.test.ts` (NEW — the seam's own gate)

- [ ] **Step 1: Write the failing test (the seam's dedicated gate)**

```typescript
// src/interactions/actions/__tests__/geometryProjection.test.ts
import { describe, it, expect } from 'vitest';
import type { Mat3 } from '@weasel-js/geom';
import { transformPath, rectPath, boundsOfPath } from 'features/paths';
import type { Path } from 'features/paths/types';
import { nudgeRightAction } from '../defaults/nudge';
import type { ImmediateInvoker } from '../invoker';
import type { Op } from 'core/ops/types';

// A scene + adapter that DOES implement setData — unlike the contract-gate stub.
function setup(path: Path) {
  const pose = (() => { const b = boundsOfPath(path); return { x: b.x, y: b.y, width: b.width, height: b.height }; })();
  const poses = new Map<string, unknown>([['n', pose]]);
  const datas = new Map<string, { path: Path }>([['n', { path }]]);
  const scene = {
    get: (id: string) => poses.has(id) ? { pose: poses.get(id), data: datas.get(id), kind: 'leaf', layer: 'default', parent: null } : undefined,
    setPose: (id: string, p: unknown) => poses.set(id, p),
    renderOrder: () => ['n'], childrenOf: () => [], roots: ['n'],
  };
  const adapter = {
    setPose: (id: string, p: unknown) => poses.set(id, p),
    setData: (id: string, d: { path: Path }) => datas.set(id, d),
  };
  const applyOps = (ops: Op[]) => { for (const op of ops) op.apply(adapter); };
  return { scene, datas, applyOps };
}

describe('geometryProjection seam', () => {
  it('rewrites data.path via the consumer transform when the dep is present', () => {
    const path = rectPath(0, 0, 10, 10);
    const { scene, datas, applyOps } = setup(path);
    const geometryProjection = {
      transform: (node: { data: { path: Path } }, m: Mat3) => ({ ...node.data, path: transformPath(node.data.path, m) }),
    };
    const inv = nudgeRightAction.invoker as ImmediateInvoker;
    inv.run({ selection: { get: () => ['n'] }, scene, applyOps, geometryProjection }, { magnitude: 'small' });
    // nudge-right by +1 → data.path moved by +1 in x.
    const after = datas.get('n')!.path;
    const b = boundsOfPath(after);
    expect(b.x).toBeCloseTo(1, 6);
  });

  it('leaves data.path untouched when the dep is absent (no setData op emitted)', () => {
    const path = rectPath(0, 0, 10, 10);
    const { scene, datas, applyOps } = setup(path);
    const inv = nudgeRightAction.invoker as ImmediateInvoker;
    // No geometryProjection dep, and no setData would be called regardless.
    inv.run({ selection: { get: () => ['n'] }, scene, applyOps }, { magnitude: 'small' });
    expect(datas.get('n')!.path).toBe(path); // identical reference — never rewritten
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/interactions/actions/__tests__/geometryProjection.test.ts`
Expected: FAIL — first test fails (data.path not rewritten; seam not implemented). Second test should already pass.

- [ ] **Step 3: Add the dep type + helper**

```typescript
// src/interactions/actions/geometryProjection.ts
import { type Mat3 } from '@weasel-js/geom';
import { createSetDataOp } from 'core/ops/setData';
import type { Op } from 'core/ops/types';

/** Optional consumer seam: given a node and the affine `m` that a pose-transform
 *  action applied to the node's POSE, return updated `data` with the node's
 *  data-held geometry transformed by `m`, or `null` if this node has no
 *  data-held geometry (the kit leaves `data` alone). */
export interface GeometryProjection {
  transform(node: { id?: string; data: unknown; pose: unknown }, m: Mat3): unknown | null;
}

/** Build the `setData` op for a node when a geometryProjection is wired and
 *  returns non-null. Returns `undefined` (no op) otherwise — keeping the data
 *  op strictly opt-in so adapters without `setData` are never invoked. */
export function geometryDataOp(
  projection: GeometryProjection | undefined,
  node: { id: string; data: unknown; pose: unknown } | undefined,
  m: Mat3,
  label: string,
): Op | undefined {
  if (!projection || !node) return undefined;
  const next = projection.transform(node, m);
  if (next == null) return undefined;
  return createSetDataOp({ id: node.id, from: node.data, to: next, label, coalesceKey: `setData:${node.id}` });
}
```

Add to `DepSchema` in `src/interactions/actions/depSchema.ts`:
```typescript
import type { GeometryProjection } from './geometryProjection';
// ... inside interface DepSchema:
  geometryProjection?: GeometryProjection;
```

- [ ] **Step 4: Emit the data op at each commit site**

Each action already builds `createTransformOp({id, from, to, label})`. Compute the `Mat3` the action applied to the pose, then push the optional data op into the SAME `ops` array before committing.

**nudge** (`defaults/nudge.ts`, commit loop ~53-62):
```typescript
import { geometryDataOp } from '../geometryProjection';
// translate Mat3 for (dx, dy):
const m: Mat3 = [1, 0, 0, 1, dx, dy];
for (const id of ids) {
  const node = scene.get(id);
  if (!node) continue;
  ops.push(createTransformOp<unknown>({ id: id as string, from: node.pose, to: translate(node.pose, dx, dy), label: 'Nudge' }));
  const dataOp = geometryDataOp(deps.geometryProjection, { id: id as string, data: node.data, pose: node.pose }, m, 'Nudge');
  if (dataOp) ops.push(dataOp);
}
```
(Read `deps.geometryProjection` where the other deps — `selection`/`scene`/`applyOps` — are destructured at the top of `run`.)

**move** (`defaults/move.ts`, reparent/commit loop ~603-617): same pattern with `const m: Mat3 = [1, 0, 0, 1, dx, dy];`, pushing the data op next to each `createTransformOp`. (The layout-drop path at ~543-578 reflows poses without a single global delta; leave it pose-only for now and add a `// TODO: geometryProjection for drop-reflow` note — drop-reflow is not exercised by the gate or the seam test.)

**flip** (`defaults/flip.ts`, commit loop ~27-41): mirror Mat3 about the pivot center. With `g = geom.getBounds(node.pose)` and `cx = g.x + g.width/2`, `cy = g.y + g.height/2`:
```typescript
const m: Mat3 = axis === 'x' ? [-1, 0, 0, 1, 2 * cx, 0] : [1, 0, 0, -1, 0, 2 * cy];
```
Push `geometryDataOp(deps.geometryProjection, {id, data: node.data, pose: node.pose}, m, 'Flip')` alongside the transform op.

**resize** (`defaults/resize.ts`, commit loop ~512-530): the affine is box→box from the start-pose bounds to the final-pose bounds. With the projection's `getBounds` already in scope (`geometry`), for each id:
```typescript
import { boxToBox } from '@weasel-js/geom';
import { geometryDataOp } from '../geometryProjection';
// 'from' = scratch.startPoses.get(id); 'next' = scratch.previews.get(id):
const node = scratch.scene.get(id);
const sb = geometry.getBounds(from);
const db = geometry.getBounds(next);
const m = boxToBox(sb.x, sb.y, sb.width, sb.height, db.x, db.y, db.width, db.height);
// after pushing the transform op:
const dataOp = geometryDataOp(scratch.deps?.geometryProjection ?? deps.geometryProjection, node ? { id: id as string, data: node.data, pose: from } : undefined, m, 'Resize');
if (dataOp) ops.push(dataOp);
```
(Use whichever `deps`/`scratch` handle is already in scope at the commit site — confirm the exact name; the resize commit site holds `scratch` with `scene`/`applyOps`. Read `geometryProjection` from the same deps bag those came from.)

- [ ] **Step 5: Run the seam test**

Run: `npx vitest run src/interactions/actions/__tests__/geometryProjection.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Re-run the contract gate to confirm it stays green (no data op leaked into the stub)**

Run: `npx vitest run src/interactions/actions/__tests__/geometryContract.test.ts apps/draw/src/__tests__/geometryContract.test.ts`
Expected: PASS — the gate stubs wire no `geometryProjection`, so `geometryDataOp` returns `undefined` and no `setData` op reaches their `setPose`-only adapters.

- [ ] **Step 7: Commit**

```bash
git add src/interactions/actions/geometryProjection.ts src/interactions/actions/depSchema.ts src/interactions/actions/defaults/resize.ts src/interactions/actions/defaults/move.ts src/interactions/actions/defaults/nudge.ts src/interactions/actions/defaults/flip.ts src/interactions/actions/__tests__/geometryProjection.test.ts
git commit -m "feat(geom): opt-in geometryProjection seam — actions rewrite data.path via consumer transform"
```

---

## Task 3.3: Thread `geometryProjection` from `<SceneCanvas>` (public prop)

Follow the `resizePolicy` threading template so a consumer can supply the seam declaratively.

**Files:**
- Create: `src/canvas/deps/geometryProjection.ts` (`useGeometryProjection` → `useDepSource`)
- Modify: `src/canvas/SceneCanvas.tsx` (prop type + registrar mount, mirroring `ResizePolicyRegistrar`)
- Test: `src/canvas/deps/geometryProjection.test.ts` (NEW) or extend an existing SceneCanvas dep test

- [ ] **Step 1: Write the failing test** (mirror the existing `resizePolicy` dep-source test shape — find it under `src/canvas/deps/` and copy its structure):

```typescript
// src/canvas/deps/geometryProjection.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGeometryProjection } from './geometryProjection';
import { readDepSource } from './testUtils'; // use the same harness resizePolicy's test uses

describe('useGeometryProjection', () => {
  it('registers the geometryProjection dep source when options are provided', () => {
    const proj = { transform: () => null };
    renderHook(() => useGeometryProjection(proj));
    expect(readDepSource('geometryProjection')).toBe(proj);
  });
});
```
(Adapt to the actual dep-source test utility used by `resizePolicy.test.ts` — match its imports and assertion style exactly.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/canvas/deps/geometryProjection.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

```typescript
// src/canvas/deps/geometryProjection.ts
import { useRef } from 'react';
import { useDepSource } from './useDepSource'; // same import resizePolicy.ts uses
import type { GeometryProjection } from '../../interactions/actions/geometryProjection';

export function useGeometryProjection(projection: GeometryProjection | undefined): void {
  const ref = useRef(projection);
  ref.current = projection;
  useDepSource('geometryProjection', () => ref.current);
}
```
(Confirm `useDepSource`'s import path from `resizePolicy.ts`.)

- [ ] **Step 4: Add the prop + registrar to `SceneCanvas.tsx`**

Add `geometryProjection?: GeometryProjection` to `SceneCanvasProps`. Where `ResizePolicyRegistrar` is conditionally mounted, mount a sibling registrar guarded by presence:
```typescript
{geometryProjection ? <GeometryProjectionRegistrar projection={geometryProjection} /> : null}
// ...
function GeometryProjectionRegistrar({ projection }: { projection: GeometryProjection }) {
  useGeometryProjection(projection);
  return null;
}
```
Thread `geometryProjection` from `props` down to the registrar the same way `resizeOptions` flows (props → memo → inner select tool). When the prop is absent, no registrar mounts → dep is undefined → actions stay pose-only (gate-safe).

- [ ] **Step 5: Run the test + a SceneCanvas smoke suite**

Run: `npx vitest run src/canvas/deps/geometryProjection.test.ts src/canvas/SceneCanvas` (and the nearest SceneCanvas integration test)
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/canvas/deps/geometryProjection.ts src/canvas/deps/geometryProjection.test.ts src/canvas/SceneCanvas.tsx
git commit -m "feat(geom): public SceneCanvas geometryProjection prop (threads the seam dep)"
```

---

## Task 3.4: Wire `geometryProjection` in apps/draw; retire `applyPoseToObj`

apps/draw becomes the first consumer: it supplies `transform` via the kernel so `data.path` stays the source of truth (consistent with `worldEditToStorage` pen-edit storage). Remove the now-dead `applyPoseToObj`/`scalePathToBounds` hand-roll.

**Files:**
- Modify: `apps/draw/src/App.tsx:1401` (add the `geometryProjection` prop)
- Modify: `apps/draw/src/poseUpdate.ts` (delete `applyPoseToObj` if it has no remaining caller) + `apps/draw/src/poseRotation.test.ts` (delete or retarget the test)
- Test: `apps/draw/src/__tests__/geometryContract.test.ts` (still green) + an apps/draw integration check

- [ ] **Step 1: Confirm `applyPoseToObj` is dead**

Run: `git grep -n "applyPoseToObj" apps/draw/src | grep -v ".test."`
Expected: no non-test hits (App.tsx does not call it). If a live caller appears, do NOT delete — instead route that caller through the new seam and keep this task's deletion scoped to what's truly dead.

- [ ] **Step 2: Add the prop to `<SceneCanvas>`** in `App.tsx` (~line 1401), alongside the other props:
```typescript
geometryProjection={{
  transform: (node, m) => {
    const data = node.data as WeaselDrawData;
    if (!data.path) return null; // text / no geometry — kit leaves data alone
    return { ...data, path: transformPath(data.path, m) };
  },
}}
```
Import `transformPath` (and the `Mat3` type if annotating) from `@weasel-js/core`.

- [ ] **Step 3: Delete the dead hand-roll**

Remove `applyPoseToObj` from `apps/draw/src/poseUpdate.ts` (keep `Obj`/`Pose` types and any still-used exports). Delete `apps/draw/src/poseRotation.test.ts` (it only tested `applyPoseToObj`) — or, if it asserts behavior still worth keeping, retarget it at `transformPath` + the seam.

- [ ] **Step 4: Run apps/draw suites + typecheck**

Run: `npx tsc --noEmit && npx vitest run apps/draw`
Expected: PASS, including the contract mirror (still green from Task 3.1; the seam now additionally syncs `data.path`).

- [ ] **Step 5: Manual smoke (optional but recommended)** — launch apps/draw, draw a polygon/star, resize non-uniformly, confirm contents fill the box; do a boolean union then resize a piece; flip-x an asymmetric shape. (Spin the dev server from the worktree; do not steal focus.)

- [ ] **Step 6: Commit**

```bash
git add apps/draw/src/App.tsx apps/draw/src/poseUpdate.ts apps/draw/src/poseRotation.test.ts
git commit -m "feat(draw): wire geometryProjection seam via transformPath; drop dead applyPoseToObj"
```

---

## Task 3.5: `#2` — nudge + flip use the auto descriptor (not rect-only)

The analysis item #2: `nudge.ts` and `flip.ts` reach for `RECT_POSE_DESCRIPTOR` directly. Route them through `AUTO_POSE_DESCRIPTOR` so path-shaped poses translate/flip correctly via the descriptor (and share `translatePose`). This is independent of the data seam (it fixes the pose-side for path-as-pose nodes).

**Files:**
- Modify: `src/interactions/actions/defaults/nudge.ts:53`, `src/interactions/actions/defaults/flip.ts:38`
- Test: existing nudge/flip tests + add a path-pose case if absent

- [ ] **Step 1: Capture baseline**

Run: `npx vitest run src/interactions/actions/defaults/nudge src/interactions/actions/defaults/flip`
Expected: PASS (record counts).

- [ ] **Step 2: Swap the descriptor**

In `nudge.ts`, replace `RECT_POSE_DESCRIPTOR` with `AUTO_POSE_DESCRIPTOR` (import from `../resize/autoPoseDescriptor`); same in `flip.ts`'s `geom` default. Keep the `as PoseProjection<unknown>` casts.

- [ ] **Step 3: Run the suites + the gate (regression)**

Run: `npx vitest run src/interactions/actions`
Expected: PASS, gate still green.

- [ ] **Step 4: Commit**

```bash
git add src/interactions/actions/defaults/nudge.ts src/interactions/actions/defaults/flip.ts
git commit -m "fix(geom): nudge + flip use AUTO_POSE_DESCRIPTOR (path-pose aware)"
```

---

## Task 3.6: `mintPathLeaf` — consolidate boolean/slice/release-compound minting

Single helper so every data-held-geometry leaf is minted with `pose = boundsOfPath(path)` and the geometry-in-data convention, enforced once. apps/draw's `createPathNode` (App.tsx ~945-975) is the model.

**Files:**
- Modify: `apps/draw/src/App.tsx` (route boolean/slice mint sites through one `mintPathLeaf`)
- (If a kit-level mint helper is warranted, add `src/features/paths/mintPathLeaf.ts` — but per YAGNI, only if more than one consumer needs it; apps/draw is the sole consumer today, so consolidate within apps/draw first.)
- Test: existing apps/draw boolean/slice tests are the guard

- [ ] **Step 1: Capture baseline**

Run: `npx vitest run apps/draw`
Expected: PASS.

- [ ] **Step 2: Extract `mintPathLeaf`** in apps/draw from the existing `createPathNode` so booleans, slice, and release-compound all call it (pose = `boundsOfPath(path)`, data = `{ path, ...style template }`). Replace duplicated mint code at those sites with the call.

- [ ] **Step 3: Run apps/draw suites**

Run: `npx vitest run apps/draw`
Expected: PASS (same counts).

- [ ] **Step 4: Commit**

```bash
git add apps/draw/src/App.tsx
git commit -m "refactor(draw): mintPathLeaf consolidates boolean/slice/release-compound minting"
```

---

## Task 3.7: Final checkpoint — full suite, typecheck, release gate

- [ ] **Step 1: Run the release gate locally** (matches CI):

Run: `npx tsc --noEmit && npx vitest run && npx tsup build` (from repo root; if `tsup`/`prepublishOnly` is package-scoped, run it where the published package lives).
Expected: ALL PASS. The two `geometryContract.test.ts` files are now GREEN; the new `geometryProjection.test.ts` and `transformPath.test.ts` pass; no typecheck errors.

- [ ] **Step 2: Confirm the gate delta** — re-read the two contract suites' pass counts: kit-level 54/54, apps/draw mirror 36/36 (was 32/54 and 20/36 at `ae66e096`).

- [ ] **Step 3: Update `docs/TODO.md`** — mark the geometry-migration items (analysis #1, #2, #4, #5, #7, #10, #11 + the seam) done per the completed-entry retention policy (delete fully-closed blocks; keep `[x]` only where a follow-up remains: drop-reflow geometryProjection TODO from Task 3.2, and any deferred dedup #6/#8/#9/#12/#13 from the spec's Phase 4–5 which are OUT OF SCOPE here).

- [ ] **Step 4: Commit**

```bash
git add docs/TODO.md
git commit -m "docs(geom): record phase 2-3 geometry migration complete; gate green"
```

---

## Out of scope (spec Phases 4–5 — separate plan)

Deliberately NOT in this plan; file/track separately:
- `#3` selection fix — `hitTestAABB` silhouette-awareness (Phase 4).
- `#6` container-move cascade rect-only copies; `#8`/`#9` dead `rotationRender.ts`/`rotationHitTest.ts`; `#12` corner→anchor table; `#13` seed-node rect-path dup (Phase 5 dedup/dead-code).
- Seams 2/3/5/6 kernel re-points (`pathInWorld` rotation, `worldEditToStorage`, `rotateAroundAABBCenter`, `poseContainsRotated`) — behavior-preserving and not gate-blocking; can fold into a Phase-2 follow-up. (Seams 1, 4, 7 + dedup #7/#10/#11 ARE covered above.)

---

## Self-review notes (carried from authoring)

- **Gate mechanism:** verified both stub harnesses read `pathInWorld(unmutated data.path, pose)` through `setPose`-only adapters → seam-1 boxToBox (Task 3.1) is the sole green trigger; the data op (Task 3.2) is opt-in and invisible to the gate. The `geometryProjection.test.ts` (Task 3.2) is the seam's own gate.
- **No double-apply:** after the seam rewrites `data.path` to fill the pose box, `pathInPoseFrame`'s `boxToBox(bounds→poseBox)` is identity (bounds now equal the box) — composes cleanly.
- **Type consistency:** `transformPath(path, m)`, `geometryDataOp(projection, node, m, label)`, `GeometryProjection.transform(node, m)`, `createSetDataOp({id,from,to,label,coalesceKey})`, `boxToBox(sx,sy,sw,sh,dx,dy,dw,dh)`, `Mat3 = [a,b,c,d,e,f]` — names used consistently across tasks.
- **`elevateQuadraticToCubic` return shape** (Task 2.3) and the exact dep-source test utility (Task 3.3) are the two spots to confirm against source before coding; both noted inline.
