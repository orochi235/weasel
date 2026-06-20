# Alignment Guides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-derive alignment guides from sibling + page bounds and snap a moving / inserted / resized object's edges and center to them, rendering the active line(s) during the gesture.

**Architecture:** A self-contained `src/features/guides/alignment/` module — pure derivation (`deriveAlignmentGuides`), a pure bounds-aware matcher (`matchAlignment`), and three behavior factories (move/insert/resize) that publish the matched line(s) to a consumer-held ref. Rendering reuses the existing `createGuidesLayer`. The manual-guide primitives are untouched.

**Tech Stack:** TypeScript, Vitest. Reuses `Guide` (`features/guides/types`), `meanScale` (`core/viewport/meanScale`), and the gesture behavior types (`interactions/gestures/types`).

**Spec:** `docs/superpowers/specs/2026-06-19-alignment-guides-design.md`

---

## File structure

```
src/features/guides/alignment/
  types.ts        AlignBounds, AlignAnchor, AlignMatchResult, AlignBoundsProjection,
                  DeriveAlignmentGuidesOptions, AlignmentBehaviorBase
  derive.ts       deriveAlignmentGuides()
  match.ts        matchAlignment(), RECT_ALIGN_PROJECTION, MOVE_ANCHORS
  behaviors.ts    alignMoveBehavior(), alignInsertBehavior(), alignResizeBehavior()
  index.ts        barrel
  derive.test.ts
  match.test.ts
  behaviors.test.ts
demo/demos/AlignmentGuidesDemo.tsx
```

Touch points: `src/features/guides/index.ts` and `src/index.ts` (barrel re-exports), `demo/registry.ts` (demo entry), `docs/TODO.md` (close item).

Reference patterns the implementer should read first:
- `src/interactions/gestures/shared/snap.ts` — how a move behavior reconstructs the proposed pose from a `GroupTransform` and returns `{ transform }`.
- `src/interactions/actions/resize/behaviors/snapToGuides.ts` — the resize edge-snap math (`width += d` vs `x += d; width -= d`) and the `BoundsConstraint` shape.
- `src/interactions/actions/insert/behaviors/snapToGuides.ts` — the insert `current`-point snap and `InsertBehavior` shape.
- `src/interactions/actions/move/behaviors/snapToGuides.test.ts` — the `GestureContext` mock used in behavior tests.
- `demo/demos/MoveSnapDemo.tsx` — `selectTool={{ move: { behaviors } }}` wiring.

---

## Task 1: Types + derivation

**Files:**
- Create: `src/features/guides/alignment/types.ts`
- Create: `src/features/guides/alignment/derive.ts`
- Test: `src/features/guides/alignment/derive.test.ts`

- [ ] **Step 1: Create the types module**

`src/features/guides/alignment/types.ts`:

```ts
import type { Guide } from '../types';
import type { View } from 'core/viewport/view';
import type { ModifierState } from '../../../interactions/gestures/types';

/** Axis-aligned bounding box. Rotation is ignored in v1 (alignment uses AABBs). */
export interface AlignBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Which feature of a box to test against candidates, per axis.
 *  'min' = left/top edge, 'center' = centerline, 'max' = right/bottom edge. */
export type AlignAnchor = 'min' | 'center' | 'max';

export interface AlignMatchResult {
  dx: number;
  dy: number;
  activeX: Guide | null;
  activeY: Guide | null;
}

/** Bounds analog of the gesture `OriginProjection`: reads an AABB from a pose
 *  and translates a pose. The rect default handles `{x,y,width,height}` poses;
 *  non-rect poses (Path, polygon) supply their own. */
export interface AlignBoundsProjection<TPose> {
  boundsOf(pose: TPose): AlignBounds;
  translate(pose: TPose, dx: number, dy: number): TPose;
}

export interface DeriveAlignmentGuidesOptions {
  /** Include the document/page box's edges + center as candidates. */
  page?: AlignBounds;
  /** Emit left/right (x) and top/bottom (y) edge guides. Default true. */
  edges?: boolean;
  /** Emit centerX (x) and centerY (y) guides. Default true. */
  centers?: boolean;
}

/** Common options shared by the three alignment behavior factories. */
export interface AlignmentBehaviorBase {
  /** Live candidate lines — consumer derives from current siblings + page. */
  getCandidates: () => readonly Guide[];
  /** Publish the currently-matched line(s). Called every onMove; cleared
   *  (`[]`) on a miss and on onEnd. */
  setActiveGuides: (guides: readonly Guide[]) => void;
  /** Tolerance (screen px when `getView` set, world units otherwise). */
  tolerance?: number;
  /** Read the active view; required for screen-pixel tolerance. */
  getView?: () => View;
  /** Modifier key that bypasses snapping while held. */
  bypassKey?: keyof ModifierState;
}
```

