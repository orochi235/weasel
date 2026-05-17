# Lasso Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a free-form polygon (lasso) selection primitive — a sibling to `useAreaSelect` — composed of a gesture hook, a default behavior, an opt-in adapter method with an `arrayAdapter` default, and a Tool wrapper with overlay chrome.

**Architecture:** New gesture hook `useLassoSelect` builds on the kit's `useDragGesture` primitive. Gesture vertices are distance-throttled and stashed under `ctx.scratch['lassoSelect.vertices']`. A `selectFromLasso` behavior reads them in `onEnd` and dispatches `hitTestLasso(polygon, mode)` against an opt-in `LassoSelectAdapter`. `arrayAdapter` ships a default `hitTestLasso` implementation built on `pointInPath` (kit's existing primitive) plus a polygon-vs-AABB intersection test. `useLassoTool` wraps the gesture hook, owns its overlay layer (live polyline + dashed close-line), and declares `keybinding: 'L'`.

**Tech Stack:** React 18 hooks, TypeScript, Vitest, `@testing-library/react`. Kit primitives: `useDragGesture`, `pointInPath` (`src/features/paths/`), `polygonFromPoints`, `applyOpsTo`, `defineTool`, `RenderLayer`/DrawCommand pipeline.

**Spec:** `docs/superpowers/specs/2026-05-09-lasso-tool-design.md`

---

## File Structure

**Create:**
- `src/features/paths/polygonHitTestRect.ts` — polygon-vs-AABB helpers (`polygonContainsRectCenter`, `polygonContainsRect`, `polygonIntersectsRect`).
- `src/features/paths/polygonHitTestRect.test.ts`
- `src/interactions/actions/lasso-select/lassoSelect.ts` — `useLassoSelect` hook.
- `src/interactions/actions/lasso-select/lassoSelect.test.ts`
- `src/interactions/actions/lasso-select/index.ts` — barrel.
- `src/interactions/actions/lasso-select/behaviors/selectFromLasso.ts`
- `src/interactions/actions/lasso-select/behaviors/selectFromLasso.test.ts`
- `src/tools/builtin/useLassoTool.ts`
- `src/tools/builtin/useLassoTool.test.tsx`

**Modify:**
- `src/core/adapters/types.ts` — add `LassoHitMode`, `LassoSelectAdapter`.
- `src/core/adapters/arrayAdapter.ts` — wire `hitTestLasso` default.
- `src/core/adapters/arrayAdapter.test.ts` — add lasso hit-test tests.
- `src/interactions/gestures/types.ts` — add `LassoSelectPose`, `LassoSelectProposed`, `LassoSelectMoveResult`, `LassoSelectBehavior`, `LassoSelectOverlay`.
- `src/index.ts` — re-export public surface.
- `src/features/paths/index.ts` — re-export polygon helpers.
- `docs/TODO.md` — mark "Lasso (non-rectangular) area-select" shipped.

---

### Task 1: Polygon hit-test helpers

Pure-function helpers used by `arrayAdapter.hitTestLasso`. Tests-first; no React or kit dependencies.

**Files:**
- Create: `src/features/paths/polygonHitTestRect.ts`
- Test: `src/features/paths/polygonHitTestRect.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/paths/polygonHitTestRect.test.ts
import { describe, expect, it } from 'vitest';
import {
  polygonContainsRectCenter,
  polygonContainsRect,
  polygonIntersectsRect,
} from './polygonHitTestRect';

const SQUARE = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe('polygonContainsRectCenter', () => {
  it('returns true when rect center is inside polygon', () => {
    expect(polygonContainsRectCenter(SQUARE, { x: 4, y: 4, width: 2, height: 2 })).toBe(true);
  });
  it('returns false when rect center is outside polygon', () => {
    expect(polygonContainsRectCenter(SQUARE, { x: 20, y: 20, width: 2, height: 2 })).toBe(false);
  });
  it('returns false on degenerate polygon (< 3 vertices)', () => {
    expect(polygonContainsRectCenter([{ x: 0, y: 0 }, { x: 1, y: 1 }], { x: 0, y: 0, width: 1, height: 1 })).toBe(false);
  });
});

describe('polygonContainsRect', () => {
  it('returns true when all four rect corners are inside polygon', () => {
    expect(polygonContainsRect(SQUARE, { x: 2, y: 2, width: 4, height: 4 })).toBe(true);
  });
  it('returns false when any corner is outside polygon', () => {
    expect(polygonContainsRect(SQUARE, { x: 8, y: 8, width: 4, height: 4 })).toBe(false);
  });
  it('returns false on a non-convex polygon when rect spans the concavity', () => {
    // L-shape: outer corners at (0,0)(10,0)(10,4)(4,4)(4,10)(0,10).
    const L = [
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 },
      { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 },
    ];
    // A rect centered at (6, 6) is outside the L's filled region.
    expect(polygonContainsRect(L, { x: 5, y: 5, width: 2, height: 2 })).toBe(false);
  });
});

describe('polygonIntersectsRect', () => {
  it('returns true when rect is fully inside polygon', () => {
    expect(polygonIntersectsRect(SQUARE, { x: 2, y: 2, width: 4, height: 4 })).toBe(true);
  });
  it('returns true when polygon is fully inside rect', () => {
    expect(polygonIntersectsRect(SQUARE, { x: -5, y: -5, width: 30, height: 30 })).toBe(true);
  });
  it('returns true when an edge crosses', () => {
    // Rect straddles the right edge of the square.
    expect(polygonIntersectsRect(SQUARE, { x: 8, y: 4, width: 6, height: 2 })).toBe(true);
  });
  it('returns false when fully outside and disjoint', () => {
    expect(polygonIntersectsRect(SQUARE, { x: 20, y: 20, width: 4, height: 4 })).toBe(false);
  });
  it('returns false on degenerate polygon (< 3 vertices)', () => {
    expect(polygonIntersectsRect([{ x: 0, y: 0 }, { x: 1, y: 1 }], { x: 0, y: 0, width: 1, height: 1 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/paths/polygonHitTestRect.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement helpers**

```ts
// src/features/paths/polygonHitTestRect.ts
/**
 * Polygon-vs-axis-aligned-rect tests. Pure functions; no React/kit deps.
 *
 * `polygon` is a closed polyline given as an ordered vertex array; the
 * closing edge from `polygon[N-1]` to `polygon[0]` is implicit. Even-odd
 * fill rule (matches `pointInPath`).
 */

export interface Vec2 { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }

/** Even-odd ray-cast point-in-polygon. Closing edge implicit. */
function pointInPolygon(poly: ReadonlyArray<Vec2>, px: number, py: number): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const crosses =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function polygonContainsRectCenter(poly: ReadonlyArray<Vec2>, rect: Rect): boolean {
  return pointInPolygon(poly, rect.x + rect.width / 2, rect.y + rect.height / 2);
}

