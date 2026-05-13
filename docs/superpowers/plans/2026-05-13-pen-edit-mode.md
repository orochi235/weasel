# Pen Edit Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users re-enter pen-tool anchor editing on any path obj via double-click, with the path remaining the source of truth and anchors derived on entry.

**Architecture:** Build bottom-up from pure math/anchor helpers (`features/paths/`), through a new path-replacement op, through a small `hitOverride` hook on the tool API (a new kit primitive), through the pen tool's edit-mode branch (new submodule with its own route table), to the overlay rendering. Parametric shapes (rect/polygon/star/ellipse) become "just a path" on first mutation via a dirty-bit-gated trapdoor.

**Tech Stack:** TypeScript, React, Vitest. No new external dependencies.

**Spec:** `docs/superpowers/specs/2026-05-13-pen-edit-mode-design.md`

---

## File Map

**New files:**
- `src/features/paths/cubicMath.ts` — De Casteljau subdivision + fit-through-deletion
- `src/features/paths/cubicMath.test.ts`
- `src/features/paths/anchors.ts` — `pathToAnchors`, `anchorsToPath`
- `src/features/paths/anchors.test.ts`
- `src/core/ops/setPath.ts` — `createSetPathOp` (replaces path + closed + params atomically)
- `src/core/ops/setPath.test.ts`
- `src/tools/builtin/penEdit/hitOverride.ts` — pen tool's screen-space anchor/handle/segment hit-test
- `src/tools/builtin/penEdit/hitOverride.test.ts`
- `src/tools/builtin/penEdit/actions.ts` — action handlers for `anchor`/`handle`/`segment` gestures
- `src/tools/builtin/penEdit/actions.test.ts`
- `src/tools/builtin/penEdit/scratch.ts` — edit-mode scratch init/exit helpers + dirty-bit accounting
- `src/tools/builtin/penEdit/scratch.test.ts`
- `src/tools/builtin/penEdit/overlay.ts` — DrawCommand emission for anchor squares + handle lines
- `src/tools/builtin/penEdit/overlay.test.ts`
- `src/tools/builtin/useUserPenTool.edit.test.tsx` — end-to-end pen-edit integration

**Modified files:**
- `src/tools/types.ts` — add `hitOverride?: …` to `Tool<…>`
- `src/tools/dispatcher.ts` — consult tool's `hitOverride` before built-in node/empty test
- `src/tools/builtin/useUserPenTool.ts` — extend `PenScratch`, wire edit submodule
- `src/features/paths/penPreviewLayer.ts` — call `penEdit/overlay.ts` when in edit mode
- `src/features/paths/index.ts` — export new helpers
- `src/core/ops/index.ts` — export `createSetPathOp`

---

## Task 1: `splitCubicAtT` (De Casteljau)

**Files:**
- Create: `src/features/paths/cubicMath.ts`
- Create: `src/features/paths/cubicMath.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/paths/cubicMath.test.ts
import { describe, expect, it } from 'vitest';
import { splitCubicAtT } from './cubicMath';

describe('splitCubicAtT', () => {
  it('splits a cubic at t=0.5 into two halves that re-evaluate to the original geometry', () => {
    // Original: P0=(0,0) P1=(0,100) P2=(100,100) P3=(100,0)
    const { left, right } = splitCubicAtT(
      { x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 0 },
      0.5,
    );
    // The midpoint of the original cubic at t=0.5:
    //   B(0.5) = 0.125·P0 + 0.375·P1 + 0.375·P2 + 0.125·P3
    //          = (50, 75)
    // Both halves share this point as their meeting endpoint.
    expect(left[3]).toEqual({ x: 50, y: 75 });
    expect(right[0]).toEqual({ x: 50, y: 75 });
    // Endpoints of each half match the original endpoints.
    expect(left[0]).toEqual({ x: 0, y: 0 });
    expect(right[3]).toEqual({ x: 100, y: 0 });
  });

  it('returns the original cubic in the right half when t=0', () => {
    const p0 = { x: 0, y: 0 }, p1 = { x: 10, y: 20 }, p2 = { x: 30, y: 40 }, p3 = { x: 50, y: 0 };
    const { left, right } = splitCubicAtT(p0, p1, p2, p3, 0);
    expect(left).toEqual([p0, p0, p0, p0]);
    expect(right).toEqual([p0, p1, p2, p3]);
  });

  it('returns the original cubic in the left half when t=1', () => {
    const p0 = { x: 0, y: 0 }, p1 = { x: 10, y: 20 }, p2 = { x: 30, y: 40 }, p3 = { x: 50, y: 0 };
    const { left, right } = splitCubicAtT(p0, p1, p2, p3, 1);
    expect(left).toEqual([p0, p1, p2, p3]);
    expect(right).toEqual([p3, p3, p3, p3]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/paths/cubicMath.test.ts`
Expected: FAIL with "Cannot find module './cubicMath'".

- [ ] **Step 3: Implement `splitCubicAtT`**

```typescript
// src/features/paths/cubicMath.ts
export interface Point { x: number; y: number; }

/**
 * De Casteljau subdivision of a cubic Bezier at parameter t ∈ [0, 1].
 * Returns the two halves as cubic control-point tuples. The point at parameter
 * t on the original curve is shared between `left[3]` and `right[0]`.
 */
export function splitCubicAtT(
  p0: Point, p1: Point, p2: Point, p3: Point,
  t: number,
): { left: [Point, Point, Point, Point]; right: [Point, Point, Point, Point] } {
  const lerp = (a: Point, b: Point): Point => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });
  const q0 = lerp(p0, p1);
  const q1 = lerp(p1, p2);
  const q2 = lerp(p2, p3);
  const r0 = lerp(q0, q1);
  const r1 = lerp(q1, q2);
  const s0 = lerp(r0, r1);
  return {
    left: [p0, q0, r0, s0],
    right: [s0, r1, q2, p3],
  };
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/features/paths/cubicMath.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/paths/cubicMath.ts src/features/paths/cubicMath.test.ts
git commit -m "feat(paths): splitCubicAtT De Casteljau subdivision helper"
```

---

## Task 2: `fitCubicThroughDeletion`

**Files:**
- Modify: `src/features/paths/cubicMath.ts`
- Modify: `src/features/paths/cubicMath.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/features/paths/cubicMath.test.ts`:

```typescript
import { fitCubicThroughDeletion } from './cubicMath';

describe('fitCubicThroughDeletion', () => {
  it('produces controls that extend in the direction of the surviving handles', () => {
    // prev anchor at (0,0) with outgoing handle pointing right at (10, 0).
    // next anchor at (100,0) with incoming handle pointing left at (90, 0).
    // Best-fit cubic should have controls roughly co-linear with that direction,
    // forming a smooth segment.
    const { c1, c2 } = fitCubicThroughDeletion(
      { x: 0, y: 0, outHandle: { x: 10, y: 0 } },
      { x: 100, y: 0, inHandle: { x: 90, y: 0 } },
    );
    // c1 should be on the prev side, past prev's outHandle direction.
    expect(c1.x).toBeGreaterThan(10);
    expect(c1.x).toBeLessThan(100);
    // c2 should be on the next side, past next's inHandle direction.
    expect(c2.x).toBeLessThan(90);
    expect(c2.x).toBeGreaterThan(0);
  });

  it('falls back to a 1/3 - 2/3 split when prev has no outHandle', () => {
    // No outHandle on prev → use line from prev to next, place c1 at 1/3.
    const { c1, c2 } = fitCubicThroughDeletion(
      { x: 0, y: 0 },
      { x: 90, y: 0, inHandle: { x: 60, y: 0 } },
    );
    expect(c1).toEqual({ x: 30, y: 0 });
    // c2 stays at next's inHandle.
    expect(c2).toEqual({ x: 60, y: 0 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/paths/cubicMath.test.ts`
Expected: FAIL with "fitCubicThroughDeletion is not a function".

- [ ] **Step 3: Implement `fitCubicThroughDeletion`**

Append to `src/features/paths/cubicMath.ts`:

```typescript
interface AnchorRef {
  x: number; y: number;
  inHandle?: Point;
  outHandle?: Point;
}

/**
 * When an interior anchor is deleted, the two flanking segments fuse into one
 * cubic. We pick controls c1 and c2 that:
 *   - lie along prev's outHandle direction (if present)
 *   - lie along next's inHandle direction (if present)
 *   - are placed at roughly 1/3 and 2/3 of the prev→next distance
 * Fallbacks: missing handles use prev→next as the direction.
 *
 * This is an approximate fit — the new curve will shift slightly from the
 * original two-segment path. Acceptable per spec.
 */
export function fitCubicThroughDeletion(
  prev: AnchorRef,
  next: AnchorRef,
): { c1: Point; c2: Point } {
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const c1 = controlOnSide(prev, prev.outHandle, dx, dy, dist, 1 / 3);
  const c2 = next.inHandle ?? controlOnSide(next, undefined, -dx, -dy, dist, 1 / 3, true);
  return { c1, c2 };
}

function controlOnSide(
  anchor: AnchorRef,
  handle: Point | undefined,
  dirX: number,
  dirY: number,
  dist: number,
  fraction: number,
  flipFromAnchor: boolean = false,
): Point {
  if (handle) return handle;
  // No handle: place control along the prev→next direction at `fraction`.
  const targetDist = dist * fraction;
  const len = Math.hypot(dirX, dirY) || 1;
  const ux = dirX / len, uy = dirY / len;
  const sign = flipFromAnchor ? -1 : 1;
  // For the next side we shift back toward prev (sign flipped) via the
  // negated direction, so the multiplier is still `+targetDist`. The
  // flipFromAnchor flag is unused in the happy path — kept for clarity.
  void sign;
  return { x: anchor.x + ux * targetDist, y: anchor.y + uy * targetDist };
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/features/paths/cubicMath.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/paths/cubicMath.ts src/features/paths/cubicMath.test.ts
git commit -m "feat(paths): fitCubicThroughDeletion for anchor-delete fusion"
```

---

## Task 3: `pathToAnchors`

**Files:**
- Create: `src/features/paths/anchors.ts`
- Create: `src/features/paths/anchors.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/paths/anchors.test.ts
import { describe, expect, it } from 'vitest';
import { pathToAnchors } from './anchors';
import { PathBuilder } from './builder';

describe('pathToAnchors', () => {
  it('extracts a single open subpath of corner anchors from M+L+L', () => {
    const path = new PathBuilder()
      .moveTo(0, 0).lineTo(10, 0).lineTo(10, 10)
      .build();
    const { anchors, closed } = pathToAnchors(path);
    expect(anchors).toEqual([[
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]]);
    expect(closed).toEqual([false]);
  });

  it('marks the subpath closed when it ends with Z', () => {
    const path = new PathBuilder()
      .moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).close()
      .build();
    const { closed } = pathToAnchors(path);
    expect(closed).toEqual([true]);
  });

  it('extracts handles from a cubic segment as outHandle/inHandle on adjacent anchors', () => {
    const path = new PathBuilder()
      .moveTo(0, 0)
      .curveTo(20, 0, 80, 100, 100, 100)
      .build();
    const { anchors } = pathToAnchors(path);
    expect(anchors[0]).toHaveLength(2);
    expect(anchors[0][0]).toEqual({ x: 0, y: 0, outHandle: { x: 20, y: 0 } });
    expect(anchors[0][1]).toEqual({ x: 100, y: 100, inHandle: { x: 80, y: 100 } });
  });

  it('produces multiple subpaths from multiple M commands', () => {
    const path = new PathBuilder()
      .moveTo(0, 0).lineTo(10, 0)
      .moveTo(50, 50).lineTo(60, 50)
      .build();
    const { anchors, closed } = pathToAnchors(path);
    expect(anchors).toHaveLength(2);
    expect(anchors[0]).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    expect(anchors[1]).toEqual([{ x: 50, y: 50 }, { x: 60, y: 50 }]);
    expect(closed).toEqual([false, false]);
  });

  it('returns empty arrays for an empty path', () => {
    const path = new PathBuilder().build();
    expect(pathToAnchors(path)).toEqual({ anchors: [], closed: [] });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/paths/anchors.test.ts`
Expected: FAIL with "Cannot find module './anchors'".

- [ ] **Step 3: Implement `pathToAnchors`**

```typescript
// src/features/paths/anchors.ts
import { PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z, type PolygonPath } from './types';

export interface PenAnchor {
  x: number;
  y: number;
  inHandle?: { x: number; y: number };
  outHandle?: { x: number; y: number };
}

/**
 * Derive a per-subpath anchor model from a PolygonPath. Subpaths split on
 * every `M` command; a subpath is closed iff it ends with `Z`.
 *
 * Cubic-segment control points become the outHandle of the previous anchor
 * and the inHandle of the next anchor. Quadratic segments are upgraded to
 * cubics (each control reused for both adjacent handles) — this loses no
 * geometry. Linear segments produce anchors with no handles.
 */
export function pathToAnchors(
  path: PolygonPath,
): { anchors: PenAnchor[][]; closed: boolean[] } {
  const { commands, coords } = path;
  const anchors: PenAnchor[][] = [];
  const closed: boolean[] = [];
  let current: PenAnchor[] | null = null;
  let ci = 0;

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    switch (cmd) {
      case PATH_M: {
        if (current) { anchors.push(current); closed.push(false); }
        current = [{ x: coords[ci], y: coords[ci + 1] }];
        ci += 2;
        break;
      }
      case PATH_L: {
        if (!current) throw new Error('pathToAnchors: L without prior M');
        current.push({ x: coords[ci], y: coords[ci + 1] });
        ci += 2;
        break;
      }
      case PATH_C: {
        if (!current) throw new Error('pathToAnchors: C without prior M');
        const x1 = coords[ci],     y1 = coords[ci + 1];
        const x2 = coords[ci + 2], y2 = coords[ci + 3];
        const x3 = coords[ci + 4], y3 = coords[ci + 5];
        const prev = current[current.length - 1];
        prev.outHandle = { x: x1, y: y1 };
        current.push({ x: x3, y: y3, inHandle: { x: x2, y: y2 } });
        ci += 6;
        break;
      }
      case PATH_Q: {
        if (!current) throw new Error('pathToAnchors: Q without prior M');
        const x1 = coords[ci],     y1 = coords[ci + 1];
        const x2 = coords[ci + 2], y2 = coords[ci + 3];
        // Quadratic → cubic: handle is the same control point on both sides.
        const prev = current[current.length - 1];
        prev.outHandle = { x: x1, y: y1 };
        current.push({ x: x2, y: y2, inHandle: { x: x1, y: y1 } });
        ci += 4;
        break;
      }
      case PATH_Z: {
        if (current) { anchors.push(current); closed.push(true); current = null; }
        break;
      }
      default:
        throw new Error(`pathToAnchors: unknown command ${cmd}`);
    }
  }
  if (current) { anchors.push(current); closed.push(false); }
  return { anchors, closed };
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/features/paths/anchors.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/paths/anchors.ts src/features/paths/anchors.test.ts
git commit -m "feat(paths): pathToAnchors derives PenAnchor model from PolygonPath"
```

