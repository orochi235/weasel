# Per-anchor path coloring (fill + stroke) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public `createPathLayer` surface for per-vertex coloring on path fills and strokes, with renderer-side arc-length interpolation across flattened/tessellated geometry, anchored at path command destinations (M / L / C / Q).

**Architecture:** Tessellators (fill + stroke) gain a parallel "anchor parameterization" output — three `Uint32Array`/`Float32Array` buffers per mesh vertex recording `(anchorA, anchorB, t)`. At draw time, when the DrawCommand carries per-anchor colors, the renderer CPU-expands `4 × anchorCount` floats into `4 × meshVertexCount` floats via per-vertex lerp and uploads as the existing color VBO. Public consumer surface is two hooks on `createPathLayer` (`getVertexColors`, `getStrokeVertexColors`); existing `pathFillVColor` shader is reused for both.

**Tech Stack:** TypeScript, vitest, WebGL2, React (demos). Path module in `src/features/paths/`, renderer in `src/renderer/`, demos in `demo/demos/`.

**Reference spec:** `docs/superpowers/specs/2026-05-10-per-anchor-path-coloring-design.md`.

---

## Branch setup

This work touches `src/renderer/draw.ts`, `src/renderer/cache/mesh.ts`, `src/features/paths/*`. The `feat/rich-text-slice-1` branch has uncommitted changes in `src/renderer/draw.ts` and friends that will conflict — **do not** branch from `feat/rich-text-slice-1`. Branch from `main`.

- [ ] **Branch from main**

```bash
git checkout main
git pull --ff-only origin main  # if remote available; otherwise skip
git checkout -b feat/per-anchor-path-coloring
```

---

## Task 1: `countPathAnchors` helper

**Files:**
- Create: `src/features/paths/anchors.ts`
- Create: `src/features/paths/anchors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/paths/anchors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { countPathAnchors } from './anchors';
import { PathBuilder, polygonFromPoints, rectPath } from './builder';

describe('countPathAnchors', () => {
  it('returns 4 for a RectPath (one anchor per corner)', () => {
    expect(countPathAnchors(rectPath(0, 0, 10, 10))).toBe(4);
  });

  it('counts M + L commands in a polygon-from-points (Z does not count)', () => {
    const p = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    // polygonFromPoints emits M + L + L + Z → 3 anchors
    expect(countPathAnchors(p)).toBe(3);
  });

  it('counts C and Q commands as one anchor each (destination point)', () => {
    const p = new PathBuilder()
      .moveTo(0, 0)
      .lineTo(10, 0)
      .curveTo(20, 0, 20, 10, 10, 10)
      .quadTo(0, 20, 0, 10)
      .build();
    // M + L + C + Q = 4 anchors
    expect(countPathAnchors(p)).toBe(4);
  });

  it('sums anchors across multiple contours', () => {
    const p = new PathBuilder()
      .moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).close()
      .moveTo(20, 20).lineTo(30, 20).close()
      .build();
    // contour 1: M + L + L = 3; contour 2: M + L = 2; total 5
    expect(countPathAnchors(p)).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/paths/anchors.test.ts
```

Expected: FAIL — module `./anchors` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/features/paths/anchors.ts`:

```ts
/**
 * Counts the path anchors used by the per-anchor coloring surface. An
 * "anchor" is the destination point of a path command: M, L, C, Q each
 * contribute one (the (x, y) where the pen ends up); Z contributes none
 * (it closes back to the subpath's first M). RectPath has four implicit
 * anchors — the corners — matching its M/L/L/L/Z stroke tessellation.
 *
 * Consumers use this to size their per-anchor color array; the renderer
 * uses it to validate the array length in dev builds.
 */

import { PATH_C, PATH_L, PATH_M, PATH_Q, type Path } from './types';