- [ ] **Step 2: Write the failing derivation test**

`src/features/guides/alignment/derive.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deriveAlignmentGuides } from './derive';

const box = { x: 10, y: 20, width: 100, height: 40 }; // L=10 cx=60 R=110 / T=20 cy=40 B=60

describe('deriveAlignmentGuides', () => {
  it('emits 3 x-guides and 3 y-guides for one target', () => {
    const g = deriveAlignmentGuides([box]);
    const xs = g.filter((q) => q.axis === 'x').map((q) => q.offset).sort((a, b) => a - b);
    const ys = g.filter((q) => q.axis === 'y').map((q) => q.offset).sort((a, b) => a - b);
    expect(xs).toEqual([10, 60, 110]);
    expect(ys).toEqual([20, 40, 60]);
  });

  it('edges:false drops the 4 edge guides, keeps the 2 centers', () => {
    const g = deriveAlignmentGuides([box], { edges: false });
    expect(g.filter((q) => q.axis === 'x').map((q) => q.offset)).toEqual([60]);
    expect(g.filter((q) => q.axis === 'y').map((q) => q.offset)).toEqual([40]);
  });

  it('centers:false drops the 2 center guides, keeps the 4 edges', () => {
    const g = deriveAlignmentGuides([box], { centers: false });
    expect(g.filter((q) => q.axis === 'x').map((q) => q.offset).sort((a, b) => a - b)).toEqual([10, 110]);
    expect(g.filter((q) => q.axis === 'y').map((q) => q.offset).sort((a, b) => a - b)).toEqual([20, 60]);
  });

  it('includes the page box edges + center', () => {
    const g = deriveAlignmentGuides([], { page: { x: 0, y: 0, width: 200, height: 200 } });
    const xs = g.filter((q) => q.axis === 'x').map((q) => q.offset).sort((a, b) => a - b);
    expect(xs).toEqual([0, 100, 200]);
  });

  it('dedups overlapping offsets to a single candidate', () => {
    // two boxes sharing left edge x=10
    const g = deriveAlignmentGuides([box, { x: 10, y: 300, width: 50, height: 50 }]);
    const leftTens = g.filter((q) => q.axis === 'x' && Math.abs(q.offset - 10) < 1e-6);
    expect(leftTens.length).toBe(1);
  });

  it('ids are stable and offset-derived', () => {
    const g = deriveAlignmentGuides([box]);
    const left = g.find((q) => q.axis === 'x' && q.offset === 10)!;
    expect(left.id).toBe('align:x:10.000');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/features/guides/alignment/derive.test.ts`
Expected: FAIL — `Failed to resolve import './derive'`.

- [ ] **Step 4: Implement `derive.ts`**

`src/features/guides/alignment/derive.ts`:

```ts
import type { Guide } from '../types';
import type { AlignBounds, DeriveAlignmentGuidesOptions } from './types';

const EPS = 1e-3;

/** Derive candidate alignment lines from a set of AABBs (siblings) plus an
 *  optional page box. Each box contributes up to 3 guides per axis: the two
 *  edges and the center. Overlapping offsets collapse to one candidate. */
export function deriveAlignmentGuides(
  targets: readonly AlignBounds[],
  opts: DeriveAlignmentGuidesOptions = {},
): Guide[] {
  const edges = opts.edges ?? true;
  const centers = opts.centers ?? true;
  // Dedup per axis: key = rounded offset. First writer wins (stable id).
  const seenX = new Map<number, Guide>();
  const seenY = new Map<number, Guide>();

  const add = (axis: 'x' | 'y', offset: number): void => {
    const seen = axis === 'x' ? seenX : seenY;
    const key = Math.round(offset / EPS);
    if (seen.has(key)) return;
    seen.set(key, { id: `align:${axis}:${offset.toFixed(3)}`, axis, offset });
  };

  const emit = (b: AlignBounds): void => {
    if (edges) {
      add('x', b.x);
      add('x', b.x + b.width);
      add('y', b.y);
      add('y', b.y + b.height);
    }
    if (centers) {
      add('x', b.x + b.width / 2);
      add('y', b.y + b.height / 2);
    }
  };

  for (const b of targets) emit(b);
  if (opts.page) emit(opts.page);

  return [...seenX.values(), ...seenY.values()];
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run src/features/guides/alignment/derive.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/guides/alignment/types.ts src/features/guides/alignment/derive.ts src/features/guides/alignment/derive.test.ts
git commit -m "feat(guides): alignment-guide derivation from sibling + page bounds"
```