---

## Task 4: `anchorsToPath`

**Files:**
- Modify: `src/features/paths/anchors.ts`
- Modify: `src/features/paths/anchors.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/features/paths/anchors.test.ts`:

```typescript
import { anchorsToPath } from './anchors';

describe('anchorsToPath', () => {
  it('serializes a single open subpath of corner anchors to M+L', () => {
    const path = anchorsToPath(
      [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]],
      [false],
    );
    expect(path.kind).toBe('polygon');
    // M 0 0 L 10 0 L 10 10
    expect(Array.from(path.commands)).toEqual([1, 2, 2]); // PATH_M=1, PATH_L=2
    expect(Array.from(path.coords)).toEqual([0, 0, 10, 0, 10, 10]);
  });

  it('serializes a closed subpath with trailing Z', () => {
    const path = anchorsToPath(
      [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]],
      [true],
    );
    // M 0 0 L 10 0 L 10 10 Z
    expect(Array.from(path.commands)).toEqual([1, 2, 2, 4]); // PATH_Z=4
  });

  it('serializes anchors with handles to C commands', () => {
    const path = anchorsToPath(
      [[
        { x: 0, y: 0, outHandle: { x: 20, y: 0 } },
        { x: 100, y: 100, inHandle: { x: 80, y: 100 } },
      ]],
      [false],
    );
    // M 0 0 C 20 0 80 100 100 100
    expect(Array.from(path.commands)).toEqual([1, 3]); // PATH_C=3
    expect(Array.from(path.coords)).toEqual([0, 0, 20, 0, 80, 100, 100, 100]);
  });

  it('round-trips: anchorsToPath(pathToAnchors(p)) yields equivalent geometry', () => {
    const original = new PathBuilder()
      .moveTo(0, 0)
      .curveTo(20, 0, 80, 100, 100, 100)
      .lineTo(150, 50)
      .build();
    const { anchors, closed } = pathToAnchors(original);
    const rebuilt = anchorsToPath(anchors, closed);
    expect(Array.from(rebuilt.commands)).toEqual(Array.from(original.commands));
    expect(Array.from(rebuilt.coords)).toEqual(Array.from(original.coords));
  });
});
```

(Note: relies on importing `PathBuilder` from `./builder` already in the file from Task 3's tests.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/paths/anchors.test.ts`
Expected: FAIL with "anchorsToPath is not a function".

- [ ] **Step 3: Implement `anchorsToPath`**

Append to `src/features/paths/anchors.ts`:

```typescript
import { PathBuilder } from './builder';

/**
 * Serialize the per-subpath anchor model back to a PolygonPath. Inverse of
 * `pathToAnchors`. Curve-vs-line decision per segment:
 *   - Both adjacent handles absent → straight L segment.
 *   - Either handle present → C segment, with missing handles defaulting to
 *     the anchor point itself (degenerate but valid; renders as a near-line).
 */
export function anchorsToPath(
  anchors: PenAnchor[][],
  closed: boolean[],
): PolygonPath {
  const b = new PathBuilder();
  for (let s = 0; s < anchors.length; s++) {
    const sub = anchors[s];
    if (sub.length === 0) continue;
    b.moveTo(sub[0].x, sub[0].y);
    for (let i = 1; i < sub.length; i++) {
      const prev = sub[i - 1];
      const cur = sub[i];
      const hasHandle = prev.outHandle != null || cur.inHandle != null;
      if (!hasHandle) {
        b.lineTo(cur.x, cur.y);
      } else {
        const c1 = prev.outHandle ?? { x: prev.x, y: prev.y };
        const c2 = cur.inHandle ?? { x: cur.x, y: cur.y };
        b.curveTo(c1.x, c1.y, c2.x, c2.y, cur.x, cur.y);
      }
    }
    if (closed[s]) {
      // Bridge last → first if they have curve handles; either way emit Z.
      const last = sub[sub.length - 1];
      const first = sub[0];
      const hasHandle = last.outHandle != null || first.inHandle != null;
      if (hasHandle) {
        const c1 = last.outHandle ?? { x: last.x, y: last.y };
        const c2 = first.inHandle ?? { x: first.x, y: first.y };
        b.curveTo(c1.x, c1.y, c2.x, c2.y, first.x, first.y);
      }
      b.close();
    }
  }
  return b.build();
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/features/paths/anchors.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Export from `features/paths/index.ts`**

Modify `src/features/paths/index.ts` — add the new exports:

```typescript
export { pathToAnchors, anchorsToPath, type PenAnchor } from './anchors';
export { splitCubicAtT, fitCubicThroughDeletion, type Point } from './cubicMath';
```

- [ ] **Step 6: Verify the build typechecks**

Run: `npx tsc --noEmit 2>&1 | grep -E "anchors|cubicMath" | head`
Expected: empty output (no new errors).

- [ ] **Step 7: Commit**

```bash
git add src/features/paths/anchors.ts src/features/paths/anchors.test.ts src/features/paths/index.ts
git commit -m "feat(paths): anchorsToPath inverse + index exports for pen-edit primitives"
```

---

## Task 5: Smoothness detection helper

**Files:**
- Modify: `src/features/paths/anchors.ts`
- Modify: `src/features/paths/anchors.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```typescript
import { isAnchorSmooth } from './anchors';

describe('isAnchorSmooth', () => {
  it('returns true when in-handle, anchor, and out-handle are collinear', () => {
    // Anchor at (50, 50), in-handle at (40, 40), out-handle at (60, 60).
    // Line is y = x. Cross product magnitude near zero.
    expect(isAnchorSmooth({
      x: 50, y: 50,
      inHandle: { x: 40, y: 40 },
      outHandle: { x: 60, y: 60 },
    })).toBe(true);
  });

  it('returns false when handles deviate from collinear', () => {
    expect(isAnchorSmooth({
      x: 50, y: 50,
      inHandle: { x: 40, y: 50 },  // pointing left
      outHandle: { x: 50, y: 60 }, // pointing down — perpendicular
    })).toBe(false);
  });

  it('returns false when either handle is missing', () => {
    expect(isAnchorSmooth({ x: 50, y: 50, outHandle: { x: 60, y: 50 } })).toBe(false);
    expect(isAnchorSmooth({ x: 50, y: 50, inHandle: { x: 40, y: 50 } })).toBe(false);
    expect(isAnchorSmooth({ x: 50, y: 50 })).toBe(false);
  });

  it('returns false when a handle is at zero distance from the anchor', () => {
    expect(isAnchorSmooth({
      x: 50, y: 50,
      inHandle: { x: 50, y: 50 },        // zero-length
      outHandle: { x: 60, y: 50 },
    })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/paths/anchors.test.ts`
Expected: FAIL with "isAnchorSmooth is not a function".

- [ ] **Step 3: Implement `isAnchorSmooth`**

Append to `src/features/paths/anchors.ts`:

```typescript
const SMOOTH_THRESHOLD = 0.001;

/**
 * Returns true if the anchor's in-handle and out-handle are collinear with
 * the anchor point, indicating "smooth" (mirror-drag) behavior. Detected via
 * the magnitude of the normalized cross product of the two handle vectors.
 *
 * Edge cases:
 *   - Missing in or out handle → false (corner by definition).
 *   - Either handle at zero distance from anchor → false.
 */
export function isAnchorSmooth(a: PenAnchor): boolean {
  if (!a.inHandle || !a.outHandle) return false;
  const inDX = a.inHandle.x - a.x;
  const inDY = a.inHandle.y - a.y;
  const outDX = a.outHandle.x - a.x;
  const outDY = a.outHandle.y - a.y;
  const inLen = Math.hypot(inDX, inDY);
  const outLen = Math.hypot(outDX, outDY);
  if (inLen === 0 || outLen === 0) return false;
  // For collinear handles on opposite sides of the anchor, the cross product
  // of the two handle vectors should be zero. Normalize by both magnitudes.
  const cross = (inDX * outDY - inDY * outDX) / (inLen * outLen);
  return Math.abs(cross) < SMOOTH_THRESHOLD;
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/features/paths/anchors.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Add to index export**

Add to `src/features/paths/index.ts`:

```typescript
export { isAnchorSmooth } from './anchors';
```

- [ ] **Step 6: Commit**

```bash
git add src/features/paths/anchors.ts src/features/paths/anchors.test.ts src/features/paths/index.ts
git commit -m "feat(paths): isAnchorSmooth via normalized cross-product collinearity check"
```

---

## Task 6: `createSetPathOp`

**Files:**
- Create: `src/core/ops/setPath.ts`
- Create: `src/core/ops/setPath.test.ts`
- Modify: `src/core/ops/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/core/ops/setPath.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createSetPathOp } from './setPath';

describe('createSetPathOp', () => {
  it('calls setPath on the adapter with the new fields when applied', () => {
    const setPath = vi.fn();
    const op = createSetPathOp({
      id: 'a',
      from: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, closed: true, params: { sides: 4 } },
      to:   { path: { kind: 'polygon', commands: new Uint8Array([1]), coords: new Float32Array([0, 0]) }, closed: false, params: undefined },
    });
    op.apply({ setPath });
    expect(setPath).toHaveBeenCalledWith('a', {
      path: { kind: 'polygon', commands: new Uint8Array([1]), coords: new Float32Array([0, 0]) },
      closed: false,
      params: undefined,
    });
  });

  it('invert() produces an op that restores `from`', () => {
    const setPath = vi.fn();
    const from = { path: { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 }, closed: true, params: undefined };
    const to   = { path: { kind: 'polygon' as const, commands: new Uint8Array([1]), coords: new Float32Array([0, 0]) }, closed: false, params: undefined };
    const op = createSetPathOp({ id: 'a', from, to });
    const inv = op.invert();
    inv.apply({ setPath });
    expect(setPath).toHaveBeenCalledWith('a', from);
  });

  it('reports no-op when from and to are structurally identical', () => {
    const same = { path: { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 }, closed: true, params: undefined };
    const op = createSetPathOp({ id: 'a', from: same, to: same });
    const setPath = vi.fn();
    expect(op.apply({ setPath })).toBe(false);
    expect(setPath).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/core/ops/setPath.test.ts`
Expected: FAIL with "Cannot find module './setPath'".

- [ ] **Step 3: Implement `createSetPathOp`**

```typescript
// src/core/ops/setPath.ts
import type { Op } from './types';

export interface SetPathFields {
  path: unknown;     // Path | RectPath; left unknown so kit doesn't depend on features/paths/types here
  closed: boolean;
  params: unknown;
}

interface SetPathAdapter {
  setPath(id: string, fields: SetPathFields): void;
}

/**
 * Op: atomically replace a PathObj's geometric fields (path + closed + params).
 * Used for pen-edit anchor mutations and parametric-shape trapdoor conversions.
 * Reports no-op when `from` and `to` are structurally equal (same path bytes,
 * closed, params), letting history skip the entry.
 */
export function createSetPathOp(args: {
  id: string;
  from: SetPathFields;
  to: SetPathFields;
  label?: string;
  coalesceKey?: string;
}): Op {
  const { id, from, to, label, coalesceKey } = args;
  return {
    label,
    coalesceKey,
    apply(adapter) {
      if (fieldsEqual(from, to)) return false;
      (adapter as SetPathAdapter).setPath(id, to);
      return undefined;
    },
    invert() {
      return createSetPathOp({ id, from: to, to: from, label, coalesceKey });
    },
  };
}

function fieldsEqual(a: SetPathFields, b: SetPathFields): boolean {
  if (a === b) return true;
  if (a.closed !== b.closed) return false;
  if (!shallowEqual(a.params, b.params)) return false;
  return pathEqual(a.path, b.path);
}

function pathEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ao = a as { kind?: string };
  const bo = b as { kind?: string };
  if (ao.kind !== bo.kind) return false;
  if (ao.kind === 'rect') return shallowEqual(a, b);
  // polygon: compare commands + coords arrays
  const aa = a as { commands: ArrayLike<number>; coords: ArrayLike<number> };
  const bb = b as { commands: ArrayLike<number>; coords: ArrayLike<number> };
  if (aa.commands.length !== bb.commands.length) return false;
  if (aa.coords.length !== bb.coords.length) return false;
  for (let i = 0; i < aa.commands.length; i++) if (aa.commands[i] !== bb.commands[i]) return false;
  for (let i = 0; i < aa.coords.length; i++) if (aa.coords[i] !== bb.coords[i]) return false;
  return true;
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if ((a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]) return false;
  }
  return true;
}
```

- [ ] **Step 4: Export from ops/index.ts**

Add to `src/core/ops/index.ts`:

```typescript
export { createSetPathOp, type SetPathFields } from './setPath';
```

- [ ] **Step 5: Run the tests, verify they pass**

Run: `npx vitest run src/core/ops/setPath.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/core/ops/setPath.ts src/core/ops/setPath.test.ts src/core/ops/index.ts
git commit -m "feat(ops): createSetPathOp for atomic path/closed/params replacement"
```

---

## Task 7: `hitOverride` hook on the tool API + dispatcher consultation

**Files:**
- Modify: `src/tools/types.ts`
- Modify: `src/tools/dispatcher.ts`
- Modify: `src/tools/dispatcher.test.ts` (or create a focused test if dispatcher test surface is awkward)

- [ ] **Step 1: Read the current `Tool` interface in `src/tools/types.ts`**

Look at the existing `Tool<TScratch, …>` interface. Locate where action handlers and routes are defined. The new `hitOverride` hook is an optional method.

- [ ] **Step 2: Write the failing test**

Create `src/tools/dispatcher.hitOverride.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createToolsDispatcher } from './dispatcher';
// (Import paths and shapes will mirror existing dispatcher tests; see
// src/tools/dispatcher.test.ts for the established setup pattern.)