export function countPathAnchors(path: Path): number {
  if (path.kind === 'rect') return 4;
  const cmds = path.commands;
  let n = 0;
  for (let i = 0; i < cmds.length; i++) {
    const c = cmds[i];
    if (c === PATH_M || c === PATH_L || c === PATH_C || c === PATH_Q) n++;
  }
  return n;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/features/paths/anchors.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Re-export from the paths barrel**

Edit `src/features/paths/index.ts` — add this line after the `pointInPath` re-export:

```ts
export { countPathAnchors } from './anchors';
```

- [ ] **Step 6: Re-export from the main barrel**

Edit `src/index.ts`. Find the line that re-exports from the paths module (something like `export * from './features/paths';` or the explicit list including `createPathLayer`) and confirm `countPathAnchors` flows through. If the main barrel re-exports the paths module via `export *`, no change needed. If it re-exports an explicit list, append `countPathAnchors` to it.

Verify by running:

```bash
grep -n "createPathLayer\|countPathAnchors" src/index.ts
```

Expected: both names appear.

- [ ] **Step 7: Commit**

```bash
git add src/features/paths/anchors.ts src/features/paths/anchors.test.ts src/features/paths/index.ts src/index.ts
git commit -m "feat(paths): add countPathAnchors helper

Counts M+L+C+Q commands (Z contributes none); RectPath returns 4. Used
to size per-anchor color arrays and validate input lengths."
```

---

## Task 2: `Stroke.vertexColors` field

**Files:**
- Modify: `src/core/paint-types.ts`

- [ ] **Step 1: Add the field**

Edit `src/core/paint-types.ts`. Locate the `Stroke` interface (around line 64) and add a `vertexColors` field after `align`:

```ts
export interface Stroke {
  paint: Paint;
  width?: number;
  /** Per `CanvasRenderingContext2D.setLineDash` — empty/omitted = solid. */
  dash?: number[];
  cap?: 'butt' | 'round' | 'square';
  join?: 'miter' | 'round' | 'bevel';
  /** Where the stroke sits relative to the geometric edge. Default `'center'`. */
  align?: StrokeAlign;
  /**
   * Per-anchor RGBA, flat (length = 4 × countPathAnchors(path)). Each
   * value in 0..1. Arc-length interpolated across the tessellated ribbon
   * between consecutive anchors. When set, `paint` is still required —
   * its `opacity` (and color, as a placeholder) flow through the shader.
   */
  vertexColors?: number[];
}
```

- [ ] **Step 2: Verify the type compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/core/paint-types.ts
git commit -m "feat(paint): add Stroke.vertexColors field

Per-anchor RGBA array for stroke vertex coloring. Renderer wiring in
follow-up commits; type added first so the rest of the chain can
reference it."
```

---

## Task 3: Mesh anchor-param fields

**Files:**
- Modify: `src/renderer/cache/mesh.ts`

- [ ] **Step 1: Add the fields to the Mesh interface**

Edit `src/renderer/cache/mesh.ts`. Replace the file contents with:

```ts
/**
 * A tessellated representation of a Path, ready to upload to GL.
 *
 * - `vertices` is interleaved x,y in path-local coordinates (`Float32Array`
 *   of length `2 * vertexCount`).
 * - `indices` are triangle indices into `vertices` (`Uint32Array`, length
 *   `3 * triangleCount`).
 * - `requiresStencil` is set for paths whose fillRule is `'evenodd'` and
 *   whose triangulation is a *naive* per-contour fan rather than a clean
 *   inside/outside triangulation. The renderer must use a stencil
 *   two-pass when this flag is true. Single-contour paths and `'nonzero'`
 *   multi-contour paths leave it false.
 * - `anchorA` / `anchorB` / `anchorT` parameterize each mesh vertex by
 *   the two consecutive path anchors it lies between and the arc-length
 *   fraction along that segment (0 = at A, 1 = at B). Vertices that fall
 *   exactly on an anchor set A === B and t = 0. Used at draw time when
 *   the DrawCommand supplies per-anchor colors so the renderer can lerp
 *   per mesh vertex. Optional — emitted by the path tessellators; absent
 *   on meshes built by other paths (e.g. text glyphs).
 */
export interface Mesh {
  readonly vertices: Float32Array;
  readonly indices: Uint32Array;
  readonly requiresStencil?: boolean;
  readonly anchorA?: Uint32Array;
  readonly anchorB?: Uint32Array;
  readonly anchorT?: Float32Array;
}
```

- [ ] **Step 2: Verify the type compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors (existing Mesh consumers tolerate optional fields).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/cache/mesh.ts
git commit -m "feat(renderer): add anchorA/B/T fields to Mesh

Optional per-vertex anchor parameterization (anchorA, anchorB, arc-length t).
Populated by path tessellators in follow-up commits; absent on meshes built
by other paths (text glyphs, etc)."
```

---

## Task 4: Polyline-level anchor parameterization

**Files:**
- Modify: `src/features/paths/tessellate/polyline.ts`
- Modify: `src/features/paths/tessellate/polyline.test.ts`

**Approach:** every flattened point in a polyline already corresponds to either (a) the destination of a M/L/C/Q command (an anchor) or (b) an interior point produced by `flattenCubic` / `flattenQuadratic` between two anchors. Augment `extractPolylines` to emit, for each flattened point, the `(anchorA, anchorB, t)` triple. `t` is the cumulative arc length from anchor A divided by the total flattened arc length of that segment. Anchor-aligned points get `A === B, t = 0`.

- [ ] **Step 1: Write the failing tests**

Add to `src/features/paths/tessellate/polyline.test.ts` (preserve existing tests; append):

```ts
import { describe, expect, it } from 'vitest';
import { extractPolylines } from './polyline';
import { PathBuilder, polygonFromPoints, rectPath } from '../builder';

describe('extractPolylines — anchor parameterization', () => {
  it('a triangle polygon emits one anchor index per output point', () => {
    const p = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    const [pl] = extractPolylines(p);
    expect(pl.points.length / 2).toBe(3);
    expect(Array.from(pl.anchorA!)).toEqual([0, 1, 2]);
    expect(Array.from(pl.anchorB!)).toEqual([0, 1, 2]);
    expect(Array.from(pl.anchorT!)).toEqual([0, 0, 0]);
  });

  it('a rect emits 4 anchor indices in CW order', () => {
    const [pl] = extractPolylines(rectPath(0, 0, 10, 10));
    expect(pl.points.length / 2).toBe(4);
    expect(Array.from(pl.anchorA!)).toEqual([0, 1, 2, 3]);
    expect(Array.from(pl.anchorB!)).toEqual([0, 1, 2, 3]);
  });

  it('interior cubic-bezier points get (A, B, t in 0..1) interpolation', () => {
    // Single cubic from anchor 0 to anchor 1 — anchor 1 is the C destination.
    const p = new PathBuilder()
      .moveTo(0, 0)
      .curveTo(0, 100, 100, 100, 100, 0)
      .build();
    const [pl] = extractPolylines(p);
    const n = pl.points.length / 2;
    // First point is anchor 0 (the M); last point is anchor 1 (the C destination).
    expect(pl.anchorA![0]).toBe(0);
    expect(pl.anchorB![0]).toBe(0);
    expect(pl.anchorT![0]).toBe(0);
    expect(pl.anchorA![n - 1]).toBe(1);
    expect(pl.anchorB![n - 1]).toBe(1);
    expect(pl.anchorT![n - 1]).toBe(0);
    // Interior points: anchorA === 0, anchorB === 1, t strictly increasing in (0, 1)
    for (let i = 1; i < n - 1; i++) {
      expect(pl.anchorA![i]).toBe(0);
      expect(pl.anchorB![i]).toBe(1);
      expect(pl.anchorT![i]).toBeGreaterThan(0);
      expect(pl.anchorT![i]).toBeLessThan(1);
    }
  });

  it('anchor index continues across multi-contour paths', () => {
    const p = new PathBuilder()
      .moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).close()
      .moveTo(20, 20).lineTo(30, 20).close()
      .build();
    const [pl1, pl2] = extractPolylines(p);
    expect(Array.from(pl1.anchorA!)).toEqual([0, 1, 2]);
    expect(Array.from(pl2.anchorA!)).toEqual([3, 4]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/paths/tessellate/polyline.test.ts
```

Expected: 4 new tests fail (anchorA/B/T undefined).

- [ ] **Step 3: Add a flatten-with-anchor helper**

Edit `src/features/paths/flatten.ts`. Append two new functions at the end of the file (do not modify the existing `flattenCubic` / `flattenQuadratic`):

```ts
/**
 * Like `flattenCubic` but also appends, for each new flattened point, its
 * arc-length fraction `t` (relative to the polyline distance accumulated so
 * far inside this curve) to `tOut`. Caller then post-processes the segment's
 * `tOut` range by dividing each by the segment's total flattened arc length
 * to yield t ∈ (0, 1].
 *
 * The returned values are *cumulative distance from the segment start*, not
 * normalized fractions. Two-pass design (accumulate, then divide) keeps the
 * recursive splitter simple — it doesn't need to know the total length up
 * front.
 */
export function flattenCubicWithArcLen(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  tolerance: number,
  out: number[],
  arcOut: number[],
  prevAccum: number,
): number {
  return flattenCubicArcRec(x0, y0, x1, y1, x2, y2, x3, y3, tolerance, out, arcOut, prevAccum);
}

function flattenCubicArcRec(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  tolerance: number,
  out: number[],
  arcOut: number[],
  accum: number,
): number {
  const d1 = distPointToLine_(x1, y1, x0, y0, x3, y3);
  const d2 = distPointToLine_(x2, y2, x0, y0, x3, y3);
  if (Math.max(d1, d2) <= tolerance) {
    const lastX = out.length >= 2 ? out[out.length - 2] : x0;
    const lastY = out.length >= 2 ? out[out.length - 1] : y0;
    const seg = Math.hypot(x3 - lastX, y3 - lastY);
    accum += seg;
    out.push(x3, y3);
    arcOut.push(accum);
    return accum;
  }
  const x01 = (x0 + x1) * 0.5, y01 = (y0 + y1) * 0.5;
  const x12 = (x1 + x2) * 0.5, y12 = (y1 + y2) * 0.5;
  const x23 = (x2 + x3) * 0.5, y23 = (y2 + y3) * 0.5;
  const x012 = (x01 + x12) * 0.5, y012 = (y01 + y12) * 0.5;
  const x123 = (x12 + x23) * 0.5, y123 = (y12 + y23) * 0.5;
  const x0123 = (x012 + x123) * 0.5, y0123 = (y012 + y123) * 0.5;
  accum = flattenCubicArcRec(x0, y0, x01, y01, x012, y012, x0123, y0123, tolerance, out, arcOut, accum);
  accum = flattenCubicArcRec(x0123, y0123, x123, y123, x23, y23, x3, y3, tolerance, out, arcOut, accum);
  return accum;
}

export function flattenQuadraticWithArcLen(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  tolerance: number,
  out: number[],
  arcOut: number[],
  prevAccum: number,
): number {
  return flattenQuadraticArcRec(x0, y0, x1, y1, x2, y2, tolerance, out, arcOut, prevAccum);
}

function flattenQuadraticArcRec(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  tolerance: number,
  out: number[],
  arcOut: number[],
  accum: number,
): number {
  const d = distPointToLine_(x1, y1, x0, y0, x2, y2);
  if (d <= tolerance) {
    const lastX = out.length >= 2 ? out[out.length - 2] : x0;
    const lastY = out.length >= 2 ? out[out.length - 1] : y0;
    const seg = Math.hypot(x2 - lastX, y2 - lastY);
    accum += seg;
    out.push(x2, y2);
    arcOut.push(accum);
    return accum;
  }
  const x01 = (x0 + x1) * 0.5, y01 = (y0 + y1) * 0.5;
  const x12 = (x1 + x2) * 0.5, y12 = (y1 + y2) * 0.5;
  const x012 = (x01 + x12) * 0.5, y012 = (y01 + y12) * 0.5;
  accum = flattenQuadraticArcRec(x0, y0, x01, y01, x012, y012, tolerance, out, arcOut, accum);
  accum = flattenQuadraticArcRec(x012, y012, x12, y12, x2, y2, tolerance, out, arcOut, accum);
  return accum;
}

function distPointToLine_(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    const ex = px - ax;
    const ey = py - ay;
    return Math.sqrt(ex * ex + ey * ey);
  }
  const cross = (px - ax) * dy - (py - ay) * dx;
  return Math.abs(cross) / Math.sqrt(len2);
}
```

- [ ] **Step 4: Update `Polyline` and `extractPolylines` to emit anchor params**

Edit `src/features/paths/tessellate/polyline.ts`. Replace the file contents with:

```ts
import {
  type Path,
  type PolygonPath,
  type RectPath,
  PATH_M,
  PATH_L,
  PATH_Z,
  PATH_C,
  PATH_Q,
  DEFAULT_FLATTEN_TOLERANCE,
  flattenCubicWithArcLen,
  flattenQuadraticWithArcLen,
} from '@orochi235/weasel';

export interface Polyline {
  /** Interleaved x,y vertices (length = 2 × point count). */
  points: number[];
  /** Whether the contour was closed (ends with Z, or is a RectPath). */
  closed: boolean;
  /** For each point, the previous anchor index. Anchor-aligned points set A === B. */
  anchorA?: Uint32Array;
  /** For each point, the next anchor index. */
  anchorB?: Uint32Array;
  /** For each point, the arc-length fraction along (A, B). 0 at anchor A; for anchor-aligned, set to 0. */
  anchorT?: Float32Array;
}

export interface ExtractOptions {
  flattenTolerance?: number;
}

export function extractPolylines(path: Path, opts: ExtractOptions = {}): Polyline[] {
  if (path.kind === 'rect') return [extractRect(path)];
  return extractPolygon(path, opts);
}

function extractRect(p: RectPath): Polyline {
  const { x, y, width: w, height: h } = p;
  return {
    points: [x, y, x + w, y, x + w, y + h, x, y + h],
    closed: true,
    anchorA: new Uint32Array([0, 1, 2, 3]),
    anchorB: new Uint32Array([0, 1, 2, 3]),
    anchorT: new Float32Array([0, 0, 0, 0]),
  };
}

function extractPolygon(p: PolygonPath, opts: ExtractOptions): Polyline[] {
  const tolerance = opts.flattenTolerance ?? DEFAULT_FLATTEN_TOLERANCE;
  const { commands, coords } = p;
  const out: Polyline[] = [];
  // Anchors are numbered globally (across all contours) in command-stream order.
  let anchorCounter = 0;

  // Builders for the current polyline.
  let pts: number[] | null = null;
  let aA: number[] | null = null;
  let aB: number[] | null = null;
  let aT: number[] | null = null;
  let current: Polyline | null = null;

  let coordIdx = 0;
  let prevX = 0;
  let prevY = 0;
  let prevAnchor = -1;

  const beginContour = () => {
    pts = [];
    aA = [];
    aB = [];
    aT = [];
    current = { points: pts, closed: false };
    out.push(current);
  };

  const commit = () => {
    if (!current || !pts || !aA || !aB || !aT) return;
    current.anchorA = new Uint32Array(aA);
    current.anchorB = new Uint32Array(aB);
    current.anchorT = new Float32Array(aT);
  };

  for (let cmdIdx = 0; cmdIdx < commands.length; cmdIdx++) {
    const cmd = commands[cmdIdx];
    switch (cmd) {
      case PATH_M: {
        if (current) commit();
        beginContour();
        prevX = coords[coordIdx];
        prevY = coords[coordIdx + 1];
        pts!.push(prevX, prevY);
        aA!.push(anchorCounter);
        aB!.push(anchorCounter);
        aT!.push(0);
        prevAnchor = anchorCounter;
        anchorCounter++;
        coordIdx += 2;
        break;
      }
      case PATH_L: {
        prevX = coords[coordIdx];
        prevY = coords[coordIdx + 1];
        pts!.push(prevX, prevY);
        aA!.push(anchorCounter);
        aB!.push(anchorCounter);
        aT!.push(0);
        prevAnchor = anchorCounter;
        anchorCounter++;
        coordIdx += 2;
        break;
      }
      case PATH_Q: {
        const cx = coords[coordIdx], cy = coords[coordIdx + 1];
        const ex = coords[coordIdx + 2], ey = coords[coordIdx + 3];
        const targetAnchor = anchorCounter;
        const segStart = pts!.length / 2;
        const arcAccum: number[] = [];
        const total = flattenQuadraticWithArcLen(prevX, prevY, cx, cy, ex, ey, tolerance, pts!, arcAccum, 0);
        // Fill anchorA/B/T for each newly-appended point (count = arcAccum.length).
        // All interior + final points have A = prevAnchor, B = targetAnchor.
        for (let k = 0; k < arcAccum.length; k++) {
          aA!.push(prevAnchor);
          aB!.push(targetAnchor);
          aT!.push(total > 0 ? arcAccum[k] / total : 0);
        }
        // The final point is exactly the anchor — pin it (A === B, t = 0) so
        // the lerp at draw time returns anchor B's color exactly.
        const lastIdx = (segStart + arcAccum.length) - 1;
        aA![lastIdx] = targetAnchor;
        aB![lastIdx] = targetAnchor;
        aT![lastIdx] = 0;
        prevX = ex; prevY = ey;
        prevAnchor = targetAnchor;
        anchorCounter++;
        coordIdx += 4;
        break;
      }
      case PATH_C: {
        const c1x = coords[coordIdx], c1y = coords[coordIdx + 1];
        const c2x = coords[coordIdx + 2], c2y = coords[coordIdx + 3];
        const ex = coords[coordIdx + 4], ey = coords[coordIdx + 5];
        const targetAnchor = anchorCounter;
        const segStart = pts!.length / 2;
        const arcAccum: number[] = [];
        const total = flattenCubicWithArcLen(prevX, prevY, c1x, c1y, c2x, c2y, ex, ey, tolerance, pts!, arcAccum, 0);
        for (let k = 0; k < arcAccum.length; k++) {
          aA!.push(prevAnchor);
          aB!.push(targetAnchor);
          aT!.push(total > 0 ? arcAccum[k] / total : 0);
        }
        const lastIdx = (segStart + arcAccum.length) - 1;
        aA![lastIdx] = targetAnchor;
        aB![lastIdx] = targetAnchor;
        aT![lastIdx] = 0;
        prevX = ex; prevY = ey;
        prevAnchor = targetAnchor;
        anchorCounter++;
        coordIdx += 6;
        break;
      }
      case PATH_Z: {
        if (current) current.closed = true;
        break;
      }
      default:
        throw new Error(`extractPolylines: unknown command code ${cmd}`);
    }
  }

  if (current) commit();
  return out;
}
```

- [ ] **Step 5: Export the new flatten helpers**

Edit `src/features/paths/index.ts`. Update the flatten re-export block to include the two new functions:

```ts
export {
  flattenCubic,
  flattenQuadratic,
  flattenCubicWithArcLen,
  flattenQuadraticWithArcLen,
  DEFAULT_FLATTEN_TOLERANCE,
} from './flatten';
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run src/features/paths/tessellate/polyline.test.ts
```

Expected: all polyline tests PASS (the existing tests still pass; the four new anchor-parameterization tests pass).

- [ ] **Step 7: Run the full path test suite to catch regressions**

```bash
npx vitest run src/features/paths
```

Expected: all path tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/paths/flatten.ts src/features/paths/tessellate/polyline.ts src/features/paths/tessellate/polyline.test.ts src/features/paths/index.ts
git commit -m "feat(paths): emit per-vertex anchor params from extractPolylines

Each flattened polyline point now carries (anchorA, anchorB, t):
anchor-aligned points set A=B,t=0; curve interiors interpolate
arc-length t in (0,1] between the segment's endpoint anchors.
Cubic/quadratic flatten gain *WithArcLen variants that accumulate
flattened polyline distance per emitted point.

Stroke and fill tessellators consume this in follow-up commits."
```

---

## Task 5: Fill mesh anchor parameterization (`tessellate`)

**Files:**
- Modify: `src/features/paths/tessellate/tessellate.ts`
- Modify: `src/features/paths/tessellate/tessellate.test.ts`

**Approach:** Earcut preserves input vertex order in its index output: an output index `i` refers to coordinate pair `(coords[i*2], coords[i*2+1])`. So if we pipe `(anchorA, anchorB, t)` parallel arrays through the flattening step and into the final coordinate ordering, each mesh vertex's anchor params can be read by position.

- [ ] **Step 1: Write the failing tests**

Append to `src/features/paths/tessellate/tessellate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { tessellate } from './tessellate';
import { PathBuilder, polygonFromPoints, rectPath } from '../builder';

describe('tessellate — anchor parameterization', () => {
  it('a rect mesh carries 4 anchor indices matching the corners', () => {
    const mesh = tessellate(rectPath(0, 0, 10, 10));
    expect(mesh.anchorA).toBeDefined();
    expect(mesh.anchorB).toBeDefined();
    expect(mesh.anchorT).toBeDefined();
    expect(mesh.anchorA!.length).toBe(mesh.vertices.length / 2);
    // Each rect vertex pinned to its own anchor.
    expect(Array.from(mesh.anchorA!)).toEqual([0, 1, 2, 3]);
    expect(Array.from(mesh.anchorB!)).toEqual([0, 1, 2, 3]);
    expect(Array.from(mesh.anchorT!)).toEqual([0, 0, 0, 0]);
  });

  it('a triangle polygon mesh has one anchor per vertex', () => {
    const p = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    const mesh = tessellate(p);
    expect(mesh.anchorA!.length).toBe(3);
    expect(Array.from(mesh.anchorA!)).toEqual([0, 1, 2]);
  });

  it('a cubic-bezier-only polygon emits anchor params interpolating across the curve', () => {
    // Closed: M → C → Z (anchor 0 at the M, anchor 1 at the C destination,
    // then Z closes back to anchor 0). Flat polyline has many interior points.
    const p = new PathBuilder()
      .moveTo(0, 0)
      .curveTo(0, 100, 100, 100, 100, 0)
      .lineTo(0, 0)
      .close()
      .build();
    const mesh = tessellate(p);
    const n = mesh.vertices.length / 2;
    expect(mesh.anchorA!.length).toBe(n);
    // First vertex should be anchor 0 (the M).
    expect(mesh.anchorA![0]).toBe(0);
    expect(mesh.anchorB![0]).toBe(0);
    // Some interior vertex along the curve must have anchorA = 0, anchorB = 1, t in (0,1).
    let foundInterior = false;
    for (let i = 1; i < n; i++) {
      if (mesh.anchorA![i] === 0 && mesh.anchorB![i] === 1 && mesh.anchorT![i] > 0 && mesh.anchorT![i] < 1) {
        foundInterior = true;
        break;
      }
    }
    expect(foundInterior).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npx vitest run src/features/paths/tessellate/tessellate.test.ts
```

Expected: 3 new tests fail.

- [ ] **Step 3: Update `flattenPolygon` to emit parallel anchor-param arrays**

Edit `src/features/paths/tessellate/tessellate.ts`. The current `flattenPolygon` returns `{ coords, contourStarts }`. Extend it to also return parallel `(anchorA, anchorB, t)` arrays per flattened point.

Replace the existing `flattenPolygon` function (around lines 42-101) and `FlattenedContours` interface with:

```ts
interface FlattenedContours {
  coords: number[];
  contourStarts: number[];
  anchorA: number[];
  anchorB: number[];
  anchorT: number[];
}

function flattenPolygon(p: PolygonPath, tolerance: number): FlattenedContours {
  const { commands, coords } = p;
  const out: number[] = [];
  const aA: number[] = [];
  const aB: number[] = [];
  const aT: number[] = [];
  const contourStarts: number[] = [];
  let coordIdx = 0;
  let prevX = 0;
  let prevY = 0;
  let prevAnchor = -1;
  let anchorCounter = 0;

  for (let cmdIdx = 0; cmdIdx < commands.length; cmdIdx++) {
    const cmd = commands[cmdIdx];
    switch (cmd) {
      case PATH_M: {
        contourStarts.push(out.length / 2);
        prevX = coords[coordIdx];
        prevY = coords[coordIdx + 1];
        out.push(prevX, prevY);
        aA.push(anchorCounter);
        aB.push(anchorCounter);
        aT.push(0);
        prevAnchor = anchorCounter;
        anchorCounter++;
        coordIdx += 2;
        break;
      }
      case PATH_L: {
        prevX = coords[coordIdx];
        prevY = coords[coordIdx + 1];
        out.push(prevX, prevY);
        aA.push(anchorCounter);
        aB.push(anchorCounter);
        aT.push(0);
        prevAnchor = anchorCounter;
        anchorCounter++;
        coordIdx += 2;
        break;
      }
      case PATH_Q: {
        const cx = coords[coordIdx], cy = coords[coordIdx + 1];
        const ex = coords[coordIdx + 2], ey = coords[coordIdx + 3];
        const target = anchorCounter;
        const arcAccum: number[] = [];
        const startIdx = out.length / 2;
        const total = flattenQuadraticWithArcLen(prevX, prevY, cx, cy, ex, ey, tolerance, out, arcAccum, 0);
        for (let k = 0; k < arcAccum.length; k++) {
          aA.push(prevAnchor);
          aB.push(target);
          aT.push(total > 0 ? arcAccum[k] / total : 0);
        }
        // Pin the last point (anchor-exact).
        const lastIdx = startIdx + arcAccum.length - 1;
        aA[lastIdx] = target;
        aB[lastIdx] = target;
        aT[lastIdx] = 0;
        prevX = ex; prevY = ey;
        prevAnchor = target;
        anchorCounter++;
        coordIdx += 4;
        break;
      }
      case PATH_C: {
        const c1x = coords[coordIdx], c1y = coords[coordIdx + 1];
        const c2x = coords[coordIdx + 2], c2y = coords[coordIdx + 3];
        const ex = coords[coordIdx + 4], ey = coords[coordIdx + 5];
        const target = anchorCounter;
        const arcAccum: number[] = [];
        const startIdx = out.length / 2;
        const total = flattenCubicWithArcLen(prevX, prevY, c1x, c1y, c2x, c2y, ex, ey, tolerance, out, arcAccum, 0);
        for (let k = 0; k < arcAccum.length; k++) {
          aA.push(prevAnchor);
          aB.push(target);
          aT.push(total > 0 ? arcAccum[k] / total : 0);
        }
        const lastIdx = startIdx + arcAccum.length - 1;
        aA[lastIdx] = target;
        aB[lastIdx] = target;
        aT[lastIdx] = 0;
        prevX = ex; prevY = ey;
        prevAnchor = target;
        anchorCounter++;
        coordIdx += 6;
        break;
      }
      case PATH_Z: {
        break;
      }
      default:
        throw new Error(`tessellate: unknown command code ${cmd}`);
    }
  }

  return { coords: out, contourStarts, anchorA: aA, anchorB: aB, anchorT: aT };
}
```

Update the import block at the top of the file to add the *WithArcLen variants:

```ts
import {
  type Path,
  type PolygonPath,
  type RectPath,
  PATH_M,
  PATH_L,
  PATH_Z,
  PATH_C,
  PATH_Q,
  DEFAULT_FLATTEN_TOLERANCE,
  flattenCubicWithArcLen,
  flattenQuadraticWithArcLen,
} from '@orochi235/weasel';
```

(Remove the now-unused `flattenCubic` and `flattenQuadratic` imports if they were there.)

- [ ] **Step 4: Update `tessellateRect` to emit anchor params**

In the same file, replace `tessellateRect`:

```ts
function tessellateRect(p: RectPath): Mesh {
  const { x, y, width: w, height: h } = p;
  return {
    vertices: new Float32Array([x, y, x + w, y, x + w, y + h, x, y + h]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    anchorA: new Uint32Array([0, 1, 2, 3]),
    anchorB: new Uint32Array([0, 1, 2, 3]),
    anchorT: new Float32Array([0, 0, 0, 0]),
  };
}
```

- [ ] **Step 5: Thread anchor params through `tessellatePolygon`**

In the same file, update `tessellatePolygon`. The function currently constructs a Mesh in three places (single contour, classic outer-with-holes, and general multi-contour). For each, the output `vertices` array is built from `coords` (or `finalCoords`); the parallel anchor arrays must follow the same index reordering.

Replace the `tessellatePolygon` function with this version (keep `signedArea`, `pointInContour`, and `tessellateEvenodd` unchanged):

```ts
function tessellatePolygon(p: PolygonPath, opts: TessellateOptions): Mesh {
  const tolerance = opts.flattenTolerance ?? DEFAULT_FLATTEN_TOLERANCE;
  const { coords, contourStarts, anchorA, anchorB, anchorT } = flattenPolygon(p, tolerance);

  if (p.fillRule === 'evenodd') {
    return tessellateEvenoddWithAnchors(coords, contourStarts, anchorA, anchorB, anchorT);
  }

  const totalVerts = coords.length / 2;
  const contourEnd = (i: number): number =>
    i + 1 < contourStarts.length ? contourStarts[i + 1] : totalVerts;

  if (contourStarts.length <= 1) {
    const tri = earcut(coords);
    return {
      vertices: new Float32Array(coords),
      indices: new Uint32Array(tri),
      anchorA: new Uint32Array(anchorA),
      anchorB: new Uint32Array(anchorB),
      anchorT: new Float32Array(anchorT),
    };
  }

  const areas: number[] = contourStarts.map((s, i) => signedArea(coords, s, contourEnd(i)));
  const refSign = Math.sign(areas[0]) || 1;

  const positives: number[] = [];
  const negatives: number[] = [];
  for (let i = 0; i < contourStarts.length; i++) {
    if (areas[i] === 0) continue;
    if (Math.sign(areas[i]) === refSign) positives.push(i);
    else negatives.push(i);
  }

  if (positives.length === 1 && negatives.length > 0) {
    const holeIndices = contourStarts.slice(1);
    const tri = earcut(coords, holeIndices);
    return {
      vertices: new Float32Array(coords),
      indices: new Uint32Array(tri),
      anchorA: new Uint32Array(anchorA),
      anchorB: new Uint32Array(anchorB),
      anchorT: new Float32Array(anchorT),
    };
  }

  const holesByPositive = new Map<number, number[]>();
  const orphanPositives: number[] = [];
  for (const n of negatives) {
    const px = coords[contourStarts[n] * 2];
    const py = coords[contourStarts[n] * 2 + 1];
    let bestPos = -1;
    let bestAbsArea = Infinity;
    for (const pos of positives) {
      const absArea = Math.abs(areas[pos]);
      if (absArea < bestAbsArea && pointInContour(coords, contourStarts[pos], contourEnd(pos), px, py)) {
        bestAbsArea = absArea;
        bestPos = pos;
      }
    }
    if (bestPos >= 0) {
      const arr = holesByPositive.get(bestPos) ?? [];
      arr.push(n);
      holesByPositive.set(bestPos, arr);
    } else {
      orphanPositives.push(n);
    }
  }

  const allPositives = [...positives, ...orphanPositives];

  const finalCoords: number[] = [];
  const finalAnchorA: number[] = [];
  const finalAnchorB: number[] = [];
  const finalAnchorT: number[] = [];
  const finalIndices: number[] = [];
  for (const pos of allPositives) {
    const holes = holesByPositive.get(pos) ?? [];
    const offset = finalCoords.length / 2;
    const groupCoords: number[] = [];
    const groupStarts: number[] = [0];
    const groupAnchorBaseStart = pos;
    // Append the positive contour's coords + anchor params.
    for (let i = contourStarts[pos]; i < contourEnd(pos); i++) {
      groupCoords.push(coords[i * 2], coords[i * 2 + 1]);
      finalAnchorA.push(anchorA[i]);
      finalAnchorB.push(anchorB[i]);
      finalAnchorT.push(anchorT[i]);
    }
    for (const h of holes) {
      groupStarts.push(groupCoords.length / 2);
      for (let i = contourStarts[h]; i < contourEnd(h); i++) {
        groupCoords.push(coords[i * 2], coords[i * 2 + 1]);
        finalAnchorA.push(anchorA[i]);
        finalAnchorB.push(anchorB[i]);
        finalAnchorT.push(anchorT[i]);
      }
    }
    const tri = earcut(groupCoords, groupStarts.length > 1 ? groupStarts.slice(1) : undefined);
    for (const v of groupCoords) finalCoords.push(v);
    for (const idx of tri) finalIndices.push(idx + offset);
    void groupAnchorBaseStart;  // tag kept for readability; no runtime effect.
  }

  return {
    vertices: new Float32Array(finalCoords),
    indices: new Uint32Array(finalIndices),
    anchorA: new Uint32Array(finalAnchorA),
    anchorB: new Uint32Array(finalAnchorB),
    anchorT: new Float32Array(finalAnchorT),
  };
}

function tessellateEvenoddWithAnchors(
  coords: number[],
  contourStarts: number[],
  anchorA: number[],
  anchorB: number[],
  anchorT: number[],
): Mesh {
  const indices: number[] = [];
  const totalVerts = coords.length / 2;
  for (let c = 0; c < contourStarts.length; c++) {
    const start = contourStarts[c];
    const end = c + 1 < contourStarts.length ? contourStarts[c + 1] : totalVerts;
    for (let i = start + 1; i < end - 1; i++) {
      indices.push(start, i, i + 1);
    }
  }
  return {
    vertices: new Float32Array(coords),
    indices: new Uint32Array(indices),
    requiresStencil: true,
    anchorA: new Uint32Array(anchorA),
    anchorB: new Uint32Array(anchorB),
    anchorT: new Float32Array(anchorT),
  };
}
```

Delete the now-unused `tessellateEvenodd` function (the wrapper above replaces it).

- [ ] **Step 6: Run tests**

```bash
npx vitest run src/features/paths/tessellate/tessellate.test.ts
```

Expected: existing tests still pass; 3 new anchor-param tests pass.

- [ ] **Step 7: Run the whole paths suite for regressions**

```bash
npx vitest run src/features/paths
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/paths/tessellate/tessellate.ts src/features/paths/tessellate/tessellate.test.ts
git commit -m "feat(paths): tessellate emits per-vertex anchor params on fill mesh

Each mesh vertex now carries (anchorA, anchorB, t). Earcut preserves
input ordering in its output indices, so the parallel anchor arrays
travel with the coords across single-contour, outer-with-holes, and
general multi-contour paths. RectPath emits 4 corner anchors."
```

---

## Task 6: Stroke ribbon anchor parameterization

**Files:**
- Modify: `src/features/paths/tessellate/stroke.ts`
- Modify: `src/features/paths/tessellate/stroke.test.ts`

**Approach:** Each emission in `expandPolyline` (segment ribbon vertex, join wedge vertex, miter apex, round-join fan vertex, cap vertex) maps to a polyline point whose anchor params are already known (Task 4). Thread the params through and record one `(A, B, t)` triple per ribbon vertex into mesh-level arrays. Dash splits interpolate `t` linearly along the segment.

This is the largest task — break into segments → joins → caps → dashes.

### Task 6a: Segment ribbon vertices

- [ ] **Step 1: Write the failing test**

Append to `src/features/paths/tessellate/stroke.test.ts`:

```ts
import { tessellateStroke } from './stroke';

describe('tessellateStroke — anchor params: segments', () => {
  it('a 2-point line emits 4 ribbon vertices each pinned to its endpoint anchor', () => {
    const p = new PathBuilder().moveTo(0, 0).lineTo(10, 0).build();
    const mesh = tessellateStroke(p, { paint: { color: '#fff' }, width: 2 });
    expect(mesh.anchorA).toBeDefined();
    expect(mesh.anchorA!.length).toBe(mesh.vertices.length / 2);
    // First two vertices (L0, R0) at the M anchor; next two (L1, R1) at the L anchor.
    expect(mesh.anchorA![0]).toBe(0);
    expect(mesh.anchorA![1]).toBe(0);
    expect(mesh.anchorA![2]).toBe(1);
    expect(mesh.anchorA![3]).toBe(1);
    expect(mesh.anchorT![0]).toBe(0);
    expect(mesh.anchorT![3]).toBe(0);
  });

  it('a cubic bezier stroke has interior ribbon vertices with t in (0,1)', () => {
    const p = new PathBuilder().moveTo(0, 0).curveTo(0, 50, 100, 50, 100, 0).build();
    const mesh = tessellateStroke(p, { paint: { color: '#fff' }, width: 2 });
    let foundInterior = false;
    for (let i = 0; i < mesh.anchorA!.length; i++) {
      if (mesh.anchorA![i] === 0 && mesh.anchorB![i] === 1 && mesh.anchorT![i] > 0 && mesh.anchorT![i] < 1) {
        foundInterior = true;
        break;
      }
    }
    expect(foundInterior).toBe(true);
  });
});
```

(`PathBuilder` is already imported at the top of `stroke.test.ts`. Verify; if not, add the import.)

- [ ] **Step 2: Run tests to verify failure**

```bash
npx vitest run src/features/paths/tessellate/stroke.test.ts -t "anchor params: segments"
```

Expected: FAIL — `mesh.anchorA` undefined.

- [ ] **Step 3: Thread anchor params through `expandPolyline` segment emissions**

Edit `src/features/paths/tessellate/stroke.ts`. The plan now requires `expandPolyline` and its callers to record per-ribbon-vertex anchor params.

Replace the `tessellateStroke` function and the `expandPolyline` function (segments only — joins, caps, dashes come in 6b/c/d).

At the top of the file, change the `EMPTY_MESH` constant to include empty anchor arrays:

```ts
const EMPTY_MESH: Mesh = {
  vertices: new Float32Array(0),
  indices: new Uint32Array(0),
  anchorA: new Uint32Array(0),
  anchorB: new Uint32Array(0),
  anchorT: new Float32Array(0),
};
```

Replace `tessellateStroke`:

```ts
export function tessellateStroke(
  path: Path,
  stroke: Stroke,
  opts: StrokeOptions = {},
): Mesh {
  const width = stroke.width ?? 1;
  if (width <= 0) return EMPTY_MESH;
  const join: Join = stroke.join ?? 'miter';
  const cap: Cap = stroke.cap ?? 'butt';
  const align = stroke.align ?? 'center';

  let workingPath = path;
  if (path.kind === 'rect' && align !== 'center') {
    const aligned = alignedStrokeRect(path, align, width);
    workingPath = {
      kind: 'rect',
      x: aligned.x,
      y: aligned.y,
      width: aligned.width,
      height: aligned.height,
    };
  }

  const polylines = extractPolylines(workingPath, opts);
  const dash = stroke.dash ?? [];
  const verts: number[] = [];
  const idx: number[] = [];
  const aA: number[] = [];
  const aB: number[] = [];
  const aT: number[] = [];

  for (const pl of polylines) {
    const subs = dash.length > 0 ? splitForDash(pl, dash) : [pl];
    for (const sub of subs) {
      expandPolyline(sub, width, join, cap, verts, idx, aA, aB, aT);
    }
  }

  return {
    vertices: new Float32Array(verts),
    indices: new Uint32Array(idx),
    anchorA: new Uint32Array(aA),
    anchorB: new Uint32Array(aB),
    anchorT: new Float32Array(aT),
  };
}
```

Replace `expandPolyline` (segments-only version for this sub-task; joins/caps still call existing helpers but with no anchor recording — fix in 6b/6c):

```ts
function expandPolyline(
  pl: Polyline,
  width: number,
  join: Join,
  cap: Cap,
  verts: number[],
  idx: number[],
  aA: number[],
  aB: number[],
  aT: number[],
): void {
  const half = width / 2;
  const pts = pl.points;
  const segCount = pts.length / 2 - 1;
  if (segCount < 1) return;

  // Anchor params per polyline point (set by extractPolylines; splitForDash
  // will re-derive these in Task 6d). Default to A=B=0,t=0 if missing.
  const plA = pl.anchorA ?? new Uint32Array(pts.length / 2);
  const plB = pl.anchorB ?? new Uint32Array(pts.length / 2);
  const plT = pl.anchorT ?? new Float32Array(pts.length / 2);

  const segs: Seg[] = [];
  const segSrcIdx: number[] = [];  // For each seg, the polyline-point index of its start.
  for (let s = 0; s < segCount; s++) {
    const seg = makeSeg(pts[s * 2], pts[s * 2 + 1], pts[(s + 1) * 2], pts[(s + 1) * 2 + 1], half);
    if (seg) {
      segs.push(seg);
      segSrcIdx.push(s);
    }
  }
  let closerSrcIdx = -1;
  if (pl.closed && segs.length >= 1) {
    const last = segs[segs.length - 1];
    const first = segs[0];
    const closer = makeSeg(last.bx, last.by, first.ax, first.ay, half);
    if (closer) {
      segs.push(closer);
      closerSrcIdx = pts.length / 2 - 1;  // start is the last polyline point.
      segSrcIdx.push(closerSrcIdx);
    }
  }
  if (segs.length === 0) return;

  // Emit ribbon quads. For each emitted vertex, record the (A, B, t) of the
  // source polyline point that the geometric vertex sits at.
  const segBaseIdx: number[] = [];
  for (let s = 0; s < segs.length; s++) {
    const seg = segs[s];
    const startSrc = segSrcIdx[s];
    // End-source index for the seg. For closer (closed-path wraparound), end is point 0.
    const endSrc = (s === segs.length - 1 && pl.closed && closerSrcIdx >= 0) ? 0 : startSrc + 1;
    const base = verts.length / 2;
    segBaseIdx.push(base);
    // L0, R0 — at seg.ax/ay; inherit start-source anchor params.
    verts.push(seg.ax + seg.nx, seg.ay + seg.ny);
    aA.push(plA[startSrc]); aB.push(plB[startSrc]); aT.push(plT[startSrc]);
    verts.push(seg.ax - seg.nx, seg.ay - seg.ny);
    aA.push(plA[startSrc]); aB.push(plB[startSrc]); aT.push(plT[startSrc]);
    // L1, R1 — at seg.bx/by; inherit end-source anchor params.
    verts.push(seg.bx + seg.nx, seg.by + seg.ny);
    aA.push(plA[endSrc]); aB.push(plB[endSrc]); aT.push(plT[endSrc]);
    verts.push(seg.bx - seg.nx, seg.by - seg.ny);
    aA.push(plA[endSrc]); aB.push(plB[endSrc]); aT.push(plT[endSrc]);
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  // Joins between consecutive segments. (Task 6b will thread anchor params here.)
  const joinCount = pl.closed ? segs.length : segs.length - 1;
  for (let j = 0; j < joinCount; j++) {
    emitJoin(segs, segBaseIdx, j, half, join, verts, idx, aA, aB, aT, segSrcIdx, plA, plB, plT, pl.closed);
  }

  // Caps. (Task 6c will thread anchor params here.)
  if (!pl.closed && cap !== 'butt') {
    const first = segs[0];
    const firstBase = segBaseIdx[0];
    emitCap(first, firstBase + 0, firstBase + 1, false, half, cap, verts, idx, aA, aB, aT, plA[0], plB[0], plT[0]);

    const last = segs[segs.length - 1];
    const lastBase = segBaseIdx[segs.length - 1];
    const lastSrc = segSrcIdx[segs.length - 1] + 1;
    emitCap(last, lastBase + 2, lastBase + 3, true, half, cap, verts, idx, aA, aB, aT, plA[lastSrc], plB[lastSrc], plT[lastSrc]);
  }
}
```

The above references `emitJoin` and `emitCap` with new signatures (anchor-recording parameters). Those will compile-fail until Task 6b and 6c update them. To unblock segment tests now, add the *type* signatures while still doing nothing with the new parameters:

Replace `emitJoin` and `emitCap` function signatures (keep existing body for now — just accept the extra args and ignore):

```ts
function emitJoin(
  segs: Seg[], segBaseIdx: number[], j: number, half: number, join: Join,
  verts: number[], idx: number[],
  aA: number[], aB: number[], aT: number[],
  segSrcIdx: number[],
  plA: Uint32Array, plB: Uint32Array, plT: Float32Array,
  closed: boolean,
): void {
  // ... existing body unchanged for now ...
}

function emitCap(
  seg: Seg, leftIdx: number, rightIdx: number, atEnd: boolean,
  half: number, cap: Cap,
  verts: number[], idx: number[],
  aA: number[], aB: number[], aT: number[],
  endA: number, endB: number, endT: number,
): void {
  // ... existing body unchanged for now ...
}
```

Update the bodies internally — when any of the existing emit code pushes to `verts`, also push the corresponding anchor param. For `emitJoin` (bevel branch): the new join vertex `jIdx` at `(a.bx, a.by)` is at the corner polyline point — anchor params come from `plA[segSrcIdx[j+1]]` (or `plA[0]` if closed wraparound). For now you can just push `0, 0, 0` to keep arrays length-consistent — Task 6b will refine.

Actually, the simplest unblocking approach is to push **placeholder** values that keep array lengths consistent. After Task 6a/b/c/d the placeholders are replaced with correct values.

To keep this task small and verifiable: in `emitJoin` and `emitCap`, for every `verts.push(x, y)` add `aA.push(0); aB.push(0); aT.push(0);` directly below. Mark with `// TODO Task 6b/6c: real anchor params`. Subsequent sub-tasks replace the zeros with real values.

Apply this throughout:
- `emitJoin` bevel: 1 vertex pushed (`jIdx`)
- `emitJoin` miter: 2 vertices pushed (`apexIdx`, `jIdx`)
- `emitJoin` round: pivot + (steps - 1) fan verts
- `emitCap` square: 2 vertices (`lOut`, `rOut`)
- `emitCap` round: pivot + (steps - 1) fan verts

Use placeholder zeros for now; they'll be corrected in subsequent sub-tasks.

- [ ] **Step 4: Verify type-check + segment tests pass**

```bash
npx tsc --noEmit
npx vitest run src/features/paths/tessellate/stroke.test.ts -t "anchor params: segments"
```

Expected: zero TS errors; segment tests pass.

- [ ] **Step 5: Confirm existing stroke tests still pass**

```bash
npx vitest run src/features/paths/tessellate/stroke.test.ts
```

Expected: all PASS (anchor placeholders don't affect geometry).

- [ ] **Step 6: Commit**

```bash
git add src/features/paths/tessellate/stroke.ts src/features/paths/tessellate/stroke.test.ts
git commit -m "feat(stroke): emit anchor params for segment ribbon vertices

Each segment's L0/R0/L1/R1 ribbon vertex inherits (A, B, t) from its
source polyline point. Join/cap emission paths receive the params but
still emit placeholder zeros — fixed in follow-up commits 6b/6c."
```

### Task 6b: Join vertex anchor params

- [ ] **Step 1: Write the failing test**

Append to `src/features/paths/tessellate/stroke.test.ts`:

```ts
describe('tessellateStroke — anchor params: joins', () => {
  it('miter join apex inherits the corner anchor (A === B at the corner)', () => {
    const p = new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).build();
    const mesh = tessellateStroke(p, { paint: { color: '#fff' }, width: 2, join: 'miter' });
    // The corner is anchor 1 (the middle L). Find any vertex whose A and B both
    // equal 1 and which is NOT a segment-quad corner (i.e., emitted by the join).
    // The plain segment quads only hit at the joint with the actual corner
    // polyline-point — those are pinned to anchor 1 as well. So the assertion
    // is: anchor params for join-emitted vertices are not the placeholder 0.
    let foundCornerAnchor = false;
    for (let i = 0; i < mesh.anchorA!.length; i++) {
      if (mesh.anchorA![i] === 1 && mesh.anchorB![i] === 1) {
        foundCornerAnchor = true;
      }
    }
    expect(foundCornerAnchor).toBe(true);
    // Stronger: no anchor params should remain at the default (0, 0, 0) for a
    // vertex that lies far from (0, 0). All emitted vertices should have an
    // identifiable anchor.
    for (let i = 0; i < mesh.anchorA!.length; i++) {
      const vx = mesh.vertices[i * 2];
      const vy = mesh.vertices[i * 2 + 1];
      const distFromZero = Math.hypot(vx, vy);
      if (distFromZero > 1) {
        // Any vertex away from origin must have an anchor index > 0 or be on segment 0->1.
        // Pragmatically: at least one of A or B should be > 0 if the vertex is past the corner.
        if (vx > 5 || vy > 5) {
          expect(Math.max(mesh.anchorA![i], mesh.anchorB![i])).toBeGreaterThan(0);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run tests to verify failure (with placeholders, the assertions fire)**

```bash
npx vitest run src/features/paths/tessellate/stroke.test.ts -t "anchor params: joins"
```

Expected: FAIL — vertices far from origin still have anchor 0 placeholder.

- [ ] **Step 3: Replace placeholder zeros in `emitJoin` with real anchor params**

Edit `src/features/paths/tessellate/stroke.ts`. The corner of join `j` is the start of segment `j+1` (or polyline point 0 if it's the wraparound closer).

Compute a `cornerSrc` index inside `emitJoin`:

```ts
const cornerSrc = j + 1 < segSrcIdx.length ? segSrcIdx[j + 1] : 0;
const cornerA = plA[cornerSrc];
const cornerB = plB[cornerSrc];
const cornerT = plT[cornerSrc];
```

Then every placeholder `aA.push(0); aB.push(0); aT.push(0);` inside `emitJoin` becomes `aA.push(cornerA); aB.push(cornerB); aT.push(cornerT);`.

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/features/paths/tessellate/stroke.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/paths/tessellate/stroke.ts src/features/paths/tessellate/stroke.test.ts
git commit -m "feat(stroke): join vertices inherit the corner anchor params

Bevel J vertex, miter apex + J vertex, and round-join pivot + fan verts
all sit at (or radiate from) the corner polyline point. Anchor params
come from that corner."
```

### Task 6c: Cap vertex anchor params

- [ ] **Step 1: Write the failing test**

Append:

```ts
describe('tessellateStroke — anchor params: caps', () => {
  it('round-cap fan vertices at the start inherit anchor 0 params', () => {
    const p = new PathBuilder().moveTo(0, 0).lineTo(50, 0).build();
    const mesh = tessellateStroke(p, { paint: { color: '#fff' }, width: 10, cap: 'round' });
    // Find vertices near the start endpoint (close to (0, 0)) — they should
    // be cap-emitted and tagged with anchor 0.
    let countNearStart = 0;
    let allHaveAnchor0 = true;
    for (let i = 0; i < mesh.anchorA!.length; i++) {
      const vx = mesh.vertices[i * 2];
      const vy = mesh.vertices[i * 2 + 1];
      if (vx < 0 || Math.hypot(vx, vy) < 5) {
        countNearStart++;
        if (mesh.anchorA![i] !== 0 || mesh.anchorB![i] !== 0) allHaveAnchor0 = false;
      }
    }
    expect(countNearStart).toBeGreaterThan(0);
    expect(allHaveAnchor0).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npx vitest run src/features/paths/tessellate/stroke.test.ts -t "anchor params: caps"
```

Expected: FAIL.

- [ ] **Step 3: Replace cap placeholder zeros with `endA/endB/endT`**

In `emitCap` (already receives `endA`, `endB`, `endT` from the calling site), replace every placeholder `aA.push(0); aB.push(0); aT.push(0);` with `aA.push(endA); aB.push(endB); aT.push(endT);`.

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/features/paths/tessellate/stroke.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/paths/tessellate/stroke.ts src/features/paths/tessellate/stroke.test.ts
git commit -m "feat(stroke): cap vertices inherit the endpoint anchor params

Square cap rectangle corners and round cap fan vertices all sit at the
endpoint anchor. Anchor params propagate from the polyline endpoint."
```

### Task 6d: Dash split vertex anchor params

- [ ] **Step 1: Write the failing test**

Append to `stroke.test.ts`:

```ts
describe('tessellateStroke — anchor params: dashed segments', () => {
  it('dashed stroke vertices inherit interpolated anchor params from their source segment', () => {
    // Single straight segment between anchors 0 and 1. Dashing splits it into
    // multiple sub-polylines. Every emitted ribbon vertex should still be tagged
    // with anchor 0 OR 1, never (0, 0, 0) garbage.
    const p = new PathBuilder().moveTo(0, 0).lineTo(100, 0).build();
    const mesh = tessellateStroke(p, { paint: { color: '#fff' }, width: 2, dash: [10, 5] });
    for (let i = 0; i < mesh.anchorA!.length; i++) {
      const a = mesh.anchorA![i];
      const b = mesh.anchorB![i];
      // Both endpoints are anchor 0 or 1; no other anchors exist.
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npx vitest run src/features/paths/tessellate/stroke.test.ts -t "dashed segments"
```

Expected: pre-existing dashing currently doesn't emit anchor params at all on the sub-polyline (the `splitForDash` helper drops them). FAIL.

- [ ] **Step 3: Extend `splitForDash` to carry anchor params on sub-polylines**

Edit `src/features/paths/tessellate/stroke.ts`. Replace `splitForDash` with this version that derives anchor params for each emitted sub-polyline point:

```ts
function splitForDash(pl: Polyline, dash: number[]): Polyline[] {
  const out: Polyline[] = [];
  const plA = pl.anchorA ?? new Uint32Array(pl.points.length / 2);
  const plB = pl.anchorB ?? new Uint32Array(pl.points.length / 2);
  const plT = pl.anchorT ?? new Float32Array(pl.points.length / 2);

  let dashIdx = 0;
  let dashRemaining = dash[0];
  let onPhase = true;
  let curPts: number[] | null = onPhase ? [pl.points[0], pl.points[1]] : null;
  let curA: number[] | null = onPhase ? [plA[0]] : null;
  let curB: number[] | null = onPhase ? [plB[0]] : null;
  let curT: number[] | null = onPhase ? [plT[0]] : null;

  const flushAndAdvance = () => {
    if (curPts && curPts.length >= 4) {
      out.push({
        points: curPts,
        closed: false,
        anchorA: new Uint32Array(curA!),
        anchorB: new Uint32Array(curB!),
        anchorT: new Float32Array(curT!),
      });
    }
    curPts = null; curA = null; curB = null; curT = null;
    dashIdx = (dashIdx + 1) % dash.length;
    dashRemaining = dash[dashIdx];
    onPhase = !onPhase;
  };

  let prevX = pl.points[0], prevY = pl.points[1];
  const ptCount = pl.points.length / 2;
  const segCount = pl.closed ? ptCount : ptCount - 1;

  for (let i = 0; i < segCount; i++) {
    const nextIdx = (i + 1) % ptCount;
    const cx = pl.points[nextIdx * 2], cy = pl.points[nextIdx * 2 + 1];
    // Anchor params at the segment endpoints.
    const startA = plA[i], startB = plB[i], startT = plT[i];
    const endA = plA[nextIdx], endB = plB[nextIdx], endT = plT[nextIdx];
    const segFullDx = cx - prevX, segFullDy = cy - prevY;
    const segFullLen = Math.hypot(segFullDx, segFullDy);
    let segDx = segFullDx, segDy = segFullDy;
    let segLen = segFullLen;
    let traveled = 0;

    while (segLen > 1e-9) {
      if (segLen <= dashRemaining) {
        if (onPhase && curPts) {
          curPts.push(cx, cy);
          curA!.push(endA); curB!.push(endB); curT!.push(endT);
        }
        dashRemaining -= segLen;
        prevX = cx; prevY = cy;
        traveled = segFullLen;
        segLen = 0;
        if (dashRemaining <= 1e-9) {
          flushAndAdvance();
          if (onPhase) {
            curPts = [prevX, prevY];
            curA = [endA]; curB = [endB]; curT = [endT];
          }
        }
      } else {
        const tConsume = dashRemaining / segLen;
        const ix = prevX + segDx * tConsume;
        const iy = prevY + segDy * tConsume;
        // Linearly interpolate the sub-polyline anchor params along the segment.
        // If start and end share the same (A, B), interpolate t. If they differ
        // (e.g. crossing an anchor), the geometry crosses a path-anchor —
        // unusual within a single polyline segment, but handle by snapping to
        // whichever endpoint we're closer to.
        traveled += dashRemaining;
        const frac = traveled / segFullLen;
        let mA: number, mB: number, mT: number;
        if (startA === endA && startB === endB) {
          mA = startA; mB = startB;
          mT = startT + (endT - startT) * frac;
        } else {
          // Cross-anchor segment — pick the nearer endpoint's params.
          if (frac < 0.5) { mA = startA; mB = startB; mT = startT; }
          else            { mA = endA; mB = endB; mT = endT; }
        }
        if (onPhase && curPts) {
          curPts.push(ix, iy);
          curA!.push(mA); curB!.push(mB); curT!.push(mT);
        }
        prevX = ix; prevY = iy;
        segDx = cx - prevX; segDy = cy - prevY;
        segLen = Math.hypot(segDx, segDy);
        flushAndAdvance();
        if (onPhase) {
          curPts = [prevX, prevY];
          curA = [mA]; curB = [mB]; curT = [mT];
        }
      }
    }
  }

  if (curPts && curPts.length >= 4) {
    out.push({
      points: curPts,
      closed: false,
      anchorA: new Uint32Array(curA!),
      anchorB: new Uint32Array(curB!),
      anchorT: new Float32Array(curT!),
    });
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/features/paths/tessellate/stroke.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/paths/tessellate/stroke.ts src/features/paths/tessellate/stroke.test.ts
git commit -m "feat(stroke): dashed sub-polylines carry anchor params

splitForDash now derives (A, B, t) for each emitted dash-on point —
endpoint anchors copy directly; mid-segment dash boundaries snap to
whichever endpoint they're closer to when the segment crosses a
path-anchor boundary."
```

---

## Task 7: `PathDrawCommand.vertexColors` semantic doc update

**Files:**
- Modify: `src/renderer/DrawCommand.ts`

- [ ] **Step 1: Update the JSDoc**

Edit `src/renderer/DrawCommand.ts`. Replace the JSDoc on `PathDrawCommand.vertexColors` with:

```ts
  /**
   * Optional flat RGBA-per-path-anchor color array (length =
   * `4 × countPathAnchors(path)`, floats in 0..1). The renderer
   * arc-length-interpolates these per-anchor colors across the
   * flattened/triangulated mesh between consecutive anchors using the
   * mesh's `anchorA` / `anchorB` / `anchorT` parameterization.
   *
   * **`fill` must also be set when using `vertexColors`.** The renderer
   * only enters the per-vertex shader path when the command has a fill
   * (the fill provides the opacity uniform; the vertex colors override
   * the fill's color). Pass any solid `fill` (e.g. `{ color: '#fff' }`)
   * as the placeholder; the per-vertex colors win in the shader.
   */
  vertexColors?: number[];
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/DrawCommand.ts
git commit -m "docs(renderer): PathDrawCommand.vertexColors is now per-anchor

Field semantic flips from per-mesh-vertex to per-path-anchor; renderer
expands via mesh anchor parameterization. For polygon-only paths the
two interpretations coincide so existing demo consumers still work."
```

---

## Task 8: Renderer-side expansion for fill vertex colors

**Files:**
- Modify: `src/renderer/draw.ts`

- [ ] **Step 1: Update `drawPathFillVColor` to CPU-expand per-anchor colors**

Edit `src/renderer/draw.ts`. Replace the body of `drawPathFillVColor` (around line 287) with:

```ts
function drawPathFillVColor(
  ctx: DrawContext,
  cmd: PathDrawCommand,
  fill: { color: string; opacity?: number },
  handle: GLMeshHandle,
): void {
  const gl = ctx.gl;
  const prog = ctx.pathFillVColor;
  gl.useProgram(prog.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx, prog);
  setSolidPaintUniforms(ctx, prog, fill.color, fill.opacity);
  setColorMatrixUniforms(ctx, prog);

  const expanded = expandAnchorColors(cmd.vertexColors!, handle);
  const colorVbo = gl.createBuffer();
  if (!colorVbo) throw new Error('drawPathFillVColor: createBuffer (color VBO) returned null');
  gl.bindBuffer(gl.ARRAY_BUFFER, colorVbo);
  gl.bufferData(gl.ARRAY_BUFFER, expanded, gl.DYNAMIC_DRAW);
  const aVColorLoc = prog.attribute('a_vertexColor');
  if (aVColorLoc !== undefined) {
    gl.enableVertexAttribArray(aVColorLoc);
    gl.vertexAttribPointer(aVColorLoc, 4, gl.FLOAT, false, 0, 0);
  }

  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
  gl.deleteBuffer(colorVbo);
}
```

- [ ] **Step 2: Add the `expandAnchorColors` helper and store anchor params on `GLMeshHandle`**

The handle currently doesn't expose `anchorA/B/T`. Three options: (a) augment `GLMeshHandle` to carry references to the source mesh's typed arrays, (b) store them on a parallel map, (c) re-emit them per-draw from the source mesh by looking up via a side channel.

(a) is simplest. Edit `src/renderer/cache/GLMeshCache.ts`:

```ts
export interface GLMeshHandle {
  readonly vao: WebGLVertexArrayObject;
  readonly indexCount: number;
  readonly requiresStencil: boolean;
  readonly anchorA?: Uint32Array;
  readonly anchorB?: Uint32Array;
  readonly anchorT?: Float32Array;
}
```

And update the `upload` method's return so the handle carries the anchor arrays from the source mesh. Inside `upload` (in the same file), after `gl.bindVertexArray(null);`, change the return value to:

```ts
    return {
      handle: {
        vao,
        indexCount: mesh.indices.length,
        requiresStencil: mesh.requiresStencil ?? false,
        anchorA: mesh.anchorA,
        anchorB: mesh.anchorB,
        anchorT: mesh.anchorT,
      },
      vbo,
      ibo,
    };
```

- [ ] **Step 3: Add the `expandAnchorColors` helper to draw.ts**

In `src/renderer/draw.ts`, near the existing color-handling helpers, add:

```ts
function expandAnchorColors(perAnchor: number[], handle: GLMeshHandle): Float32Array {
  const aA = handle.anchorA;
  const aB = handle.anchorB;
  const aT = handle.anchorT;
  if (!aA || !aB || !aT) {
    // Legacy path: caller-provided array is already per-vertex. Used for
    // meshes without anchor params (none in this codebase after the
    // tessellator changes, but keeps the renderer permissive).
    return new Float32Array(perAnchor);
  }
  const n = aA.length;
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const a4 = aA[i] * 4;
    const b4 = aB[i] * 4;
    const t = aT[i];
    out[i * 4 + 0] = perAnchor[a4 + 0] + (perAnchor[b4 + 0] - perAnchor[a4 + 0]) * t;
    out[i * 4 + 1] = perAnchor[a4 + 1] + (perAnchor[b4 + 1] - perAnchor[a4 + 1]) * t;
    out[i * 4 + 2] = perAnchor[a4 + 2] + (perAnchor[b4 + 2] - perAnchor[a4 + 2]) * t;
    out[i * 4 + 3] = perAnchor[a4 + 3] + (perAnchor[b4 + 3] - perAnchor[a4 + 3]) * t;
  }
  return out;
}
```

- [ ] **Step 4: Verify type-check and existing renderer tests pass**

```bash
npx tsc --noEmit
npx vitest run src/renderer
```

Expected: all PASS. (Existing renderer tests don't pass `vertexColors`, so the new expansion code isn't exercised by them yet — but the type change must compile.)

- [ ] **Step 5: Visually verify by running the existing VertexColorsDemo**

```bash
npm run dev
```

Open the dev server, navigate to the Vertex Colors demo. Confirm the heptagon still renders with its rainbow gradient. (For a polygon-only path, anchor count = mesh vertex count, and `(A=B, t=0)` produces the same lerp output as the old per-vertex semantic.)

Stop the dev server with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/draw.ts src/renderer/cache/GLMeshCache.ts
git commit -m "feat(renderer): expand per-anchor colors via mesh anchor params

drawPathFillVColor now CPU-expands the per-anchor color array into a
per-mesh-vertex Float32Array via the mesh's (anchorA, anchorB, t)
parameterization, then uploads as the color VBO. Behavior unchanged
for polygon-only paths (A=B at every vertex); curve interiors get
arc-length-interpolated colors."
```

---

## Task 9: Renderer-side stroke vertex colors

**Files:**
- Modify: `src/renderer/draw.ts`

The stroke ribbon is a transient mesh built per-frame by `tessellateStroke`. Its `anchorA/B/T` arrays travel through `uploadTransient` to the handle (Task 8 already wired that path).

- [ ] **Step 1: Route the unclipped stroke path to vColor when colors are present**

Edit `src/renderer/draw.ts`. Replace `drawPathStrokeUnclipped` (around line 618) with:

```ts
function drawPathStrokeUnclipped(ctx: DrawContext, cmd: PathDrawCommand): void {
  const stroke = cmd.stroke!;
  const solid = stroke.paint as { color: string; opacity?: number };
  const mesh = tessellateStroke(cmd.path, stroke);
  if (mesh.indices.length === 0) return;
  const handle = ctx.meshCache.uploadTransient(mesh);

  const gl = ctx.gl;
  if (stroke.vertexColors && stroke.vertexColors.length > 0) {
    const prog = ctx.pathFillVColor;
    gl.useProgram(prog.handle);
    gl.bindVertexArray(handle.vao);
    setProjAndModel(ctx, prog);
    setSolidPaintUniforms(ctx, prog, solid.color, solid.opacity);
    setColorMatrixUniforms(ctx, prog);

    const expanded = expandAnchorColors(stroke.vertexColors, handle);
    const colorVbo = gl.createBuffer();
    if (!colorVbo) throw new Error('drawPathStrokeUnclipped: createBuffer (color VBO) returned null');
    gl.bindBuffer(gl.ARRAY_BUFFER, colorVbo);
    gl.bufferData(gl.ARRAY_BUFFER, expanded, gl.DYNAMIC_DRAW);
    const aVColorLoc = prog.attribute('a_vertexColor');
    if (aVColorLoc !== undefined) {
      gl.enableVertexAttribArray(aVColorLoc);
      gl.vertexAttribPointer(aVColorLoc, 4, gl.FLOAT, false, 0, 0);
    }
    gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    gl.deleteBuffer(colorVbo);
    return;
  }

  gl.useProgram(ctx.pathFill.handle);
  gl.bindVertexArray(handle.vao);
  setProjAndModel(ctx, ctx.pathFill);
  setSolidPaintUniforms(ctx, ctx.pathFill, solid.color, solid.opacity);
  setColorMatrixUniforms(ctx, ctx.pathFill);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}
```

- [ ] **Step 2: Route the stenciled stroke path to vColor when colors are present**

In the same file, replace `drawPathStrokeStenciled` (around line 639) with:

```ts
function drawPathStrokeStenciled(
  ctx: DrawContext,
  cmd: PathDrawCommand,
  align: 'inner' | 'outer',
): void {
  const stroke = cmd.stroke!;
  const solid = stroke.paint as { color: string; opacity?: number };
  const widerStroke: Stroke = { ...stroke, width: (stroke.width ?? 1) * 2, align: 'center' };

  const fillMesh = getMesh(cmd.path);
  const fillHandle = ctx.meshCache.handleFor(fillMesh);
  const ribbonMesh = tessellateStroke(cmd.path, widerStroke);
  if (ribbonMesh.indices.length === 0) return;
  const ribbonHandle = ctx.meshCache.uploadTransient(ribbonMesh);

  const gl = ctx.gl;
  const useVColor = stroke.vertexColors && stroke.vertexColors.length > 0;
  const prog = useVColor ? ctx.pathFillVColor : ctx.pathFill;
  gl.useProgram(prog.handle);
  setProjAndModel(ctx, prog);

  gl.enable(gl.STENCIL_TEST);
  gl.colorMask(false, false, false, false);
  gl.stencilMask(0x01);
  gl.stencilFunc(gl.ALWAYS, 1, 0x01);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
  gl.bindVertexArray(fillHandle.vao);
  gl.drawElements(gl.TRIANGLES, fillHandle.indexCount, gl.UNSIGNED_INT, 0);

  gl.colorMask(true, true, true, true);
  gl.stencilFunc(gl.EQUAL, align === 'inner' ? 1 : 0, 0x01);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  setSolidPaintUniforms(ctx, prog, solid.color, solid.opacity);
  setColorMatrixUniforms(ctx, prog);
  gl.bindVertexArray(ribbonHandle.vao);

  let colorVbo: WebGLBuffer | null = null;
  if (useVColor) {
    const expanded = expandAnchorColors(stroke.vertexColors!, ribbonHandle);
    colorVbo = gl.createBuffer();
    if (!colorVbo) throw new Error('drawPathStrokeStenciled: createBuffer (color VBO) returned null');
    gl.bindBuffer(gl.ARRAY_BUFFER, colorVbo);
    gl.bufferData(gl.ARRAY_BUFFER, expanded, gl.DYNAMIC_DRAW);
    const aVColorLoc = prog.attribute('a_vertexColor');
    if (aVColorLoc !== undefined) {
      gl.enableVertexAttribArray(aVColorLoc);
      gl.vertexAttribPointer(aVColorLoc, 4, gl.FLOAT, false, 0, 0);
    }
  }

  gl.drawElements(gl.TRIANGLES, ribbonHandle.indexCount, gl.UNSIGNED_INT, 0);
  if (colorVbo) gl.deleteBuffer(colorVbo);

  gl.stencilMask(0x01);
  gl.clear(gl.STENCIL_BUFFER_BIT);
  gl.disable(gl.STENCIL_TEST);
  gl.bindVertexArray(null);
}
```

- [ ] **Step 3: Verify type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Run renderer tests**

```bash
npx vitest run src/renderer
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/draw.ts
git commit -m "feat(renderer): per-anchor stroke colors via pathFillVColor

drawPathStrokeUnclipped and drawPathStrokeStenciled both route to the
existing pathFillVColor shader when stroke.vertexColors is set. The
ribbon mesh's anchor parameterization drives CPU-side color expansion;
shader is geometry-agnostic so no shader changes were needed."
```

---

## Task 10: `createPathLayer` fill hook + validation

**Files:**
- Modify: `src/features/paths/pathLayer.ts`
- Modify: `src/features/paths/pathLayer.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/features/paths/pathLayer.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createPathLayer } from './pathLayer';
import { polygonFromPoints, rectPath } from './builder';

describe('createPathLayer — getVertexColors', () => {
  it('threads per-anchor colors through to the emitted PathDrawCommand', () => {
    const path = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    const colors = [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1];
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }],
      getPath: () => path,
      getVertexColors: () => colors,
    });
    const out = layer.draw(undefined, { x: 0, y: 0, scale: 1 } as any);
    const group = out[0] as any;
    const cmd = group.children[0];
    expect(cmd.vertexColors).toEqual(colors);
    // Placeholder fill is synthesized so the renderer's gate passes.
    expect(cmd.fill).toEqual({ color: '#ffffff' });
  });

  it('explicit fill from getFill wins over the synthesized placeholder', () => {
    const path = rectPath(0, 0, 10, 10);
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }],
      getPath: () => path,
      getFill: () => ({ color: '#abcdef', opacity: 0.5 }),
      getVertexColors: () => [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 1, 1, 1],
    });
    const out = layer.draw(undefined, { x: 0, y: 0, scale: 1 } as any);
    const cmd = (out[0] as any).children[0];
    expect(cmd.fill).toEqual({ color: '#abcdef', opacity: 0.5 });
  });

  it('warns and drops colors when the array length does not match 4 × anchor count (dev mode)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const path = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    // 3 anchors → expects 12 floats; supply 8.
    const layer = createPathLayer({
      getNodes: () => [{ id: 'wrong' }],
      getPath: () => path,
      getVertexColors: () => [1, 0, 0, 1, 0, 1, 0, 1],
    });
    const out = layer.draw(undefined, { x: 0, y: 0, scale: 1 } as any);
    const cmd = (out[0] as any).children[0];
    expect(cmd.vertexColors).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('warns once per (layer-id, node-id) pair across multiple draw calls', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const path = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    const layer = createPathLayer({
      id: 'L1',
      getNodes: () => [{ id: 'wrong' }],
      getPath: () => path,
      getVertexColors: () => [1, 0, 0, 1],
    });
    layer.draw(undefined, { x: 0, y: 0, scale: 1 } as any);
    layer.draw(undefined, { x: 0, y: 0, scale: 1 } as any);
    layer.draw(undefined, { x: 0, y: 0, scale: 1 } as any);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npx vitest run src/features/paths/pathLayer.test.ts -t "getVertexColors"
```

Expected: FAIL (the hook doesn't exist).

- [ ] **Step 3: Implement the hook + placeholder + validation**

Replace the file contents of `src/features/paths/pathLayer.ts`:

```ts
/**
 * `RenderLayer` that fills/strokes `Path` instances. Mirrors the shape of
 * `createTextLayer`: caller hands over a `getNodes()` enumerator and a
 * `getPath(node)` lookup; the layer iterates and renders. Paint and
 * stroke are looked up per node so consumers can keep the path geometry
 * separate from the visual style record (the typical scene-graph layout).
 */

import { type DrawCommand, viewToMat3 } from '../../renderer';
import { type Paint, type Stroke } from 'core/paint-types';
import type { RenderLayer } from 'core/layers/render';
import type { Path } from './types';
import { countPathAnchors } from './anchors';

const PLACEHOLDER_FILL: Paint = { color: '#ffffff' };
const PLACEHOLDER_STROKE: Stroke = { paint: { color: '#ffffff' }, width: 1 };

/** Options for `createPathLayer`. */
export interface CreatePathLayerOpts<T> {
  id?: string;
  label?: string;
  getNodes: () => readonly T[];
  getPath: (node: T) => Path;
  /** Per-node fill paint. Return `null`/`undefined` to skip filling. */
  getFill?: (node: T) => Paint | null | undefined;
  /** Per-node stroke. Return `null`/`undefined` to skip stroking. */
  getStroke?: (node: T) => Stroke | null | undefined;
  /** Optional per-node hide hook (e.g., suppress while editing). */
  isHidden?: (node: T) => boolean;
  /**
   * Per-node fill vertex-color array, flat RGBA-per-path-anchor.
   * Length must be `4 × countPathAnchors(getPath(node))`. When set and
   * `getFill` returns null/undefined, a white placeholder fill is
   * synthesized so the renderer's per-vertex shader path activates.
   */
  getVertexColors?: (node: T) => number[] | null | undefined;
  /**
   * Per-node stroke vertex-color array, flat RGBA-per-path-anchor.
   * Length must be `4 × countPathAnchors(getPath(node))`. When set and
   * `getStroke` returns null/undefined, a white 1px placeholder stroke
   * is synthesized.
   */
  getStrokeVertexColors?: (node: T) => number[] | null | undefined;
}

/** Build a `RenderLayer` that fills/strokes `Path` instances enumerated from a node list. */
export function createPathLayer<T>(opts: CreatePathLayerOpts<T>): RenderLayer<unknown> {
  const {
    id = 'paths', label = 'Paths',
    getNodes, getPath, getFill, getStroke, isHidden,
    getVertexColors, getStrokeVertexColors,
  } = opts;
  const warned = new Set<string>();
  const isDev = typeof import.meta !== 'undefined'
    && (import.meta as any).env
    && (import.meta as any).env.DEV;

  return {
    id,
    label,
    draw: (_data, view) => {
      const children: DrawCommand[] = [];
      for (const node of getNodes()) {
        if (isHidden?.(node)) continue;
        const path = getPath(node);
        const fillFromHook = getFill?.(node);
        const strokeFromHook = getStroke?.(node);
        const vColors = getVertexColors?.(node);
        const strokeVColors = getStrokeVertexColors?.(node);

        const nodeKey = (node as { id?: string }).id ?? String(children.length);
        const expectedLen = 4 * countPathAnchors(path);

        let useVColors: number[] | null = null;
        if (vColors != null) {
          if (vColors.length === expectedLen) {
            useVColors = vColors;
          } else if (isDev) {
            const key = `${id}:${nodeKey}:fill`;
            if (!warned.has(key)) {
              warned.add(key);
              // eslint-disable-next-line no-console
              console.warn(
                `[createPathLayer ${id}] node ${nodeKey}: fill vertexColors length ${vColors.length}, expected ${expectedLen}; dropping`,
              );
            }
          }
        }

        let useStrokeVColors: number[] | null = null;
        if (strokeVColors != null) {
          if (strokeVColors.length === expectedLen) {
            useStrokeVColors = strokeVColors;
          } else if (isDev) {
            const key = `${id}:${nodeKey}:stroke`;
            if (!warned.has(key)) {
              warned.add(key);
              // eslint-disable-next-line no-console
              console.warn(
                `[createPathLayer ${id}] node ${nodeKey}: stroke vertexColors length ${strokeVColors.length}, expected ${expectedLen}; dropping`,
              );
            }
          }
        }

        const fill: Paint | undefined =
          fillFromHook != null ? fillFromHook
          : (useVColors != null ? PLACEHOLDER_FILL : undefined);

        const baseStroke: Stroke | undefined =
          strokeFromHook != null ? strokeFromHook
          : (useStrokeVColors != null ? PLACEHOLDER_STROKE : undefined);

        const stroke: Stroke | undefined =
          baseStroke != null && useStrokeVColors != null
            ? { ...baseStroke, vertexColors: useStrokeVColors }
            : baseStroke;

        if (fill == null && stroke == null) continue;

        children.push({
          kind: 'path',
          path,
          ...(fill != null ? { fill } : {}),
          ...(stroke != null ? { stroke } : {}),
          ...(useVColors != null ? { vertexColors: useVColors } : {}),
        });
      }
      return [{ kind: 'group', transform: viewToMat3(view), children }];
    },
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/features/paths/pathLayer.test.ts
```

Expected: all PASS (including pre-existing tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/paths/pathLayer.ts src/features/paths/pathLayer.test.ts
git commit -m "feat(paths): createPathLayer per-anchor vertex-color hooks

Adds getVertexColors (fill) and getStrokeVertexColors (stroke) hooks
with white-paint placeholder synthesis when getFill / getStroke return
null. Dev-only length validation warns once per (layer, node, side)
pair and drops mismatched arrays."
```

---

## Task 11: Stroke-vertex-colors test for createPathLayer

**Files:**
- Modify: `src/features/paths/pathLayer.test.ts`

- [ ] **Step 1: Add stroke-side tests**

Append to `pathLayer.test.ts`:

```ts
describe('createPathLayer — getStrokeVertexColors', () => {
  it('threads stroke vertex colors onto Stroke.vertexColors with placeholder stroke', () => {
    const path = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    const colors = [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1];
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }],
      getPath: () => path,
      getStrokeVertexColors: () => colors,
    });
    const out = layer.draw(undefined, { x: 0, y: 0, scale: 1 } as any);
    const cmd = (out[0] as any).children[0];
    expect(cmd.stroke.vertexColors).toEqual(colors);
    expect(cmd.stroke.paint).toEqual({ color: '#ffffff' });
    expect(cmd.stroke.width).toBe(1);
  });

  it('threads stroke vertex colors onto an existing Stroke (overriding any pre-set vertexColors)', () => {
    const path = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    const colors = [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1];
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }],
      getPath: () => path,
      getStroke: () => ({ paint: { color: '#000' }, width: 3 }),
      getStrokeVertexColors: () => colors,
    });
    const out = layer.draw(undefined, { x: 0, y: 0, scale: 1 } as any);
    const cmd = (out[0] as any).children[0];
    expect(cmd.stroke.vertexColors).toEqual(colors);
    expect(cmd.stroke.paint).toEqual({ color: '#000' });
    expect(cmd.stroke.width).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/features/paths/pathLayer.test.ts
```

Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/paths/pathLayer.test.ts
git commit -m "test(paths): cover createPathLayer stroke vertex-color hook"
```

---

## Task 12: Refactor `VertexColorsDemo` to use the new hook

**Files:**
- Modify: `demo/demos/VertexColorsDemo.tsx`

- [ ] **Step 1: Replace the demo body**

Replace the contents of `demo/demos/VertexColorsDemo.tsx` with:

```tsx
import { useMemo, useRef, useState } from 'react';
import {
  SceneCanvas,
  createPathLayer,
  hexToRgba,
  polygonFromPoints,
  rgbaToHex,
  useHandleDrag,
  useScene,
} from '@orochi235/weasel';
import type { Path } from '@orochi235/weasel';

const W = 600;
const H = 400;
const N = 7;

interface Vertex { x: number; y: number; rgba: [number, number, number, number]; }
interface HeptagonNode { id: string; path: Path; colors: number[]; }

const RAINBOW: [number, number, number, number][] = [
  [1.0, 0.2, 0.3, 1.0],
  [1.0, 0.6, 0.1, 1.0],
  [1.0, 0.9, 0.2, 1.0],
  [0.3, 0.9, 0.4, 1.0],
  [0.2, 0.7, 0.95, 1.0],
  [0.4, 0.4, 0.95, 1.0],
  [0.7, 0.3, 0.9, 1.0],
];

function makeHeptagon(): Vertex[] {
  const cx = W / 2, cy = H / 2, r = 140;
  return Array.from({ length: N }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    return {
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r,
      rgba: RAINBOW[i % RAINBOW.length],
    };
  });
}

export function VertexColorsDemo() {
  const [verts, setVerts] = useState<Vertex[]>(makeHeptagon);
  const [showHandles, setShowHandles] = useState(true);

  const node: HeptagonNode = useMemo(() => ({
    id: 'heptagon',
    path: polygonFromPoints(verts.map((v) => ({ x: v.x, y: v.y }))),
    colors: verts.flatMap((v) => v.rgba),
  }), [verts]);

  const layer = useMemo(() => createPathLayer<HeptagonNode>({
    id: 'vertex-colored-poly',
    label: 'Vertex-colored polygon',
    getNodes: () => [node],
    getPath: (n) => n.path,
    getVertexColors: (n) => n.colors,
  }), [node]);

  const scene = useScene<never, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });

  return (
    <div className="ckd-stack">
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <label style={{ color: '#ddd' }}>
          <input
            type="checkbox"
            checked={showHandles}
            onChange={(e) => setShowHandles(e.target.checked)}
          />
          {' '}show handles
        </label>
        <button onClick={() => setVerts(makeHeptagon())} style={{ padding: '4px 10px' }}>Reset</button>
      </div>
      <div style={{ position: 'relative', width: W, height: H }}>
        <SceneCanvas
          width={W}
          height={H}
          className="ckd-canvas"
          scene={scene}
          layers={{
            scene: { drawOne: () => [] },
            poly: { layer, after: 'scene' },
          }}
        />
        {showHandles && (
          <Handles verts={verts} setVerts={setVerts} width={W} height={H} />
        )}
      </div>
    </div>
  );
}

function Handles({
  verts, setVerts, width, height,
}: {
  verts: Vertex[];
  setVerts: (v: Vertex[] | ((prev: Vertex[]) => Vertex[])) => void;
  width: number;
  height: number;
}) {
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {verts.map((v, i) => (
        <VertexHandle
          key={i}
          v={v}
          onMove={(x, y) => setVerts((prev) => prev.map((p, j) => j === i ? { ...p, x, y } : p))}
          onRecolor={(rgba) => setVerts((prev) => prev.map((p, j) => j === i ? { ...p, rgba } : p))}
        />
      ))}
    </svg>
  );
}

function VertexHandle({
  v, onMove, onRecolor,
}: {
  v: Vertex;
  onMove: (x: number, y: number) => void;
  onRecolor: (rgba: [number, number, number, number]) => void;
}) {
  const swatchHex = rgbaToHex(v.rgba);
  const colorRef = useRef<HTMLInputElement>(null);
  const drag = useHandleDrag<SVGCircleElement>({
    onMove: ({ x, y }) => onMove(x, y),
  });
  return (
    <g style={{ pointerEvents: 'auto' }}>
      <circle
        cx={v.x}
        cy={v.y}
        r={9}
        fill={swatchHex}
        stroke="#fff"
        strokeWidth={2}
        style={{ cursor: 'grab' }}
        {...drag}
        onDoubleClick={(e) => {
          e.preventDefault();
          colorRef.current?.click();
        }}
      />
      <foreignObject x={v.x} y={v.y} width={1} height={1} style={{ overflow: 'visible' }}>
        <input
          ref={colorRef}
          type="color"
          value={swatchHex}
          onChange={(e) => onRecolor(hexToRgba(e.target.value))}
          style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }}
        />
      </foreignObject>
    </g>
  );
}
```

The custom `RenderLayer` is gone; the demo now models the heptagon as a `HeptagonNode` and uses `createPathLayer({ getVertexColors })`.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Visually verify in the dev server**

```bash
npm run dev
```

Open the Vertex Colors demo. Confirm the heptagon renders with the rainbow gradient. Drag a vertex handle — colors stay glued to vertices as the geometry moves. Double-click a handle and pick a new color — that vertex's hue updates.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add demo/demos/VertexColorsDemo.tsx
git commit -m "refactor(demo): VertexColorsDemo uses createPathLayer hook

Drops the custom RenderLayer and DrawCommand emission in favor of
createPathLayer({ getVertexColors }). Demonstrates the new public
surface for per-anchor fill coloring."
```

---

## Task 13: Rainbow stroke in `BezierEditDemo`

**Files:**
- Modify: `demo/demos/BezierEditDemo.tsx`

- [ ] **Step 1: Add the rainbow stroke**

Edit `demo/demos/BezierEditDemo.tsx`. The demo has two stroke emission sites: `drawGhost` (around line 86) and the `scene.drawOne` slot (around line 160). Both render the same path with `stroke: { paint: { color: '#f5b7a3' }, width: 2 }`.

At the top of the file, add the new import:

```ts
import {
  Canvas,
  PathBuilder,
  pathPoseDescriptor,
  PATH_C,
  countPathAnchors,
  selectFromMarquee,
  useSelection,
  useSelectWithAnchorEdit,
} from '@orochi235/weasel';
```

Then add a helper near the top of the file (after the imports and constants):

```tsx
function rainbowColors(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const h = (i * 360) / Math.max(1, n);
    const [r, g, b] = hslToRgb(h, 0.8, 0.6);
    out.push(r, g, b, 1);
  }
  return out;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = l - c / 2;
  return [r + m, g + m, b + m];
}
```

Then update the two stroke emission sites. The `drawGhost` (around line 86) becomes:

```tsx
    drawGhost: (_o, p): DrawCommand[] => {
      const colors = rainbowColors(countPathAnchors(p));
      return [{
        kind: 'path',
        path: p,
        stroke: { paint: { color: '#ffffff' }, width: 2, vertexColors: colors },
      }];
    },
```

And `scene.drawOne` (around line 160) becomes:

```tsx
              scene: {
                drawOne: (_o, p): DrawCommand[] => {
                  const colors = rainbowColors(countPathAnchors(p));
                  return [{
                    kind: 'path',
                    path: p,
                    stroke: { paint: { color: '#ffffff' }, width: 2, vertexColors: colors },
                  }];
                },
              },
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Visually verify in the dev server**

```bash
npm run dev
```

Open the Bezier Edit demo. The S-curve should now show a smooth rainbow gradient along its length — red at one end, transitioning through hue space to violet at the other. Click "Add point" — a new cubic gets appended; the rainbow redistributes across one more anchor, so each color band gets slightly thinner. Drag an anchor — colors stay attached to their anchor as the curve warps.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add demo/demos/BezierEditDemo.tsx
git commit -m "feat(demo): rainbow stroke on the BezierEditDemo S-curve

Demonstrates per-anchor stroke colors arc-length-interpolated across
flattened cubic segments. Adding anchors via the Add point button
redistributes the rainbow; dragging an anchor warps the gradient
along with the geometry."
```

---

## Task 14: Update `docs/TODO.md`

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: Replace the per-vertex coloring entry**

Edit `docs/TODO.md`. Locate the Tier 1 bullet "Per-vertex coloring on paths" (search for "Per-vertex coloring"). Replace its body with:

```markdown
- **Per-anchor coloring on paths.** *Shipped.* `createPathLayer` exposes `getVertexColors` (fill) and `getStrokeVertexColors` (stroke). Colors live on `PathDrawCommand.vertexColors` (fill) and `Stroke.vertexColors` (stroke) as flat RGBA-per-path-anchor; the renderer arc-length-interpolates across the flattened/tessellated mesh between consecutive anchors. `countPathAnchors(path)` is exported for sizing arrays. Two demos in the kit: `VertexColorsDemo` (fill) and `BezierEditDemo` (rainbow stroke on the editable S-curve). Spec: `docs/superpowers/specs/2026-05-10-per-anchor-path-coloring-design.md`. Open follow-up: animation primitive integration (tween/spring over a color array) for things like color cycling along a stroke.
```

- [ ] **Step 2: Commit**

```bash
git add docs/TODO.md
git commit -m "docs(todo): mark per-anchor path coloring shipped

Public createPathLayer hooks for fill + stroke, arc-length interpolation
across curves, countPathAnchors helper, two demos."
```

---

## Final verification

- [ ] **Step 1: Full test suite + typecheck (matches the CI release gate)**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: zero TS errors; all tests pass.

- [ ] **Step 2: Production build**

```bash
npm run build
```

Expected: build completes cleanly. (The project uses `tsup`; the `prepublishOnly` gate runs `tsc --noEmit && vitest run && tsup build`.)

- [ ] **Step 3: Push the branch and open a PR**

```bash
git push -u origin feat/per-anchor-path-coloring
gh pr create --title "feat: per-anchor path coloring (fill + stroke)" --body "$(cat <<'EOF'
## Summary
- `createPathLayer` gains `getVertexColors` (fill) and `getStrokeVertexColors` (stroke) hooks
- `Stroke.vertexColors` field added; `PathDrawCommand.vertexColors` semantic flipped to per-anchor (arc-length interpolated across the mesh)
- New `countPathAnchors(path)` helper for sizing arrays
- `VertexColorsDemo` refactored to use the hook; `BezierEditDemo` gains a rainbow stroke

Spec: `docs/superpowers/specs/2026-05-10-per-anchor-path-coloring-design.md`.

## Test plan
- [ ] Run `npx vitest run` — all unit tests pass
- [ ] Open VertexColorsDemo in the dev server; verify rainbow heptagon renders, dragging a vertex moves color with geometry, double-click recolors
- [ ] Open BezierEditDemo; verify the S-curve renders with a rainbow gradient; click "Add point" — rainbow redistributes; drag an anchor — gradient follows
EOF
)"
```

---

## Risks and rollback

- **Mesh-cache stale anchor params.** `getMesh` caches by Path identity. Anchor params are computed inside `tessellate` and stored on the same Mesh object — they live and die with the mesh, so cache invalidation is automatic. If a consumer mutates Path coords in place (against the documented immutability convention), they'll get stale colors *and* stale geometry — same failure mode as before, so no new risk.
- **Stroke tessellation perf.** Anchor params are always emitted now, even for stroke calls that don't use vertex colors. Extra cost is `3 × ribbonVertexCount` typed-array writes per `tessellateStroke`. Negligible; the existing GL-buffer-leak fix already dominated the per-frame budget.
- **Rollback.** If the renderer routing in Task 8/9 misbehaves, the safest rollback is to revert Task 8 + Task 9 commits — the new field semantics fall back to the old behavior on solid strokes (no `vertexColors` set), and fills with vertex colors fall back to the legacy expansion in `expandAnchorColors` when `handle.anchorA` is undefined (the path is permissive). Tasks 4-6 (anchor-param emission) are inert without the consuming code paths.
