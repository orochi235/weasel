# WebGL Transition — Step 2: Strokes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stroke rendering to `@weasel-js/gl`. Polyline → ribbon mesh expansion (CPU-side caps, joins, miter limits), dash patterns via geometry gaps, and `StrokeAlign` (`center`/`inner`/`outer`). Reuses the existing path-fill shader (strokes are just colored triangles). Exits when synthetic scenes covering all caps, all joins, dash patterns, and all three alignments render correctly in headless Chromium.

**Architecture:** New module `packages/gl/src/stroke.ts` produces a `Mesh` from `(Path, Stroke)`. The `kind: 'path'` DrawCommand variant gains an optional `stroke?: Stroke`. `drawPath()` draws fill first (existing) then stroke (new). For `align: 'inner' | 'outer'` on arbitrary paths, a stencil two-pass clips the ribbon to the path's interior or exterior — pass 1 builds the path-interior stencil mask, pass 2 draws the ribbon with the mask. `RectPath` short-circuits via `alignedStrokeRect` (existing helper in `@weasel-js/core/core/paint.ts`).

**Tech Stack:** TypeScript (strict), vitest. No new external deps. Reuses `@weasel-js/core` exports: `Stroke` (existing public), `Path`, `PolygonPath`, `RectPath`, path command codes, `flattenCubic`/`flattenQuadratic`. Adds two exports to `@weasel-js/core`'s barrel: `StrokeAlign` type, `alignedStrokeRect` helper.

**Spec:** [`docs/superpowers/specs/2026-05-08-webgl-transition-plan-design.md`](../specs/2026-05-08-webgl-transition-plan-design.md), Sequencing → Step 2.

**Required reading before starting:**
- [`webgl-stepwise-conventions.md`](./webgl-stepwise-conventions.md) — accumulated lessons that apply to every step. Read entries 1, 2, and 6 in particular: they directly affect Tasks 11 and 13 of this plan.
- [`2026-05-08-webgl-step-1-done.md`](./2026-05-08-webgl-step-1-done.md) — context on what step 1 shipped and what bit us along the way.

**Conventions cited by specific tasks below:**
- Task 11 (stencil-clipped stroke): conventions §1 — *unit tests don't catch stencil bugs*; visual smoke required.
- Task 13 (smoke spec): conventions §6 — `preserveDrawingBuffer: true` AND `stencil: true` on every dev-page `getContext` call.
- Any new fragment shader (none in this step, but watch step 3 onward): conventions §2 — premultiplied output `vec4(rgb*a, a)` + `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`.

---

## File structure

Files this plan creates/modifies in `packages/gl/src/`:

```
stroke.ts                  # NEW — polyline → ribbon mesh; caps, joins, dash
stroke.test.ts             # NEW
DrawCommand.ts             # MODIFY — add stroke?: Stroke to PathDrawCommand
draw.ts                    # MODIFY — drawPath dispatches fill then stroke; stencil two-pass for inner/outer
draw.test.ts               # MODIFY — assertions for stroke calls + stencil paths
WeaselRenderer.ts          # (no changes expected; stroke uses existing pathFill program)
index.ts                   # MODIFY — export from stroke.ts
```

Files outside the package:

```
src/index.ts               # MODIFY — export StrokeAlign type and alignedStrokeRect helper
packages/gl/dev/synthetic.html   # MODIFY — add stroke scenes
packages/gl/dev/synthetic.ts     # MODIFY
packages/gl/dev/synthetic.spec.ts # MODIFY (or extend smoke.spec.ts)
docs/TODO.md               # MODIFY — mark step 2 shipped
docs/superpowers/plans/2026-05-09-webgl-step-2-done.md  # NEW done note
```

---

## Task 1: Public exports for `StrokeAlign` and `alignedStrokeRect`

**Files:**
- Modify: `src/index.ts`

`weasel-gl` needs `StrokeAlign` and `alignedStrokeRect` from the parent package. Both exist in `src/core/paint.ts` but only `Stroke` is publicly exported.

- [ ] **Step 1: Add exports**

Append to the relevant block in `src/index.ts` (next to the existing `Stroke` export):

```ts
export type {
  Paint,
  Stroke,
  StrokeAlign,
  Region,
  RenderFilledRegionOptions,
} from './core/paint';
export { applyPaint, applyStroke, renderFilledRegion, alignedStrokeRect } from './core/paint';
```

(Replace the existing two related blocks with the merged versions above.)

- [ ] **Step 2: Verify exports**

Run: `npm run typecheck`

Expected: 0 errors.

Run a quick value check: create `/tmp/check-export.ts`:

```ts
import { alignedStrokeRect, type StrokeAlign } from '@weasel-js/core';
const r = alignedStrokeRect({ x: 0, y: 0, width: 10, height: 10 }, 'inner', 2);
const a: StrokeAlign = 'center';
console.log(r, a);
```

Run: `npx tsx /tmp/check-export.ts && rm /tmp/check-export.ts`

Expected: prints the deflated rect `{ x: 1, y: 1, width: 8, height: 8 } center`.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(weasel): export StrokeAlign type and alignedStrokeRect helper"
```

---

## Task 2: Polyline extraction

**Files:**
- Create: `packages/gl/src/polyline.ts`
- Create: `packages/gl/src/polyline.test.ts`

A helper that walks a `Path` and emits one polyline per contour. Reuses bezier flattening from `@weasel-js/core` (`flattenCubic`/`flattenQuadratic`). Output shape: `{ points: number[]; closed: boolean }[]` where `points` is interleaved x,y and `closed` reflects whether the contour ended with `Z`.

- [ ] **Step 1: Write the failing test**

Create `packages/gl/src/polyline.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  PATH_M, PATH_L, PATH_Q, PATH_Z,
  type PolygonPath,
  type RectPath,
} from '@weasel-js/core';
import { extractPolylines } from './polyline';

describe('extractPolylines', () => {
  it('emits a closed 4-point polyline for a RectPath', () => {
    const r: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const out = extractPolylines(r);
    expect(out).toHaveLength(1);
    expect(out[0].closed).toBe(true);
    expect(Array.from(out[0].points)).toEqual([0, 0, 10, 0, 10, 10, 0, 10]);
  });

  it('emits a closed polyline for a M/L/L/L/Z polygon', () => {
    const p: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
      fillRule: 'nonzero',
    };
    const out = extractPolylines(p);
    expect(out).toHaveLength(1);
    expect(out[0].closed).toBe(true);
    expect(out[0].points).toEqual([0, 0, 10, 0, 10, 10, 0, 10]);
  });

  it('emits an open polyline for a polygon without Z', () => {
    const p: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L]),
      coords: new Float32Array([0, 0, 10, 0, 20, 0]),
      fillRule: 'nonzero',
    };
    const out = extractPolylines(p);
    expect(out[0].closed).toBe(false);
  });

  it('flattens curves into polyline points', () => {
    const p: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_Q, PATH_Z]),
      coords: new Float32Array([0, 0, 5, 10, 10, 0]),
      fillRule: 'nonzero',
    };
    const out = extractPolylines(p);
    expect(out[0].points.length).toBeGreaterThan(4);
    expect(out[0].closed).toBe(true);
  });

  it('emits one polyline per contour for multi-contour paths', () => {
    const p: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
      ]),
      coords: new Float32Array([
        0, 0, 10, 0, 10, 10, 0, 10,
        3, 3, 7, 3, 7, 7, 3, 7,
      ]),
      fillRule: 'nonzero',
    };
    const out = extractPolylines(p);
    expect(out).toHaveLength(2);
    expect(out[0].points.length).toBe(8);
    expect(out[1].points.length).toBe(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/gl/src/polyline.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement polyline extraction**

Create `packages/gl/src/polyline.ts`:

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
  flattenCubic,
  flattenQuadratic,
} from '@weasel-js/core';