describe('dispatcher: tool-provided hitOverride', () => {
  it('uses the tool-provided hit when hitOverride returns non-null', () => {
    const hitOverride = vi.fn(() => ({ target: 'anchor' as const, extra: { sub: 0, idx: 2 } }));
    // ...build a dispatcher with a single tool that has hitOverride set,
    //    and a route table row for { target: 'anchor', gesture: 'down' } that
    //    asserts ctx.target.category === 'tool' and ctx.target.kind === 'anchor'
    //    and ctx.target.extra deep-equals { sub: 0, idx: 2 }.
    // ...invoke a pointer down event on the dispatcher.
    // ...expect hitOverride was called and the route fired.
  });

  it('falls through to built-in node/empty when hitOverride returns null', () => {
    const hitOverride = vi.fn(() => null);
    // ...build a dispatcher with the tool's hitOverride returning null.
    // ...also wire a getNodeAtPoint that returns null (empty).
    // ...expect that the empty route fires (not the anchor route).
  });
});
```

(Mirror the existing dispatcher test setup — `getNodeAtPoint`, slots, tools — from `src/tools/dispatcher.test.ts`. Don't reinvent it.)

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/tools/dispatcher.hitOverride.test.ts`
Expected: FAIL — hitOverride property doesn't exist on `Tool`, dispatcher doesn't consult it.

- [ ] **Step 4: Add the hook to `Tool` in `src/tools/types.ts`**

Find the `Tool<TScratch, …>` interface. Add this field:

```typescript
/**
 * Optional. When set, the dispatcher consults this before its built-in
 * node/empty hit-test. If it returns a value, that target replaces the
 * default `target` on the routed action's ctx. The string `target` is
 * the tool's own vocabulary — the dispatcher does not interpret it.
 *
 * Used for tools that need richer sub-object hit categories (e.g., pen
 * edit-mode's anchor/handle/segment vs the default node/empty).
 */
hitOverride?(ctx: {
  worldX: number;
  worldY: number;
  scratch: TScratch;
  view: View;
  modifiers: Modifiers;
}): { target: string; extra?: unknown } | null;
```

(`View`, `Modifiers` types should already be in scope where `Tool<…>` is defined; mirror their existing import.)

- [ ] **Step 5: Extend `HitResult` to support tool-provided targets**

In `src/tools/routing/hitResult.ts`, add a new variant:

```typescript
/** Hit on a tool-defined target (anchor, handle, segment, etc.) supplied
 *  via the tool's `hitOverride`. The `kind` string is the tool's own
 *  vocabulary; the dispatcher does not interpret it. */
export interface ToolHit {
  category: 'tool';
  kind: string;
  extra?: unknown;
}

export type HitResult = EmptyHit | NodeHit | AffordanceHit | ToolHit;
```

- [ ] **Step 6: Consult `hitOverride` in the dispatcher**

In `src/tools/dispatcher.ts`, find each call site of `nodeHitFor(rawCtx.worldX, rawCtx.worldY, opts.getNodeAtPoint)` (there are several — around lines 318, 417, 462 per the earlier grep). Wrap each with a precedence helper:

```typescript
function targetFor(
  rawCtx: { worldX: number; worldY: number; view: View; modifiers: Modifiers },
  tool: AnyTool | undefined,
  scratch: unknown,
  getNodeAtPoint: ToolsDispatcherOptions['getNodeAtPoint'],
): HitResult {
  if (tool?.hitOverride) {
    const override = tool.hitOverride({
      worldX: rawCtx.worldX,
      worldY: rawCtx.worldY,
      scratch,
      view: rawCtx.view,
      modifiers: rawCtx.modifiers,
    });
    if (override) {
      return { category: 'tool', kind: override.target, extra: override.extra };
    }
  }
  return nodeHitFor(rawCtx.worldX, rawCtx.worldY, getNodeAtPoint);
}
```

Replace the existing `nodeHitFor(...)` call-sites with `targetFor(...)`, passing the currently-active tool and its scratch. (The dispatcher already tracks active tool + scratch in slots; thread them through.)

- [ ] **Step 7: Run the tests, verify they pass**

Run: `npx vitest run src/tools/dispatcher.hitOverride.test.ts`
Expected: PASS.

Run the full dispatcher test suite to verify nothing regressed:
`npx vitest run src/tools/dispatcher`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add src/tools/types.ts src/tools/routing/hitResult.ts src/tools/dispatcher.ts src/tools/dispatcher.hitOverride.test.ts
git commit -m "feat(tools): hitOverride hook for tool-provided hit-test vocabularies"
```

---

## Task 8: Extend `PenScratch` with `mode` + `edit` branch

**Files:**
- Modify: `src/tools/builtin/useUserPenTool.ts`

- [ ] **Step 1: Read the existing `PenScratch` interface**

Locate `interface PenScratch` near the top of `src/tools/builtin/useUserPenTool.ts`. Note the existing fields.

- [ ] **Step 2: Extend the interface**

Replace the existing `PenScratch` with:

```typescript
export interface PenSubpath {
  anchors: PenAnchor[];
  closed: boolean;
}

export interface PenEditState {
  objId: string;
  /** Per-subpath anchor arrays. Mutated during edit. */
  anchors: PenAnchor[][];
  /** Per-subpath closed flag. */
  closed: boolean[];
  /** "subpathIdx:anchorIdx" keys for selected anchors. */
  selectedAnchors: Set<string>;
  /** Currently-dragged handle, if any. */
  activeHandle: { sub: number; anchor: number; side: 'in' | 'out' } | null;
  /** True after any mutation; gates the trapdoor's first-mutation commit. */
  dirty: boolean;
  /** Snapshot of pre-conversion state for parametric-shape trapdoor.
   *  null when the source obj is already a plain path. */
  preConvert: { path: unknown; closed: boolean; params: unknown } | null;
}

export interface PenScratch {
  mode: 'create' | 'edit';

  // create-mode fields (existing):
  finishedSubpaths: PenSubpath[];
  current: PenSubpath | null;
  cursor: { x: number; y: number } | null;
  draggingHandleAt: number | null;
  closeHintActive: boolean;
  _pendingDown: { worldX: number; worldY: number; alt: boolean; shift: boolean } | null;
  _lastClick: { t: number; x: number; y: number } | null;

  // edit-mode fields (new):
  edit: PenEditState | null;
}
```

Also import `PenAnchor` from `features/paths`:

```typescript
import type { PenAnchor } from 'features/paths';
```

(Remove the local `PenAnchor` re-declaration if present — use the kit's.)

- [ ] **Step 3: Update `freshScratch` to initialize the new fields**

Find the existing `freshScratch` function. Update it:

```typescript
function freshScratch(): PenScratch {
  return {
    mode: 'create',
    finishedSubpaths: [],
    current: null,
    cursor: null,
    draggingHandleAt: null,
    closeHintActive: false,
    _pendingDown: null,
    _lastClick: null,
    edit: null,
  };
}
```

- [ ] **Step 4: Verify the pen tool still typechecks**

Run: `npx tsc --noEmit 2>&1 | grep useUserPenTool | head`
Expected: empty (no new errors). Pre-existing errors from the broader codebase are fine.

- [ ] **Step 5: Run existing pen tests to verify nothing regressed**

Run: `npx vitest run src/tools/builtin/useUserPenTool.test`
Expected: all green. Create-mode behavior is unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/tools/builtin/useUserPenTool.ts
git commit -m "refactor(pen): extend PenScratch with mode + edit branch (no behavior change)"
```

---

## Task 9: Pen tool's `hitOverride` — anchor and handle hit-testing

**Files:**
- Create: `src/tools/builtin/penEdit/hitOverride.ts`
- Create: `src/tools/builtin/penEdit/hitOverride.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/tools/builtin/penEdit/hitOverride.test.ts
import { describe, expect, it } from 'vitest';
import { penEditHitOverride } from './hitOverride';
import type { PenScratch } from '../useUserPenTool';

const view = { x: 0, y: 0, scale: 1 } as const;

function editingScratch(anchors: { x: number; y: number; outHandle?: { x: number; y: number }; inHandle?: { x: number; y: number } }[][]): PenScratch {
  return {
    mode: 'edit',
    finishedSubpaths: [],
    current: null,
    cursor: null,
    draggingHandleAt: null,
    closeHintActive: false,
    _pendingDown: null,
    _lastClick: null,
    edit: {
      objId: 'a',
      anchors,
      closed: anchors.map(() => false),
      selectedAnchors: new Set(),
      activeHandle: null,
      dirty: false,
      preConvert: null,
    },
  };
}

describe('penEditHitOverride', () => {
  it('returns null when not in edit mode', () => {
    const scratch: PenScratch = {
      mode: 'create', finishedSubpaths: [], current: null, cursor: null,
      draggingHandleAt: null, closeHintActive: false, _pendingDown: null,
      _lastClick: null, edit: null,
    };
    const r = penEditHitOverride({
      worldX: 0, worldY: 0, scratch, view, modifiers: {} as never,
    });
    expect(r).toBeNull();
  });

  it('returns anchor hit when pointer is within hit radius of an anchor', () => {
    const scratch = editingScratch([[{ x: 50, y: 50 }]]);
    const r = penEditHitOverride({
      worldX: 52, worldY: 51, scratch, view, modifiers: {} as never,
    });
    expect(r).toEqual({ target: 'anchor', extra: { sub: 0, idx: 0 } });
  });

  it('returns null when pointer is far from any anchor', () => {
    const scratch = editingScratch([[{ x: 50, y: 50 }]]);
    const r = penEditHitOverride({
      worldX: 500, worldY: 500, scratch, view, modifiers: {} as never,
    });
    expect(r).toBeNull();
  });

  it('prefers anchor over handle when both are in range', () => {
    // Anchor at (50, 50) is selected → its outHandle at (52, 52) is visible.
    // Pointer at (51, 51) is inside both hit radii; anchor wins.
    const scratch = editingScratch([[{ x: 50, y: 50, outHandle: { x: 52, y: 52 } }]]);
    scratch.edit!.selectedAnchors.add('0:0');
    const r = penEditHitOverride({
      worldX: 51, worldY: 51, scratch, view, modifiers: {} as never,
    });
    expect(r).toEqual({ target: 'anchor', extra: { sub: 0, idx: 0 } });
  });

  it('returns handle hit when pointer is near a handle of a selected anchor', () => {
    const scratch = editingScratch([[{ x: 50, y: 50, outHandle: { x: 80, y: 50 } }]]);
    scratch.edit!.selectedAnchors.add('0:0');
    const r = penEditHitOverride({
      worldX: 79, worldY: 50, scratch, view, modifiers: {} as never,
    });
    expect(r).toEqual({ target: 'handle', extra: { sub: 0, idx: 0, side: 'out' } });
  });

  it('does not hit unselected anchors handles', () => {
    // Handle exists but anchor is not selected — handles are only interactive for selected anchors.
    const scratch = editingScratch([[{ x: 50, y: 50, outHandle: { x: 80, y: 50 } }]]);
    const r = penEditHitOverride({
      worldX: 79, worldY: 50, scratch, view, modifiers: {} as never,
    });
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tools/builtin/penEdit/hitOverride.test.ts`
Expected: FAIL with "Cannot find module './hitOverride'".

- [ ] **Step 3: Implement `penEditHitOverride`**

```typescript
// src/tools/builtin/penEdit/hitOverride.ts
import type { PenScratch } from '../useUserPenTool';
import type { View } from 'core/viewport/view';

const ANCHOR_HIT_RADIUS_PX = 10;
const HANDLE_HIT_RADIUS_PX = 8;

export interface PenEditHitOverrideCtx {
  worldX: number;
  worldY: number;
  scratch: PenScratch;
  view: View;
  modifiers: unknown;
}

/**
 * Pen tool's hit-test override. Active only in edit mode.
 * Tests anchors first (all visible), then handles (only of selected anchors —
 * handles aren't drawn for unselected anchors, so they shouldn't hit either).
 */
export function penEditHitOverride(
  ctx: PenEditHitOverrideCtx,
): { target: string; extra?: unknown } | null {
  const { scratch, worldX, worldY, view } = ctx;
  if (scratch.mode !== 'edit' || !scratch.edit) return null;

  const anchorR = ANCHOR_HIT_RADIUS_PX / view.scale;
  const handleR = HANDLE_HIT_RADIUS_PX / view.scale;
  const anchorR2 = anchorR * anchorR;
  const handleR2 = handleR * handleR;

  // Anchor hits (any anchor, selected or not).
  for (let s = 0; s < scratch.edit.anchors.length; s++) {
    const sub = scratch.edit.anchors[s];
    for (let i = 0; i < sub.length; i++) {
      const a = sub[i];
      const dx = a.x - worldX, dy = a.y - worldY;
      if (dx * dx + dy * dy <= anchorR2) {
        return { target: 'anchor', extra: { sub: s, idx: i } };
      }
    }
  }

  // Handle hits (only for selected anchors).
  for (const key of scratch.edit.selectedAnchors) {
    const [s, i] = key.split(':').map(Number);
    const a = scratch.edit.anchors[s]?.[i];
    if (!a) continue;
    if (a.inHandle) {
      const dx = a.inHandle.x - worldX, dy = a.inHandle.y - worldY;
      if (dx * dx + dy * dy <= handleR2) {
        return { target: 'handle', extra: { sub: s, idx: i, side: 'in' } };
      }
    }
    if (a.outHandle) {
      const dx = a.outHandle.x - worldX, dy = a.outHandle.y - worldY;
      if (dx * dx + dy * dy <= handleR2) {
        return { target: 'handle', extra: { sub: s, idx: i, side: 'out' } };
      }
    }
  }

  return null;
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/tools/builtin/penEdit/hitOverride.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/penEdit/hitOverride.ts src/tools/builtin/penEdit/hitOverride.test.ts
git commit -m "feat(penEdit): hitOverride for anchor + handle screen-space picks"
```

---

## Task 10: Segment hit-testing (curve distance)

**Files:**
- Modify: `src/tools/builtin/penEdit/hitOverride.ts`
- Modify: `src/tools/builtin/penEdit/hitOverride.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/tools/builtin/penEdit/hitOverride.test.ts`:

```typescript
describe('penEditHitOverride: segments', () => {
  it('returns segment hit when pointer is near a straight segment', () => {
    // Two anchors, no handles → straight line.
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 100, y: 0 }]]);
    const r = penEditHitOverride({
      worldX: 50, worldY: 1, scratch, view, modifiers: {} as never,
    });
    expect(r).toEqual({ target: 'segment', extra: { sub: 0, segIdx: 0, t: expect.any(Number) } });
  });

  it('returns segment hit when pointer is near a cubic segment', () => {
    const scratch = editingScratch([[
      { x: 0, y: 0, outHandle: { x: 33, y: 100 } },
      { x: 100, y: 0, inHandle: { x: 66, y: 100 } },
    ]]);
    // Midpoint of this curve is at (50, 75). Pointer just above midpoint.
    const r = penEditHitOverride({
      worldX: 50, worldY: 73, scratch, view, modifiers: {} as never,
    });
    expect(r?.target).toBe('segment');
  });

  it('does not hit when pointer is far from the segment', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 100, y: 0 }]]);
    const r = penEditHitOverride({
      worldX: 50, worldY: 50, scratch, view, modifiers: {} as never,
    });
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tools/builtin/penEdit/hitOverride.test.ts`
Expected: FAIL — segments aren't tested yet.

- [ ] **Step 3: Add segment hit-test to `penEditHitOverride`**

Append to `penEditHitOverride`, after the handle-hits loop and before `return null`:

```typescript
const SEGMENT_HIT_RADIUS_PX = 4;
const segmentR = SEGMENT_HIT_RADIUS_PX / view.scale;

// Segment hits — sample each segment at 12 evenly-spaced t and pick the
// closest. Cheap; the tessellation samples used for rendering are similar
// granularity and the kit's segment-pick UX has been fine with that.
const SAMPLES = 12;
for (let s = 0; s < scratch.edit.anchors.length; s++) {
  const sub = scratch.edit.anchors[s];
  for (let i = 0; i + 1 < sub.length; i++) {
    const a = sub[i], b = sub[i + 1];
    const p0 = a, p1 = a.outHandle ?? a, p2 = b.inHandle ?? b, p3 = b;
    let bestD2 = Infinity, bestT = 0;
    for (let k = 1; k < SAMPLES; k++) {
      const t = k / SAMPLES;
      const u = 1 - t;
      const px = u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x;
      const py = u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y;
      const dx = px - worldX, dy = py - worldY;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; bestT = t; }
    }
    if (bestD2 <= segmentR * segmentR) {
      return { target: 'segment', extra: { sub: s, segIdx: i, t: bestT } };
    }
  }
}
```

(Move the `SEGMENT_HIT_RADIUS_PX`/`segmentR` declaration to the top of the function with the others; the body is appended in-place.)

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/tools/builtin/penEdit/hitOverride.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/penEdit/hitOverride.ts src/tools/builtin/penEdit/hitOverride.test.ts
git commit -m "feat(penEdit): segment hit-test via 12-sample cubic distance"
```

---

## Task 11: Edit-mode scratch helpers — `enterEditMode`, `exitEditMode`

**Files:**
- Create: `src/tools/builtin/penEdit/scratch.ts`
- Create: `src/tools/builtin/penEdit/scratch.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/tools/builtin/penEdit/scratch.test.ts
import { describe, expect, it } from 'vitest';
import { enterEditMode, exitEditMode } from './scratch';
import { PathBuilder } from 'features/paths/builder';
import type { PenScratch } from '../useUserPenTool';

function freshScratch(): PenScratch {
  return {
    mode: 'create',
    finishedSubpaths: [], current: null, cursor: null,
    draggingHandleAt: null, closeHintActive: false,
    _pendingDown: null, _lastClick: null, edit: null,
  };
}

describe('enterEditMode', () => {
  it('flips mode to edit and derives anchors from the obj path', () => {
    const scratch = freshScratch();
    const path = new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).build();
    enterEditMode(scratch, {
      objId: 'a',
      path,
      closed: false,
      params: undefined,
      isParametric: false,
    });
    expect(scratch.mode).toBe('edit');
    expect(scratch.edit?.objId).toBe('a');
    expect(scratch.edit?.anchors).toEqual([[
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 },
    ]]);
    expect(scratch.edit?.preConvert).toBeNull(); // not parametric
  });

  it('snapshots preConvert when obj is parametric', () => {
    const scratch = freshScratch();
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    enterEditMode(scratch, {
      objId: 'a',
      path,
      closed: true,
      params: { sides: 4 } as never,
      isParametric: true,
    });
    expect(scratch.edit?.preConvert).toEqual({
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      closed: true,
      params: { sides: 4 },
    });
  });

  it('starts dirty=false and with empty selection', () => {
    const scratch = freshScratch();
    const path = new PathBuilder().moveTo(0, 0).lineTo(10, 0).build();
    enterEditMode(scratch, { objId: 'a', path, closed: false, params: undefined, isParametric: false });
    expect(scratch.edit?.dirty).toBe(false);
    expect(scratch.edit?.selectedAnchors.size).toBe(0);
  });
});

describe('exitEditMode', () => {
  it('clears edit branch and flips mode back to create', () => {
    const scratch = freshScratch();
    const path = new PathBuilder().moveTo(0, 0).lineTo(10, 0).build();
    enterEditMode(scratch, { objId: 'a', path, closed: false, params: undefined, isParametric: false });
    exitEditMode(scratch);
    expect(scratch.mode).toBe('create');
    expect(scratch.edit).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tools/builtin/penEdit/scratch.test.ts`
Expected: FAIL with "Cannot find module './scratch'".

- [ ] **Step 3: Implement `enterEditMode` and `exitEditMode`**

```typescript
// src/tools/builtin/penEdit/scratch.ts
import { pathToAnchors } from 'features/paths';
import type { PolygonPath, RectPath } from 'features/paths/types';
import type { PenScratch } from '../useUserPenTool';

export interface EnterEditArgs {
  objId: string;
  path: PolygonPath | RectPath;
  closed: boolean;
  params: unknown;
  isParametric: boolean;
}

export function enterEditMode(scratch: PenScratch, args: EnterEditArgs): void {
  // If the source is a RectPath, convert it to a 4-anchor closed polygon for
  // editing. The original RectPath is held in preConvert and restored on undo.
  const derived = args.path.kind === 'rect'
    ? rectToAnchors(args.path)
    : pathToAnchors(args.path);
  scratch.mode = 'edit';
  scratch.edit = {
    objId: args.objId,
    anchors: derived.anchors,
    closed: derived.closed.length > 0 ? derived.closed : [args.closed],
    selectedAnchors: new Set(),
    activeHandle: null,
    dirty: false,
    preConvert: args.isParametric
      ? { path: args.path, closed: args.closed, params: args.params }
      : null,
  };
}

export function exitEditMode(scratch: PenScratch): void {
  scratch.mode = 'create';
  scratch.edit = null;
}

function rectToAnchors(rect: RectPath): { anchors: { x: number; y: number }[][]; closed: boolean[] } {
  return {
    anchors: [[
      { x: rect.x,                y: rect.y },
      { x: rect.x + rect.width,   y: rect.y },
      { x: rect.x + rect.width,   y: rect.y + rect.height },
      { x: rect.x,                y: rect.y + rect.height },
    ]],
    closed: [true],
  };
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/tools/builtin/penEdit/scratch.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/penEdit/scratch.ts src/tools/builtin/penEdit/scratch.test.ts
git commit -m "feat(penEdit): enterEditMode/exitEditMode + rect→anchors trapdoor seed"
```

---

## Task 12: Anchor-drag action (with op emission)

**Files:**
- Create: `src/tools/builtin/penEdit/actions.ts`
- Create: `src/tools/builtin/penEdit/actions.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/tools/builtin/penEdit/actions.test.ts
import { describe, expect, it, vi } from 'vitest';
import { dragAnchor } from './actions';
import type { PenScratch } from '../useUserPenTool';

function editingScratch(anchors: { x: number; y: number; inHandle?: { x: number; y: number }; outHandle?: { x: number; y: number } }[][], preConvert: PenScratch['edit'] extends infer T ? T extends null ? never : T['preConvert'] : never = null as never): PenScratch {
  return {
    mode: 'edit',
    finishedSubpaths: [], current: null, cursor: null,
    draggingHandleAt: null, closeHintActive: false,
    _pendingDown: null, _lastClick: null,
    edit: {
      objId: 'a',
      anchors,
      closed: anchors.map(() => false),
      selectedAnchors: new Set(),
      activeHandle: null,
      dirty: false,
      preConvert,
    },
  };
}

describe('dragAnchor', () => {
  it('moves the targeted anchor and translates its handles by the same delta', () => {
    const scratch = editingScratch([[
      { x: 10, y: 10, inHandle: { x: 5, y: 10 }, outHandle: { x: 15, y: 10 } },
    ]]);
    dragAnchor(scratch, { sub: 0, idx: 0, dx: 20, dy: 5 });
    expect(scratch.edit!.anchors[0][0]).toEqual({
      x: 30, y: 15,
      inHandle: { x: 25, y: 15 },
      outHandle: { x: 35, y: 15 },
    });
  });

  it('sets dirty=true', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }]]);
    dragAnchor(scratch, { sub: 0, idx: 0, dx: 1, dy: 0 });
    expect(scratch.edit!.dirty).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tools/builtin/penEdit/actions.test.ts`
Expected: FAIL with "Cannot find module './actions'".

- [ ] **Step 3: Implement `dragAnchor`**

```typescript
// src/tools/builtin/penEdit/actions.ts
import type { PenScratch } from '../useUserPenTool';

/** In-place translate an anchor and both its handles by (dx, dy). Sets dirty. */
export function dragAnchor(
  scratch: PenScratch,
  args: { sub: number; idx: number; dx: number; dy: number },
): void {
  if (!scratch.edit) return;
  const a = scratch.edit.anchors[args.sub]?.[args.idx];
  if (!a) return;
  a.x += args.dx;
  a.y += args.dy;
  if (a.inHandle) {
    a.inHandle.x += args.dx;
    a.inHandle.y += args.dy;
  }
  if (a.outHandle) {
    a.outHandle.x += args.dx;
    a.outHandle.y += args.dy;
  }
  scratch.edit.dirty = true;
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/tools/builtin/penEdit/actions.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/penEdit/actions.ts src/tools/builtin/penEdit/actions.test.ts
git commit -m "feat(penEdit): dragAnchor scratch-level mutation"
```

---

## Task 13: Handle-drag action (with smooth-mirror + alt-break)

**Files:**
- Modify: `src/tools/builtin/penEdit/actions.ts`
- Modify: `src/tools/builtin/penEdit/actions.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```typescript
import { dragHandle } from './actions';

describe('dragHandle', () => {
  it('moves only the targeted handle in corner mode (alt or non-smooth)', () => {
    const scratch = editingScratch([[
      { x: 50, y: 50, inHandle: { x: 40, y: 50 }, outHandle: { x: 60, y: 50 } },
    ]]);
    dragHandle(scratch, { sub: 0, idx: 0, side: 'out', toX: 70, toY: 55, breakSmoothness: true });
    const a = scratch.edit!.anchors[0][0];
    expect(a.outHandle).toEqual({ x: 70, y: 55 });
    expect(a.inHandle).toEqual({ x: 40, y: 50 }); // unchanged
  });

  it('mirrors the opposite handle in smooth mode', () => {
    // Smooth anchor: in (40,50), out (60,50) — collinear through (50,50).
    const scratch = editingScratch([[
      { x: 50, y: 50, inHandle: { x: 40, y: 50 }, outHandle: { x: 60, y: 50 } },
    ]]);
    dragHandle(scratch, { sub: 0, idx: 0, side: 'out', toX: 70, toY: 60, breakSmoothness: false });
    const a = scratch.edit!.anchors[0][0];
    expect(a.outHandle).toEqual({ x: 70, y: 60 });
    // inHandle is the mirror of outHandle through anchor:
    //   anchor - (handle - anchor) = 2*anchor - handle
    expect(a.inHandle).toEqual({ x: 2*50 - 70, y: 2*50 - 60 }); // (30, 40)
  });

  it('does not mirror when the opposite handle does not exist', () => {
    const scratch = editingScratch([[
      { x: 50, y: 50, outHandle: { x: 60, y: 50 } }, // no inHandle
    ]]);
    dragHandle(scratch, { sub: 0, idx: 0, side: 'out', toX: 70, toY: 60, breakSmoothness: false });
    expect(scratch.edit!.anchors[0][0].inHandle).toBeUndefined();
  });

  it('sets dirty=true', () => {
    const scratch = editingScratch([[{ x: 0, y: 0, outHandle: { x: 10, y: 0 } }]]);
    dragHandle(scratch, { sub: 0, idx: 0, side: 'out', toX: 20, toY: 0, breakSmoothness: false });
    expect(scratch.edit!.dirty).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tools/builtin/penEdit/actions.test.ts`
Expected: FAIL with "dragHandle is not a function".

- [ ] **Step 3: Implement `dragHandle`**

Append to `src/tools/builtin/penEdit/actions.ts`:

```typescript
import { isAnchorSmooth } from 'features/paths';

/**
 * Move a single handle to an absolute position. When the anchor is smooth
 * and breakSmoothness is false, mirror the opposite handle through the anchor
 * to maintain collinearity.
 */
export function dragHandle(
  scratch: PenScratch,
  args: {
    sub: number; idx: number;
    side: 'in' | 'out';
    toX: number; toY: number;
    breakSmoothness: boolean;
  },
): void {
  if (!scratch.edit) return;
  const a = scratch.edit.anchors[args.sub]?.[args.idx];
  if (!a) return;
  const wasSmooth = isAnchorSmooth(a);
  const target = { x: args.toX, y: args.toY };
  if (args.side === 'out') a.outHandle = target;
  else a.inHandle = target;
  const oppositeSide = args.side === 'out' ? 'in' : 'out';
  const opposite = oppositeSide === 'in' ? a.inHandle : a.outHandle;
  if (!args.breakSmoothness && wasSmooth && opposite) {
    // Mirror the opposite handle through the anchor.
    const mirrored = { x: 2*a.x - target.x, y: 2*a.y - target.y };
    if (oppositeSide === 'in') a.inHandle = mirrored;
    else a.outHandle = mirrored;
  }
  scratch.edit.dirty = true;
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/tools/builtin/penEdit/actions.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/penEdit/actions.ts src/tools/builtin/penEdit/actions.test.ts
git commit -m "feat(penEdit): dragHandle with smooth-mirror + alt-break"
```

---

## Task 14: Anchor selection + click

**Files:**
- Modify: `src/tools/builtin/penEdit/actions.ts`
- Modify: `src/tools/builtin/penEdit/actions.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```typescript
import { selectAnchor } from './actions';

describe('selectAnchor', () => {
  it('replaces selection by default', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 10, y: 0 }]]);
    scratch.edit!.selectedAnchors.add('0:0');
    selectAnchor(scratch, { sub: 0, idx: 1, additive: false });
    expect([...scratch.edit!.selectedAnchors]).toEqual(['0:1']);
  });

  it('adds to selection when additive=true', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 10, y: 0 }]]);
    scratch.edit!.selectedAnchors.add('0:0');
    selectAnchor(scratch, { sub: 0, idx: 1, additive: true });
    expect([...scratch.edit!.selectedAnchors].sort()).toEqual(['0:0', '0:1']);
  });

  it('removes from selection when additive=true and already selected', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }]]);
    scratch.edit!.selectedAnchors.add('0:0');
    selectAnchor(scratch, { sub: 0, idx: 0, additive: true });
    expect([...scratch.edit!.selectedAnchors]).toEqual([]);
  });

  it('does not set dirty (selection is not a mutation of geometry)', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }]]);
    selectAnchor(scratch, { sub: 0, idx: 0, additive: false });
    expect(scratch.edit!.dirty).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tools/builtin/penEdit/actions.test.ts`
Expected: FAIL with "selectAnchor is not a function".

- [ ] **Step 3: Implement `selectAnchor`**

Append:

```typescript
export function selectAnchor(
  scratch: PenScratch,
  args: { sub: number; idx: number; additive: boolean },
): void {
  if (!scratch.edit) return;
  const key = `${args.sub}:${args.idx}`;
  if (args.additive) {
    if (scratch.edit.selectedAnchors.has(key)) scratch.edit.selectedAnchors.delete(key);
    else scratch.edit.selectedAnchors.add(key);
  } else {
    scratch.edit.selectedAnchors.clear();
    scratch.edit.selectedAnchors.add(key);
  }
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/tools/builtin/penEdit/actions.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/penEdit/actions.ts src/tools/builtin/penEdit/actions.test.ts
git commit -m "feat(penEdit): selectAnchor with additive (shift) mode"
```

---

## Task 15: Add anchor on segment

**Files:**
- Modify: `src/tools/builtin/penEdit/actions.ts`
- Modify: `src/tools/builtin/penEdit/actions.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```typescript
import { addAnchorOnSegment } from './actions';

describe('addAnchorOnSegment', () => {
  it('inserts a new anchor between two existing anchors on a straight segment', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 100, y: 0 }]]);
    addAnchorOnSegment(scratch, { sub: 0, segIdx: 0, t: 0.5 });
    const sub = scratch.edit!.anchors[0];
    expect(sub).toHaveLength(3);
    expect(sub[1]).toEqual(expect.objectContaining({ x: 50, y: 0 }));
  });

  it('splits a cubic segment via De Casteljau and sets handles on the new anchor + neighbors', () => {
    const scratch = editingScratch([[
      { x: 0, y: 0, outHandle: { x: 33, y: 100 } },
      { x: 100, y: 0, inHandle: { x: 66, y: 100 } },
    ]]);
    addAnchorOnSegment(scratch, { sub: 0, segIdx: 0, t: 0.5 });
    const sub = scratch.edit!.anchors[0];
    expect(sub).toHaveLength(3);
    // Midpoint of the curve at t=0.5 is the new anchor's (x, y).
    // B(0.5) = 0.125*(0,0) + 0.375*(33,100) + 0.375*(66,100) + 0.125*(100,0) = (50, 75)
    expect(sub[1].x).toBeCloseTo(50, 5);
    expect(sub[1].y).toBeCloseTo(75, 5);
    // The new anchor's incoming/outgoing handles should be present.
    expect(sub[1].inHandle).toBeDefined();
    expect(sub[1].outHandle).toBeDefined();
    // The original anchors' outer handles should have been replaced with the
    // De Casteljau-derived inner controls (the curve geometry is preserved).
    expect(sub[0].outHandle).not.toEqual({ x: 33, y: 100 });
    expect(sub[2].inHandle).not.toEqual({ x: 66, y: 100 });
  });

  it('sets dirty=true', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 100, y: 0 }]]);
    addAnchorOnSegment(scratch, { sub: 0, segIdx: 0, t: 0.5 });
    expect(scratch.edit!.dirty).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tools/builtin/penEdit/actions.test.ts`
Expected: FAIL with "addAnchorOnSegment is not a function".

- [ ] **Step 3: Implement `addAnchorOnSegment`**

Append:

```typescript
import { splitCubicAtT } from 'features/paths';

export function addAnchorOnSegment(
  scratch: PenScratch,
  args: { sub: number; segIdx: number; t: number },
): void {
  if (!scratch.edit) return;
  const sub = scratch.edit.anchors[args.sub];
  if (!sub) return;
  const a = sub[args.segIdx];
  const b = sub[args.segIdx + 1];
  if (!a || !b) return;
  const p0 = a, p1 = a.outHandle ?? a, p2 = b.inHandle ?? b, p3 = b;
  const { left, right } = splitCubicAtT(p0, p1, p2, p3, args.t);
  // After the split:
  //   left[0] = a    (unchanged x,y)
  //   left[1] = a.outHandle (new value: left[1])
  //   left[2] = newAnchor.inHandle
  //   left[3] = newAnchor (x,y) — also right[0]
  //   right[1] = newAnchor.outHandle
  //   right[2] = b.inHandle (new value)
  //   right[3] = b (unchanged x,y)
  a.outHandle = { x: left[1].x, y: left[1].y };
  b.inHandle = { x: right[2].x, y: right[2].y };
  const newAnchor = {
    x: left[3].x,
    y: left[3].y,
    inHandle: { x: left[2].x, y: left[2].y },
    outHandle: { x: right[1].x, y: right[1].y },
  };
  sub.splice(args.segIdx + 1, 0, newAnchor);
  scratch.edit.dirty = true;
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/tools/builtin/penEdit/actions.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/penEdit/actions.ts src/tools/builtin/penEdit/actions.test.ts
git commit -m "feat(penEdit): addAnchorOnSegment via De Casteljau split"
```

---

## Task 16: Delete anchor (fuse adjacent segments)

**Files:**
- Modify: `src/tools/builtin/penEdit/actions.ts`
- Modify: `src/tools/builtin/penEdit/actions.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```typescript
import { deleteAnchors } from './actions';

describe('deleteAnchors', () => {
  it('removes interior anchor and fits a new cubic through the surviving anchors', () => {
    const scratch = editingScratch([[
      { x: 0, y: 0, outHandle: { x: 10, y: 0 } },
      { x: 50, y: 50 }, // delete this
      { x: 100, y: 0, inHandle: { x: 90, y: 0 } },
    ]]);
    deleteAnchors(scratch, ['0:1']);
    const sub = scratch.edit!.anchors[0];
    expect(sub).toHaveLength(2);
    expect(sub[0].x).toBe(0);
    expect(sub[1].x).toBe(100);
    expect(sub[0].outHandle).toBeDefined();
    expect(sub[1].inHandle).toBeDefined();
  });

  it('removes endpoint anchor and drops the adjacent segment', () => {
    const scratch = editingScratch([[
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 }, // delete this
    ]]);
    deleteAnchors(scratch, ['0:2']);
    expect(scratch.edit!.anchors[0]).toHaveLength(2);
  });

  it('clears the deleted anchor from selection', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 10, y: 0 }]]);
    scratch.edit!.selectedAnchors.add('0:0');
    deleteAnchors(scratch, ['0:0']);
    expect(scratch.edit!.selectedAnchors.has('0:0')).toBe(false);
  });

  it('sets dirty=true', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }]]);
    deleteAnchors(scratch, ['0:1']);
    expect(scratch.edit!.dirty).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tools/builtin/penEdit/actions.test.ts`
Expected: FAIL with "deleteAnchors is not a function".

- [ ] **Step 3: Implement `deleteAnchors`**

Append:

```typescript
import { fitCubicThroughDeletion } from 'features/paths';