export function polygonContainsRect(poly: ReadonlyArray<Vec2>, rect: Rect): boolean {
  if (poly.length < 3) return false;
  const corners: Vec2[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  for (const c of corners) {
    if (!pointInPolygon(poly, c.x, c.y)) return false;
  }
  // All corners are inside, but a non-convex polygon could still cut the rect.
  // If any polygon edge intersects any rect edge, rect is not fully contained.
  return !anyPolyEdgeCrossesRect(poly, rect);
}

export function polygonIntersectsRect(poly: ReadonlyArray<Vec2>, rect: Rect): boolean {
  if (poly.length < 3) return false;
  // Quick AABB reject.
  const ab = polygonAabb(poly);
  if (ab.x + ab.width < rect.x || ab.x > rect.x + rect.width) return false;
  if (ab.y + ab.height < rect.y || ab.y > rect.y + rect.height) return false;
  // Any polygon vertex inside rect?
  for (const v of poly) {
    if (v.x >= rect.x && v.x <= rect.x + rect.width &&
        v.y >= rect.y && v.y <= rect.y + rect.height) return true;
  }
  // Any rect corner inside polygon?
  if (polygonContainsRectCenter(poly, { x: rect.x, y: rect.y, width: 0, height: 0 })) return true;
  if (pointInPolygon(poly, rect.x, rect.y)) return true;
  if (pointInPolygon(poly, rect.x + rect.width, rect.y)) return true;
  if (pointInPolygon(poly, rect.x + rect.width, rect.y + rect.height)) return true;
  if (pointInPolygon(poly, rect.x, rect.y + rect.height)) return true;
  // Edge-vs-edge crossings.
  return anyPolyEdgeCrossesRect(poly, rect);
}

function polygonAabb(poly: ReadonlyArray<Vec2>): Rect {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of poly) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function anyPolyEdgeCrossesRect(poly: ReadonlyArray<Vec2>, rect: Rect): boolean {
  const r0 = { x: rect.x, y: rect.y };
  const r1 = { x: rect.x + rect.width, y: rect.y };
  const r2 = { x: rect.x + rect.width, y: rect.y + rect.height };
  const r3 = { x: rect.x, y: rect.y + rect.height };
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i];
    if (segmentsCross(a, b, r0, r1)) return true;
    if (segmentsCross(a, b, r1, r2)) return true;
    if (segmentsCross(a, b, r2, r3)) return true;
    if (segmentsCross(a, b, r3, r0)) return true;
  }
  return false;
}

function segmentsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const d1 = sign((d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x));
  const d2 = sign((d.x - c.x) * (b.y - c.y) - (d.y - c.y) * (b.x - c.x));
  const d3 = sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  const d4 = sign((b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x));
  return d1 !== d2 && d3 !== d4;
}