---

## Task 2: The matcher

**Files:**
- Create: `src/features/guides/alignment/match.ts`
- Test: `src/features/guides/alignment/match.test.ts`

- [ ] **Step 1: Write the failing test**

`src/features/guides/alignment/match.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { matchAlignment, MOVE_ANCHORS } from './match';
import type { Guide } from '../types';

const box = { x: 100, y: 100, width: 50, height: 50 }; // L=100 cx=125 R=150

describe('matchAlignment', () => {
  it('snaps the left edge to a candidate within tolerance', () => {
    const cands: Guide[] = [{ id: 'a', axis: 'x', offset: 96 }];
    const m = matchAlignment(box, cands, 5, MOVE_ANCHORS);
    expect(m.dx).toBe(-4); // 96 - 100
    expect(m.activeX).toEqual(cands[0]);
    expect(m.dy).toBe(0);
    expect(m.activeY).toBeNull();
  });

  it('snaps the center when it is the closest feature', () => {
    const cands: Guide[] = [{ id: 'c', axis: 'x', offset: 123 }]; // near cx=125
    const m = matchAlignment(box, cands, 5, MOVE_ANCHORS);
    expect(m.dx).toBe(-2); // 123 - 125
    expect(m.activeX).toEqual(cands[0]);
  });

  it('snaps the right edge when it is the closest feature', () => {
    const cands: Guide[] = [{ id: 'r', axis: 'x', offset: 151 }]; // near R=150
    const m = matchAlignment(box, cands, 5, MOVE_ANCHORS);
    expect(m.dx).toBe(1); // 151 - 150
  });

  it('nearest candidate wins when several are in range', () => {
    const cands: Guide[] = [
      { id: 'far', axis: 'x', offset: 104 }, // 4 from L=100
      { id: 'near', axis: 'x', offset: 124 }, // 1 from cx=125
    ];
    const m = matchAlignment(box, cands, 6, MOVE_ANCHORS);
    expect(m.activeX!.id).toBe('near');
    expect(m.dx).toBe(-1);
  });

  it('resolves the two axes independently', () => {
    const cands: Guide[] = [
      { id: 'x', axis: 'x', offset: 100 }, // L exact
      { id: 'y', axis: 'y', offset: 98 }, // near T=100
    ];
    const m = matchAlignment(box, cands, 5, MOVE_ANCHORS);
    expect(m.dx).toBe(0);
    expect(m.activeX!.id).toBe('x');
    expect(m.dy).toBe(-2);
    expect(m.activeY!.id).toBe('y');
  });

  it('no match when all features are outside tolerance', () => {
    const cands: Guide[] = [{ id: 'a', axis: 'x', offset: 200 }];
    const m = matchAlignment(box, cands, 5, MOVE_ANCHORS);
    expect(m).toEqual({ dx: 0, dy: 0, activeX: null, activeY: null });
  });

  it('honors a restricted anchor set (resize: east edge only)', () => {
    const cands: Guide[] = [
      { id: 'l', axis: 'x', offset: 100 }, // would match L if 'min' allowed
      { id: 'r', axis: 'x', offset: 152 }, // matches R=150
    ];
    const m = matchAlignment(box, cands, 5, { x: ['max'], y: [] });
    expect(m.activeX!.id).toBe('r');
    expect(m.dx).toBe(2); // 152 - 150
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/guides/alignment/match.test.ts`
Expected: FAIL — `Failed to resolve import './match'`.

- [ ] **Step 3: Implement `match.ts`**

`src/features/guides/alignment/match.ts`:

```ts
import type { Guide } from '../types';
import type {
  AlignAnchor,
  AlignBounds,
  AlignBoundsProjection,
  AlignMatchResult,
} from './types';

/** Move/insert test all three features per axis. */
export const MOVE_ANCHORS: { x: readonly AlignAnchor[]; y: readonly AlignAnchor[] } = {
  x: ['min', 'center', 'max'],
  y: ['min', 'center', 'max'],
};

/** Default projection for rect-shaped poses (`{x,y,width,height}`). */
export const RECT_ALIGN_PROJECTION: AlignBoundsProjection<AlignBounds> = {
  boundsOf: (p) => p,
  translate: (p, dx, dy) => ({ ...p, x: p.x + dx, y: p.y + dy }),
};

function featureOffset(b: AlignBounds, axis: 'x' | 'y', anchor: AlignAnchor): number {
  if (axis === 'x') {
    if (anchor === 'min') return b.x;
    if (anchor === 'center') return b.x + b.width / 2;
    return b.x + b.width;
  }
  if (anchor === 'min') return b.y;
  if (anchor === 'center') return b.y + b.height / 2;
  return b.y + b.height;
}

/** Best (feature, candidate) match on one axis, within tolerance. */
function bestAxis(
  b: AlignBounds,
  axis: 'x' | 'y',
  anchors: readonly AlignAnchor[],
  candidates: readonly Guide[],
  worldTolerance: number,
): { delta: number; guide: Guide | null } {
  let bestAbs = Infinity;
  let bestDelta = 0;
  let bestGuide: Guide | null = null;
  for (const anchor of anchors) {
    const o = featureOffset(b, axis, anchor);
    for (const g of candidates) {
      if (g.axis !== axis) continue;
      const d = g.offset - o;
      const ad = Math.abs(d);
      if (ad <= worldTolerance && ad < bestAbs) {
        bestAbs = ad;
        bestDelta = d;
        bestGuide = g;
      }
    }
  }
  return { delta: bestGuide ? bestDelta : 0, guide: bestGuide };
}

/**
 * Match a moving box's selected edge/center features against candidate guide
 * lines. Returns the per-axis snap delta and the matched candidate line(s).
 * The two axes resolve independently; on each axis the closest in-tolerance
 * (feature, candidate) pair wins.
 */
export function matchAlignment(
  bounds: AlignBounds,
  candidates: readonly Guide[],
  worldTolerance: number,
  anchors: { x: readonly AlignAnchor[]; y: readonly AlignAnchor[] },
): AlignMatchResult {
  const x = bestAxis(bounds, 'x', anchors.x, candidates, worldTolerance);
  const y = bestAxis(bounds, 'y', anchors.y, candidates, worldTolerance);
  return { dx: x.delta, dy: y.delta, activeX: x.guide, activeY: y.guide };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/features/guides/alignment/match.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/guides/alignment/match.ts src/features/guides/alignment/match.test.ts
git commit -m "feat(guides): bounds-aware alignment matcher (edges + center, per-axis)"
```

---

## Task 3: Behaviors (move / insert / resize)

**Files:**
- Create: `src/features/guides/alignment/behaviors.ts`
- Test: `src/features/guides/alignment/behaviors.test.ts`

- [ ] **Step 1: Write the failing test**