/**
 * Delete one or more anchors by "sub:idx" keys. Interior deletions fuse the
 * adjacent segments via fitCubicThroughDeletion. Endpoint deletions just drop
 * the adjacent segment.
 *
 * Deletes are processed in reverse index order within each subpath so earlier
 * indices remain valid as later ones disappear.
 */
export function deleteAnchors(scratch: PenScratch, keys: string[]): void {
  if (!scratch.edit) return;
  // Group by subpath, sort indices desc.
  const bySub = new Map<number, number[]>();
  for (const k of keys) {
    const [s, i] = k.split(':').map(Number);
    if (!bySub.has(s)) bySub.set(s, []);
    bySub.get(s)!.push(i);
  }
  for (const [s, indices] of bySub) {
    indices.sort((a, b) => b - a);
    const sub = scratch.edit.anchors[s];
    if (!sub) continue;
    for (const i of indices) {
      const prev = sub[i - 1];
      const next = sub[i + 1];
      if (prev && next) {
        // Interior — fit a new cubic and apply the controls to prev.outHandle / next.inHandle.
        const { c1, c2 } = fitCubicThroughDeletion(prev, next);
        prev.outHandle = c1;
        next.inHandle = c2;
      }
      sub.splice(i, 1);
    }
  }
  // Drop any selection keys that now point at gone/shifted anchors. Simple
  // approach: clear selection on delete. Users select again as needed.
  scratch.edit.selectedAnchors.clear();
  scratch.edit.dirty = true;
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/tools/builtin/penEdit/actions.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/penEdit/actions.ts src/tools/builtin/penEdit/actions.test.ts
git commit -m "feat(penEdit): deleteAnchors with adjacent-segment fuse"
```

---

## Task 17: Scissors (alt+click on anchor)

**Files:**
- Modify: `src/tools/builtin/penEdit/actions.ts`
- Modify: `src/tools/builtin/penEdit/actions.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```typescript
import { scissorsAtAnchor } from './actions';

describe('scissorsAtAnchor', () => {
  it('opens a closed subpath at the clicked anchor (closed → false)', () => {
    const scratch = editingScratch([[
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
    ]]);
    scratch.edit!.closed = [true];
    scissorsAtAnchor(scratch, { sub: 0, idx: 1 });
    expect(scratch.edit!.closed).toEqual([false]);
  });

  it('rotates anchors so the cut point sits at the start of the array', () => {
    const scratch = editingScratch([[
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
    ]]);
    scratch.edit!.closed = [true];
    scissorsAtAnchor(scratch, { sub: 0, idx: 2 });
    expect(scratch.edit!.anchors[0].map(a => a.x)).toEqual([10, 0, 0, 10]);
  });

  it('is a no-op on an already-open subpath', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 10, y: 0 }]]);
    scratch.edit!.closed = [false];
    scissorsAtAnchor(scratch, { sub: 0, idx: 0 });
    expect(scratch.edit!.closed).toEqual([false]);
    expect(scratch.edit!.dirty).toBe(false); // no-op shouldn't dirty
  });

  it('sets dirty=true on actual open', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 10, y: 0 }]]);
    scratch.edit!.closed = [true];
    scissorsAtAnchor(scratch, { sub: 0, idx: 0 });
    expect(scratch.edit!.dirty).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tools/builtin/penEdit/actions.test.ts`
Expected: FAIL with "scissorsAtAnchor is not a function".

- [ ] **Step 3: Implement `scissorsAtAnchor`**

Append:

```typescript
export function scissorsAtAnchor(
  scratch: PenScratch,
  args: { sub: number; idx: number },
): void {
  if (!scratch.edit) return;
  if (!scratch.edit.closed[args.sub]) return;
  const sub = scratch.edit.anchors[args.sub];
  if (!sub) return;
  // Rotate so args.idx is the first anchor; mark open.
  scratch.edit.anchors[args.sub] = [...sub.slice(args.idx), ...sub.slice(0, args.idx)];
  scratch.edit.closed[args.sub] = false;
  scratch.edit.dirty = true;
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/tools/builtin/penEdit/actions.test.ts`
Expected: PASS, 21 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/penEdit/actions.ts src/tools/builtin/penEdit/actions.test.ts
git commit -m "feat(penEdit): scissorsAtAnchor opens closed subpath at clicked anchor"
```

---

## Task 18: Marquee select (rect → anchor selection)

**Files:**
- Modify: `src/tools/builtin/penEdit/actions.ts`
- Modify: `src/tools/builtin/penEdit/actions.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```typescript
import { marqueeSelect } from './actions';

describe('marqueeSelect', () => {
  it('selects anchors whose points fall inside the world-space rect', () => {
    const scratch = editingScratch([[
      { x: 5, y: 5 },    // inside
      { x: 15, y: 15 },  // outside
      { x: 0, y: 0 },    // inside
    ]]);
    marqueeSelect(scratch, { x: 0, y: 0, width: 10, height: 10, additive: false });
    expect([...scratch.edit!.selectedAnchors].sort()).toEqual(['0:0', '0:2']);
  });

  it('replaces existing selection by default', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 100, y: 0 }]]);
    scratch.edit!.selectedAnchors.add('0:1');
    marqueeSelect(scratch, { x: -5, y: -5, width: 10, height: 10, additive: false });
    expect([...scratch.edit!.selectedAnchors]).toEqual(['0:0']);
  });

  it('adds to selection when additive=true', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 100, y: 0 }]]);
    scratch.edit!.selectedAnchors.add('0:1');
    marqueeSelect(scratch, { x: -5, y: -5, width: 10, height: 10, additive: true });
    expect([...scratch.edit!.selectedAnchors].sort()).toEqual(['0:0', '0:1']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tools/builtin/penEdit/actions.test.ts`
Expected: FAIL with "marqueeSelect is not a function".

- [ ] **Step 3: Implement `marqueeSelect`**

Append:

```typescript
export function marqueeSelect(
  scratch: PenScratch,
  args: { x: number; y: number; width: number; height: number; additive: boolean },
): void {
  if (!scratch.edit) return;
  if (!args.additive) scratch.edit.selectedAnchors.clear();
  const x2 = args.x + args.width;
  const y2 = args.y + args.height;
  for (let s = 0; s < scratch.edit.anchors.length; s++) {
    const sub = scratch.edit.anchors[s];
    for (let i = 0; i < sub.length; i++) {
      const a = sub[i];
      if (a.x >= args.x && a.x <= x2 && a.y >= args.y && a.y <= y2) {
        scratch.edit.selectedAnchors.add(`${s}:${i}`);
      }
    }
  }
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/tools/builtin/penEdit/actions.test.ts`
Expected: PASS, 24 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/penEdit/actions.ts src/tools/builtin/penEdit/actions.test.ts
git commit -m "feat(penEdit): marqueeSelect rect → anchor selection"
```

---

## Task 19: Arrow-key nudge

**Files:**
- Modify: `src/tools/builtin/penEdit/actions.ts`
- Modify: `src/tools/builtin/penEdit/actions.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```typescript
import { nudgeSelectedAnchors } from './actions';

describe('nudgeSelectedAnchors', () => {
  it('translates selected anchors by (dx, dy)', () => {
    const scratch = editingScratch([[
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 },
    ]]);
    scratch.edit!.selectedAnchors.add('0:0');
    scratch.edit!.selectedAnchors.add('0:2');
    nudgeSelectedAnchors(scratch, { dx: 1, dy: 0 });
    expect(scratch.edit!.anchors[0][0].x).toBe(1);
    expect(scratch.edit!.anchors[0][1].x).toBe(10); // unchanged
    expect(scratch.edit!.anchors[0][2].x).toBe(21);
  });

  it('translates handles along with their anchor', () => {
    const scratch = editingScratch([[
      { x: 0, y: 0, inHandle: { x: -5, y: 0 }, outHandle: { x: 5, y: 0 } },
    ]]);
    scratch.edit!.selectedAnchors.add('0:0');
    nudgeSelectedAnchors(scratch, { dx: 3, dy: 4 });
    const a = scratch.edit!.anchors[0][0];
    expect(a).toEqual({
      x: 3, y: 4,
      inHandle: { x: -2, y: 4 },
      outHandle: { x: 8, y: 4 },
    });
  });

  it('sets dirty=true', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }]]);
    scratch.edit!.selectedAnchors.add('0:0');
    nudgeSelectedAnchors(scratch, { dx: 1, dy: 0 });
    expect(scratch.edit!.dirty).toBe(true);
  });

  it('is a no-op when no anchors are selected', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }]]);
    nudgeSelectedAnchors(scratch, { dx: 1, dy: 0 });
    expect(scratch.edit!.anchors[0][0].x).toBe(0);
    expect(scratch.edit!.dirty).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tools/builtin/penEdit/actions.test.ts`
Expected: FAIL with "nudgeSelectedAnchors is not a function".

- [ ] **Step 3: Implement `nudgeSelectedAnchors`**

Append:

```typescript
export function nudgeSelectedAnchors(
  scratch: PenScratch,
  args: { dx: number; dy: number },
): void {
  if (!scratch.edit) return;
  if (scratch.edit.selectedAnchors.size === 0) return;
  for (const key of scratch.edit.selectedAnchors) {
    const [s, i] = key.split(':').map(Number);
    dragAnchor(scratch, { sub: s, idx: i, dx: args.dx, dy: args.dy });
  }
  // dragAnchor sets dirty=true; nothing further needed.
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/tools/builtin/penEdit/actions.test.ts`
Expected: PASS, 28 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/penEdit/actions.ts src/tools/builtin/penEdit/actions.test.ts
git commit -m "feat(penEdit): nudgeSelectedAnchors for arrow-key translation"
```

---

## Task 20: Commit helper — turn scratch state into a SetPathOp

**Files:**
- Modify: `src/tools/builtin/penEdit/scratch.ts`
- Modify: `src/tools/builtin/penEdit/scratch.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/tools/builtin/penEdit/scratch.test.ts`:

```typescript
import { commitEditAsOp } from './scratch';
import { PathBuilder } from 'features/paths/builder';

describe('commitEditAsOp', () => {
  it('returns null when scratch is not dirty', () => {
    const scratch = freshScratch();
    const path = new PathBuilder().moveTo(0, 0).lineTo(10, 0).build();
    enterEditMode(scratch, { objId: 'a', path, closed: false, params: undefined, isParametric: false });
    expect(commitEditAsOp(scratch)).toBeNull();
  });

  it('emits a SetPathOp with the current anchor geometry when dirty', () => {
    const scratch = freshScratch();
    const path = new PathBuilder().moveTo(0, 0).lineTo(10, 0).build();
    enterEditMode(scratch, { objId: 'a', path, closed: false, params: undefined, isParametric: false });
    scratch.edit!.anchors[0][0] = { x: 5, y: 5 };
    scratch.edit!.dirty = true;
    const op = commitEditAsOp(scratch);
    expect(op).not.toBeNull();
    const setPath = vi.fn();
    op!.apply({ setPath });
    expect(setPath).toHaveBeenCalledWith('a', expect.objectContaining({
      params: undefined,
      closed: false,
    }));
  });

  it('on a parametric trapdoor, op replaces path and clears params', () => {
    const scratch = freshScratch();
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    enterEditMode(scratch, { objId: 'a', path, closed: true, params: { sides: 4 } as never, isParametric: true });
    scratch.edit!.anchors[0][0] = { x: 1, y: 1 };
    scratch.edit!.dirty = true;
    const op = commitEditAsOp(scratch);
    const setPath = vi.fn();
    op!.apply({ setPath });
    const call = setPath.mock.calls[0]?.[1] as { params: unknown; path: { kind: string } };
    expect(call.params).toBeUndefined();
    expect(call.path.kind).toBe('polygon');
  });
});
```

(Add `import { vi } from 'vitest'` at top of file.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tools/builtin/penEdit/scratch.test.ts`
Expected: FAIL with "commitEditAsOp is not a function".

- [ ] **Step 3: Implement `commitEditAsOp`**

Append to `src/tools/builtin/penEdit/scratch.ts`:

```typescript
import { anchorsToPath } from 'features/paths';
import { createSetPathOp } from 'core/ops/setPath';
import type { Op } from 'core/ops/types';

/**
 * Build the SetPathOp that commits the current edit state to history.
 * Returns null when the edit is not dirty (entering edit + exiting without
 * mutation is a no-op, including for parametric trapdoors).
 *
 * For a parametric trapdoor, the op's `from` is the pre-conversion snapshot;
 * for a plain-path edit, the op's `from` is the freshly-derived polygon path.
 */
export function commitEditAsOp(scratch: PenScratch): Op | null {
  if (!scratch.edit || !scratch.edit.dirty) return null;
  const newPath = anchorsToPath(scratch.edit.anchors, scratch.edit.closed);
  const newClosed = scratch.edit.closed[0] ?? false;
  const fromFields = scratch.edit.preConvert ?? {
    // Re-serialize the pre-edit anchors → path. Conservative: in real
    // gestures we'd ideally cache this on entry, but recomputing once at
    // commit-time is fine and avoids a stale-snapshot bug if the underlying
    // obj changed via another path mid-edit (shouldn't happen, but cheap).
    path: anchorsToPath(scratch.edit.anchors, scratch.edit.closed),
    closed: newClosed,
    params: undefined,
  };
  return createSetPathOp({
    id: scratch.edit.objId,
    from: fromFields,
    to: { path: newPath, closed: newClosed, params: undefined },
    label: 'Edit path',
    coalesceKey: `penEdit:${scratch.edit.objId}`,
  });
}
```

**Note on the `from` snapshot**: this implementation has a flaw — the non-trapdoor `fromFields.path` is computed from the current (post-edit) anchor state, which means undo would no-op. Fix this in Task 21 by snapshotting the original path on entry.

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/tools/builtin/penEdit/scratch.test.ts`
Expected: PASS for the "dirty → op" and "trapdoor" cases. The plain-path commit test passes trivially because we don't yet assert undo-correctness — Task 21 fixes it.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/penEdit/scratch.ts src/tools/builtin/penEdit/scratch.test.ts
git commit -m "feat(penEdit): commitEditAsOp builds SetPathOp from edit scratch"
```

---

## Task 21: Snapshot original path on entry (fix from-fields for undo)

**Files:**
- Modify: `src/tools/builtin/useUserPenTool.ts` (extend `PenEditState`)
- Modify: `src/tools/builtin/penEdit/scratch.ts`
- Modify: `src/tools/builtin/penEdit/scratch.test.ts`

- [ ] **Step 1: Add `original` snapshot field to `PenEditState`**

In `src/tools/builtin/useUserPenTool.ts`, in `PenEditState`:

```typescript
export interface PenEditState {
  objId: string;
  anchors: PenAnchor[][];
  closed: boolean[];
  selectedAnchors: Set<string>;
  activeHandle: { sub: number; anchor: number; side: 'in' | 'out' } | null;
  dirty: boolean;
  preConvert: { path: unknown; closed: boolean; params: unknown } | null;
  /** Snapshot of the path-as-it-was on edit-mode entry (already a polygon —
   *  if the obj was parametric, this is the converted form). Used as the
   *  op's `from` for plain-path edits so undo restores the entry state. */
  original: { path: unknown; closed: boolean };
}
```

- [ ] **Step 2: Populate `original` in `enterEditMode`**

In `src/tools/builtin/penEdit/scratch.ts`, update `enterEditMode`:

```typescript
export function enterEditMode(scratch: PenScratch, args: EnterEditArgs): void {
  const derived = args.path.kind === 'rect'
    ? rectToAnchors(args.path)
    : pathToAnchors(args.path);
  const closedArr = derived.closed.length > 0 ? derived.closed : [args.closed];
  scratch.mode = 'edit';
  scratch.edit = {
    objId: args.objId,
    anchors: derived.anchors,
    closed: closedArr,
    selectedAnchors: new Set(),
    activeHandle: null,
    dirty: false,
    preConvert: args.isParametric
      ? { path: args.path, closed: args.closed, params: args.params }
      : null,
    // Snapshot the entry state as a freshly-serialized polygon, so commitEditAsOp
    // has a stable `from` for undo regardless of subsequent edits.
    original: {
      path: anchorsToPath(derived.anchors, closedArr),
      closed: closedArr[0] ?? false,
    },
  };
}
```

- [ ] **Step 3: Update `commitEditAsOp` to use `original`**

In `src/tools/builtin/penEdit/scratch.ts`:

```typescript
export function commitEditAsOp(scratch: PenScratch): Op | null {
  if (!scratch.edit || !scratch.edit.dirty) return null;
  const newPath = anchorsToPath(scratch.edit.anchors, scratch.edit.closed);
  const newClosed = scratch.edit.closed[0] ?? false;
  const fromFields = scratch.edit.preConvert
    ? scratch.edit.preConvert
    : { path: scratch.edit.original.path, closed: scratch.edit.original.closed, params: undefined };
  return createSetPathOp({
    id: scratch.edit.objId,
    from: fromFields,
    to: { path: newPath, closed: newClosed, params: undefined },
    label: 'Edit path',
    coalesceKey: `penEdit:${scratch.edit.objId}`,
  });
}
```

- [ ] **Step 4: Add a test for undo correctness**

Append:

```typescript
describe('commitEditAsOp: undo correctness', () => {
  it('op.invert() restores the entry-time path/closed', () => {
    const scratch = freshScratch();
    const path = new PathBuilder().moveTo(0, 0).lineTo(10, 0).build();
    enterEditMode(scratch, { objId: 'a', path, closed: false, params: undefined, isParametric: false });
    scratch.edit!.anchors[0][1] = { x: 100, y: 0 }; // mutated
    scratch.edit!.dirty = true;
    const op = commitEditAsOp(scratch)!;
    const setPath = vi.fn();
    op.apply({ setPath });
    op.invert().apply({ setPath });
    // The second call should restore the original (commands + coords from the entry path).
    const restored = setPath.mock.calls[1]?.[1] as { path: { commands: ArrayLike<number>; coords: ArrayLike<number> } };
    expect(Array.from(restored.path.commands)).toEqual([1, 2]); // M, L
    expect(Array.from(restored.path.coords)).toEqual([0, 0, 10, 0]);
  });
});
```

- [ ] **Step 5: Run the tests, verify they pass**

Run: `npx vitest run src/tools/builtin/penEdit/scratch.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tools/builtin/useUserPenTool.ts src/tools/builtin/penEdit/scratch.ts src/tools/builtin/penEdit/scratch.test.ts
git commit -m "fix(penEdit): snapshot entry-state path so commitEditAsOp's from-fields restore on undo"
```

---

## Task 22: Wire the pen tool — `hitOverride` + dblclick-on-node enters edit

**Files:**
- Modify: `src/tools/builtin/useUserPenTool.ts`

- [ ] **Step 1: Wire the hit override into the tool definition**

In `useUserPenTool.ts`, locate the `defineTool({ … })` call. Add:

```typescript
import { penEditHitOverride } from './penEdit/hitOverride';
import { enterEditMode, exitEditMode, commitEditAsOp } from './penEdit/scratch';
```

In the `defineTool({ … })` config, add:

```typescript
hitOverride: (ctx) => penEditHitOverride({
  worldX: ctx.worldX,
  worldY: ctx.worldY,
  scratch: ctx.scratch,
  view: ctx.view,
  modifiers: ctx.modifiers,
}),
```

- [ ] **Step 2: Add a route entry for `node: dblclick` that enters edit mode**

In the pen tool's route table (look for the existing routes object), add:

```typescript
node: {
  dblclick: claim((ctx) => {
    // Resolve the obj's path/closed/params via the consumer adapter. The pen
    // tool needs a `getPathObj` callback on UseUserPenToolOptions; add it.
    const obj = optsRef.current.getPathObj?.(ctx.target.id);
    if (!obj) return none();
    enterEditMode(ctx.scratch, {
      objId: ctx.target.id,
      path: obj.path,
      closed: obj.closed,
      params: obj.params,
      isParametric: obj.tool !== 'pen' && obj.tool !== 'pencil' && obj.tool !== 'imported',
    });
    return none();
  }),
},
```

(`optsRef` is the existing pattern in the file for accessing the consumer's option callbacks. If not present, the file likely uses a different ref name — look at how `wrapPath` is accessed and follow that pattern.)

- [ ] **Step 3: Add `getPathObj` to `UseUserPenToolOptions`**

In the same file, in `UseUserPenToolOptions`:

```typescript
/** Resolve a path obj from id. Returns the obj's path, closed flag, params,
 *  and the tool that created it (used to decide whether the trapdoor applies).
 *  Required when pen-edit is wanted; safe to omit if the consumer only uses
 *  create mode (dblclick-to-edit will be a no-op). */
getPathObj?: (id: string) => {
  path: PolygonPath | { kind: 'rect'; x: number; y: number; width: number; height: number };
  closed: boolean;
  params: unknown;
  tool: string;
} | null;
```

- [ ] **Step 4: Verify the tool still typechecks**

Run: `npx tsc --noEmit 2>&1 | grep useUserPenTool | head`
Expected: empty.

- [ ] **Step 5: Run existing pen tests**

Run: `npx vitest run src/tools/builtin/useUserPenTool.test`
Expected: all green (create mode unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/tools/builtin/useUserPenTool.ts
git commit -m "feat(pen): wire hitOverride + node:dblclick → enterEditMode"
```

---

## Task 23: Edit-mode route table (gates by mode, dispatches edit actions)

**Files:**
- Modify: `src/tools/builtin/useUserPenTool.ts`

- [ ] **Step 1: Add edit-mode route entries**

In the pen tool's route table, alongside the existing `node: { dblclick: ... }`, add:

```typescript
// Routes that fire only when scratch.mode === 'edit'.
// We don't have an explicit mode-key on the route table, so each route's
// action checks the mode and bails to none() if create-mode is active.
anchor: {
  down: begin({
    onStart: (ctx) => {
      if (ctx.scratch.mode !== 'edit' || !ctx.scratch.edit) return;
      const extra = (ctx.target as { extra: { sub: number; idx: number } }).extra;
      // Replace selection unless shift held.
      selectAnchor(ctx.scratch, { sub: extra.sub, idx: extra.idx, additive: ctx.modifiers.shift });
    },
    onMove: (ctx) => {
      if (ctx.scratch.mode !== 'edit' || !ctx.scratch.edit) return;
      const extra = (ctx.target as { extra: { sub: number; idx: number } }).extra;
      // Convert ctx delta into our world-space dx, dy.
      // The drag begin recorded the down position; we use ctx.dragDelta or equivalent.
      dragAnchor(ctx.scratch, { sub: extra.sub, idx: extra.idx, dx: ctx.dragDeltaX, dy: ctx.dragDeltaY });
      const op = commitEditAsOp(ctx.scratch);
      if (op) ctx.applyOps([op], 'Move anchor');
    },
    onEnd: () => { /* coalesce window closes; nothing extra */ },
  }),
  click: claim((ctx) => {
    if (ctx.scratch.mode !== 'edit' || !ctx.scratch.edit) return none();
    const extra = (ctx.target as { extra: { sub: number; idx: number } }).extra;
    if (ctx.modifiers.alt) {
      scissorsAtAnchor(ctx.scratch, { sub: extra.sub, idx: extra.idx });
      const op = commitEditAsOp(ctx.scratch);
      if (op) ctx.applyOps([op], 'Scissors');
    } else {
      selectAnchor(ctx.scratch, { sub: extra.sub, idx: extra.idx, additive: ctx.modifiers.shift });
    }
    return none();
  }),
},
handle: {
  down: begin({
    onStart: (ctx) => {
      if (ctx.scratch.mode !== 'edit' || !ctx.scratch.edit) return;
      const extra = (ctx.target as { extra: { sub: number; idx: number; side: 'in' | 'out' } }).extra;
      ctx.scratch.edit.activeHandle = { sub: extra.sub, anchor: extra.idx, side: extra.side };
    },
    onMove: (ctx) => {
      if (ctx.scratch.mode !== 'edit' || !ctx.scratch.edit) return;
      const h = ctx.scratch.edit.activeHandle;
      if (!h) return;
      dragHandle(ctx.scratch, {
        sub: h.sub, idx: h.anchor, side: h.side,
        toX: ctx.worldX, toY: ctx.worldY,
        breakSmoothness: ctx.modifiers.alt,
      });
      const op = commitEditAsOp(ctx.scratch);
      if (op) ctx.applyOps([op], 'Move handle');
    },
    onEnd: (ctx) => {
      if (ctx.scratch.edit) ctx.scratch.edit.activeHandle = null;
    },
  }),
},
segment: {
  click: claim((ctx) => {
    if (ctx.scratch.mode !== 'edit' || !ctx.scratch.edit) return none();
    const extra = (ctx.target as { extra: { sub: number; segIdx: number; t: number } }).extra;
    addAnchorOnSegment(ctx.scratch, extra);
    const op = commitEditAsOp(ctx.scratch);
    if (op) ctx.applyOps([op], 'Add anchor');
    return none();
  }),
},
empty: {
  click: claim((ctx) => {
    if (ctx.scratch.mode !== 'edit') return none();
    // Commit any in-flight edits and exit.
    const op = commitEditAsOp(ctx.scratch);
    if (op) ctx.applyOps([op], 'Edit path');
    exitEditMode(ctx.scratch);
    return none();
  }),
},
```

(Imports for `selectAnchor`, `dragAnchor`, `dragHandle`, `scissorsAtAnchor`, `addAnchorOnSegment` come from `./penEdit/actions`.)

- [ ] **Step 2: Add Escape and Enter keyboard exits**

The pen tool likely already has key routes (for Escape-cancel-in-progress-anchor). Add to that table:

```typescript
keydown: {
  Escape: claim((ctx) => {
    if (ctx.scratch.mode !== 'edit') return none();
    const op = commitEditAsOp(ctx.scratch);
    if (op) ctx.applyOps([op], 'Edit path');
    exitEditMode(ctx.scratch);
    return none();
  }),
  Enter: claim((ctx) => {
    if (ctx.scratch.mode !== 'edit') return none();
    const op = commitEditAsOp(ctx.scratch);
    if (op) ctx.applyOps([op], 'Edit path');
    exitEditMode(ctx.scratch);
    return none();
  }),
  Backspace: claim((ctx) => {
    if (ctx.scratch.mode !== 'edit' || !ctx.scratch.edit) return none();
    if (ctx.scratch.edit.selectedAnchors.size === 0) return none();
    deleteAnchors(ctx.scratch, [...ctx.scratch.edit.selectedAnchors]);
    const op = commitEditAsOp(ctx.scratch);
    if (op) ctx.applyOps([op], 'Delete anchor');
    return none();
  }),
  ArrowUp:    claim((ctx) => nudgeRoute(ctx, 0, -1)),
  ArrowDown:  claim((ctx) => nudgeRoute(ctx, 0, 1)),
  ArrowLeft:  claim((ctx) => nudgeRoute(ctx, -1, 0)),
  ArrowRight: claim((ctx) => nudgeRoute(ctx, 1, 0)),
},
```

With a helper inside the file:

```typescript
function nudgeRoute(ctx: ToolCtx<PenScratch>, dx: number, dy: number) {
  if (ctx.scratch.mode !== 'edit') return none();
  const step = ctx.modifiers.shift ? 10 : 1;
  nudgeSelectedAnchors(ctx.scratch, { dx: dx * step, dy: dy * step });
  const op = commitEditAsOp(ctx.scratch);
  if (op) ctx.applyOps([op], 'Nudge anchor');
  return none();
}
```

(If the existing pen tool doesn't surface a `keydown:` route shape, add it — there's an existing `_lastClick` pattern for tracking keyboard, so the keyboard route surface may need scaffolding.)

- [ ] **Step 3: Tool-switch exit hook**

If `defineTool` supports an `onDeactivate` hook, wire:

```typescript
onDeactivate: (scratch) => {
  if (scratch.mode === 'edit') {
    const op = commitEditAsOp(scratch);
    if (op) /* apply via consumer-provided applyOps from optsRef */;
    exitEditMode(scratch);
  }
},
```

If `defineTool` does not support `onDeactivate`, this gap is documented as a known limitation; in practice the dispatcher's tool-switch already triggers an `applyBatch` finalize on the outgoing tool's drag, and the user can use Escape to exit cleanly. Add a TODO note in the spec's "Out of scope".

- [ ] **Step 4: Verify the tool typechecks**

Run: `npx tsc --noEmit 2>&1 | grep useUserPenTool | head`
Expected: empty.

- [ ] **Step 5: Run existing pen tests**

Run: `npx vitest run src/tools/builtin/useUserPenTool.test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/tools/builtin/useUserPenTool.ts
git commit -m "feat(pen): edit-mode route table — anchor/handle/segment + keyboard"
```

---

## Task 23b: Wire marquee drag on empty in edit mode

The route table from Task 23 handles `empty: click → exitEdit` but not the drag case. In edit mode, a drag starting on empty should preview a rubber-band rect; on release, `marqueeSelect` applies.

**Files:**
- Modify: `src/tools/builtin/useUserPenTool.ts`
- Modify: `src/tools/builtin/penEdit/overlay.ts` — add marquee rubber-band rendering

- [ ] **Step 1: Add a marquee scratch field**

In `PenEditState` (in `useUserPenTool.ts`):

```typescript
/** In-flight marquee rect (world-space). Null when not dragging. */
marquee: { x0: number; y0: number; x1: number; y1: number; additive: boolean } | null;
```

Initialize to `null` in `enterEditMode` (in `penEdit/scratch.ts`).

- [ ] **Step 2: Add a route for `empty: drag` (replaces the prior empty:down+drag exit-behavior note)**

Replace the placeholder `empty: down+drag → exit` route with:

```typescript
empty: {
  // Click in edit mode = exit (already in Task 23).
  click: claim((ctx) => {
    if (ctx.scratch.mode !== 'edit') return none();
    const op = commitEditAsOp(ctx.scratch);
    if (op) ctx.applyOps([op], 'Edit path');
    exitEditMode(ctx.scratch);
    return none();
  }),
  // Drag in edit mode = marquee. In create mode falls through (no entry).
  down: begin({
    onStart: (ctx) => {
      if (ctx.scratch.mode !== 'edit' || !ctx.scratch.edit) return;
      ctx.scratch.edit.marquee = {
        x0: ctx.worldX, y0: ctx.worldY,
        x1: ctx.worldX, y1: ctx.worldY,
        additive: ctx.modifiers.shift,
      };
    },
    onMove: (ctx) => {
      if (!ctx.scratch.edit?.marquee) return;
      ctx.scratch.edit.marquee.x1 = ctx.worldX;
      ctx.scratch.edit.marquee.y1 = ctx.worldY;
    },
    onEnd: (ctx) => {
      const m = ctx.scratch.edit?.marquee;
      if (!m || !ctx.scratch.edit) return;
      const x = Math.min(m.x0, m.x1);
      const y = Math.min(m.y0, m.y1);
      const width = Math.abs(m.x1 - m.x0);
      const height = Math.abs(m.y1 - m.y0);
      marqueeSelect(ctx.scratch, { x, y, width, height, additive: m.additive });
      ctx.scratch.edit.marquee = null;
      // No op — selection isn't an op-level mutation.
    },
  }),
},
```

- [ ] **Step 3: Render the rubber-band rect in the overlay**

In `src/tools/builtin/penEdit/overlay.ts`, after the existing anchor/handle loop and before `return out`:

```typescript
if (scratch.edit.marquee) {
  const m = scratch.edit.marquee;
  const x = Math.min(m.x0, m.x1);
  const y = Math.min(m.y0, m.y1);
  const width = Math.abs(m.x1 - m.x0);
  const height = Math.abs(m.y1 - m.y0);
  out.push(makeRect(x, y, width, height, '#3478f6', 'rgba(52, 120, 246, 0.08)', 1 / scale));
}
```

- [ ] **Step 4: Add a marquee test**

In `src/tools/builtin/penEdit/overlay.test.ts`:

```typescript
it('emits a rubber-band rect command when marquee is active', () => {
  const scratch = editingScratch([[{ x: 0, y: 0 }]]);
  scratch.edit!.marquee = { x0: 0, y0: 0, x1: 10, y1: 10, additive: false };
  const cmds = renderPenEditOverlay(scratch, view);
  const cmds2 = renderPenEditOverlay(editingScratch([[{ x: 0, y: 0 }]]), view);
  expect(cmds.length).toBeGreaterThan(cmds2.length);
});
```

(Add `marquee: null` to the default `editingScratch` helper so tests without a marquee still type-check.)

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/tools/builtin/penEdit/overlay.test.ts src/tools/builtin/useUserPenTool.test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tools/builtin/useUserPenTool.ts src/tools/builtin/penEdit/overlay.ts src/tools/builtin/penEdit/overlay.test.ts src/tools/builtin/penEdit/scratch.ts
git commit -m "feat(penEdit): marquee drag on empty in edit mode (rubber band + select)"
```

---

## Task 24: Anchor + handle overlay rendering

**Files:**
- Create: `src/tools/builtin/penEdit/overlay.ts`
- Create: `src/tools/builtin/penEdit/overlay.test.ts`
- Modify: `src/features/paths/penPreviewLayer.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/tools/builtin/penEdit/overlay.test.ts
import { describe, expect, it } from 'vitest';
import { renderPenEditOverlay } from './overlay';
import type { PenScratch } from '../useUserPenTool';

const view = { x: 0, y: 0, scale: 1 } as const;

function editingScratch(anchors: { x: number; y: number; inHandle?: { x: number; y: number }; outHandle?: { x: number; y: number } }[][], selectedKeys: string[] = []): PenScratch {
  return {
    mode: 'edit',
    finishedSubpaths: [], current: null, cursor: null,
    draggingHandleAt: null, closeHintActive: false,
    _pendingDown: null, _lastClick: null,
    edit: {
      objId: 'a', anchors, closed: anchors.map(() => false),
      selectedAnchors: new Set(selectedKeys), activeHandle: null, dirty: false,
      preConvert: null, original: { path: null, closed: false } as never,
    },
  };
}

describe('renderPenEditOverlay', () => {
  it('returns no commands when not in edit mode', () => {
    const scratch: PenScratch = {
      mode: 'create', finishedSubpaths: [], current: null, cursor: null,
      draggingHandleAt: null, closeHintActive: false, _pendingDown: null,
      _lastClick: null, edit: null,
    };
    expect(renderPenEditOverlay(scratch, view)).toEqual([]);
  });

  it('emits one command per anchor (square marker)', () => {
    const scratch = editingScratch([[{ x: 0, y: 0 }, { x: 10, y: 0 }]]);
    const cmds = renderPenEditOverlay(scratch, view);
    // At least 2 anchor markers.
    expect(cmds.length).toBeGreaterThanOrEqual(2);
  });

  it('emits handle lines for selected anchors only', () => {
    const scratch = editingScratch(
      [[{ x: 0, y: 0, outHandle: { x: 10, y: 0 } }]],
      ['0:0'],
    );
    const cmds = renderPenEditOverlay(scratch, view);
    // Should include lines (handle stem) — count commands.
    // Without selection, no handle commands.
    const cmds2 = renderPenEditOverlay(editingScratch(
      [[{ x: 0, y: 0, outHandle: { x: 10, y: 0 } }]],
      [],
    ), view);
    expect(cmds.length).toBeGreaterThan(cmds2.length);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tools/builtin/penEdit/overlay.test.ts`
Expected: FAIL with "Cannot find module './overlay'".

- [ ] **Step 3: Implement `renderPenEditOverlay`**

```typescript
// src/tools/builtin/penEdit/overlay.ts
import type { DrawCommand } from 'renderer';
import type { View } from 'core/viewport/view';
import type { PenScratch } from '../useUserPenTool';

const ANCHOR_SIZE_PX = 6;
const HANDLE_DOT_PX = 4;
const ANCHOR_STROKE = '#3478f6';
const ANCHOR_FILL_SELECTED = '#3478f6';
const ANCHOR_FILL_UNSELECTED = '#ffffff';
const HANDLE_STROKE = '#7da7e8';

export function renderPenEditOverlay(scratch: PenScratch, view: View): DrawCommand[] {
  if (scratch.mode !== 'edit' || !scratch.edit) return [];
  const out: DrawCommand[] = [];
  const scale = view.scale || 1;
  const anchorSize = ANCHOR_SIZE_PX / scale;
  const handleDot = HANDLE_DOT_PX / scale;

  for (let s = 0; s < scratch.edit.anchors.length; s++) {
    const sub = scratch.edit.anchors[s];
    for (let i = 0; i < sub.length; i++) {
      const a = sub[i];
      const selected = scratch.edit.selectedAnchors.has(`${s}:${i}`);

      // Handle lines + dots for selected anchors only.
      if (selected) {
        if (a.inHandle) {
          out.push(makeLine(a.x, a.y, a.inHandle.x, a.inHandle.y, HANDLE_STROKE, 1 / scale));
          out.push(makeCircle(a.inHandle.x, a.inHandle.y, handleDot, HANDLE_STROKE, HANDLE_STROKE));
        }
        if (a.outHandle) {
          out.push(makeLine(a.x, a.y, a.outHandle.x, a.outHandle.y, HANDLE_STROKE, 1 / scale));
          out.push(makeCircle(a.outHandle.x, a.outHandle.y, handleDot, HANDLE_STROKE, HANDLE_STROKE));
        }
      }

      // Anchor square (last so it draws on top of handle dots if overlap).
      out.push(makeRect(
        a.x - anchorSize / 2, a.y - anchorSize / 2,
        anchorSize, anchorSize,
        ANCHOR_STROKE, selected ? ANCHOR_FILL_SELECTED : ANCHOR_FILL_UNSELECTED,
        1.5 / scale,
      ));
    }
  }
  return out;
}

// PREREQUISITE: before writing this file, read src/renderer/DrawCommand.ts
// to see the actual DrawCommand union variants (kinds, field names, expected
// shape). Then read src/features/paths/penPreviewLayer.ts to see how that
// file constructs rect and line commands. Use those exact factories — the
// helpers below are illustrative naming only; replace them with whatever
// the kit actually exposes (e.g., the file may use a builder, or plain
// object literals matching specific kind tags like 'fill-rect' /
// 'stroke-rect' / 'stroke-line').
function makeRect(x: number, y: number, w: number, h: number, stroke: string, fill: string, strokeWidth: number): DrawCommand {
  // Replace with the actual DrawCommand factory used in penPreviewLayer.ts.
  return { kind: 'rect', x, y, width: w, height: h, stroke, fill, strokeWidth } as DrawCommand;
}
function makeCircle(cx: number, cy: number, r: number, stroke: string, fill: string): DrawCommand {
  // Replace with the actual circle/arc factory.
  return { kind: 'circle', cx, cy, r, stroke, fill, strokeWidth: 1 } as DrawCommand;
}
function makeLine(x1: number, y1: number, x2: number, y2: number, stroke: string, strokeWidth: number): DrawCommand {
  // Replace with the actual line factory.
  return { kind: 'line', x1, y1, x2, y2, stroke, strokeWidth } as DrawCommand;
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/tools/builtin/penEdit/overlay.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Call the overlay from `penPreviewLayer`**

In `src/features/paths/penPreviewLayer.ts`, find the render entry. Add:

```typescript
import { renderPenEditOverlay } from 'tools/builtin/penEdit/overlay';

// Inside the layer's render function, after the existing in-progress draw
// commands and before the return:
if (scratch.mode === 'edit') {
  commands.push(...renderPenEditOverlay(scratch, view));
}
```

(Adjust to match the layer's actual structure — variables `scratch`, `view`, and `commands` may have different names; mirror the file's conventions.)

- [ ] **Step 6: Run all pen-preview tests**

Run: `npx vitest run src/features/paths/penPreviewLayer`
Expected: existing tests pass; the edit-mode overlay is additive.

- [ ] **Step 7: Commit**

```bash
git add src/tools/builtin/penEdit/overlay.ts src/tools/builtin/penEdit/overlay.test.ts src/features/paths/penPreviewLayer.ts
git commit -m "feat(penEdit): anchor + handle overlay rendering"
```

---

## Task 25: Background tint via CSS class

**Files:**
- Modify: `src/tools/builtin/useUserPenTool.ts`

The CSS class must be added/removed on the canvas container DOM element when `scratch.mode` flips. The kit doesn't own DOM; the canonical pattern is the consumer reads tool state and applies styles. But for ergonomics, expose a derived value the consumer can wire to.

- [ ] **Step 1: Add a return value indicating edit-mode active**

Find where `useUserPenTool` returns its public API. Add an `isEditing` boolean:

```typescript
return {
  // existing exposed API...
  isEditing: scratch.mode === 'edit',
};
```

(If the hook uses a reducer/ref pattern where the returned object is memoized, you'll need to trigger a re-render on mode change — add a small `useState` boolean kept in sync via `useEffect` watching scratch ref. Look at how `closeHintActive` or similar boolean state surfaces to consumers for the established pattern.)

- [ ] **Step 2: Document the CSS class contract**

Add a JSDoc comment to the hook:

```typescript
/**
 * ...existing...
 *
 * **Pen-edit-mode CSS class:** consumers should apply a CSS class like
 * `pen-edit-active` to the canvas container when `isEditing` is true, to
 * give users a visual cue that they're in edit mode (subtle background tint).
 * The kit does not own the DOM and ships no default stylesheet for this.
 */
```

- [ ] **Step 3: Commit**

```bash
git add src/tools/builtin/useUserPenTool.ts
git commit -m "feat(pen): expose isEditing for consumer-side pen-edit-active class wiring"
```

---

## Task 26: Wire Swillustrator — `getPathObj` + `setPath` adapter + tint class

**Files:**
- Modify: `apps/swillustrator/src/App.tsx`
- Modify: `apps/swillustrator/src/App.css` (or wherever swillustrator's canvas-container styles live)
- Modify: `apps/swillustrator/src/poseUpdate.ts` (or wherever the obj-mutation adapter lives) to add `setPath` support

- [ ] **Step 1: Add `setPath` to Swillustrator's adapter**

Find where Swillustrator's adapter is constructed (likely in `App.tsx` near the `useUserPenTool` call site). Add a `setPath` method:

```typescript
setPath: (id: string, fields: { path: unknown; closed: boolean; params: unknown }) => {
  const i = items.findIndex((o) => o.id === id);
  if (i < 0) return;
  const obj = items[i];
  if (obj.tool === 'text') return; // text objs aren't path-shaped
  items[i] = { ...obj, path: fields.path as never, closed: fields.closed, params: fields.params as never };
},
```

- [ ] **Step 2: Pass `getPathObj` into `useUserPenTool`**

At the existing `useUserPenTool` call site in `App.tsx`:

```typescript
getPathObj: (id: string) => {
  const o = items.find((x) => x.id === id);
  if (!o || o.tool === 'text') return null;
  return { path: o.path, closed: o.closed, params: o.params, tool: o.tool };
},
```

- [ ] **Step 3: Apply the CSS class based on `isEditing`**

Find the canvas container in `App.tsx`. Apply the class:

```typescript
const penTool = useUserPenTool({...});
// ...
<div className={`canvas-container${penTool.isEditing ? ' pen-edit-active' : ''}`}>
  <Canvas .../>
</div>
```

Add the CSS in the existing app stylesheet:

```css
.canvas-container.pen-edit-active {
  background-color: #f7f4ec; /* warm-grey tint */
}
```

- [ ] **Step 4: Manual smoke test in the dev server**

Run `npm run dev` (or the project's existing dev-server command) in `apps/swillustrator`. With the pen tool active:

1. Draw a curve, click off, then double-click → tint appears, anchor squares draw.
2. Select an anchor → handles appear.
3. Drag an anchor → curve updates live.
4. Alt+drag a handle → smooth breaks.
5. Click segment between anchors → new anchor inserts.
6. Backspace on selected anchor → anchor deletes.
7. Escape → tint disappears, edit committed.
8. Undo → reverts to pre-edit state.
9. Draw a rect, switch to pen, dblclick rect → tint appears, 4 corner anchors.
10. Drag a corner → rect becomes a polygon. Undo restores rect.

- [ ] **Step 5: Commit**

```bash
git add apps/swillustrator/src/App.tsx apps/swillustrator/src/App.css apps/swillustrator/src/poseUpdate.ts
git commit -m "feat(swillustrator): wire pen-edit-mode — getPathObj, setPath, tint class"
```

---

## Task 27: End-to-end integration test

**Files:**
- Create: `src/tools/builtin/useUserPenTool.edit.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/tools/builtin/useUserPenTool.edit.test.tsx
import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUserPenTool } from './useUserPenTool';
import { PathBuilder } from '../../features/paths/builder';

// This integration test mirrors the test rig used in other pen tool tests
// (useUserPenTool.test.tsx) — see that file for the established harness.
// The shape below is illustrative; copy the test-harness patterns from there
// to wire dispatcher + scratch + applyOps fakes properly.

describe('pen tool edit-mode integration', () => {
  it('dblclick on a path obj enters edit; anchor drag commits a SetPathOp; undo restores', () => {
    // 1. Build a rig with one PolygonPath obj at (0,0)→(10,0)→(10,10).
    // 2. Activate pen tool.
    // 3. Simulate dblclick at (0, 0) (over the first anchor area, but in
    //    create mode the hit is `node:dblclick` since hitOverride returns
    //    null when scratch.mode !== 'edit').
    // 4. Assert scratch.mode === 'edit'; anchors derived correctly.
    // 5. Simulate pointer down on anchor at (10, 0); drag by (0, 5); up.
    // 6. Assert the obj's path now has the moved anchor.
    // 7. Call history.undo(); assert the original path is restored.
  });

  it('dblclick on a rect obj enters edit; no commit until first mutation; escape leaves rect intact', () => {
    // 1. Build a rig with one RectPath obj.
    // 2. dblclick → scratch.mode === 'edit', anchors are 4 corners,
    //    scratch.edit.preConvert.path.kind === 'rect'.
    // 3. Press Escape → mode flips back to 'create'; no op was applied;
    //    obj's path is still a RectPath.
  });

  it('dblclick on a rect, drag a corner, undo restores the rect (not the intermediate polygon)', () => {
    // 1. Build a rig with one RectPath obj.
    // 2. dblclick → enter edit.
    // 3. Drag a corner → first mutation triggers trapdoor commit: one op that
    //    replaces RectPath+params with PolygonPath+undefined-params, plus the
    //    moved corner.
    // 4. history.undo() → obj is a RectPath again, params restored.
  });
});
```

- [ ] **Step 2: Run the test, expecting partial failure**

Run: `npx vitest run src/tools/builtin/useUserPenTool.edit.test.tsx`
Expected: tests fail unless all wiring from Tasks 22–25 lands. The test harness pattern matches the existing `useUserPenTool.test.tsx`.

- [ ] **Step 3: Implement the tests fully**

Copy the test-harness setup from `src/tools/builtin/useUserPenTool.test.tsx`. The existing tests already drive the pen tool through pointer events; reuse that. Fill in the bodies per the comments above.

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/tools/builtin/useUserPenTool.edit.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all green.

- [ ] **Step 6: Verify final typecheck and prepublish**

Run: `npx tsc --noEmit 2>&1 | grep -E "useUserPenTool|penEdit|features/paths/(anchors|cubicMath)|core/ops/setPath" | head`
Expected: empty.

- [ ] **Step 7: Commit**

```bash
git add src/tools/builtin/useUserPenTool.edit.test.tsx
git commit -m "test(pen): end-to-end pen-edit integration — enter, mutate, undo, trapdoor"
```

---

## Final Verification

- [ ] **Run the kit's full prepublish gate**

```bash
npx tsc --noEmit && npx vitest run && npx tsup build
```

Expected: all clean. (Pre-existing test-file typecheck errors documented earlier in the repo may remain — verify no new errors in the files this plan touches.)

- [ ] **Manual UAT in Swillustrator**

Open `apps/swillustrator`, run `npm run dev`, walk through the smoke-test steps from Task 26's Step 4. Compare against the spec's expected behaviors. File any discrepancies as follow-up issues.

- [ ] **Update `docs/TODO.md` to reflect completion**

Mark the pen-edit-mode item complete (the exact heading/format mirrors the file's existing patterns).

```bash
# Edit docs/TODO.md to check off the pen-edit-mode entry
git add docs/TODO.md
git commit -m "docs(todo): mark pen-edit-mode complete"
```