export interface Polyline {
  /** Interleaved x,y vertices (length = 2 × point count). */
  points: number[];
  /** Whether the contour was closed (ends with Z, or is a RectPath). */
  closed: boolean;
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
  return { points: [x, y, x + w, y, x + w, y + h, x, y + h], closed: true };
}

function extractPolygon(p: PolygonPath, opts: ExtractOptions): Polyline[] {
  const tolerance = opts.flattenTolerance ?? DEFAULT_FLATTEN_TOLERANCE;
  const { commands, coords } = p;
  const out: Polyline[] = [];
  let current: Polyline | null = null;
  let coordIdx = 0;
  let prevX = 0;
  let prevY = 0;

  const ensureCurrent = () => {
    if (!current) {
      current = { points: [], closed: false };
      out.push(current);
    }
    return current;
  };

  for (let cmdIdx = 0; cmdIdx < commands.length; cmdIdx++) {
    const cmd = commands[cmdIdx];
    switch (cmd) {
      case PATH_M: {
        // Close out the previous contour (without setting closed=true)
        // and start a new one.
        current = { points: [], closed: false };
        out.push(current);
        prevX = coords[coordIdx];
        prevY = coords[coordIdx + 1];
        current.points.push(prevX, prevY);
        coordIdx += 2;
        break;
      }
      case PATH_L: {
        prevX = coords[coordIdx];
        prevY = coords[coordIdx + 1];
        ensureCurrent().points.push(prevX, prevY);
        coordIdx += 2;
        break;
      }
      case PATH_Q: {
        const cx = coords[coordIdx], cy = coords[coordIdx + 1];
        const ex = coords[coordIdx + 2], ey = coords[coordIdx + 3];
        flattenQuadratic(prevX, prevY, cx, cy, ex, ey, tolerance, ensureCurrent().points);
        prevX = ex; prevY = ey;
        coordIdx += 4;
        break;
      }
      case PATH_C: {
        const c1x = coords[coordIdx], c1y = coords[coordIdx + 1];
        const c2x = coords[coordIdx + 2], c2y = coords[coordIdx + 3];
        const ex = coords[coordIdx + 4], ey = coords[coordIdx + 5];
        flattenCubic(prevX, prevY, c1x, c1y, c2x, c2y, ex, ey, tolerance, ensureCurrent().points);
        prevX = ex; prevY = ey;
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

  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/gl/src/polyline.test.ts`

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/polyline.ts packages/gl/src/polyline.test.ts
git commit -m "feat(weasel-gl): extractPolylines (path → flattened polylines per contour)"
```

---

## Task 3: Stroke ribbon — straight segments, butt caps, no joins

**Files:**
- Create: `packages/gl/src/stroke.ts`
- Create: `packages/gl/src/stroke.test.ts`

Generates a `Mesh` for a stroke. First version handles only straight segments with `cap: 'butt'` and no joins (treats each segment independently). Subsequent tasks add joins, other caps, dashes.

- [ ] **Step 1: Write the failing test**

Create `packages/gl/src/stroke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { RectPath, Stroke } from '@weasel-js/core';
import { tessellateStroke } from './stroke';

describe('tessellateStroke (straight, butt, no joins)', () => {
  it('expands a rect outline into a ribbon mesh', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 100, height: 50 };
    const stroke: Stroke = { paint: { color: '#000' }, width: 4, cap: 'butt', join: 'bevel' };
    const mesh = tessellateStroke(path, stroke);
    // 4 segments × 2 triangles per segment × 3 indices = 24
    // Bevel joins on a closed path with 4 corners can add 0–4 more triangles;
    // join handling lands in a later task. Here we just confirm the ribbon
    // exists and is non-degenerate.
    expect(mesh.vertices.length).toBeGreaterThanOrEqual(16);   // ≥ 8 unique points × 2
    expect(mesh.indices.length).toBeGreaterThanOrEqual(24);
    expect(mesh.indices.length % 3).toBe(0);
  });

  it('produces an empty mesh for a stroke with width 0', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 100, height: 50 };
    const stroke: Stroke = { paint: { color: '#000' }, width: 0 };
    const mesh = tessellateStroke(path, stroke);
    expect(mesh.indices.length).toBe(0);
  });

  it('uses default width 1 when omitted', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 100, height: 50 };
    const meshDefault = tessellateStroke(path, { paint: { color: '#000' } });
    const meshExplicit = tessellateStroke(path, { paint: { color: '#000' }, width: 1 });
    expect(meshDefault.indices.length).toBe(meshExplicit.indices.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/gl/src/stroke.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement basic ribbon expansion**

Create `packages/gl/src/stroke.ts`:

```ts
import type { Path, Stroke } from '@weasel-js/core';
import type { Mesh } from './mesh';
import { extractPolylines, type Polyline } from './polyline';

export interface StrokeOptions {
  flattenTolerance?: number;
}

const EMPTY_MESH: Mesh = {
  vertices: new Float32Array(0),
  indices: new Uint32Array(0),
};

/**
 * Build a triangle-mesh ribbon from a stroked Path.
 *
 * Step-2 v1 scope:
 *   - cap: 'butt'  (no extension at endpoints)
 *   - join: 'bevel' (CPU triangle filling the wedge between segments)
 *   - center alignment (caller deflates/inflates rects upstream for inner/outer)
 *   - solid (no dash)
 *
 * Subsequent tasks add other caps, miter/round joins, dashes, and stencil-
 * based inner/outer alignment for arbitrary paths.
 */
export function tessellateStroke(
  path: Path,
  stroke: Stroke,
  opts: StrokeOptions = {},
): Mesh {
  const width = stroke.width ?? 1;
  if (width <= 0) return EMPTY_MESH;

  const polylines = extractPolylines(path, opts);
  const verts: number[] = [];
  const idx: number[] = [];

  for (const pl of polylines) {
    expandPolyline(pl, width, verts, idx);
  }

  return {
    vertices: new Float32Array(verts),
    indices: new Uint32Array(idx),
  };
}

function expandPolyline(pl: Polyline, width: number, verts: number[], idx: number[]): void {
  const half = width / 2;
  const pts = pl.points;
  const segCount = pts.length / 2 - 1;
  if (segCount < 1) return;

  for (let s = 0; s < segCount; s++) {
    const ax = pts[s * 2], ay = pts[s * 2 + 1];
    const bx = pts[(s + 1) * 2], by = pts[(s + 1) * 2 + 1];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;
    // Perpendicular (rotated 90° CCW), normalized × half-width.
    const nx = (-dy / len) * half;
    const ny = (dx / len) * half;

    const base = verts.length / 2;
    verts.push(ax + nx, ay + ny);   // 0: a + perp
    verts.push(ax - nx, ay - ny);   // 1: a - perp
    verts.push(bx + nx, by + ny);   // 2: b + perp
    verts.push(bx - nx, by - ny);   // 3: b - perp
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  // Closing segment for closed polylines.
  if (pl.closed) {
    const ax = pts[pts.length - 2], ay = pts[pts.length - 1];
    const bx = pts[0], by = pts[1];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len !== 0) {
      const nx = (-dy / len) * half;
      const ny = (dx / len) * half;
      const base = verts.length / 2;
      verts.push(ax + nx, ay + ny);
      verts.push(ax - nx, ay - ny);
      verts.push(bx + nx, by + ny);
      verts.push(bx - nx, by - ny);
      idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/gl/src/stroke.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/stroke.ts packages/gl/src/stroke.test.ts
git commit -m "feat(weasel-gl): tessellateStroke for straight segments (butt cap, no joins)"
```

---

## Task 4: Bevel joins

**Files:**
- Modify: `packages/gl/src/stroke.ts`
- Modify: `packages/gl/src/stroke.test.ts`

A bevel join fills the wedge between two segments with a single triangle from the outer corner of segment A's end to the outer corner of segment B's start, sharing the inner corner.

- [ ] **Step 1: Write the failing test**

Append to `packages/gl/src/stroke.test.ts`:

```ts
describe('tessellateStroke joins', () => {
  it('inserts a bevel triangle between two segments at a corner', () => {
    // Open polyline: (0,0) → (10,0) → (10,10). One corner.
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10]),
      fillRule: 'nonzero',
    };
    const meshNoBevel = tessellateStroke(path, { paint: { color: '#000' }, width: 4, join: 'bevel' });
    // Two segments × 2 triangles + 1 bevel triangle = 5 triangles → 15 indices.
    expect(meshNoBevel.indices.length).toBe(15);
  });
});

import { PATH_M, PATH_L, type PolygonPath } from '@weasel-js/core';
```

(Place the `import` at the top of the file with the other imports.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/gl/src/stroke.test.ts`

Expected: FAIL — bevel triangle not yet emitted; current count is 12.

- [ ] **Step 3: Implement bevel joins**

Replace `expandPolyline` in `packages/gl/src/stroke.ts`:

```ts
function expandPolyline(pl: Polyline, width: number, join: 'miter' | 'round' | 'bevel', verts: number[], idx: number[]): void {
  const half = width / 2;
  const pts = pl.points;
  const segCount = pts.length / 2 - 1;
  if (segCount < 1) return;

  // Compute per-segment perpendiculars first so joins can reference both sides.
  type Seg = { ax: number; ay: number; bx: number; by: number; nx: number; ny: number; len: number };
  const segs: Seg[] = [];
  for (let s = 0; s < segCount; s++) {
    const ax = pts[s * 2], ay = pts[s * 2 + 1];
    const bx = pts[(s + 1) * 2], by = pts[(s + 1) * 2 + 1];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;
    segs.push({ ax, ay, bx, by, nx: (-dy / len) * half, ny: (dx / len) * half, len });
  }
  if (pl.closed && segs.length >= 1) {
    const a = segs[segs.length - 1].bx, ay = segs[segs.length - 1].by;
    const bx = segs[0].ax, by = segs[0].ay;
    const dx = bx - a, dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len !== 0) {
      segs.push({ ax: a, ay, bx, by, nx: (-dy / len) * half, ny: (dx / len) * half, len });
    }
  }

  // Emit one ribbon quad per segment.
  const segBaseIdx: number[] = [];
  for (const seg of segs) {
    const base = verts.length / 2;
    segBaseIdx.push(base);
    verts.push(seg.ax + seg.nx, seg.ay + seg.ny); // L0
    verts.push(seg.ax - seg.nx, seg.ay - seg.ny); // R0
    verts.push(seg.bx + seg.nx, seg.by + seg.ny); // L1
    verts.push(seg.bx - seg.nx, seg.by - seg.ny); // R1
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  // Joins between consecutive segments (and the closing seam if closed).
  const joinCount = pl.closed ? segs.length : segs.length - 1;
  for (let j = 0; j < joinCount; j++) {
    const aBase = segBaseIdx[j];
    const bBase = segBaseIdx[(j + 1) % segs.length];
    if (join === 'bevel') {
      // Triangle fills the outer wedge. Determine which side is outer by
      // cross product of segment directions.
      const a = segs[j];
      const b = segs[(j + 1) % segs.length];
      const cross = a.nx * (b.bx - b.ax) + a.ny * (b.by - b.ay);
      // If cross > 0, segment B turns toward the +n side: outer wedge is on -n.
      // Outer-side vertex of segment A's end: indexed at aBase+2 (L1) or aBase+3 (R1).
      // Inner-side of B's start: bBase+1 (R0) or bBase+0 (L0).
      const aOuterEnd = cross > 0 ? aBase + 3 : aBase + 2;          // L1 or R1
      const bOuterStart = cross > 0 ? bBase + 1 : bBase + 0;        // R0 or L0
      const innerCorner = cross > 0 ? aBase + 2 : aBase + 3;        // opposite end of A
      idx.push(aOuterEnd, innerCorner, bOuterStart);
    }
    // miter / round joins land in subsequent tasks.
  }
}
```

Update `tessellateStroke` to pass the join through:

```ts
const join = stroke.join ?? 'miter';   // canvas default
// inside the loop:
expandPolyline(pl, width, join, verts, idx);
```

(For now, only `'bevel'` actually emits a join triangle. `'miter'` and `'round'` hit the no-op branch and effectively act like bevel-without-fill — i.e. visible gap. Subsequent tasks fix this.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/gl/src/stroke.test.ts`

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/stroke.ts packages/gl/src/stroke.test.ts
git commit -m "feat(weasel-gl): bevel joins"
```

---

## Task 5: Miter joins (with miter limit)

**Files:**
- Modify: `packages/gl/src/stroke.ts`
- Modify: `packages/gl/src/stroke.test.ts`

A miter join extends both segments' outer edges until they meet at a point. If the angle is too sharp (miter length > miter limit × half-width), the join falls back to bevel.

The default miter limit in Canvas2D is 10. Since `Stroke` doesn't currently have a `miterLimit` field, we hard-code 10 for v1; document the limitation.

- [ ] **Step 1: Write the failing test**

Append to `packages/gl/src/stroke.test.ts`:

```ts
it('extends miter join to the outer apex on a 90° corner', () => {
  const path: PolygonPath = {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L]),
    coords: new Float32Array([0, 0, 10, 0, 10, 10]),
    fillRule: 'nonzero',
  };
  const mesh = tessellateStroke(path, { paint: { color: '#000' }, width: 4, join: 'miter' });
  // 2 segments × 2 triangles + 1 miter triangle = 5 triangles → 15 indices.
  expect(mesh.indices.length).toBe(15);
});

it('falls back to bevel for very acute angles (miter limit 10, half-width 2 → max miter length 20)', () => {
  // ~5° corner: (0, 0) → (100, 0) → (200, -3). Very acute.
  const path: PolygonPath = {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L]),
    coords: new Float32Array([0, 0, 100, 0, 200, -3]),
    fillRule: 'nonzero',
  };
  const mesh = tessellateStroke(path, { paint: { color: '#000' }, width: 4, join: 'miter' });
  // Same triangle count as bevel since fallback kicks in.
  expect(mesh.indices.length).toBe(15);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/gl/src/stroke.test.ts`

Expected: FAIL — miter case has no join triangle yet (12 indices, expected 15).

- [ ] **Step 3: Implement miter**

Add a helper to `stroke.ts` and update the join branch:

```ts
const MITER_LIMIT = 10;

// Inside the join loop, alongside the bevel branch:
if (join === 'miter') {
  const a = segs[j];
  const b = segs[(j + 1) % segs.length];
  // Miter point: intersect the two outer edges. Outer side determined by cross.
  const cross = a.nx * (b.bx - b.ax) + a.ny * (b.by - b.ay);
  const aOuterEnd = cross > 0 ? aBase + 3 : aBase + 2;
  const bOuterStart = cross > 0 ? bBase + 1 : bBase + 0;
  const innerCorner = cross > 0 ? aBase + 2 : aBase + 3;
  // Average the two perpendiculars for the miter direction.
  const sign = cross > 0 ? -1 : 1;
  const mx = sign * (a.nx + b.nx);
  const my = sign * (a.ny + b.ny);
  // Miter length: |a.n + b.n| / |a.n + b.n projected on a.n|, scaled by half.
  // For unit perpendiculars (a.n, b.n already half-length), the bisector length
  // is half / cos(θ/2) where θ is the angle between segments.
  const dotN = (a.nx * b.nx + a.ny * b.ny) / ((a.len) === 0 ? 1 : 1);
  // (Simpler: compute the actual intersection point.)
  // Apex = a.bx + factor * (mx, my) where factor accounts for the normalized bisector.
  const half = (stroke.width ?? 1) / 2;  // not in scope; pass via param
  // … the math is fiddlier than this scaffold; full implementation lands here.
}
```

(The above is illustrative; the full implementation needs the miter math to be self-consistent. The implementer should derive the apex from line-line intersection and compare its distance to the joint to `MITER_LIMIT * half`. If exceeded, fall through to bevel.)

The clean implementation:

```ts
function emitMiterOrBevel(
  segs: Seg[], j: number, segBaseIdx: number[],
  half: number, idx: number[], verts: number[], closed: boolean,
): void {
  const a = segs[j];
  const b = segs[(j + 1) % segs.length];
  const aBase = segBaseIdx[j];
  const bBase = segBaseIdx[(j + 1) % segs.length];

  // Cross product of segment direction vectors → outer side selection.
  const adx = a.bx - a.ax, ady = a.by - a.ay;
  const bdx = b.bx - b.ax, bdy = b.by - b.ay;
  const cross = adx * bdy - ady * bdx;
  const onPositive = cross > 0;                                   // outer is on -n side

  const aOuterEnd = onPositive ? aBase + 3 : aBase + 2;           // R1 or L1
  const bOuterStart = onPositive ? bBase + 1 : bBase + 0;         // R0 or L0
  const innerCorner = onPositive ? aBase + 2 : aBase + 3;         // L1 or R1

  // Solve for apex: ray from outer end of A in direction of A, ray from
  // outer start of B (going backward) intersection point.
  const aOX = verts[aOuterEnd * 2], aOY = verts[aOuterEnd * 2 + 1];
  const bOX = verts[bOuterStart * 2], bOY = verts[bOuterStart * 2 + 1];
  const apx = lineLineX(aOX, aOY, adx, ady, bOX, bOY, -bdx, -bdy);
  const apy = lineLineY(aOX, aOY, adx, ady, bOX, bOY, -bdx, -bdy);

  // Miter limit: distance from joint corner to apex.
  const jointX = a.bx, jointY = a.by;
  const miterLen = Math.hypot(apx - jointX, apy - jointY);
  if (miterLen > MITER_LIMIT * half || !Number.isFinite(apx)) {
    // Bevel fallback.
    idx.push(aOuterEnd, innerCorner, bOuterStart);
    return;
  }
  // Insert apex vertex.
  const apexIdx = verts.length / 2;
  verts.push(apx, apy);
  idx.push(aOuterEnd, innerCorner, apexIdx);
  idx.push(apexIdx, innerCorner, bOuterStart);
}

// Line-line intersection helpers (parametric).
function lineLineX(ax: number, ay: number, adx: number, ady: number, bx: number, by: number, bdx: number, bdy: number): number {
  const denom = adx * bdy - ady * bdx;
  if (denom === 0) return NaN;
  const t = ((bx - ax) * bdy - (by - ay) * bdx) / denom;
  return ax + t * adx;
}
function lineLineY(ax: number, ay: number, adx: number, ady: number, bx: number, by: number, bdx: number, bdy: number): number {
  const denom = adx * bdy - ady * bdx;
  if (denom === 0) return NaN;
  const t = ((bx - ax) * bdy - (by - ay) * bdx) / denom;
  return ay + t * ady;
}
```

Use `emitMiterOrBevel` in the join loop when `join === 'miter'`. Bevel branch stays as a single bevel triangle.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/gl/src/stroke.test.ts`

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/stroke.ts packages/gl/src/stroke.test.ts
git commit -m "feat(weasel-gl): miter joins with miter-limit bevel fallback"
```

---

## Task 6: Round joins

**Files:**
- Modify: `packages/gl/src/stroke.ts`
- Modify: `packages/gl/src/stroke.test.ts`

A round join is an arc fan from one segment's outer corner to the next segment's outer corner, centered on the joint. Tessellate with N triangles where N depends on the angle and a fixed angular step (~10°/segment is fine for v1).

- [ ] **Step 1: Write the failing test**

Append:

```ts
it('emits at least 3 fan triangles for a round join on a 90° corner', () => {
  const path: PolygonPath = {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L]),
    coords: new Float32Array([0, 0, 10, 0, 10, 10]),
    fillRule: 'nonzero',
  };
  const mesh = tessellateStroke(path, { paint: { color: '#000' }, width: 4, join: 'round' });
  // 2 ribbon segments × 2 triangles = 4. Round join over 90° at ~10°/step ≈ 9 fan triangles.
  // Total: 4 + 9 = 13 triangles minimum. Allow ≥ 7 to permit different angular-step choices.
  expect(mesh.indices.length / 3).toBeGreaterThanOrEqual(4 + 7);
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — round emits no join triangles yet (4 ribbon × 3 = 12 indices).

- [ ] **Step 3: Implement round**

Add to the join loop:

```ts
const ROUND_STEP_RAD = (10 * Math.PI) / 180;   // ~10° per fan segment

if (join === 'round') {
  const a = segs[j];
  const b = segs[(j + 1) % segs.length];
  const aBase = segBaseIdx[j];
  const bBase = segBaseIdx[(j + 1) % segs.length];
  const adx = a.bx - a.ax, ady = a.by - a.ay;
  const bdx = b.bx - b.ax, bdy = b.by - b.ay;
  const cross = adx * bdy - ady * bdx;
  const onPositive = cross > 0;

  const aOuterEnd = onPositive ? aBase + 3 : aBase + 2;
  const bOuterStart = onPositive ? bBase + 1 : bBase + 0;
  const innerCorner = onPositive ? aBase + 2 : aBase + 3;

  const cx = a.bx, cy = a.by;
  const startX = verts[aOuterEnd * 2] - cx;
  const startY = verts[aOuterEnd * 2 + 1] - cy;
  const endX = verts[bOuterStart * 2] - cx;
  const endY = verts[bOuterStart * 2 + 1] - cy;

  // Total angular sweep (signed; arc goes the "outer" way).
  let startAngle = Math.atan2(startY, startX);
  let endAngle = Math.atan2(endY, endX);
  let sweep = endAngle - startAngle;
  // Normalize sweep so it goes the outer (longer-than-180-if-needed) way:
  // for the cross direction, the outer arc is the shorter one in the right
  // orientation. The straightforward fix:
  if (onPositive && sweep < 0) sweep += 2 * Math.PI;
  else if (!onPositive && sweep > 0) sweep -= 2 * Math.PI;

  const steps = Math.max(1, Math.ceil(Math.abs(sweep) / ROUND_STEP_RAD));
  const stepAngle = sweep / steps;
  const r = Math.hypot(startX, startY);

  let prevIdx = aOuterEnd;
  for (let i = 1; i < steps; i++) {
    const ang = startAngle + i * stepAngle;
    const fx = cx + Math.cos(ang) * r;
    const fy = cy + Math.sin(ang) * r;
    const newIdx = verts.length / 2;
    verts.push(fx, fy);
    idx.push(prevIdx, innerCorner, newIdx);
    prevIdx = newIdx;
  }
  idx.push(prevIdx, innerCorner, bOuterStart);
}
```

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/stroke.ts packages/gl/src/stroke.test.ts
git commit -m "feat(weasel-gl): round joins via fan triangulation"
```

---

## Task 7: Square and round caps

**Files:**
- Modify: `packages/gl/src/stroke.ts`
- Modify: `packages/gl/src/stroke.test.ts`

End caps apply only to *open* polylines. `butt` (default) is the no-op we already have. `square` extends the polyline by `half` in the segment direction at each endpoint. `round` is a half-disc fan centered on the endpoint.

- [ ] **Step 1: Write the failing test**

```ts
it('square caps extend an open polyline by half-width at each end', () => {
  const path: PolygonPath = {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L]),
    coords: new Float32Array([0, 0, 10, 0]),
    fillRule: 'nonzero',
  };
  const meshButt = tessellateStroke(path, { paint: { color: '#000' }, width: 4, cap: 'butt' });
  const meshSquare = tessellateStroke(path, { paint: { color: '#000' }, width: 4, cap: 'square' });
  // Square caps add 2 triangles per cap × 2 caps = 4 extra triangles.
  expect(meshSquare.indices.length).toBe(meshButt.indices.length + 4 * 3);
});

it('round caps add fan triangles at each endpoint', () => {
  const path: PolygonPath = {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L]),
    coords: new Float32Array([0, 0, 10, 0]),
    fillRule: 'nonzero',
  };
  const meshButt = tessellateStroke(path, { paint: { color: '#000' }, width: 4, cap: 'butt' });
  const meshRound = tessellateStroke(path, { paint: { color: '#000' }, width: 4, cap: 'round' });
  // Round caps over 180° at ~10°/step → ~18 fan triangles per cap × 2 caps.
  // Allow ≥ 14 each to permit different angular-step choices.
  expect((meshRound.indices.length - meshButt.indices.length) / 3).toBeGreaterThanOrEqual(2 * 14);
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — caps not implemented.

- [ ] **Step 3: Implement square + round caps**

Add a `cap: 'butt' | 'square' | 'round'` parameter to `expandPolyline` and threaded through `tessellateStroke`:

```ts
// At each open polyline's start (segment 0) and end (last segment), emit:
//   - butt:   no-op
//   - square: 2 triangles forming a width × half-width rect extending outward
//   - round:  fan triangulation of a 180° half-disc

function emitStartCap(seg: Seg, cap: Cap, half: number, verts: number[], idx: number[], leftIdx: number, rightIdx: number): void {
  if (cap === 'butt') return;
  const dx = (seg.bx - seg.ax) / seg.len;   // unit direction
  const dy = (seg.by - seg.ay) / seg.len;
  if (cap === 'square') {
    const ax = seg.ax - dx * half, ay = seg.ay - dy * half;
    const lOut = verts.length / 2;
    verts.push(ax + seg.nx, ay + seg.ny);
    const rOut = verts.length / 2;
    verts.push(ax - seg.nx, ay - seg.ny);
    idx.push(leftIdx, lOut, rOut, leftIdx, rOut, rightIdx);
  } else {
    // Round: fan from endpoint center over 180° starting at L (leftIdx) ending at R (rightIdx).
    const cx = seg.ax, cy = seg.ay;
    const startAngle = Math.atan2(seg.ny, seg.nx);   // L direction
    const sweep = -Math.PI;                           // 180° clockwise to R
    const steps = Math.max(1, Math.ceil(Math.abs(sweep) / ROUND_STEP_RAD));
    let prev = leftIdx;
    for (let i = 1; i < steps; i++) {
      const ang = startAngle + (sweep / steps) * i;
      const fx = cx + Math.cos(ang) * half;
      const fy = cy + Math.sin(ang) * half;
      const next = verts.length / 2;
      verts.push(fx, fy);
      // Pivot at the segment endpoint (cx, cy). Add an extra vertex for the pivot if
      // not already present, or fan from the existing leftIdx; simplest: push pivot once
      // outside this loop.
      idx.push(prev, /* pivot index */ /* needs setup */, next);
      prev = next;
    }
    idx.push(prev, /* pivot */, rightIdx);
  }
}

function emitEndCap(seg: Seg, cap: Cap, half: number, verts: number[], idx: number[], leftIdx: number, rightIdx: number): void {
  // Symmetric to emitStartCap but extends in +direction from the segment end.
  // (Implementation analogous; flip dx/dy sign and swap leftIdx/rightIdx orientation.)
}
```

(The pseudocode above leaves the round-cap pivot setup as an exercise; the round join implementation in Task 6 has the canonical pattern. Implementer should add a pivot vertex once before the fan loop and use that index for all triangles in the fan.)

Call `emitStartCap(segs[0], cap, half, verts, idx, /* L0 */ 0, /* R0 */ 1)` and `emitEndCap(segs[lastSegIdx], cap, half, verts, idx, /* L1 */ 2, /* R1 */ 3)` on *open* polylines (skip if `pl.closed`).

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/stroke.ts packages/gl/src/stroke.test.ts
git commit -m "feat(weasel-gl): square and round end caps"
```

---

## Task 8: Dash patterns

**Files:**
- Modify: `packages/gl/src/stroke.ts`
- Modify: `packages/gl/src/stroke.test.ts`

A dash pattern is an array `[on1, off1, on2, off2, …]`. Walk the polyline accumulating arc length; emit ribbon geometry only during "on" portions, breaking the polyline into multiple sub-polylines that get capped per the stroke's `cap`.

The naïve implementation: walk each segment, slicing it into sub-segments at dash boundaries. Each "on" sub-segment becomes its own polyline (open — gets caps).

- [ ] **Step 1: Write the failing test**

```ts
it('produces multiple disjoint sub-ribbons for a dashed straight line', () => {
  const path: PolygonPath = {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L]),
    coords: new Float32Array([0, 0, 100, 0]),
    fillRule: 'nonzero',
  };
  const mesh = tessellateStroke(path, {
    paint: { color: '#000' },
    width: 4,
    dash: [10, 10],
    cap: 'butt',
    join: 'bevel',
  });
  // 100 / 20 = 5 dash periods → 5 "on" sub-segments → 10 triangles → 30 indices.
  expect(mesh.indices.length).toBe(30);
});

it('an empty or omitted dash array produces a continuous ribbon', () => {
  const path: PolygonPath = {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L]),
    coords: new Float32Array([0, 0, 100, 0]),
    fillRule: 'nonzero',
  };
  const meshNoDash = tessellateStroke(path, { paint: { color: '#000' }, width: 4 });
  const meshEmptyDash = tessellateStroke(path, { paint: { color: '#000' }, width: 4, dash: [] });
  expect(meshEmptyDash.indices.length).toBe(meshNoDash.indices.length);
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — dash splitting not implemented.

- [ ] **Step 3: Implement dash splitting**

Before calling `expandPolyline`, run a `splitForDash(pl, dash)` step that returns a `Polyline[]` of the "on" portions. Each output polyline is open (gets caps).

```ts
function splitForDash(pl: Polyline, dash: number[]): Polyline[] {
  if (dash.length === 0) return [pl];
  const out: Polyline[] = [];
  let dashIdx = 0;
  let dashRemaining = dash[0];
  let onPhase = true;
  let current: Polyline | null = null;

  const advance = () => {
    dashIdx = (dashIdx + 1) % dash.length;
    dashRemaining = dash[dashIdx];
    onPhase = !onPhase;
    if (current) {
      out.push(current);
      current = null;
    }
  };

  const pts = pl.points;
  let prevX = pts[0], prevY = pts[1];
  if (onPhase) {
    current = { points: [prevX, prevY], closed: false };
  }

  // Iterate segments, slicing each by dashRemaining.
  for (let i = 1; i < pts.length / 2; i++) {
    const cx = pts[i * 2], cy = pts[i * 2 + 1];
    let segDx = cx - prevX, segDy = cy - prevY;
    let segLen = Math.hypot(segDx, segDy);

    while (segLen > 0) {
      if (segLen <= dashRemaining) {
        if (onPhase && current) current.points.push(cx, cy);
        dashRemaining -= segLen;
        prevX = cx; prevY = cy;
        segLen = 0;
        if (dashRemaining === 0) advance();
      } else {
        const t = dashRemaining / segLen;
        const ix = prevX + segDx * t;
        const iy = prevY + segDy * t;
        if (onPhase && current) current.points.push(ix, iy);
        prevX = ix; prevY = iy;
        segDx = cx - prevX; segDy = cy - prevY;
        segLen = Math.hypot(segDx, segDy);
        advance();
        if (onPhase) current = { points: [prevX, prevY], closed: false };
      }
    }
  }

  if (current && current.points.length >= 4) out.push(current);
  return out;
}
```

In `tessellateStroke`, replace `for (const pl of polylines) expandPolyline(pl, ...)` with:

```ts
const dash = stroke.dash ?? [];
for (const pl of polylines) {
  const subs = dash.length > 0 ? splitForDash(pl, dash) : [pl];
  for (const sub of subs) {
    expandPolyline(sub, width, join, cap, verts, idx);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/stroke.ts packages/gl/src/stroke.test.ts
git commit -m "feat(weasel-gl): dash patterns split into per-on-segment ribbons"
```

---

## Task 9: DrawCommand stroke variant + drawPath dispatch

**Files:**
- Modify: `packages/gl/src/DrawCommand.ts`
- Modify: `packages/gl/src/draw.ts`
- Modify: `packages/gl/src/draw.test.ts`

Extend the `kind: 'path'` DrawCommand variant with `stroke?: Stroke`. After drawing fill (existing), draw stroke. Reuses the existing path-fill shader (strokes are colored triangles).

- [ ] **Step 1: Add failing test**

Append to `packages/gl/src/draw.test.ts`:

```ts
import type { RectPath, Stroke } from '@weasel-js/core';

describe('WeaselRenderer.render — kind: path with stroke', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  it('draws stroke (drawElements) when stroke is set', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const stroke: Stroke = { paint: { color: '#000' }, width: 2 };
    r.render([{ kind: 'path', path, stroke }]);
    const draws = recorder.calls.filter((c) => c.name === 'drawElements');
    expect(draws.length).toBeGreaterThan(0);
  });

  it('draws fill THEN stroke when both are set (stroke after fill)', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    r.render([{ kind: 'path', path, fill: { color: '#f00' }, stroke: { paint: { color: '#000' }, width: 2 } }]);
    const draws = recorder.calls.filter((c) => c.name === 'drawElements');
    expect(draws.length).toBe(2);
  });

  it('skips when neither fill nor stroke is set', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    r.render([{ kind: 'path', path }]);
    const draws = recorder.calls.filter((c) => c.name === 'drawElements');
    expect(draws.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — stroke handling not present.

- [ ] **Step 3: Implement DrawCommand variant + dispatch**

In `DrawCommand.ts`:

```ts
import type { Path, Stroke } from '@weasel-js/core';
// (Stroke is already publicly exported.)

export interface PathDrawCommand {
  kind: 'path';
  path: Path;
  fill?: SolidPaint;
  stroke?: Stroke;
}
```

In `draw.ts`, after the existing fill dispatch in `drawPath`:

```ts
function drawPath(ctx: DrawContext, cmd: PathDrawCommand): void {
  if (!cmd.fill && !cmd.stroke) return;

  // Existing fill rendering (unchanged) when cmd.fill set.
  if (cmd.fill) {
    const mesh = getMesh(cmd.path);
    const handle = ctx.meshCache.handleFor(mesh);
    if (handle.requiresStencil) {
      drawPathStencil(ctx, cmd, handle);
    } else {
      drawPathSolid(ctx, cmd, handle);
    }
  }

  if (cmd.stroke) {
    drawPathStroke(ctx, cmd);
  }
}
```

(Refactor the existing inline fill code into `drawPathSolid` for cleanliness — same call sequence, just extracted.)

Add `drawPathStroke`:

```ts
import { tessellateStroke } from './stroke';
import { parseColor } from './color';

function drawPathStroke(ctx: DrawContext, cmd: PathDrawCommand): void {
  const stroke = cmd.stroke!;
  const mesh = tessellateStroke(cmd.path, stroke);
  if (mesh.indices.length === 0) return;
  const handle = ctx.meshCache.handleFor(mesh);
  const gl = ctx.gl;

  gl.useProgram(ctx.pathFill.handle);
  gl.bindVertexArray(handle.vao);

  const proj = mat3.screenToClip(ctx.widthCss, ctx.heightCss);
  gl.uniformMatrix3fv(ctx.pathFill.uniform('u_proj')!, false, proj);
  gl.uniformMatrix3fv(ctx.pathFill.uniform('u_model')!, false, ctx.state.transform);

  // Stroke paint must be SolidPaint for step 2; gradients/patterns arrive in step 4.
  if (stroke.paint.fill && stroke.paint.fill !== 'solid') {
    throw new Error('weasel-gl step 2: stroke.paint must be solid; gradient/pattern arrives in step 4');
  }
  const paint = stroke.paint as { color: string; opacity?: number };
  const [r, g, b, a] = parseColor(paint.color);
  const opacity = paint.opacity ?? 1;
  gl.uniform4f(ctx.pathFill.uniform('u_color')!, r, g, b, a * opacity);
  gl.uniform1f(ctx.pathFill.uniform('u_alpha')!, ctx.state.alpha);

  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}
```

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS — adds 3 stroke-related tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/DrawCommand.ts packages/gl/src/draw.ts packages/gl/src/draw.test.ts
git commit -m "feat(weasel-gl): kind: 'path' stroke variant; draw fill then stroke"
```

---

## Task 10: StrokeAlign for RectPath

**Files:**
- Modify: `packages/gl/src/stroke.ts`

For `RectPath` with `align: 'inner' | 'outer'`, adjust the rect via `alignedStrokeRect` from `@weasel-js/core` *before* polyline extraction. For arbitrary paths, alignment is deferred to Task 11.

- [ ] **Step 1: Add failing test**

Append to `stroke.test.ts`:

```ts
import { alignedStrokeRect } from '@weasel-js/core';

it('inner alignment on RectPath shifts the polyline inward by half-width', () => {
  const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 100, height: 100 };
  const meshCenter = tessellateStroke(path, { paint: { color: '#000' }, width: 10, align: 'center' });
  const meshInner = tessellateStroke(path, { paint: { color: '#000' }, width: 10, align: 'inner' });
  // Compare bounds of the ribbon: inner alignment should produce vertices entirely within [0..100].
  let minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < meshInner.vertices.length; i += 2) {
    minX = Math.min(minX, meshInner.vertices[i]);
    maxX = Math.max(maxX, meshInner.vertices[i]);
  }
  expect(minX).toBeGreaterThanOrEqual(0);
  expect(maxX).toBeLessThanOrEqual(100);

  // Center alignment extends ±5 outside the rect.
  let minXC = Infinity, maxXC = -Infinity;
  for (let i = 0; i < meshCenter.vertices.length; i += 2) {
    minXC = Math.min(minXC, meshCenter.vertices[i]);
    maxXC = Math.max(maxXC, meshCenter.vertices[i]);
  }
  expect(minXC).toBeLessThan(0);
  expect(maxXC).toBeGreaterThan(100);
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — alignment isn't honored yet.

- [ ] **Step 3: Implement RectPath alignment**

In `stroke.ts`, before `extractPolylines`:

```ts
import { alignedStrokeRect } from '@weasel-js/core';

export function tessellateStroke(path: Path, stroke: Stroke, opts: StrokeOptions = {}): Mesh {
  const width = stroke.width ?? 1;
  if (width <= 0) return EMPTY_MESH;

  // RectPath fast path: shift the rect for inner/outer alignment, then proceed
  // as if center-aligned. Arbitrary paths handle alignment via stencil two-pass
  // (next task).
  let workingPath = path;
  const align = stroke.align ?? 'center';
  if (path.kind === 'rect' && align !== 'center') {
    const aligned = alignedStrokeRect(path, align, width);
    workingPath = { kind: 'rect', x: aligned.x, y: aligned.y, width: aligned.width, height: aligned.height };
  }

  const polylines = extractPolylines(workingPath, opts);
  // … rest unchanged
}
```

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/stroke.ts packages/gl/src/stroke.test.ts
git commit -m "feat(weasel-gl): RectPath inner/outer stroke alignment via alignedStrokeRect"
```

---

## Task 11: StrokeAlign for arbitrary paths via stencil two-pass

**Files:**
- Modify: `packages/gl/src/draw.ts`
- Modify: `packages/gl/src/draw.test.ts`

> ⚠️ **Convention §1 applies here.** Unit tests with the GL recorder will mock stencil ops away — they assert the *call sequence* but not the *context attribute* (`stencil: true` on `getContext`). Step 1 caught a near-identical bug in evenodd: unit-tests green, real-browser produced a solid filled square.
>
> **You must verify this task with a Playwright smoke (Task 13), not just unit tests.** The renderer constructor was updated in step 1 to request `{ stencil: true }`, so the buffer should exist; but if a regression slips in, only the smoke catches it.

For arbitrary `PolygonPath` with `align: 'inner' | 'outer'`, draw with stencil clipping:

1. **Pass 1 — fill stencil:** disable color writes, draw the path's *fill* mesh (NOT stroke ribbon) with `stencilOp(KEEP, KEEP, REPLACE)` and `stencilFunc(ALWAYS, 1, 0xff)`. Result: stencil bit = 1 inside the path's fill region.
2. **Pass 2 — stroke clipped:** enable color writes, set `stencilFunc(EQUAL, 1, 0xff)` for `inner` (draw only where stencil=1, i.e. inside) or `stencilFunc(EQUAL, 0, 0xff)` for `outer` (draw only where stencil=0). Draw the ribbon at center alignment with twice the requested width (so the half that falls in the masked region equals the requested width).
3. **Restore:** clear stencil, disable stencil test.

For `PolygonPath` with center alignment, no stencil — current behavior.

This is the spec's "stencil-based clip" approach. Inner/outer for arbitrary paths is NOT correct for self-intersecting paths in v1; that's deferred (correct handling needs even-odd or nonzero winding inside the stencil mask, which we already have from Step 1's tessellator with `requiresStencil`).

- [ ] **Step 1: Add failing test**

Append to `draw.test.ts`:

```ts
it('uses stencil two-pass when stroking a PolygonPath with align: inner', () => {
  const path: PolygonPath = {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
    coords: new Float32Array([0, 0, 100, 0, 100, 100, 0, 100]),
    fillRule: 'nonzero',
  };
  r.render([{ kind: 'path', path, stroke: { paint: { color: '#000' }, width: 10, align: 'inner' } }]);
  const enableCalls = recorder.calls.filter((c) => c.name === 'enable');
  expect(enableCalls.some((c) => c.args[0] === recorder.gl.STENCIL_TEST)).toBe(true);
  // Stencil mask pass + stencil-clipped paint pass = 2 drawElements at minimum.
  // (The ribbon itself may add more; check that stencil is involved.)
  expect(recorder.calls.find((c) => c.name === 'stencilFunc')).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — alignment-on-PolygonPath uses no stencil yet.

- [ ] **Step 3: Implement stencil-clipped stroke**

In `drawPathStroke`, branch on alignment + path kind:

```ts
function drawPathStroke(ctx: DrawContext, cmd: PathDrawCommand): void {
  const stroke = cmd.stroke!;
  const align = stroke.align ?? 'center';

  // PolygonPath with inner/outer goes through stencil clipping. RectPath
  // already had its alignment baked into the stroke geometry by tessellateStroke.
  if (cmd.path.kind === 'polygon' && align !== 'center') {
    drawPathStrokeStenciled(ctx, cmd, align);
    return;
  }

  drawPathStrokeUnclipped(ctx, cmd);
}

function drawPathStrokeStenciled(ctx: DrawContext, cmd: PathDrawCommand, align: 'inner' | 'outer'): void {
  const stroke = cmd.stroke!;
  const width = (stroke.width ?? 1) * 2;     // double width; stencil keeps half
  const widerStroke: Stroke = { ...stroke, width, align: 'center' };
  const fillMesh = getMesh(cmd.path);
  const fillHandle = ctx.meshCache.handleFor(fillMesh);
  const ribbonMesh = tessellateStroke(cmd.path, widerStroke);
  if (ribbonMesh.indices.length === 0) return;
  const ribbonHandle = ctx.meshCache.handleFor(ribbonMesh);

  const gl = ctx.gl;

  gl.useProgram(ctx.pathFill.handle);
  const proj = mat3.screenToClip(ctx.widthCss, ctx.heightCss);
  gl.uniformMatrix3fv(ctx.pathFill.uniform('u_proj')!, false, proj);
  gl.uniformMatrix3fv(ctx.pathFill.uniform('u_model')!, false, ctx.state.transform);

  // Pass 1: build stencil from path's fill mesh.
  gl.enable(gl.STENCIL_TEST);
  gl.colorMask(false, false, false, false);
  gl.stencilMask(0xff);
  gl.stencilFunc(gl.ALWAYS, 1, 0xff);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
  gl.bindVertexArray(fillHandle.vao);
  gl.drawElements(gl.TRIANGLES, fillHandle.indexCount, gl.UNSIGNED_INT, 0);

  // Pass 2: draw ribbon clipped to inside (inner) or outside (outer).
  gl.colorMask(true, true, true, true);
  gl.stencilFunc(gl.EQUAL, align === 'inner' ? 1 : 0, 0xff);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  const paint = stroke.paint as { color: string; opacity?: number };
  const [r, g, b, a] = parseColor(paint.color);
  const opacity = paint.opacity ?? 1;
  gl.uniform4f(ctx.pathFill.uniform('u_color')!, r, g, b, a * opacity);
  gl.uniform1f(ctx.pathFill.uniform('u_alpha')!, ctx.state.alpha);
  gl.bindVertexArray(ribbonHandle.vao);
  gl.drawElements(gl.TRIANGLES, ribbonHandle.indexCount, gl.UNSIGNED_INT, 0);

  gl.clear(gl.STENCIL_BUFFER_BIT);
  gl.disable(gl.STENCIL_TEST);
  gl.bindVertexArray(null);
}

// drawPathStrokeUnclipped is the existing drawPathStroke renamed.
```

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/draw.ts packages/gl/src/draw.test.ts
git commit -m "feat(weasel-gl): inner/outer stroke alignment via stencil clip on PolygonPath"
```

---

## Task 12: Public barrel exports

**Files:**
- Modify: `packages/gl/src/index.ts`

- [ ] **Step 1: Add stroke exports**

Add to `packages/gl/src/index.ts`:

```ts
export { tessellateStroke, type StrokeOptions } from './stroke';
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/gl/src/index.ts
git commit -m "feat(weasel-gl): export tessellateStroke from public barrel"
```

---

## Task 13: Synthetic scene + smoke spec

**Files:**
- Modify: `packages/gl/dev/synthetic.html`
- Modify: `packages/gl/dev/synthetic.ts`
- Modify: `packages/gl/dev/synthetic.spec.ts`

Add four new canvases covering caps, joins, dashes, alignment.

> ⚠️ **Convention §6 applies here.** Every new canvas in `synthetic.ts` must call `canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true })` and pass the resulting `gl` to `WeaselRenderer`. Without `preserveDrawingBuffer`, the smoke spec's `readPixels` returns zero. Without `stencil: true`, the cAlign canvas's stencil-clipped polygon (Task 11) renders as solid fill, silently masking the bug.
>
> The existing `make()` helper in `synthetic.ts` already does this; just confirm new scenes use it consistently.

- [ ] **Step 1: Update HTML**

Append to `synthetic.html`:

```html
<h2>Caps: butt / square / round</h2>
<canvas id="cCaps" width="800" height="100"></canvas>
<h2>Joins: miter / bevel / round</h2>
<canvas id="cJoins" width="800" height="200"></canvas>
<h2>Dash patterns</h2>
<canvas id="cDash" width="800" height="100"></canvas>
<h2>Stroke align: center / inner / outer (rect; stencil-clipped polygon)</h2>
<canvas id="cAlign" width="800" height="200"></canvas>
```

- [ ] **Step 2: Update synthetic.ts**

Add scene builders for each canvas. Example:

```ts
import type { Stroke } from '@weasel-js/core';

const strokeLine = (x1: number, y1: number, x2: number, y2: number, stroke: Stroke): DrawCommand => ({
  kind: 'path',
  path: {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L]),
    coords: new Float32Array([x1, y1, x2, y2]),
    fillRule: 'nonzero',
  },
  stroke,
});

make('cCaps', 800, 100, [
  strokeLine(40, 50, 240, 50, { paint: { color: '#fff' }, width: 20, cap: 'butt' }),
  strokeLine(280, 50, 480, 50, { paint: { color: '#fff' }, width: 20, cap: 'square' }),
  strokeLine(520, 50, 720, 50, { paint: { color: '#fff' }, width: 20, cap: 'round' }),
]);

// cJoins: 3 right-angle paths side by side, one per join style.
// cDash: 3 horizontal lines with [10,10], [5,15], and [20,5,5,5] dashes.
// cAlign: 100×100 rect stroked center, inner, outer (and a polygon stenciled).
```

(Implementer should fill in the cJoins / cDash / cAlign scenes following the same pattern.)

- [ ] **Step 3: Update synthetic.spec.ts**

Add the new canvas IDs to the test loop:

```ts
const canvasIds = ['c10', 'c100', 'c1000', 'cEvenodd', 'cCaps', 'cJoins', 'cDash', 'cAlign'];
```

- [ ] **Step 4: Run smoke**

Run: `npm run test:smoke:step1`

Expected: 2 specs pass, all 8 canvases paint.

- [ ] **Step 5: Manual eyeball**

Run: `npx vite --config packages/gl/dev/vite.config.ts --port 5173`

Visit: `http://localhost:5173/packages/gl/dev/synthetic.html`

Confirm visually:
- **cCaps:** three white horizontal lines; second has square endcaps extending further than the line itself; third has rounded endcaps.
- **cJoins:** three corners; one with bevel (cut corner), one with miter (sharp point), one with round (curved).
- **cDash:** three lines with visible gaps in the dash pattern.
- **cAlign:** rect strokes — center stroke straddles the rect edge; inner stroke is entirely inside; outer entirely outside. Polygon stencil-clipped.

- [ ] **Step 6: Commit**

```bash
git add packages/gl/dev/synthetic.html packages/gl/dev/synthetic.ts packages/gl/dev/synthetic.spec.ts
git commit -m "test(weasel-gl): synthetic scenes for caps / joins / dash / align"
```

---

## Task 14: Step 2 done note + TODO update

**Files:**
- Create: `docs/superpowers/plans/2026-05-09-webgl-step-2-done.md`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Done note**

Create `docs/superpowers/plans/2026-05-09-webgl-step-2-done.md` with the sections from step-1's done note, filled in for step 2 (what shipped, deviations, lessons for step 3, open follow-ups).

- [ ] **Step 2: Update TODO**

Mark step 2 shipped:

```md
- [x] Step 2 — Strokes shipped (date) — `docs/superpowers/plans/2026-05-09-webgl-step-2-done.md`
- [ ] Step 3 — Text (MSDF) (plan TBW)
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-05-09-webgl-step-2-done.md docs/TODO.md
git commit -m "docs(webgl): step 2 done note + TODO update"
```

---

## Self-review checklist (run before declaring step 2 done)

- [ ] Vitest: all tests pass (existing 1332 + new ~30 stroke tests)
- [ ] Typecheck: clean
- [ ] Smoke + synthetic specs: pass against headless Chromium
- [ ] Manual eyeball: caps / joins / dash / alignments render correctly
- [ ] Step-2 done note filled in
- [ ] TODO.md updated
- [ ] No regressions in step 1's red/green/yellow smoke or evenodd ring

## What this step deliberately does NOT include

- **Stroke caching by (Path, Stroke) tuple** — recomputed per draw. Add caching as an optimization in step 9 (visual-regression rig will reveal whether perf needs it).
- **`miterLimit` field on `Stroke`** — Canvas2D's default of 10 is hard-coded. Adding the field is a `Stroke`-shape change; defer until a real consumer needs it.
- **Self-intersecting path stencil correctness** — the inner/outer stencil mask uses the path's own fill triangulation. For self-intersecting paths with `nonzero`, this is correct (earcut respects winding). For `evenodd` self-intersection, the mask uses the naive fan + already-set `requiresStencil`, which doesn't compose with stroke's stencil pass. Document, defer.
- **Gradient/pattern stroke paints** — solid only. Throws clearly if non-solid passed. Lands in step 4.
- **Per-vertex stroke colors** — lands in step 5 alongside `Path.vertexColors` for fill.