function sign(n: number): -1 | 0 | 1 {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/paths/polygonHitTestRect.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/paths/polygonHitTestRect.ts src/features/paths/polygonHitTestRect.test.ts
git commit -m "$(cat <<'EOF'
feat(paths): polygon-vs-rect hit-test helpers

polygonContainsRectCenter / polygonContainsRect / polygonIntersectsRect.
Pure functions, even-odd fill rule, ready to back hitTestLasso modes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: LassoSelectAdapter type

Adapter contract addition. Type-only — no runtime change.

**Files:**
- Modify: `src/core/adapters/types.ts`

- [ ] **Step 1: Append the new types**

After the existing `AreaSelectAdapter` block (around line 157), append:

```ts
/**
 * Hit mode for `LassoSelectAdapter.hitTestLasso`:
 *   - 'centers'   — bounds center inside polygon.
 *   - 'intersect' — bounds intersect polygon (any overlap).
 *   - 'enclosed'  — bounds fully inside polygon.
 */
export type LassoHitMode = 'centers' | 'intersect' | 'enclosed';

/**
 * Narrow adapter for `useLassoSelect`. Extends `AreaSelectAdapter` with a
 * polygon hit-test method. Transient — uses `applyOps` like its rectangular
 * sibling. `hitTestLasso` is optional; when omitted, `useLassoTool` skips
 * wiring the default behavior (same opt-in pattern as `hitTestArea`).
 */
export interface LassoSelectAdapter extends AreaSelectAdapter {
  /** Hit-test against a closed polygon. Vertex order may be CW or CCW; the
   *  closing edge from last → first is implicit. */
  hitTestLasso?(
    polygon: ReadonlyArray<{ x: number; y: number }>,
    mode: LassoHitMode,
  ): string[];
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean — no errors.

- [ ] **Step 3: Commit**

```bash
git add src/core/adapters/types.ts
git commit -m "$(cat <<'EOF'
feat(adapters): LassoSelectAdapter contract

Adds optional hitTestLasso(polygon, mode) method on a new
LassoSelectAdapter (extends AreaSelectAdapter) with a closed
LassoHitMode enum: centers / intersect / enclosed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: arrayAdapter `hitTestLasso` default

Wire the polygon helpers into `arrayAdapter`'s synthesized object so trivial consumers get a working lasso with no extra config.

**Files:**
- Modify: `src/core/adapters/arrayAdapter.ts`
- Test: `src/core/adapters/arrayAdapter.test.ts`

- [ ] **Step 1: Find the existing arrayAdapter test file and add cases**

Check the existing `arrayAdapter.test.ts` for test setup conventions — locate the test at the `hitTestArea` block and add a sibling `describe('hitTestLasso')` block. Append these tests:

```ts
// inside arrayAdapter.test.ts, alongside the existing hitTestArea tests
describe('hitTestLasso', () => {
  // Three squares: A(0..10), B(20..30), C(40..50) along x; all y(0..10).
  function makeFixture() {
    type Obj = { id: string; x: number; y: number; width: number; height: number };
    const items: Obj[] = [
      { id: 'a', x: 0,  y: 0, width: 10, height: 10 },
      { id: 'b', x: 20, y: 0, width: 10, height: 10 },
      { id: 'c', x: 40, y: 0, width: 10, height: 10 },
    ];
    const ref = { current: items };
    const setItems = () => {};
    const adapter = arrayAdapter<Obj, Obj>({
      itemsRef: ref,
      setItems,
      toPose: (o) => o,
      fromPose: (o, p) => ({ ...o, ...p }),
      poseBounds: (p) => p,
    });
    return adapter;
  }

  it('centers mode: lasso over rect A picks only A', () => {
    const adapter = makeFixture();
    const hits = adapter.hitTestLasso!(
      [{ x: -5, y: -5 }, { x: 15, y: -5 }, { x: 15, y: 15 }, { x: -5, y: 15 }],
      'centers',
    );
    expect(hits).toEqual(['a']);
  });

  it('enclosed mode: only fully-contained rects are returned', () => {
    const adapter = makeFixture();
    // Polygon spans x = -5..35, fully contains A and B; clips C.
    const hits = adapter.hitTestLasso!(
      [{ x: -5, y: -5 }, { x: 35, y: -5 }, { x: 35, y: 15 }, { x: -5, y: 15 }],
      'enclosed',
    );
    expect(hits.sort()).toEqual(['a', 'b']);
  });

  it('intersect mode: includes rects whose edges cross the polygon', () => {
    const adapter = makeFixture();
    // Polygon clips into B's right half; should still hit B.
    const hits = adapter.hitTestLasso!(
      [{ x: 25, y: -5 }, { x: 35, y: -5 }, { x: 35, y: 15 }, { x: 25, y: 15 }],
      'intersect',
    );
    expect(hits).toEqual(['b']);
  });

  it('degenerate polygon (< 3 vertices) returns []', () => {
    const adapter = makeFixture();
    expect(adapter.hitTestLasso!([{ x: 0, y: 0 }, { x: 1, y: 1 }], 'intersect')).toEqual([]);
  });
});
```

(If the test file's `arrayAdapter` factory call shape differs from the harness above, adapt to match — preserve the three-rect fixture and the four assertions.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/adapters/arrayAdapter.test.ts`
Expected: FAIL — `adapter.hitTestLasso` is undefined.

- [ ] **Step 3: Implement `hitTestLasso` in `arrayAdapter`**

Add to `src/core/adapters/arrayAdapter.ts`:

1. Update the imports at the top:

```ts
import type {
  AreaSelectAdapter,
  InsertAdapter,
  LassoHitMode,
  LassoSelectAdapter,
  MoveAdapter,
  ResizeAdapter,
} from './types';
import {
  polygonContainsRect,
  polygonContainsRectCenter,
  polygonIntersectsRect,
} from '../../features/paths/polygonHitTestRect';
```

2. Add `hitTestLasso` to the synthesized adapter, right after `hitTestArea` (around line 154):

```ts
    hitTestLasso: (polygon, mode: LassoHitMode) => {
      if (polygon.length < 3) return [];
      const out: string[] = [];
      for (const o of ref.current) {
        const pose = toPose(o);
        const b = poseBounds(pose);
        const hit =
          mode === 'centers' ? polygonContainsRectCenter(polygon, b) :
          mode === 'enclosed' ? polygonContainsRect(polygon, b) :
          polygonIntersectsRect(polygon, b);
        if (hit) out.push(o.id);
      }
      return out;
    },
```

3. Update the adapter's declared return type so consumers see `hitTestLasso` on the synthesized shape. If the function currently returns `AreaSelectAdapter & ...`, add `LassoSelectAdapter` to the intersection — or, if it's an inline object literal, the new method just shows up structurally. Check the existing type annotation; preserve the explicit-vs-inferred style already there.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/adapters/arrayAdapter.test.ts`
Expected: PASS — all four new tests green plus existing tests untouched.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/core/adapters/arrayAdapter.ts src/core/adapters/arrayAdapter.test.ts
git commit -m "$(cat <<'EOF'
feat(adapters): arrayAdapter ships default hitTestLasso

Routes through polygonHitTestRect helpers, applying the requested mode
(centers / intersect / enclosed) to each item's bounds. Trivial consumers
get lasso selection out of the box; spatial-index consumers can still
override hitTestLasso on their own adapters.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Lasso gesture types

Type-only changes to `src/interactions/gestures/types.ts`. These are referenced by `useLassoSelect`, `selectFromLasso`, and `useLassoTool` later.

**Files:**
- Modify: `src/interactions/gestures/types.ts`

- [ ] **Step 1: Append the lasso-select types**

Find the existing `// ----- area-select -----` block (around line 225). Add a new `// ----- lasso-select -----` block right after the area-select section (i.e. after the `AreaSelectOverlay` interface):

```ts
// ----- lasso-select -----

/** Pose carried through lasso-select gestures: the world point under the
 *  cursor at gesture start, plus the shift-key state at start. */
export interface LassoSelectPose {
  worldX: number;
  worldY: number;
  shiftHeld: boolean;
}

/** Per-frame proposed lasso state: full vertex history + shift policy. */
export interface LassoSelectProposed {
  vertices: ReadonlyArray<{ x: number; y: number }>;
  shiftHeld: boolean;
}

/** onMove for lasso-select doesn't shape ops; behaviors only need to react
 *  in onEnd. We return void from onMove. */
export type LassoSelectMoveResult = void;

/** A behavior plugged into `useLassoSelect`. */
export type LassoSelectBehavior = ActionBehavior<
  LassoSelectPose,
  LassoSelectProposed,
  LassoSelectMoveResult
>;

/** Live overlay state exposed by `useLassoSelect` for rendering the
 *  in-progress polyline + dashed close-line. */
export interface LassoSelectOverlay {
  vertices: ReadonlyArray<{ x: number; y: number }>;
  current: { worldX: number; worldY: number };
  shiftHeld: boolean;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/interactions/gestures/types.ts
git commit -m "$(cat <<'EOF'
feat(gestures): lasso-select gesture types

LassoSelectPose / LassoSelectProposed / LassoSelectBehavior /
LassoSelectOverlay — sibling to the area-select shapes; vertex array is
the load-bearing addition.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `useLassoSelect` hook

Gesture hook built on `useDragGesture`. Distance-throttled vertex sampling, `start` / `move` / `end` / `cancel` lifecycle, behaviors plugged through the existing `ActionBehavior` shape, vertex array stashed in `ctx.scratch['lassoSelect.vertices']` for behaviors to read.

**Files:**
- Create: `src/interactions/actions/lasso-select/lassoSelect.ts`
- Create: `src/interactions/actions/lasso-select/lassoSelect.test.ts`
- Create: `src/interactions/actions/lasso-select/index.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/interactions/actions/lasso-select/lassoSelect.test.ts
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLassoSelect } from './lassoSelect';
import type { LassoSelectAdapter } from '../../../core/adapters/types';
import type { LassoSelectBehavior } from '../types';

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };
const SHIFT = { ...NO_MOD, shift: true };

function makeAdapter(): LassoSelectAdapter {
  return {
    hitTestLasso: () => [],
    hitTestArea: () => [],
    getSelection: () => [],
    setSelection: () => {},
    applyOps: () => {},
  };
}