`src/features/guides/alignment/behaviors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { alignMoveBehavior, alignInsertBehavior, alignResizeBehavior } from './behaviors';
import type { Guide } from '../types';
import type {
  GestureContext,
  GroupTransform,
  InsertProposed,
  ModifierState,
  ResizeAnchor,
  ResizePose,
} from '../../../interactions/gestures/types';

interface Pose { x: number; y: number; width: number; height: number }

function ctx(modifiers: Partial<ModifierState> = {}, origin: Pose = { x: 100, y: 100, width: 50, height: 50 }): GestureContext<Pose> {
  const o = new Map<string, Pose>();
  o.set('a', origin);
  return {
    draggedIds: ['a'],
    origin: o,
    current: new Map(),
    snap: null,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, ...modifiers },
    pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
    adapter: {} as never,
    scratch: {},
  };
}

const tt = (dx: number, dy: number): GroupTransform => ({ kind: 'translate', dx, dy });

describe('alignMoveBehavior', () => {
  it('shapes the transform and publishes the active line on a hit', () => {
    const cands: Guide[] = [{ id: 'L', axis: 'x', offset: 96 }];
    let active: readonly Guide[] = [];
    const b = alignMoveBehavior<Pose>({
      getCandidates: () => cands,
      setActiveGuides: (g) => { active = g; },
      tolerance: 5,
    });
    // origin L=100; proposed translate (0,0) keeps L=100; candidate 96 within 5.
    const res = b.onMove!(ctx(), tt(0, 0));
    expect(res).toEqual({ transform: { kind: 'translate', dx: -4, dy: 0 } });
    expect(active).toEqual([{ id: 'L', axis: 'x', offset: 96 }]);
  });

  it('clears actives and returns nothing on a miss', () => {
    let active: readonly Guide[] = [{ id: 'stale', axis: 'x', offset: 0 }];
    const b = alignMoveBehavior<Pose>({
      getCandidates: () => [{ id: 'L', axis: 'x', offset: 300 }],
      setActiveGuides: (g) => { active = g; },
      tolerance: 5,
    });
    expect(b.onMove!(ctx(), tt(0, 0))).toBeUndefined();
    expect(active).toEqual([]);
  });

  it('onEnd clears actives', () => {
    let active: readonly Guide[] = [{ id: 'x', axis: 'x', offset: 1 }];
    const b = alignMoveBehavior<Pose>({
      getCandidates: () => [],
      setActiveGuides: (g) => { active = g; },
    });
    b.onEnd!(ctx());
    expect(active).toEqual([]);
  });

  it('bypassKey held skips matching and clears actives', () => {
    let active: readonly Guide[] = [{ id: 'x', axis: 'x', offset: 1 }];
    const b = alignMoveBehavior<Pose>({
      getCandidates: () => [{ id: 'L', axis: 'x', offset: 100 }],
      setActiveGuides: (g) => { active = g; },
      tolerance: 5,
      bypassKey: 'alt',
    });
    expect(b.onMove!(ctx({ alt: true }), tt(0, 0))).toBeUndefined();
    expect(active).toEqual([]);
  });
});

describe('alignInsertBehavior', () => {
  it('snaps the live current point and publishes the line', () => {
    const cands: Guide[] = [{ id: 'gx', axis: 'x', offset: 200 }];
    let active: readonly Guide[] = [];
    const b = alignInsertBehavior<Pose>({
      getCandidates: () => cands,
      setActiveGuides: (g) => { active = g; },
      tolerance: 5,
    });
    const proposed: InsertProposed<Pose> = {
      start: { x: 50, y: 50 },
      current: { x: 197, y: 80 },
      bounds: { x: 50, y: 50, width: 147, height: 30 },
      pose: { x: 50, y: 50, width: 147, height: 30 },
    };
    const res = b.onMove!(ctx(), proposed);
    expect(res).toEqual({ current: { x: 200, y: 80 } });
    expect(active).toEqual([{ id: 'gx', axis: 'x', offset: 200 }]);
  });
});

describe('alignResizeBehavior', () => {
  it('snaps the moving east edge and pins the west edge', () => {
    const cands: Guide[] = [{ id: 'r', axis: 'x', offset: 152 }];
    let active: readonly Guide[] = [];
    const b = alignResizeBehavior<ResizePose>({
      getCandidates: () => cands,
      setActiveGuides: (g) => { active = g; },
      tolerance: 5,
    });
    const pose: ResizePose = { x: 100, y: 100, width: 50, height: 50 }; // R=150
    const anchor: ResizeAnchor = { x: 'min', y: 'free' }; // west pinned, east moves
    const res = b.onMove!(ctx(), { pose, anchor });
    // east edge 150 -> 152: width 50 -> 52, x unchanged.
    expect(res).toEqual({ pose: { x: 100, y: 100, width: 52, height: 50 } });
    expect(active).toEqual([{ id: 'r', axis: 'x', offset: 152 }]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/guides/alignment/behaviors.test.ts`
Expected: FAIL — `Failed to resolve import './behaviors'`.

- [ ] **Step 3: Implement `behaviors.ts`**

`src/features/guides/alignment/behaviors.ts`:

```ts
import type { Guide } from '../types';
import type {
  BoundsConstraint,
  InsertBehavior,
  MoveBehavior,
  ResizeAnchor,
  ResizePose,
} from '../../../interactions/gestures/types';
import { meanScale } from 'core/viewport/meanScale';
import type {
  AlignAnchor,
  AlignBoundsProjection,
  AlignmentBehaviorBase,
} from './types';
import { MOVE_ANCHORS, RECT_ALIGN_PROJECTION, matchAlignment } from './match';

/** Options for move/insert — adds the bounds projection for non-rect poses. */
export interface AlignMoveArgs<TPose> extends AlignmentBehaviorBase {
  projection?: AlignBoundsProjection<TPose>;
}

const activeList = (m: { activeX: Guide | null; activeY: Guide | null }): Guide[] =>
  [m.activeX, m.activeY].filter((g): g is Guide => g !== null);

function worldTol(base: AlignmentBehaviorBase): number {
  const t = base.tolerance ?? 6;
  return base.getView ? t / Math.max(1e-9, meanScale(base.getView().scale)) : t;
}

/** Move behavior: snap the dragged box's edges/center to candidates, shaping
 *  the proposed translate. Publishes the matched line(s); clears on miss/end. */
export function alignMoveBehavior<TPose>(args: AlignMoveArgs<TPose>): MoveBehavior<TPose> {
  const proj = args.projection ?? (RECT_ALIGN_PROJECTION as unknown as AlignBoundsProjection<TPose>);
  return {
    onMove(ctx, transform) {
      if (args.bypassKey && ctx.modifiers[args.bypassKey]) { args.setActiveGuides([]); return; }
      if (transform.kind !== 'translate') return;
      const primaryId = ctx.draggedIds[0];
      if (primaryId === undefined) return;
      const originPose = ctx.origin.get(primaryId);
      if (originPose === undefined) return;
      const proposed = proj.translate(originPose, transform.dx, transform.dy);
      const m = matchAlignment(proj.boundsOf(proposed), args.getCandidates(), worldTol(args), MOVE_ANCHORS);
      if (m.activeX === null && m.activeY === null) { args.setActiveGuides([]); return; }
      args.setActiveGuides(activeList(m));
      return { transform: { kind: 'translate', dx: transform.dx + m.dx, dy: transform.dy + m.dy } };
    },
    onEnd() { args.setActiveGuides([]); },
  };
}

/** Insert behavior: snap the live `current` point to candidates (treating it
 *  as a zero-size box). Publishes the matched line(s). */
export function alignInsertBehavior<TPose>(args: AlignmentBehaviorBase): InsertBehavior<TPose> {
  const pointAnchors: { x: readonly AlignAnchor[]; y: readonly AlignAnchor[] } = { x: ['min'], y: ['min'] };
  return {
    onMove(ctx, { current }) {
      if (args.bypassKey && ctx.modifiers[args.bypassKey]) { args.setActiveGuides([]); return; }
      const box = { x: current.x, y: current.y, width: 0, height: 0 };
      const m = matchAlignment(box, args.getCandidates(), worldTol(args), pointAnchors);
      if (m.activeX === null && m.activeY === null) { args.setActiveGuides([]); return; }
      args.setActiveGuides(activeList(m));
      return { current: { x: current.x + m.dx, y: current.y + m.dy } };
    },
    onEnd() { args.setActiveGuides([]); },
  };
}

/** Resize constraint: snap the moving edge(s) of the dragged rect to
 *  candidates. The pinned (anchor) edge stays fixed. Publishes the line(s). */
export function alignResizeBehavior<TPose extends ResizePose>(
  args: AlignmentBehaviorBase,
): BoundsConstraint<TPose> {
  return {
    onMove(ctx, { pose, anchor }) {
      if (args.bypassKey && ctx.modifiers[args.bypassKey]) { args.setActiveGuides([]); return; }
      // Moving edge per axis: 'min' anchor pins the west/north edge so the
      // east/south (max) edge moves, and vice versa.
      const movingX: AlignAnchor[] = anchor.x === 'min' ? ['max'] : anchor.x === 'max' ? ['min'] : [];
      const movingY: AlignAnchor[] = anchor.y === 'min' ? ['max'] : anchor.y === 'max' ? ['min'] : [];
      const m = matchAlignment(pose, args.getCandidates(), worldTol(args), { x: movingX, y: movingY });
      if (m.activeX === null && m.activeY === null) { args.setActiveGuides([]); return; }

      let { x, y, width, height } = pose;
      if (m.activeX !== null) {
        if (anchor.x === 'min') { width += m.dx; } else { x += m.dx; width -= m.dx; }
      }
      if (m.activeY !== null) {
        if (anchor.y === 'min') { height += m.dy; } else { y += m.dy; height -= m.dy; }
      }
      args.setActiveGuides(activeList(m));
      return { pose: { ...pose, x, y, width, height } };
    },
    onEnd() { args.setActiveGuides([]); },
  };
}
```

Note: confirm `BoundsConstraint` is exported from `interactions/gestures/types`. If `BoundsConstraint` does not carry an `onEnd` in its type, drop the `onEnd` from `alignResizeBehavior` and clear actives via the gesture's existing end path (the resize behavior's `onMove` already clears on a miss, so a stale line only persists if the gesture ends exactly on a match — acceptable; the demo also clears on pointer-up). Prefer keeping `onEnd` if the type allows it.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/features/guides/alignment/behaviors.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/guides/alignment/behaviors.ts src/features/guides/alignment/behaviors.test.ts
git commit -m "feat(guides): alignment behaviors for move / insert / resize"
```

---

## Task 4: Barrels

**Files:**
- Create: `src/features/guides/alignment/index.ts`
- Modify: `src/features/guides/index.ts`
- Modify: `src/index.ts:660-665`

- [ ] **Step 1: Create the module barrel**

`src/features/guides/alignment/index.ts`:

```ts
export type {
  AlignBounds,
  AlignAnchor,
  AlignMatchResult,
  AlignBoundsProjection,
  DeriveAlignmentGuidesOptions,
  AlignmentBehaviorBase,
} from './types';
export { deriveAlignmentGuides } from './derive';
export { matchAlignment, MOVE_ANCHORS, RECT_ALIGN_PROJECTION } from './match';
export {
  alignMoveBehavior,
  alignInsertBehavior,
  alignResizeBehavior,
  type AlignMoveArgs,
} from './behaviors';
```

- [ ] **Step 2: Re-export from the guides barrel**

In `src/features/guides/index.ts`, append:

```ts
export * from './alignment';
```

- [ ] **Step 3: Re-export from the kit barrel**

In `src/index.ts`, the existing guides export block is:

```ts
export { useGuides, createGuidesLayer } from './features/guides';
export type { Guide, UseGuidesReturn, GuidesLayerOpts } from './features/guides';
```

Replace with:

```ts
export {
  useGuides,
  createGuidesLayer,
  deriveAlignmentGuides,
  matchAlignment,
  MOVE_ANCHORS,
  RECT_ALIGN_PROJECTION,
  alignMoveBehavior,
  alignInsertBehavior,
  alignResizeBehavior,
} from './features/guides';
export type {
  Guide,
  UseGuidesReturn,
  GuidesLayerOpts,
  AlignBounds,
  AlignAnchor,
  AlignMatchResult,
  AlignBoundsProjection,
  DeriveAlignmentGuidesOptions,
  AlignmentBehaviorBase,
  AlignMoveArgs,
} from './features/guides';
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Run the alignment suite + the barrel test**

Run: `npx vitest run src/features/guides`
Expected: PASS (the three new test files plus existing guide tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/guides/alignment/index.ts src/features/guides/index.ts src/index.ts
git commit -m "feat(guides): export alignment-guides surface from the kit barrel"
```

---

## Task 5: Demo card

**Files:**
- Create: `demo/demos/AlignmentGuidesDemo.tsx`
- Modify: `demo/registry.ts`

- [ ] **Step 1: Write the demo**

`demo/demos/AlignmentGuidesDemo.tsx`. Follow `demo/demos/MoveSnapDemo.tsx` for the `SceneCanvas` + `selectTool={{ move: { behaviors } }}` harness. Three static rects plus a draggable one; candidates derived from the *other* rects + the page box each frame; active lines held in a ref and drawn by `createGuidesLayer`.

```tsx
import { useMemo, useRef, useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  createGuidesLayer,
  deriveAlignmentGuides,
  alignMoveBehavior,
} from '@weasel-js/core';
import type { Guide } from '@weasel-js/core';
import type { DrawCommand } from '../../src/renderer';
import type { View } from '../../src/core/viewport/view';

interface NodeData { color: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 460, H = 320;
const PAGE = { x: 0, y: 0, width: W, height: H };

export function AlignmentGuidesDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: 'a' as never, kind: 'leaf', layer: 'default', pose: { x: 60, y: 50, width: 90, height: 60 }, data: { color: '#7fb069' } },
      { id: 'b' as never, kind: 'leaf', layer: 'default', pose: { x: 300, y: 130, width: 80, height: 80 }, data: { color: '#d98f6f' } },
      { id: 'c' as never, kind: 'leaf', layer: 'default', pose: { x: 150, y: 230, width: 120, height: 50 }, data: { color: '#6f9fd9' } },
      { id: 'drag' as never, kind: 'leaf', layer: 'default', pose: { x: 200, y: 60, width: 70, height: 70 }, data: { color: '#b07fd0' } },
    ],
  });
  const selection = useSelection();
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  // Active guides live in a ref so the layer reads them each draw without a
  // React re-render per pointer-move.
  const activeRef = useRef<readonly Guide[]>([]);

  const behaviors = useMemo(() => [
    alignMoveBehavior<Pose>({
      tolerance: 6,
      getView: () => view,
      // Derive from every node EXCEPT the one(s) being dragged, plus the page.
      getCandidates: () => {
        const dragged = new Set(selection.get());
        const targets = [...scene.nodes.values()]
          .filter((n) => !dragged.has(n.id))
          .map((n) => n.pose as Pose);
        return deriveAlignmentGuides(targets, { page: PAGE });
      },
      setActiveGuides: (g) => { activeRef.current = g; },
    }),
  ], [scene, selection, view]);

  const guidesLayer = useMemo(
    () => createGuidesLayer({ getGuides: () => activeRef.current, color: '#e0397f' }),
    [],
  );

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selection={selection}
      selectTool={{ move: { behaviors } }}
      view={view}
      onViewChange={setView}
      viewport={{}}
      layers={{
        scene: {
          drawOne: (n, p): DrawCommand[] => [{
            kind: 'path',
            path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
            fill: { color: n.data.color },
          }],
        },
        overlays: [guidesLayer],
        selectionOverlay: { handles: false },
      }}
    />
  );
}
```

Note: confirm the `layers.overlays` slot name against `MoveSnapDemo`/`SceneCanvas` props. If `SceneCanvas` exposes guide overlays under a different slot (e.g. `layers.overlay` or a top-level `overlays` prop), use that — grep `createGuidesLayer` usages in `demo/demos/` for the canonical wiring and match it. The alignment-specific logic (derive + ref + behavior) is unchanged regardless of the slot name.

- [ ] **Step 2: Register the demo**

In `demo/registry.ts`: add the import near the other demo imports:

```ts
import { AlignmentGuidesDemo } from './demos/AlignmentGuidesDemo';
import AlignmentGuidesDemoFull from './demos/AlignmentGuidesDemo.tsx?raw';
```

Add an entry to the demos array (in the `Tools` category, near the other snap demos):

```ts
  {
    id: 'alignment-guides',
    title: 'Alignment guides',
    category: 'Tools',
    description: 'Drag the purple rect: its edges and center snap to the other rects and the page, drawing a full-length guide line. Candidates are derived from sibling bounds via deriveAlignmentGuides; the matched line is published to a ref the guides layer reads.',
    hint: 'Drag the purple rectangle near another rect’s edge or center.',
    Component: AlignmentGuidesDemo,
    full: AlignmentGuidesDemoFull,
    path: 'demo/demos/AlignmentGuidesDemo.tsx',
  },