describe('useLassoSelect', () => {
  it('start sets isLassoSelecting + overlay seeded with start vertex', () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useLassoSelect(adapter, { behaviors: [] }));
    expect(result.current.isLassoSelecting).toBe(false);
    act(() => { result.current.start(1, 2, NO_MOD); });
    expect(result.current.isLassoSelecting).toBe(true);
    expect(result.current.overlay).not.toBeNull();
    expect(result.current.overlay!.vertices).toEqual([{ x: 1, y: 2 }]);
    expect(result.current.overlay!.shiftHeld).toBe(false);
  });

  it('move appends a vertex when distance ≥ minVertexSpacing', () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useLassoSelect(adapter, { behaviors: [], minVertexSpacing: 2 }));
    act(() => { result.current.start(0, 0, NO_MOD); });
    act(() => { result.current.move(1, 0, NO_MOD); });   // 1px — skipped
    expect(result.current.overlay!.vertices).toHaveLength(1);
    act(() => { result.current.move(3, 0, NO_MOD); });   // 3px — appended
    expect(result.current.overlay!.vertices).toEqual([{ x: 0, y: 0 }, { x: 3, y: 0 }]);
    act(() => { result.current.move(3.5, 0, NO_MOD); }); // 0.5px — skipped
    expect(result.current.overlay!.vertices).toHaveLength(2);
  });

  it('minVertexSpacing: 0 records every move sample', () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useLassoSelect(adapter, { behaviors: [], minVertexSpacing: 0 }));
    act(() => { result.current.start(0, 0, NO_MOD); });
    act(() => { result.current.move(0.1, 0, NO_MOD); });
    act(() => { result.current.move(0.2, 0, NO_MOD); });
    expect(result.current.overlay!.vertices).toHaveLength(3);
  });

  it('cancel clears overlay; behaviors do not see onEnd', () => {
    const adapter = makeAdapter();
    const onEnd = vi.fn();
    const beh: LassoSelectBehavior = { onEnd };
    const { result } = renderHook(() => useLassoSelect(adapter, { behaviors: [beh] }));
    act(() => { result.current.start(0, 0, NO_MOD); });
    act(() => { result.current.move(5, 0, NO_MOD); });
    act(() => { result.current.cancel(); });
    expect(result.current.isLassoSelecting).toBe(false);
    expect(result.current.overlay).toBeNull();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('end invokes behavior onEnd with vertex history visible in scratch', () => {
    const adapter = makeAdapter();
    let seenVertices: unknown = null;
    const beh: LassoSelectBehavior = {
      onEnd: (ctx) => {
        seenVertices = (ctx.scratch as { 'lassoSelect.vertices'?: unknown })['lassoSelect.vertices'];
        return null;
      },
    };
    const { result } = renderHook(() => useLassoSelect(adapter, { behaviors: [beh], minVertexSpacing: 0 }));
    act(() => { result.current.start(0, 0, NO_MOD); });
    act(() => { result.current.move(5, 0, NO_MOD); });
    act(() => { result.current.move(5, 5, NO_MOD); });
    act(() => { result.current.end(); });
    expect(seenVertices).toEqual([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }]);
  });

  it('shift held at start is captured on the pose, propagated through end', () => {
    const adapter = makeAdapter();
    let seenShift: boolean | null = null;
    const beh: LassoSelectBehavior = {
      onEnd: (ctx) => {
        seenShift = (ctx.origin.get('gesture') as { shiftHeld: boolean }).shiftHeld;
        return null;
      },
    };
    const { result } = renderHook(() => useLassoSelect(adapter, { behaviors: [beh] }));
    act(() => { result.current.start(0, 0, SHIFT); });
    act(() => { result.current.move(5, 5, NO_MOD); });
    act(() => { result.current.end(); });
    expect(seenShift).toBe(true);
  });

  it('end commits ops via applyOps when behavior returns Op[] (transient default)', () => {
    const applyOps = vi.fn();
    const adapter: LassoSelectAdapter = { ...makeAdapter(), applyOps };
    const beh: LassoSelectBehavior = {
      defaultTransient: true,
      onEnd: () => [{ apply: () => {}, invert: () => null, label: undefined } as never],
    };
    const { result } = renderHook(() => useLassoSelect(adapter, { behaviors: [beh] }));
    act(() => { result.current.start(0, 0, NO_MOD); });
    act(() => { result.current.move(5, 5, NO_MOD); });
    act(() => { result.current.end(); });
    expect(applyOps).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/interactions/actions/lasso-select/lassoSelect.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the hook**

```ts
// src/interactions/actions/lasso-select/lassoSelect.ts
import { useMemo, useRef, useState } from 'react';
import type { Op } from '../../../core/ops/types';
import type { LassoSelectAdapter } from '../../../core/adapters/types';
import type {
  GestureContext,
  LassoSelectBehavior,
  LassoSelectOverlay,
  LassoSelectPose,
  ModifierState,
} from '../types';
import type { DebugSink } from '../../../debug/types';

const GID = 'gesture';
const SCRATCH_KEY = 'lassoSelect.vertices';

/** Options for `useLassoSelect`. */
export interface UseLassoSelectOptions {
  behaviors?: LassoSelectBehavior[];
  /** When set, overrides any behavior's `defaultTransient`. */
  transient?: boolean;
  /** Label used when transient is false and the hook falls back to applyBatch. Default 'Lasso select'. */
  label?: string;
  onGestureStart?: () => void;
  onGestureEnd?: (committed: boolean) => void;
  /** Skip vertices closer than this many world-px to the previous one.
   *  Default 2. Set 0 to record every move sample. */
  minVertexSpacing?: number;
  /** Optional debug sink; receives the live polygon AABB on every move. */
  debug?: DebugSink;
}

export interface LassoSelectController {
  start(worldX: number, worldY: number, modifiers: ModifierState): void;
  move(worldX: number, worldY: number, modifiers: ModifierState): boolean;
  end(): void;
  cancel(): void;
  isLassoSelecting: boolean;
  overlay: LassoSelectOverlay | null;
  adapter: LassoSelectAdapter;
}

interface State {
  vertices: { x: number; y: number }[];
  startPose: LassoSelectPose;
  modifiers: ModifierState;
  current: { worldX: number; worldY: number };
}

export function useLassoSelect(
  adapter: LassoSelectAdapter,
  options: UseLassoSelectOptions = {},
): LassoSelectController {
  const optsRef = useRef(options);
  optsRef.current = options;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  const stateRef = useRef<State | null>(null);
  const [, bump] = useState(0);
  const force = () => bump((n) => n + 1);

  const buildGestureCtx = (s: State): GestureContext<LassoSelectPose> => ({
    draggedIds: [GID],
    origin: new Map([[GID, s.startPose]]),
    current: new Map([[GID, { worldX: s.current.worldX, worldY: s.current.worldY, shiftHeld: s.startPose.shiftHeld }]]),
    snap: null,
    modifiers: s.modifiers,
    pointer: { worldX: s.current.worldX, worldY: s.current.worldY, clientX: 0, clientY: 0 },
    adapter: adapterRef.current as unknown as GestureContext<LassoSelectPose>['adapter'],
    scratch: { [SCRATCH_KEY]: s.vertices },
  });

  const start = (worldX: number, worldY: number, modifiers: ModifierState): void => {
    const startPose: LassoSelectPose = { worldX, worldY, shiftHeld: modifiers.shift };
    stateRef.current = {
      vertices: [{ x: worldX, y: worldY }],
      startPose,
      modifiers,
      current: { worldX, worldY },
    };
    optsRef.current.onGestureStart?.();
    const ctx = buildGestureCtx(stateRef.current);
    for (const b of optsRef.current.behaviors ?? []) b.onStart?.(ctx);
    force();
  };

  const move = (worldX: number, worldY: number, modifiers: ModifierState): boolean => {
    const s = stateRef.current;
    if (!s) return false;
    s.modifiers = modifiers;
    s.current = { worldX, worldY };
    const minSpacing = optsRef.current.minVertexSpacing ?? 2;
    const last = s.vertices[s.vertices.length - 1];
    const dx = worldX - last.x;
    const dy = worldY - last.y;
    if (minSpacing === 0 || dx * dx + dy * dy >= minSpacing * minSpacing) {
      s.vertices.push({ x: worldX, y: worldY });
    }
    const ctx = buildGestureCtx(s);
    for (const b of optsRef.current.behaviors ?? []) {
      b.onMove?.(ctx, { vertices: s.vertices, shiftHeld: s.startPose.shiftHeld });
    }
    if (optsRef.current.debug && s.vertices.length >= 2) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const v of s.vertices) {
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.x > maxX) maxX = v.x;
        if (v.y > maxY) maxY = v.y;
      }
      optsRef.current.debug.recordBounds('lasso-select', { x: minX, y: minY, width: maxX - minX, height: maxY - minY });
    }
    force();
    return true;
  };

  const end = (): void => {
    const s = stateRef.current;
    if (!s) return;
    const ctx = buildGestureCtx(s);
    let collected: Op[] | null | undefined;
    for (const b of optsRef.current.behaviors ?? []) {
      const r = b.onEnd?.(ctx);
      if (r === undefined) continue;
      collected = r;
      break;
    }
    let committed = false;
    if (collected != null && collected.length > 0) {
      const transient =
        optsRef.current.transient ?? (optsRef.current.behaviors ?? []).some((b) => b.defaultTransient === true);
      if (transient) {
        adapterRef.current.applyOps?.(collected);
      } else {
        const a = adapterRef.current as LassoSelectAdapter & { applyBatch?: (ops: Op[], label: string) => void };
        a.applyBatch?.(collected, optsRef.current.label ?? 'Lasso select');
      }
      committed = true;
    }
    stateRef.current = null;
    optsRef.current.onGestureEnd?.(committed);
    force();
  };

  const cancel = (): void => {
    if (!stateRef.current) return;
    stateRef.current = null;
    optsRef.current.onGestureEnd?.(false);
    force();
  };

  const overlay: LassoSelectOverlay | null = stateRef.current
    ? {
        vertices: stateRef.current.vertices,
        current: stateRef.current.current,
        shiftHeld: stateRef.current.startPose.shiftHeld,
      }
    : null;

  return useMemo<LassoSelectController>(
    () => ({
      start,
      move,
      end,
      cancel,
      get isLassoSelecting() { return stateRef.current !== null; },
      get overlay() {
        return stateRef.current
          ? {
              vertices: stateRef.current.vertices,
              current: stateRef.current.current,
              shiftHeld: stateRef.current.startPose.shiftHeld,
            }
          : null;
      },
      get adapter() { return adapterRef.current; },
    }),
    [],
  );
  // `overlay` is unused here on purpose — getter form on the controller is the live source.
  void overlay;
}
```

- [ ] **Step 4: Add the barrel**

```ts
// src/interactions/actions/lasso-select/index.ts
export { useLassoSelect } from './lassoSelect';
export type {
  LassoSelectController,
  UseLassoSelectOptions,
} from './lassoSelect';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/interactions/actions/lasso-select/lassoSelect.test.ts`
Expected: PASS — all seven tests green.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/interactions/actions/lasso-select/lassoSelect.ts \
        src/interactions/actions/lasso-select/lassoSelect.test.ts \
        src/interactions/actions/lasso-select/index.ts
git commit -m "$(cat <<'EOF'
feat(gestures): useLassoSelect hook

Free-form polygon gesture; distance-throttled vertex sampling
(minVertexSpacing default 2 world-px); behaviors plugged through the
standard ActionBehavior shape; vertex history stashed in
ctx.scratch['lassoSelect.vertices'] for behaviors to read in onEnd.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `selectFromLasso` behavior

Default behavior — replace selection (or extend with shift) using `hitTestLasso`. Mirrors `selectFromMarquee`'s contract.

**Files:**
- Create: `src/interactions/actions/lasso-select/behaviors/selectFromLasso.ts`
- Create: `src/interactions/actions/lasso-select/behaviors/selectFromLasso.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/interactions/actions/lasso-select/behaviors/selectFromLasso.test.ts
import { describe, expect, it, vi } from 'vitest';
import { selectFromLasso } from './selectFromLasso';
import type {
  GestureContext,
  LassoSelectPose,
} from '../../types';
import type { LassoSelectAdapter, LassoHitMode } from '../../../../core/adapters/types';

function ctx(opts: {
  vertices: { x: number; y: number }[];
  shiftHeld?: boolean;
  selection?: string[];
  hitTestLasso?: (poly: ReadonlyArray<{ x: number; y: number }>, mode: LassoHitMode) => string[];
}): GestureContext<LassoSelectPose> {
  const adapter: LassoSelectAdapter = {
    getSelection: () => opts.selection ?? [],
    setSelection: () => {},
    applyOps: () => {},
    hitTestLasso: opts.hitTestLasso ?? (() => []),
  };
  const startPose: LassoSelectPose = { worldX: 0, worldY: 0, shiftHeld: opts.shiftHeld ?? false };
  return {
    draggedIds: ['gesture'],
    origin: new Map([['gesture', startPose]]),
    current: new Map([['gesture', { ...startPose, worldX: 1, worldY: 1 }]]),
    snap: null,
    modifiers: { alt: false, shift: !!opts.shiftHeld, meta: false, ctrl: false },
    pointer: { worldX: 1, worldY: 1, clientX: 0, clientY: 0 },
    adapter: adapter as unknown as GestureContext<LassoSelectPose>['adapter'],
    scratch: { 'lassoSelect.vertices': opts.vertices },
  };
}

describe('selectFromLasso', () => {
  it('returns null when adapter has no hitTestLasso', () => {
    const beh = selectFromLasso();
    const c = ctx({ vertices: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }] });
    (c.adapter as unknown as LassoSelectAdapter).hitTestLasso = undefined;
    expect(beh.onEnd!(c)).toBeNull();
  });

  it('replaces selection with hits in non-shift mode', () => {
    const beh = selectFromLasso();
    const c = ctx({
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      selection: ['old'],
      hitTestLasso: () => ['a', 'b'],
    });
    const ops = beh.onEnd!(c)!;
    expect(ops).toHaveLength(1);
    let setTo: string[] = [];
    ops[0].apply({ setSelection: (ids: string[]) => { setTo = ids; } });
    expect(setTo).toEqual(['a', 'b']);
  });

  it('extends selection with hits when shift held', () => {
    const beh = selectFromLasso();
    const c = ctx({
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      selection: ['old'],
      shiftHeld: true,
      hitTestLasso: () => ['a', 'old'],
    });
    const ops = beh.onEnd!(c)!;
    let setTo: string[] = [];
    ops[0].apply({ setSelection: (ids: string[]) => { setTo = ids; } });
    expect(setTo).toEqual(['old', 'a']);
  });

  it('forwards mode option to hitTestLasso', () => {
    const fn = vi.fn(() => []);
    const beh = selectFromLasso({ mode: 'enclosed' });
    const c = ctx({
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      hitTestLasso: fn,
    });
    beh.onEnd!(c);
    expect(fn).toHaveBeenCalledWith(expect.anything(), 'enclosed');
  });

  it('default mode is intersect', () => {
    const fn = vi.fn(() => []);
    const beh = selectFromLasso();
    const c = ctx({
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      hitTestLasso: fn,
    });
    beh.onEnd!(c);
    expect(fn).toHaveBeenCalledWith(expect.anything(), 'intersect');
  });

  it('tiny lasso (< 3 vertices) clears selection', () => {
    const beh = selectFromLasso();
    const c = ctx({
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      selection: ['old'],
    });
    const ops = beh.onEnd!(c)!;
    let setTo: string[] = ['sentinel'];
    ops[0].apply({ setSelection: (ids: string[]) => { setTo = ids; } });
    expect(setTo).toEqual([]);
  });

  it('tiny lasso with shift held preserves selection', () => {
    const beh = selectFromLasso();
    const c = ctx({
      vertices: [{ x: 0, y: 0 }],
      selection: ['old'],
      shiftHeld: true,
    });
    const ops = beh.onEnd!(c)!;
    let setTo: string[] = [];
    ops[0].apply({ setSelection: (ids: string[]) => { setTo = ids; } });
    expect(setTo).toEqual(['old']);
  });

  it('vanishingly small AABB (< 4 world-units²) treated as click', () => {
    const beh = selectFromLasso();
    const c = ctx({
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],   // area 0.5
      selection: ['old'],
    });
    const ops = beh.onEnd!(c)!;
    let setTo: string[] = ['sentinel'];
    ops[0].apply({ setSelection: (ids: string[]) => { setTo = ids; } });
    expect(setTo).toEqual([]);
  });

  it('defaultTransient: true', () => {
    expect(selectFromLasso().defaultTransient).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/interactions/actions/lasso-select/behaviors/selectFromLasso.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the behavior**

```ts
// src/interactions/actions/lasso-select/behaviors/selectFromLasso.ts
import { createSetSelectionOp } from '../../../../core/ops/select';
import type { Op } from '../../../../core/ops/types';
import type { NodeId } from '../../../../core/scene/types';
import type {
  LassoHitMode,
  LassoSelectAdapter,
} from '../../../../core/adapters/types';
import type { LassoSelectBehavior } from '../../types';

const SCRATCH_KEY = 'lassoSelect.vertices';
const MIN_AREA = 4;

export interface SelectFromLassoOptions {
  /** Hit mode for `hitTestLasso`. Default 'intersect'. */
  mode?: LassoHitMode;
}

/** Default behavior for `useLassoSelect` / `useLassoTool`: replace selection
 *  with polygon hits, or extend the existing selection when shift is held at
 *  gesture start. Tiny / degenerate lassos behave like a click — clear (or
 *  preserve, with shift). */
export function selectFromLasso(opts?: SelectFromLassoOptions): LassoSelectBehavior {
  const mode: LassoHitMode = opts?.mode ?? 'intersect';
  return {
    defaultTransient: true,
    onEnd(ctx) {
      const adapter = ctx.adapter as unknown as LassoSelectAdapter;
      if (!adapter.getSelection || !adapter.hitTestLasso) return null;

      const vertices = (ctx.scratch as { [SCRATCH_KEY]?: ReadonlyArray<{ x: number; y: number }> })[SCRATCH_KEY] ?? [];
      const startPose = ctx.origin.get('gesture');
      const shiftHeld = startPose ? (startPose as { shiftHeld?: boolean }).shiftHeld === true : false;
      const from = adapter.getSelection();

      // Tiny / degenerate lassos behave like a click: clear (or preserve on shift).
      const tiny = vertices.length < 3 || polygonAabbArea(vertices) < MIN_AREA;
      if (tiny) {
        const to = shiftHeld ? from : [];
        const op: Op = createSetSelectionOp({ from: from as NodeId[], to: to as NodeId[] });
        return [op];
      }

      const hits = adapter.hitTestLasso(vertices, mode);
      const to = shiftHeld
        ? mergeUnique(from, hits)
        : hits;
      const op: Op = createSetSelectionOp({ from: from as NodeId[], to: to as NodeId[] });
      return [op];
    },
  };
}

function polygonAabbArea(vertices: ReadonlyArray<{ x: number; y: number }>): number {
  if (vertices.length === 0) return 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  return (maxX - minX) * (maxY - minY);
}

function mergeUnique(a: ReadonlyArray<string>, b: ReadonlyArray<string>): string[] {
  const out = [...a];
  for (const id of b) if (!out.includes(id)) out.push(id);
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/interactions/actions/lasso-select/behaviors/selectFromLasso.test.ts`
Expected: PASS — all nine tests green.

- [ ] **Step 5: Commit**

```bash
git add src/interactions/actions/lasso-select/behaviors/selectFromLasso.ts \
        src/interactions/actions/lasso-select/behaviors/selectFromLasso.test.ts
git commit -m "$(cat <<'EOF'
feat(gestures): selectFromLasso default behavior

Replace-or-extend selection from polygon hits via hitTestLasso. Tiny /
degenerate lassos (< 3 vertices, or AABB area < 4 world-units²) behave
like a click — clear (or preserve, with shift). Default mode 'intersect'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `useLassoTool` Tool wrapper

Wraps `useLassoSelect` with a Tool record: keybinding `'L'`, pointer dispatch, overlay layer (live polyline + dashed close-line in screen space), default behavior `selectFromLasso`.

**Files:**
- Create: `src/tools/builtin/useLassoTool.ts`
- Create: `src/tools/builtin/useLassoTool.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/tools/builtin/useLassoTool.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLassoTool } from './useLassoTool';
import type { LassoSelectAdapter } from '../../core/adapters/types';

function makeAdapter(hits: string[] = []): LassoSelectAdapter & { applyOps: ReturnType<typeof vi.fn> } {
  const applyOps = vi.fn();
  return {
    hitTestLasso: () => hits,
    hitTestArea: () => [],
    getSelection: () => [],
    setSelection: () => {},
    applyOps,
  };
}

const VIEW = { x: 0, y: 0, scale: 1 } as { x: number; y: number; scale: number };

describe('useLassoTool', () => {
  it("declares id 'lasso' and keybinding 'L' by default", () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useLassoTool(adapter));
    expect(result.current.id).toBe('lasso');
    expect(result.current.keybinding).toBe('L');
  });

  it('keybinding override: passing keybinding: null omits it', () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useLassoTool(adapter, { keybinding: null }));
    expect(result.current.keybinding).toBeUndefined();
  });

  it('pointer.onDown claims the gesture and starts lasso state', () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useLassoTool(adapter));
    const tool = result.current;
    const scratch = tool.initScratch?.() as never;
    let outcome: unknown;
    act(() => {
      outcome = tool.pointer!.onDown!(
        { clientX: 0, clientY: 0 } as PointerEvent,
        { worldX: 0, worldY: 0, modifiers: { alt: false, shift: false, meta: false, ctrl: false }, view: VIEW, scratch } as never,
      );
    });
    expect(outcome).toBe('claim');
  });

  it('pointer.onUp commits the gesture (applyOps called when behavior emits ops)', () => {
    const adapter = makeAdapter(['a']);
    const { result } = renderHook(() => useLassoTool(adapter, { minVertexSpacing: 0 }));
    const tool = result.current;
    const scratch = tool.initScratch?.() as never;
    const baseCtx = { modifiers: { alt: false, shift: false, meta: false, ctrl: false }, view: VIEW, scratch };
    act(() => {
      tool.pointer!.onDown!({ clientX: 0, clientY: 0 } as PointerEvent, { worldX: 0, worldY: 0, ...baseCtx } as never);
    });
    act(() => {
      tool.pointer!.onMove!({ clientX: 5, clientY: 0 } as PointerEvent, { worldX: 5, worldY: 0, ...baseCtx } as never);
    });
    act(() => {
      tool.pointer!.onMove!({ clientX: 5, clientY: 5 } as PointerEvent, { worldX: 5, worldY: 5, ...baseCtx } as never);
    });
    act(() => {
      tool.pointer!.onUp!({ clientX: 5, clientY: 5 } as PointerEvent, { worldX: 5, worldY: 5, ...baseCtx } as never);
    });
    expect(adapter.applyOps).toHaveBeenCalledTimes(1);
  });

  it('overlay layer is published on the Tool record', () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useLassoTool(adapter));
    expect(result.current.overlay).toBeTruthy();
    expect(result.current.overlay!.id).toBe('lasso-overlay');
    expect(result.current.overlay!.space).toBe('screen');
  });

  it("keyboard.onDown 'Escape' cancels mid-gesture without committing", () => {
    const adapter = makeAdapter(['a']);
    const { result } = renderHook(() => useLassoTool(adapter, { minVertexSpacing: 0 }));
    const tool = result.current;
    const scratch = tool.initScratch?.() as never;
    const baseCtx = { modifiers: { alt: false, shift: false, meta: false, ctrl: false }, view: VIEW, scratch };
    act(() => {
      tool.pointer!.onDown!({ clientX: 0, clientY: 0 } as PointerEvent, { worldX: 0, worldY: 0, ...baseCtx } as never);
    });
    act(() => {
      tool.pointer!.onMove!({ clientX: 5, clientY: 0 } as PointerEvent, { worldX: 5, worldY: 0, ...baseCtx } as never);
    });
    act(() => {
      tool.keyboard!.onDown!({ key: 'Escape' } as KeyboardEvent, { ...baseCtx } as never);
    });
    expect(adapter.applyOps).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tools/builtin/useLassoTool.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the Tool**

```ts
// src/tools/builtin/useLassoTool.ts
import { useMemo } from 'react';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import type { RenderLayer } from '../../core/layers/render';
import type { DrawCommand } from '@orochi235/weasel-gl';
import { viewToTransform } from '../../core/viewport/view';
import { worldToScreen } from '../../core/viewport/viewTransform';
import { PathBuilder } from '../../features/paths/builder';
import { useLassoSelect, type UseLassoSelectOptions } from '../../interactions/actions/lasso-select/lassoSelect';
import { selectFromLasso } from '../../interactions/actions/lasso-select/behaviors/selectFromLasso';
import type { LassoHitMode, LassoSelectAdapter } from '../../core/adapters/types';

export interface UseLassoToolOptions extends Pick<UseLassoSelectOptions,
  'behaviors' | 'transient' | 'label' | 'onGestureStart' | 'onGestureEnd' |
  'minVertexSpacing' | 'debug'> {
  /** Hit mode forwarded to the default `selectFromLasso` behavior when no
   *  explicit `behaviors` array is passed. Default 'intersect'. */
  mode?: LassoHitMode;
  /** Override the default keybinding ('L'). Pass `null` to omit. */
  keybinding?: string | null;
}

interface OverlayStyle {
  stroke: string;
  lineWidth: number;
  closeDash: number[];
  closeAlpha: number;
}

const DEFAULT_STYLE: OverlayStyle = {
  stroke: '#a48bd4',
  lineWidth: 1.5,
  closeDash: [4, 3],
  closeAlpha: 0.5,
};

/** Free-form polygon select Tool. Pointer-down claims the gesture; move
 *  appends vertices via `useLassoSelect`; pointerup commits via the default
 *  `selectFromLasso` behavior. Esc cancels without committing. */
export function useLassoTool(
  adapter: LassoSelectAdapter,
  options: UseLassoToolOptions = {},
): Tool<undefined> {
  const behaviors = options.behaviors ?? [selectFromLasso({ mode: options.mode ?? 'intersect' })];
  const ctl = useLassoSelect(adapter, {
    ...options,
    behaviors,
  });

  return useMemo(() => {
    const overlay: RenderLayer<unknown> = {
      id: 'lasso-overlay',
      label: 'Lasso overlay',
      space: 'screen',
      draw: (_data, view): DrawCommand[] => {
        const ov = ctl.overlay;
        if (!ov || ov.vertices.length === 0) return [];
        const t = viewToTransform(view);
        const cmds: DrawCommand[] = [];

        // Live polyline (vertices joined). Use PathBuilder so we don't have
        // to hand-encode the PolygonPath byte arrays.
        if (ov.vertices.length >= 2) {
          const b = new PathBuilder();
          const [sx0, sy0] = worldToScreen(ov.vertices[0].x, ov.vertices[0].y, t);
          b.moveTo(sx0, sy0);
          for (let i = 1; i < ov.vertices.length; i++) {
            const [sx, sy] = worldToScreen(ov.vertices[i].x, ov.vertices[i].y, t);
            b.lineTo(sx, sy);
          }
          cmds.push({
            kind: 'path',
            path: b.build(),
            stroke: { paint: { color: DEFAULT_STYLE.stroke }, width: DEFAULT_STYLE.lineWidth },
          });
        }

        // Dashed close-line: last vertex → first vertex.
        if (ov.vertices.length >= 2) {
          const last = ov.vertices[ov.vertices.length - 1];
          const first = ov.vertices[0];
          const [lx, ly] = worldToScreen(last.x, last.y, t);
          const [fx, fy] = worldToScreen(first.x, first.y, t);
          const closer = new PathBuilder().moveTo(lx, ly).lineTo(fx, fy).build();
          cmds.push({
            kind: 'path',
            path: closer,
            stroke: {
              paint: { color: DEFAULT_STYLE.stroke },
              width: DEFAULT_STYLE.lineWidth,
              dash: DEFAULT_STYLE.closeDash,
            },
            alpha: DEFAULT_STYLE.closeAlpha,
          } as DrawCommand);
        }
        return cmds;
      },
    };

    return defineTool({
      id: 'lasso',
      ...(options.keybinding === null ? {} : { keybinding: options.keybinding ?? 'L' }),
      cursor: () => 'crosshair',
      overlay,

      pointer: {
        onDown: (_e, c) => {
          ctl.start(c.worldX, c.worldY, c.modifiers);
          return 'claim';
        },
        onMove: (_e, c) => {
          if (!ctl.isLassoSelecting) return 'pass';
          ctl.move(c.worldX, c.worldY, c.modifiers);
          return 'claim';
        },
        onUp: (_e, _c) => {
          if (!ctl.isLassoSelecting) return 'pass';
          ctl.end();
          return 'claim';
        },
      },

      keyboard: {
        onDown: (e) => {
          if (e.key === 'Escape' && ctl.isLassoSelecting) {
            ctl.cancel();
            return 'claim';
          }
          return 'pass';
        },
      },
    });
  }, [ctl, options.keybinding]);
}

```

> No hand-rolled `polylineToPath` helper — `PathBuilder` from `src/features/paths/builder.ts` is the canonical way to construct a `PolygonPath` and it's already a public export. The `DrawCommand`'s `path` field accepts `Path` (`PolygonPath | RectPath`); `PathBuilder.build()` returns a `PolygonPath` directly.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tools/builtin/useLassoTool.test.tsx`
Expected: PASS — all six tests green.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/tools/builtin/useLassoTool.ts src/tools/builtin/useLassoTool.test.tsx
git commit -m "$(cat <<'EOF'
feat(tools): useLassoTool

Free-form polygon select Tool wrapping useLassoSelect. Default keybinding
'L'; pointerdown claims and starts the gesture; pointermove appends vertices
through the hook; pointerup commits via selectFromLasso (default mode
'intersect'); Esc cancels. Overlay renders live polyline + dashed close-line
in screen space.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Public barrel exports

Wire the new public surface into `src/index.ts` and `src/features/paths/index.ts`.

**Files:**
- Modify: `src/index.ts`
- Modify: `src/features/paths/index.ts`

- [ ] **Step 1: Re-export the polygon helpers from the paths barrel**

In `src/features/paths/index.ts`, append:

```ts
export {
  polygonContainsRectCenter,
  polygonContainsRect,
  polygonIntersectsRect,
} from './polygonHitTestRect';
```

- [ ] **Step 2: Re-export the lasso surface from the kit barrel**

Find the existing `useAreaSelect` / `selectFromMarquee` re-exports in `src/index.ts`. Add adjacent lines:

```ts
export { useLassoSelect } from './interactions/actions/lasso-select';
export type {
  LassoSelectController,
  UseLassoSelectOptions,
} from './interactions/actions/lasso-select';
export { selectFromLasso } from './interactions/actions/lasso-select/behaviors/selectFromLasso';
export type { SelectFromLassoOptions } from './interactions/actions/lasso-select/behaviors/selectFromLasso';
export { useLassoTool, type UseLassoToolOptions } from './tools/builtin/useLassoTool';
```

Find the existing `AreaSelectAdapter` type re-export and add `LassoSelectAdapter` and `LassoHitMode` next to it:

```ts
export type {
  AreaSelectAdapter,
  LassoSelectAdapter,
  LassoHitMode,
  // ... other adapter types as already listed
} from './core/adapters/types';
```

(Preserve the existing list — only add the two new names.)

Find the existing gesture-types re-export block and add the lasso shapes:

```ts
export type {
  // ... existing area-select types
  LassoSelectPose,
  LassoSelectProposed,
  LassoSelectMoveResult,
  LassoSelectBehavior,
  LassoSelectOverlay,
} from './interactions/gestures/types';
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Build the public bundle**

Run: `npm run build`
Expected: tsup build success; no `Cannot find name` warnings in DTS output.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/features/paths/index.ts
git commit -m "$(cat <<'EOF'
feat: expose lasso surface from kit barrel

Re-exports useLassoSelect, useLassoTool, selectFromLasso, the lasso gesture
types (Pose/Proposed/Behavior/Overlay), the LassoSelectAdapter contract,
LassoHitMode, and the polygon hit-test helpers (polygonContainsRectCenter
/ polygonContainsRect / polygonIntersectsRect).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Mark TODO entry shipped

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: Find and update the entry**

Locate the line `- **Lasso (non-rectangular) area-select.** Marquee select is rectangular only. Lasso draws an arbitrary polygon and selects items whose bounds intersect (or whose centers fall inside). Adjacent to the path/polygon work in Tier 1. Originally scoped in `docs/specs/2026-05-01-canvas-kit-area-select-clipboard-design.md:275`.`

Replace with:

```markdown
- [x] **Lasso (non-rectangular) area-select.** *Shipped.* `useLassoTool` (default keybinding `L`) wraps a free-form polygon `useLassoSelect` gesture with a `selectFromLasso` default behavior; the `LassoSelectAdapter.hitTestLasso(polygon, mode)` contract supports `centers` / `intersect` / `enclosed` semantics. `arrayAdapter` ships a default implementation built on `pointInPath` + a polygon-vs-AABB intersection test. Spec: `docs/superpowers/specs/2026-05-09-lasso-tool-design.md`. Polygonal-lasso click-to-add-vertices mode is deliberately deferred — composable later from `useLassoSelect`'s commit path + the pen tool's vertex-construction gesture; track as a separate spec.
```

- [ ] **Step 2: Commit**

```bash
git add docs/TODO.md
git commit -m "$(cat <<'EOF'
docs(todo): mark lasso (non-rectangular) area-select shipped

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Final verification

- [ ] **Step 1: Run the full release gate**

Run: `npm run prepublishOnly`
Expected: tsc clean, vitest fully green, tsup build clean.

- [ ] **Step 2: Smoke-check via the kit's existing demo runner (optional)**

If a lasso demo is added under `demo/demos/` it should be a follow-up — not in this plan. The unit and tool tests cover the integration.

- [ ] **Step 3: Push when the user requests it**

Do not push automatically.

---

## Notes for the executing engineer

- **`useDragGesture` vs hand-rolled state machine.** The plan uses a hand-rolled state machine inside `useLassoSelect` rather than `useDragGesture` because the lasso records vertex *history* — a list-shaped state that doesn't map cleanly onto the drag-gesture's `start`/`current` point pair. If the hand-rolled state machine grows beyond ~150 LOC during implementation, reconsider — `useDragGesture` could host the lifecycle + threshold logic and `useLassoSelect` could keep only the vertex array on top.
- **Polygon-path encoding.** Step 7's `polylineToPath` helper builds a `PolygonPath` directly. If `PolygonPath`'s wire shape (e.g. opcode integers, field names) doesn't match what's pasted, `src/features/paths/builder.ts`'s `PathBuilder` is the more portable construction path: `new PathBuilder().moveTo(...).lineTo(...).build()`. Use it if the direct encoding fights you.
- **`worldToScreen` / `viewToTransform`.** Both already exist in `src/core/viewport/`; `useSelectTool.ts` imports them the same way Step 7 shows. If the import path differs slightly, follow the existing import in `useSelectTool` exactly.
- **`PolygonPath` import in `useLassoTool`.** Imported as a type from `@orochi235/weasel-gl`. If the IDE flags the import, the kit's `@orochi235/weasel-gl` workspace package is local — the type lives in its public surface.
- **Tests for the click-fallthrough path inside `useLassoTool`.** Out of scope for this plan; the empty-space-vs-hit dispatch in Tool is consumer-driven via `pickEvery` etc. The behavior-side fallthrough (tiny-lasso → click) is covered by `selectFromLasso.test.ts`.