```

- [ ] **Step 3: Typecheck the demo workspace**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Build the demo to confirm it compiles in the bundler**

Run: `npm run build --workspace demo` (or the repo's demo build script — check `package.json`; if none, skip and rely on tsc).
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add demo/demos/AlignmentGuidesDemo.tsx demo/registry.ts
git commit -m "demo(guides): alignment-guides demo card"
```

---

## Task 6: Verification + TODO

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 2: Full test suite (prepublish gate)**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 3: Update the TODO**

In `docs/TODO.md`, remove the "Alignment guides / insert snap-to-existing-edges" bullet from the High-priority index (line ~46) and rewrite/remove the full entry under "Selection, actions & UI panels" (line ~220) to reflect that auto-derivation + bounds-aware snap shipped. If a follow-up remains worth tracking, add a single P3 bullet (e.g. "Figma-style segment rendering" / "distribution guides" / "rotated-object alignment").

- [ ] **Step 4: Commit**

```bash
git add docs/TODO.md
git commit -m "docs(todo): close out alignment guides / insert snap-to-existing-edges"
```

---

## Self-review notes

- **Spec coverage:** derivation (Task 1), bounds-aware matcher with edges+center+per-axis (Task 2), move/insert/resize behaviors with active-guide publication + bypass + onEnd clear (Task 3), barrel exports (Task 4), full-length rendering reusing `createGuidesLayer` + siblings+page candidates + terse demo (Task 5), TODO close + out-of-scope follow-ups (Task 6). Page bounds: derive `opts.page` (Task 1) + demo passes `PAGE` (Task 5).
- **Type consistency:** `AlignBounds`, `AlignAnchor`, `AlignMatchResult`, `AlignBoundsProjection`, `AlignmentBehaviorBase`, `DeriveAlignmentGuidesOptions`, `AlignMoveArgs`; functions `deriveAlignmentGuides` / `matchAlignment` / `alignMoveBehavior` / `alignInsertBehavior` / `alignResizeBehavior`; consts `MOVE_ANCHORS` / `RECT_ALIGN_PROJECTION` — used identically across tasks and barrels.
- **Two confirm-before-coding notes** are flagged inline (Task 3: `BoundsConstraint` `onEnd` availability; Task 5: the `SceneCanvas` overlay slot name) — both have a stated fallback so neither blocks.
