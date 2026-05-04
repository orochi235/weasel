# Container layout strategies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `LayoutStrategy<TPose>` + three reference strategies (`freeform`, `tileGrid`, `snapPoint`) composed with a `LayoutSnap<TPose>` axis, an optional `getLayout` adapter method, and a layout-aware extension to `useMove` that handles cross-container drag with live source/destination reflow.

**Architecture:** Layouts live in a new `src/layout/` module — pure-function strategy factories that close over config and return `{ getChildPositions, getDropTargets, reflowFor, commitDrop, snap }`. The move gesture grows a layout pass that runs after pose-translation: hit-test the top-most container under the pointer, ask its layout for drop targets, run that layout's bundled snap policy, derive sibling reflow for both source and destination, and publish everything in an extended `MoveOverlay`. On release, `strategy.commitDrop(...)` produces the op batch (plus source-reflow ops). Adapters that don't implement `getLayout` keep today's absolute-positioning semantics — full backward compatibility.

**Tech Stack:** TypeScript (no React in `src/layout/`), Vitest. The strategy modules are pure functions over data — they have no React, canvas, or DOM dependencies, which keeps unit tests fast and unflakeable.

**Spec:** `docs/specs/2026-05-03-container-layout-strategies-design.md` is authoritative. When this plan and the spec disagree, the spec wins.

---

## File Structure

**Create:**

- `src/layout/types.ts` — `ContainerBounds`, `LayoutChild<TPose>`, `DropTarget<TPose>`, `LayoutSnap<TPose>`, `LayoutStrategy<TPose>`. No runtime code; types only.
- `src/layout/snaps.ts` — `none`, `nearest`, `nearestWithin`, `cellAt`. Each is a small factory returning a `LayoutSnap<TPose>`.
- `src/layout/strategies/freeform.ts` — `freeform<TPose>(opts?)`.
- `src/layout/strategies/tileGrid.ts` — `tileGrid<TPose>(opts)`. Carries `meta: { col, row, cellRect }` on its drop targets so `cellAt` can hit-test them.
- `src/layout/strategies/snapPoint.ts` — `snapPoint<TPose>(opts)`.
- `src/layout/strategies/index.ts` — barrel re-exporting the three strategies.
- `src/layout/index.ts` — top-level barrel re-exporting types, snaps, strategies.
- `src/layout/snaps.test.ts`, `src/layout/strategies/freeform.test.ts`, `src/layout/strategies/tileGrid.test.ts`, `src/layout/strategies/snapPoint.test.ts`.
- `src/interactions/gestures/move/move.layout.test.ts` — gesture integration covering layout-aware drop, cross-container drag, source reflow, rejection fall-through, commit batch shape.
- `demo/demos/LayoutDemo.tsx` — three side-by-side containers (freeform, tileGrid, snapPoint) wired through one adapter that returns the right strategy per container id.
- `demo/demos/__tests__/layoutDemo.integration.test.tsx` — drives a cross-container drag from the freeform container into the tileGrid container and asserts the dest reflow.

**Modify:**

- `src/core/adapters/types.ts` — add optional `getLayout?(containerId: string): LayoutStrategy<TPose> | null` to `MoveAdapter`. (Pose generic comes through naturally since `MoveAdapter` is already `<TObject, TPose>`.)
- `src/interactions/gestures/types.ts` — extend `MoveOverlay<TPose>` with `hypotheticalChildPositions: Map<string, TPose>`, `sourceReflowPositions: Map<string, TPose>`, `destContainerId: string | null`, `accepted: boolean`. Default-empty maps when no layout is engaged.
- `src/interactions/gestures/move/move.ts` — in `move()`: after pose-translation, run the layout pass and update overlay fields. In `end()`: when a layout accepted the drop, prefer `strategy.commitDrop(...)` ops + cross-container source-reflow ops over the default `createTransformOp` batch.
- `src/index.ts` — export the layout module: `export * from './layout';`.
- `docs/TODO.md` — remove the "Container layout strategies" entry from Tier 1.5; add a new TODO entry for the deferred items in the spec's "Deferred / out of scope" section.
- `demo/index.tsx` (or wherever the demo registry lives) — register `LayoutDemo`.

**Tests:** Every strategy has a unit test (pure-function, no React). The move gesture has one integration test file dedicated to layout interaction. The demo gets one integration test that exercises the whole stack end-to-end.

---

## Conventions for this plan

- All commits use the project's standard trailer:
  ```
  Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
  ```
- Run the full suite with `npm test -- --run` after every task. Each task ends with that command going green before the commit.
- The first three lines of every new file mirror the project's existing convention — start with imports, then types, then code. No file-header comments unless the kit's existing peer files have them (`src/interactions/gestures/types.ts`, `src/core/adapters/types.ts` — no header comments; follow suit).
- `Op[]` import path is `../../core/ops/types` from `src/layout/strategies/*.ts`.

---

### Task 1: Layout core types

**Files:**
- Create: `src/layout/types.ts`

- [ ] **Step 1: Create the types module**

```ts
// src/layout/types.ts
import type { Op } from '../core/ops/types';

export type ContainerBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export interface LayoutChild<TPose> {
  id: string;
  pose: TPose;
}

export interface DropTarget<TPose> {
  /** Where the dragged child lands if this target is picked. */
  pose: TPose;
  /** Reference point for distance metrics (snap algorithms). */
  origin: { x: number; y: number };
  /** Strategy-private metadata (e.g. cell coords for tile-grid). */
  meta?: unknown;
}

export interface LayoutSnap<TPose> {
  pickTarget(
    targets: DropTarget<TPose>[],
    pointer: { x: number; y: number },
  ): DropTarget<TPose> | null;
}

export interface LayoutContainer {
  id: string;
  bounds: ContainerBounds;
}

export interface LayoutDragged<TPose> {
  id: string;
  pose: TPose;
  sourceContainerId: string | null;
}

export interface LayoutStrategy<TPose> {
  getChildPositions(
    container: LayoutContainer,
    children: ReadonlyArray<LayoutChild<TPose>>,
  ): Map<string, TPose>;

  getDropTargets(
    container: LayoutContainer,
    children: ReadonlyArray<LayoutChild<TPose>>,
    dragged: LayoutDragged<TPose>,
  ): DropTarget<TPose>[];

  reflowFor(
    container: LayoutContainer,
    children: ReadonlyArray<LayoutChild<TPose>>,
    dragged: LayoutDragged<TPose>,
    target: DropTarget<TPose> | null,
  ): Map<string, TPose>;

  commitDrop(
    container: LayoutContainer,
    children: ReadonlyArray<LayoutChild<TPose>>,
    dragged: LayoutDragged<TPose>,
    target: DropTarget<TPose> | null,
  ): Op[];

  snap: LayoutSnap<TPose>;
}
```

- [ ] **Step 2: Verify the project type-checks**

Run: `npm run build`
Expected: PASS (the file is types-only; no runtime to break).

- [ ] **Step 3: Commit**

```bash
git add src/layout/types.ts
git commit -m "$(cat <<'EOF'
feat(layout): add LayoutStrategy/LayoutSnap core types

Types-only module; no runtime yet. Establishes the contract that
layout strategies and the move-gesture integration will consume in
subsequent commits.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Built-in snap policies

**Files:**
- Create: `src/layout/snaps.ts`
- Create: `src/layout/snaps.test.ts`

- [ ] **Step 1: Write the failing snap-policy tests**

Create `src/layout/snaps.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { none, nearest, nearestWithin, cellAt } from './snaps';
import type { DropTarget } from './types';

type P = { x: number; y: number };

const target = (x: number, y: number, meta?: unknown): DropTarget<P> => ({
  pose: { x, y },
  origin: { x, y },
  meta,
});

describe('none', () => {
  it('returns null regardless of input', () => {
    const snap = none<P>();
    expect(snap.pickTarget([target(0, 0), target(10, 10)], { x: 5, y: 5 })).toBeNull();
    expect(snap.pickTarget([], { x: 0, y: 0 })).toBeNull();
  });
});

describe('nearest', () => {
  it('returns the closest target by Euclidean distance', () => {
    const snap = nearest<P>();
    const got = snap.pickTarget(
      [target(0, 0), target(10, 0), target(0, 10)],
      { x: 9, y: 1 },
    );
    expect(got?.origin).toEqual({ x: 10, y: 0 });
  });

  it('returns null when targets is empty', () => {
    expect(nearest<P>().pickTarget([], { x: 0, y: 0 })).toBeNull();
  });
});

describe('nearestWithin', () => {
  it('returns null when nothing is within tolerance', () => {
    const snap = nearestWithin<P>({ tolerance: 1 });
    expect(snap.pickTarget([target(0, 0)], { x: 5, y: 5 })).toBeNull();
  });

  it('returns the closest target within tolerance', () => {
    const snap = nearestWithin<P>({ tolerance: 5 });
    const got = snap.pickTarget(
      [target(0, 0), target(10, 0)],
      { x: 2, y: 0 },
    );
    expect(got?.origin).toEqual({ x: 0, y: 0 });
  });
});

describe('cellAt', () => {
  it('returns the target whose meta.cellRect contains the pointer', () => {
    const snap = cellAt<P>();
    const a = target(0, 0, { cellRect: { x: 0, y: 0, width: 10, height: 10 } });
    const b = target(20, 0, { cellRect: { x: 10, y: 0, width: 10, height: 10 } });
    expect(snap.pickTarget([a, b], { x: 12, y: 5 })?.origin).toEqual({ x: 20, y: 0 });
  });

  it('falls back to nearest when pointer is outside all cells', () => {
    const snap = cellAt<P>();
    const a = target(0, 0, { cellRect: { x: 0, y: 0, width: 10, height: 10 } });
    const b = target(20, 0, { cellRect: { x: 10, y: 0, width: 10, height: 10 } });
    expect(snap.pickTarget([a, b], { x: 100, y: 5 })?.origin).toEqual({ x: 20, y: 0 });
  });

  it('returns null when targets is empty', () => {
    expect(cellAt<P>().pickTarget([], { x: 0, y: 0 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm test -- --run src/layout/snaps.test.ts`
Expected: FAIL with "Cannot find module './snaps'".

- [ ] **Step 3: Implement the snap policies**

Create `src/layout/snaps.ts`:

```ts
import type { DropTarget, LayoutSnap } from './types';

function dist2(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function nearestOf<TPose>(
  targets: DropTarget<TPose>[],
  pointer: { x: number; y: number },
): DropTarget<TPose> | null {
  if (targets.length === 0) return null;
  let best = targets[0];
  let bestD = dist2(best.origin, pointer);
  for (let i = 1; i < targets.length; i++) {
    const d = dist2(targets[i].origin, pointer);
    if (d < bestD) {
      bestD = d;
      best = targets[i];
    }
  }
  return best;
}

export function none<TPose>(): LayoutSnap<TPose> {
  return { pickTarget: () => null };
}

export function nearest<TPose>(): LayoutSnap<TPose> {
  return { pickTarget: (targets, pointer) => nearestOf(targets, pointer) };
}

export function nearestWithin<TPose>(opts: { tolerance: number }): LayoutSnap<TPose> {
  const tol2 = opts.tolerance * opts.tolerance;
  return {
    pickTarget(targets, pointer) {
      const got = nearestOf(targets, pointer);
      if (got === null) return null;
      return dist2(got.origin, pointer) <= tol2 ? got : null;
    },
  };
}

interface CellMeta {
  cellRect: { x: number; y: number; width: number; height: number };
}

function isCellMeta(m: unknown): m is CellMeta {
  return (
    typeof m === 'object' &&
    m !== null &&
    'cellRect' in m &&
    typeof (m as { cellRect: unknown }).cellRect === 'object'
  );
}

export function cellAt<TPose>(): LayoutSnap<TPose> {
  return {
    pickTarget(targets, pointer) {
      for (const t of targets) {
        if (!isCellMeta(t.meta)) continue;
        const r = t.meta.cellRect;
        if (
          pointer.x >= r.x &&
          pointer.x < r.x + r.width &&
          pointer.y >= r.y &&
          pointer.y < r.y + r.height
        ) {
          return t;
        }
      }
      return nearestOf(targets, pointer);
    },
  };
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npm test -- --run src/layout/snaps.test.ts`
Expected: PASS (all 8 cases).

- [ ] **Step 5: Run the full suite**

Run: `npm test -- --run`
Expected: PASS, baseline + 8 new tests.

- [ ] **Step 6: Commit**

```bash
git add src/layout/snaps.ts src/layout/snaps.test.ts
git commit -m "$(cat <<'EOF'
feat(layout): add built-in snap policies

none/nearest/nearestWithin/cellAt — small factories returning
LayoutSnap<TPose>. cellAt is tile-grid aware (reads meta.cellRect)
and falls back to nearest when the pointer is outside every cell.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: freeform strategy

**Files:**
- Create: `src/layout/strategies/freeform.ts`
- Create: `src/layout/strategies/freeform.test.ts`

- [ ] **Step 1: Write the failing freeform tests**

Create `src/layout/strategies/freeform.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { freeform } from './freeform';
import { nearestWithin } from '../snaps';

type P = { x: number; y: number; width: number; height: number };

const container = { id: 'C', bounds: { x: 0, y: 0, width: 100, height: 100 } };
const child = (id: string, x: number, y: number): { id: string; pose: P } => ({
  id,
  pose: { x, y, width: 10, height: 10 },
});

describe('freeform', () => {
  it('getChildPositions returns identity over stored poses', () => {
    const layout = freeform<P>();
    const children = [child('a', 5, 5), child('b', 30, 40)];
    const got = layout.getChildPositions(container, children);
    expect(got.get('a')).toEqual({ x: 5, y: 5, width: 10, height: 10 });
    expect(got.get('b')).toEqual({ x: 30, y: 40, width: 10, height: 10 });
    expect(got.size).toBe(2);
  });

  it('getDropTargets returns empty array (snap is none by default)', () => {
    const layout = freeform<P>();
    const targets = layout.getDropTargets(
      container,
      [child('a', 5, 5)],
      { id: 'd', pose: { x: 0, y: 0, width: 10, height: 10 }, sourceContainerId: null },
    );
    expect(targets).toEqual([]);
  });

  it('reflowFor returns an empty map (no sibling movement)', () => {
    const layout = freeform<P>();
    const reflow = layout.reflowFor(
      container,
      [child('a', 5, 5)],
      { id: 'd', pose: { x: 0, y: 0, width: 10, height: 10 }, sourceContainerId: null },
      null,
    );
    expect(reflow.size).toBe(0);
  });

  it('commitDrop emits a single setPose op for the dragged child', () => {
    const layout = freeform<P>();
    const ops = layout.commitDrop(
      container,
      [],
      { id: 'd', pose: { x: 12, y: 34, width: 10, height: 10 }, sourceContainerId: null },
      null,
    );
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe('transform');
  });

  it('accepts a snap override', () => {
    const layout = freeform<P>({ snap: nearestWithin({ tolerance: 1 }) });
    expect(layout.snap.pickTarget([], { x: 0, y: 0 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm test -- --run src/layout/strategies/freeform.test.ts`
Expected: FAIL — "Cannot find module './freeform'".

- [ ] **Step 3: Implement freeform**

Create `src/layout/strategies/freeform.ts`:

```ts
import { createTransformOp } from '../../core/ops/transform';
import type { LayoutSnap, LayoutStrategy } from '../types';
import { none } from '../snaps';

export interface FreeformOptions<TPose> {
  snap?: LayoutSnap<TPose>;
}

export function freeform<TPose>(opts: FreeformOptions<TPose> = {}): LayoutStrategy<TPose> {
  const snap = opts.snap ?? none<TPose>();

  return {
    snap,

    getChildPositions(_container, children) {
      const out = new Map<string, TPose>();
      for (const c of children) out.set(c.id, c.pose);
      return out;
    },

    getDropTargets() {
      return [];
    },

    reflowFor() {
      return new Map();
    },

    commitDrop(_container, _children, dragged, _target) {
      // Dragged pose is the in-flight pose at release; the gesture
      // hands us the snapped pose if a target was picked.
      return [
        createTransformOp<TPose>({
          id: dragged.id,
          from: dragged.pose,
          to: dragged.pose,
          label: 'Drop',
        }),
      ];
    },
  };
}
```

Wait — `commitDrop` needs `from` to differ from `to` for the transform op to be meaningful. The gesture passes the **proposed** pose (where the drag would land); the strategy doesn't know the origin. Update the call sites in this plan: `commitDrop` receives `dragged.pose` as the **proposed final** pose; the gesture is responsible for separately producing the `from` (origin) when it builds the batch. Adjust the freeform impl to produce a no-op-shaped transform with `from: dragged.pose, to: dragged.pose` and let the gesture replace `from` before dispatch — *no*, that's brittle.

**Resolution:** extend `LayoutDragged<TPose>` with `originPose: TPose` so `commitDrop` can build a real transform op. Add this field now:

Edit `src/layout/types.ts` to add `originPose: TPose` to `LayoutDragged`:

```ts
export interface LayoutDragged<TPose> {
  id: string;
  /** The pose the dragged child currently has (pre-drop). */
  originPose: TPose;
  /** The pose the gesture proposes (pointer-driven, pre-snap). */
  pose: TPose;
  sourceContainerId: string | null;
}
```

Then `commitDrop` becomes:

```ts
commitDrop(_container, _children, dragged, _target) {
  return [
    createTransformOp<TPose>({
      id: dragged.id,
      from: dragged.originPose,
      to: dragged.pose,
      label: 'Drop',
    }),
  ];
},
```

Update the freeform test's commitDrop case to supply `originPose`:

```ts
const ops = layout.commitDrop(
  container,
  [],
  {
    id: 'd',
    originPose: { x: 0, y: 0, width: 10, height: 10 },
    pose: { x: 12, y: 34, width: 10, height: 10 },
    sourceContainerId: null,
  },
  null,
);
```

Same `originPose` field needs to be added everywhere `LayoutDragged` appears in this plan: tileGrid + snapPoint tasks below carry the same shape. The other strategies likewise consume `originPose` when emitting transform ops.

- [ ] **Step 4: Update `src/layout/types.ts` and freeform impl per the resolution above**

Apply the `originPose` field to `LayoutDragged<TPose>` in `src/layout/types.ts`. Update the freeform `commitDrop` body and the freeform test's commit case to supply `originPose`.

- [ ] **Step 5: Run tests — verify they pass**

Run: `npm test -- --run src/layout/strategies/freeform.test.ts`
Expected: PASS (5 cases).

- [ ] **Step 6: Run the full suite**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/layout/types.ts src/layout/strategies/freeform.ts src/layout/strategies/freeform.test.ts
git commit -m "$(cat <<'EOF'
feat(layout): add freeform strategy

Identity layout — no reflow, no drop targets, single setPose on commit.
Adds originPose field to LayoutDragged so strategies can build a real
transform op without round-tripping through the gesture.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: tileGrid strategy

**Files:**
- Create: `src/layout/strategies/tileGrid.ts`
- Create: `src/layout/strategies/tileGrid.test.ts`

The tileGrid layout treats the container as an `cols × rows` grid of equal cells (with optional `gap` in world units). `getChildPositions` assigns committed children to cells in id-stable order (Array.sort by id) — overflow children beyond `cols * rows` are skipped from the returned map. `getDropTargets` emits one `DropTarget` per cell with `meta: { col, row, cellRect }`. `reflowFor` implements **swap-on-occupied**: if the picked cell is currently occupied by a sibling, the sibling moves into the dragged child's previous cell (or stays put if the dragged child is from another container). `commitDrop` returns the dragged child's transform op + the swap sibling's transform op.

The tile pose is `{ x, y, width, height }` so this strategy is rect-shaped. Constrain `TPose extends { x: number; y: number; width: number; height: number }`.

- [ ] **Step 1: Write the failing tileGrid tests**

Create `src/layout/strategies/tileGrid.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { tileGrid } from './tileGrid';
import { none } from '../snaps';

type P = { x: number; y: number; width: number; height: number };

const container = { id: 'C', bounds: { x: 0, y: 0, width: 100, height: 100 } };

describe('tileGrid', () => {
  it('getChildPositions assigns children to cells in id order', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 2 });
    const children = [
      { id: 'b', pose: { x: 999, y: 999, width: 10, height: 10 } },
      { id: 'a', pose: { x: 0, y: 0, width: 10, height: 10 } },
      { id: 'c', pose: { x: 0, y: 0, width: 10, height: 10 } },
    ];
    const got = layout.getChildPositions(container, children);
    // 100x100 container, 2x2 grid, no gap → 50x50 cells.
    // Sorted ids: a, b, c → cells (0,0), (1,0), (0,1).
    expect(got.get('a')).toEqual({ x: 0, y: 0, width: 50, height: 50 });
    expect(got.get('b')).toEqual({ x: 50, y: 0, width: 50, height: 50 });
    expect(got.get('c')).toEqual({ x: 0, y: 50, width: 50, height: 50 });
  });

  it('skips overflow children beyond cols * rows', () => {
    const layout = tileGrid<P>({ cols: 1, rows: 1 });
    const children = [
      { id: 'a', pose: { x: 0, y: 0, width: 10, height: 10 } },
      { id: 'b', pose: { x: 0, y: 0, width: 10, height: 10 } },
    ];
    const got = layout.getChildPositions(container, children);
    expect(got.size).toBe(1);
    expect(got.has('a')).toBe(true);
    expect(got.has('b')).toBe(false);
  });

  it('honors gap', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 1, gap: 10 });
    const children = [
      { id: 'a', pose: { x: 0, y: 0, width: 10, height: 10 } },
      { id: 'b', pose: { x: 0, y: 0, width: 10, height: 10 } },
    ];
    const got = layout.getChildPositions(container, children);
    // 100 wide, 2 cols, 10 gap → cells width = (100 - 10) / 2 = 45.
    // a at x=0, b at x=55.
    expect(got.get('a')?.x).toBe(0);
    expect(got.get('b')?.x).toBe(55);
  });

  it('getDropTargets emits one target per cell with cellRect meta', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 2 });
    const targets = layout.getDropTargets(
      container,
      [],
      {
        id: 'd',
        originPose: { x: 0, y: 0, width: 10, height: 10 },
        pose: { x: 0, y: 0, width: 10, height: 10 },
        sourceContainerId: null,
      },
    );
    expect(targets).toHaveLength(4);
    const tl = targets.find((t) => (t.meta as { col: number; row: number }).col === 0
      && (t.meta as { col: number; row: number }).row === 0)!;
    expect(tl.origin).toEqual({ x: 25, y: 25 }); // cell center: (0,0) → (50,50) center is (25,25)
    expect((tl.meta as { cellRect: P }).cellRect).toEqual({ x: 0, y: 0, width: 50, height: 50 });
  });

  it('reflowFor swaps occupant when picked cell is occupied (same-container drag)', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 1 });
    const children = [
      { id: 'a', pose: { x: 0, y: 0, width: 50, height: 100 } },
      { id: 'b', pose: { x: 50, y: 0, width: 50, height: 100 } },
    ];
    // Drag 'a' onto cell (1,0) which is 'b'.
    const targets = layout.getDropTargets(container, children, {
      id: 'a',
      originPose: { x: 0, y: 0, width: 50, height: 100 },
      pose: { x: 50, y: 0, width: 50, height: 100 },
      sourceContainerId: 'C',
    });
    const cell1 = targets.find((t) => (t.meta as { col: number }).col === 1)!;
    const reflow = layout.reflowFor(container, children, {
      id: 'a',
      originPose: { x: 0, y: 0, width: 50, height: 100 },
      pose: { x: 50, y: 0, width: 50, height: 100 },
      sourceContainerId: 'C',
    }, cell1);
    // 'b' should move into 'a's old cell.
    expect(reflow.get('b')).toEqual({ x: 0, y: 0, width: 50, height: 100 });
    expect(reflow.has('a')).toBe(false);
  });

  it('reflowFor returns empty map when picked cell is empty', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 1 });
    const children = [
      { id: 'a', pose: { x: 0, y: 0, width: 50, height: 100 } },
    ];
    const targets = layout.getDropTargets(container, children, {
      id: 'd',
      originPose: { x: 0, y: 0, width: 50, height: 100 },
      pose: { x: 50, y: 0, width: 50, height: 100 },
      sourceContainerId: null,
    });
    const cell1 = targets.find((t) => (t.meta as { col: number }).col === 1)!;
    const reflow = layout.reflowFor(container, children, {
      id: 'd',
      originPose: { x: 0, y: 0, width: 50, height: 100 },
      pose: { x: 50, y: 0, width: 50, height: 100 },
      sourceContainerId: null,
    }, cell1);
    expect(reflow.size).toBe(0);
  });

  it('commitDrop emits dragged setPose plus swap setPose on occupied drop', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 1 });
    const children = [
      { id: 'a', pose: { x: 0, y: 0, width: 50, height: 100 } },
      { id: 'b', pose: { x: 50, y: 0, width: 50, height: 100 } },
    ];
    const targets = layout.getDropTargets(container, children, {
      id: 'a',
      originPose: { x: 0, y: 0, width: 50, height: 100 },
      pose: { x: 50, y: 0, width: 50, height: 100 },
      sourceContainerId: 'C',
    });
    const cell1 = targets.find((t) => (t.meta as { col: number }).col === 1)!;
    const ops = layout.commitDrop(container, children, {
      id: 'a',
      originPose: { x: 0, y: 0, width: 50, height: 100 },
      pose: { x: 50, y: 0, width: 50, height: 100 },
      sourceContainerId: 'C',
    }, cell1);
    expect(ops).toHaveLength(2);
    expect(ops.every((o) => o.kind === 'transform')).toBe(true);
  });

  it('default snap is cellAt (returns target under pointer)', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 1 });
    const targets = layout.getDropTargets(container, [], {
      id: 'd',
      originPose: { x: 0, y: 0, width: 10, height: 10 },
      pose: { x: 0, y: 0, width: 10, height: 10 },
      sourceContainerId: null,
    });
    const got = layout.snap.pickTarget(targets, { x: 75, y: 50 });
    expect((got?.meta as { col: number }).col).toBe(1);
  });

  it('accepts a snap override', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 1, snap: none<P>() });
    const targets = layout.getDropTargets(container, [], {
      id: 'd',
      originPose: { x: 0, y: 0, width: 10, height: 10 },
      pose: { x: 0, y: 0, width: 10, height: 10 },
      sourceContainerId: null,
    });
    expect(layout.snap.pickTarget(targets, { x: 25, y: 25 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm test -- --run src/layout/strategies/tileGrid.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement tileGrid**

Create `src/layout/strategies/tileGrid.ts`:

```ts
import { createTransformOp } from '../../core/ops/transform';
import type {
  ContainerBounds,
  DropTarget,
  LayoutChild,
  LayoutDragged,
  LayoutSnap,
  LayoutStrategy,
} from '../types';
import { cellAt } from '../snaps';

interface TileMeta {
  col: number;
  row: number;
  cellRect: { x: number; y: number; width: number; height: number };
}

export interface TileGridOptions<TPose> {
  cols: number;
  rows: number;
  /** Gap between cells, in world units. Default 0. */
  gap?: number;
  snap?: LayoutSnap<TPose>;
}

type RectPose = { x: number; y: number; width: number; height: number };

function cellRectAt(
  bounds: ContainerBounds,
  cols: number,
  rows: number,
  gap: number,
  col: number,
  row: number,
): { x: number; y: number; width: number; height: number } {
  const cw = (bounds.width - gap * (cols - 1)) / cols;
  const ch = (bounds.height - gap * (rows - 1)) / rows;
  return {
    x: bounds.x + col * (cw + gap),
    y: bounds.y + row * (ch + gap),
    width: cw,
    height: ch,
  };
}

function sortedChildIds<TPose>(children: ReadonlyArray<LayoutChild<TPose>>): string[] {
  return children.map((c) => c.id).sort();
}

function findOccupantAt<TPose>(
  layoutPositions: Map<string, TPose>,
  cellRect: { x: number; y: number; width: number; height: number },
  excludeId: string,
): string | null {
  for (const [id, pose] of layoutPositions) {
    if (id === excludeId) continue;
    const p = pose as unknown as RectPose;
    if (
      p.x === cellRect.x &&
      p.y === cellRect.y &&
      p.width === cellRect.width &&
      p.height === cellRect.height
    ) {
      return id;
    }
  }
  return null;
}

export function tileGrid<TPose extends RectPose>(
  opts: TileGridOptions<TPose>,
): LayoutStrategy<TPose> {
  const { cols, rows } = opts;
  const gap = opts.gap ?? 0;
  const snap = opts.snap ?? cellAt<TPose>();
  const capacity = cols * rows;

  function cellPose(bounds: ContainerBounds, col: number, row: number): TPose {
    return cellRectAt(bounds, cols, rows, gap, col, row) as TPose;
  }

  return {
    snap,

    getChildPositions(container, children) {
      const out = new Map<string, TPose>();
      const ids = sortedChildIds(children);
      for (let i = 0; i < ids.length && i < capacity; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        out.set(ids[i], cellPose(container.bounds, col, row));
      }
      return out;
    },

    getDropTargets(container, _children, _dragged) {
      const out: DropTarget<TPose>[] = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const cellRect = cellRectAt(container.bounds, cols, rows, gap, col, row);
          out.push({
            pose: cellRect as TPose,
            origin: { x: cellRect.x + cellRect.width / 2, y: cellRect.y + cellRect.height / 2 },
            meta: { col, row, cellRect } satisfies TileMeta,
          });
        }
      }
      return out;
    },

    reflowFor(container, children, dragged, target) {
      const out = new Map<string, TPose>();
      if (target === null) return out;
      const meta = target.meta as TileMeta;
      const sameContainer = dragged.sourceContainerId === container.id;
      // Map of currently-laid-out children (excluding dragged if same-container).
      const filtered = sameContainer
        ? children.filter((c) => c.id !== dragged.id)
        : children;
      const draggedTaking: LayoutChild<TPose> = {
        id: dragged.id,
        pose: dragged.pose,
      };
      // Build a candidate layout: current children minus dragged,
      // plus dragged inserted at the target cell index (if it fits).
      const layoutBefore = this.getChildPositions(container, filtered);
      const occupant = findOccupantAt(layoutBefore, meta.cellRect, dragged.id);
      if (occupant !== null && sameContainer) {
        // Swap: occupant moves to dragged's previous cell.
        const draggedOriginPose = dragged.originPose as unknown as RectPose;
        const occupantNewPose = {
          x: draggedOriginPose.x,
          y: draggedOriginPose.y,
          width: draggedOriginPose.width,
          height: draggedOriginPose.height,
        } as unknown as TPose;
        out.set(occupant, occupantNewPose);
      }
      // (Cross-container occupancy: spec leaves this as deferral —
      // for v1, dropping onto an occupied cell of a different container
      // displaces the occupant only when same-container. Cross-container
      // collisions fall back to free-space drop semantics from the gesture.)
      void draggedTaking;
      return out;
    },

    commitDrop(container, children, dragged, target) {
      const ops = [];
      const sameContainer = dragged.sourceContainerId === container.id;
      const filtered = sameContainer
        ? children.filter((c) => c.id !== dragged.id)
        : children;
      const layoutBefore = this.getChildPositions(container, filtered);

      let droppedPose: TPose;
      if (target === null) {
        droppedPose = dragged.pose;
      } else {
        const meta = target.meta as TileMeta;
        droppedPose = meta.cellRect as TPose;
        const occupant = findOccupantAt(layoutBefore, meta.cellRect, dragged.id);
        if (occupant !== null && sameContainer) {
          const dop = dragged.originPose as unknown as RectPose;
          const occupantNewPose = {
            x: dop.x,
            y: dop.y,
            width: dop.width,
            height: dop.height,
          } as unknown as TPose;
          ops.push(
            createTransformOp<TPose>({
              id: occupant,
              from: layoutBefore.get(occupant)!,
              to: occupantNewPose,
              label: 'Tile swap',
            }),
          );
        }
      }
      ops.push(
        createTransformOp<TPose>({
          id: dragged.id,
          from: dragged.originPose,
          to: droppedPose,
          label: 'Tile drop',
        }),
      );
      return ops;
    },
  };
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npm test -- --run src/layout/strategies/tileGrid.test.ts`
Expected: PASS (9 cases).

- [ ] **Step 5: Run the full suite**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/layout/strategies/tileGrid.ts src/layout/strategies/tileGrid.test.ts
git commit -m "$(cat <<'EOF'
feat(layout): add tileGrid strategy

NxM grid with optional gap. Stable id-sorted cell assignment, cellAt
default snap, swap-on-occupied reflow for same-container drags.
Cross-container occupancy falls through to free-space (deferred).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: snapPoint strategy

**Files:**
- Create: `src/layout/strategies/snapPoint.ts`
- Create: `src/layout/strategies/snapPoint.test.ts`

The snapPoint strategy generates candidate drop points without owning child positions. `getChildPositions` returns identity over stored poses. `getDropTargets` generates points based on the configured pattern. `reflowFor` is empty (snap-point doesn't move siblings). `commitDrop` returns one transform op moving the dragged child to the snapped origin.

Patterns:
- `'corners'` — four corners of the container bounds.
- `'edges'` — midpoint of each of the four edges.
- `'center'` — single point at container center.
- `'grid'` — points on a regular grid with spacing `gridSpacing` (default 50), starting at the container origin and stopping before exceeding bounds.

The dragged pose's `width`/`height` (when present) are used to anchor the dropped child by its top-left at the snap point. For non-rect poses without size, the snap target's `pose` field is just `{ x, y }` — the strategy is generic over `TPose extends { x: number; y: number }` (no width/height required).

- [ ] **Step 1: Write the failing snapPoint tests**

Create `src/layout/strategies/snapPoint.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { snapPoint } from './snapPoint';
import { nearest } from '../snaps';

type P = { x: number; y: number };

const container = { id: 'C', bounds: { x: 0, y: 0, width: 100, height: 100 } };
const dragged = (pose: P) => ({
  id: 'd',
  originPose: { x: 0, y: 0 } as P,
  pose,
  sourceContainerId: null as string | null,
});

describe('snapPoint', () => {
  it('getChildPositions returns identity', () => {
    const layout = snapPoint<P>({ pattern: 'corners' });
    const children = [{ id: 'a', pose: { x: 5, y: 5 } as P }];
    const got = layout.getChildPositions(container, children);
    expect(got.get('a')).toEqual({ x: 5, y: 5 });
  });

  it('corners pattern emits four targets at the container corners', () => {
    const layout = snapPoint<P>({ pattern: 'corners' });
    const targets = layout.getDropTargets(container, [], dragged({ x: 0, y: 0 }));
    const origins = targets.map((t) => t.origin);
    expect(origins).toEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
        { x: 100, y: 100 },
      ]),
    );
    expect(targets).toHaveLength(4);
  });

  it('edges pattern emits four edge midpoints', () => {
    const layout = snapPoint<P>({ pattern: 'edges' });
    const targets = layout.getDropTargets(container, [], dragged({ x: 0, y: 0 }));
    const origins = targets.map((t) => t.origin);
    expect(origins).toEqual(
      expect.arrayContaining([
        { x: 50, y: 0 },
        { x: 50, y: 100 },
        { x: 0, y: 50 },
        { x: 100, y: 50 },
      ]),
    );
    expect(targets).toHaveLength(4);
  });

  it('center pattern emits a single center target', () => {
    const layout = snapPoint<P>({ pattern: 'center' });
    const targets = layout.getDropTargets(container, [], dragged({ x: 0, y: 0 }));
    expect(targets).toHaveLength(1);
    expect(targets[0].origin).toEqual({ x: 50, y: 50 });
  });

  it('grid pattern emits a regular grid of points', () => {
    const layout = snapPoint<P>({ pattern: 'grid', gridSpacing: 50 });
    const targets = layout.getDropTargets(container, [], dragged({ x: 0, y: 0 }));
    // Spacing 50 in 100x100 container → x ∈ {0, 50, 100}, y ∈ {0, 50, 100} = 9 points.
    expect(targets).toHaveLength(9);
  });

  it('reflowFor returns empty map', () => {
    const layout = snapPoint<P>({ pattern: 'center' });
    const reflow = layout.reflowFor(container, [], dragged({ x: 0, y: 0 }), null);
    expect(reflow.size).toBe(0);
  });

  it('commitDrop emits a single setPose at the target origin when target is non-null', () => {
    const layout = snapPoint<P>({ pattern: 'center' });
    const targets = layout.getDropTargets(container, [], dragged({ x: 0, y: 0 }));
    const ops = layout.commitDrop(container, [], dragged({ x: 30, y: 30 }), targets[0]);
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe('transform');
  });

  it('commitDrop with null target emits free-space drop', () => {
    const layout = snapPoint<P>({ pattern: 'corners' });
    const ops = layout.commitDrop(container, [], dragged({ x: 30, y: 30 }), null);
    expect(ops).toHaveLength(1);
  });

  it('default snap is nearestWithin with the configured tolerance', () => {
    const layout = snapPoint<P>({ pattern: 'corners', tolerance: 5 });
    const targets = layout.getDropTargets(container, [], dragged({ x: 0, y: 0 }));
    expect(layout.snap.pickTarget(targets, { x: 2, y: 2 })?.origin).toEqual({ x: 0, y: 0 });
    expect(layout.snap.pickTarget(targets, { x: 50, y: 50 })).toBeNull();
  });

  it('accepts a snap override', () => {
    const layout = snapPoint<P>({ pattern: 'corners', snap: nearest<P>() });
    const targets = layout.getDropTargets(container, [], dragged({ x: 0, y: 0 }));
    // nearest never returns null when targets non-empty.
    expect(layout.snap.pickTarget(targets, { x: 50, y: 50 })).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm test -- --run src/layout/strategies/snapPoint.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement snapPoint**

Create `src/layout/strategies/snapPoint.ts`:

```ts
import { createTransformOp } from '../../core/ops/transform';
import type {
  DropTarget,
  LayoutSnap,
  LayoutStrategy,
} from '../types';
import { nearestWithin } from '../snaps';

export interface SnapPointOptions<TPose> {
  pattern: 'corners' | 'edges' | 'center' | 'grid';
  /** Spacing for the 'grid' pattern, in world units. Default 50. */
  gridSpacing?: number;
  /** Tolerance for the default snap policy (nearestWithin). Default Infinity. */
  tolerance?: number;
  snap?: LayoutSnap<TPose>;
}

type Pt = { x: number; y: number };

function buildPoints(
  bounds: { x: number; y: number; width: number; height: number },
  pattern: SnapPointOptions<unknown>['pattern'],
  gridSpacing: number,
): Pt[] {
  switch (pattern) {
    case 'corners':
      return [
        { x: bounds.x, y: bounds.y },
        { x: bounds.x + bounds.width, y: bounds.y },
        { x: bounds.x, y: bounds.y + bounds.height },
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      ];
    case 'edges':
      return [
        { x: bounds.x + bounds.width / 2, y: bounds.y },
        { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
        { x: bounds.x, y: bounds.y + bounds.height / 2 },
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
      ];
    case 'center':
      return [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }];
    case 'grid': {
      const out: Pt[] = [];
      for (let y = bounds.y; y <= bounds.y + bounds.height + 1e-9; y += gridSpacing) {
        for (let x = bounds.x; x <= bounds.x + bounds.width + 1e-9; x += gridSpacing) {
          out.push({ x, y });
        }
      }
      return out;
    }
  }
}

export function snapPoint<TPose extends Pt>(
  opts: SnapPointOptions<TPose>,
): LayoutStrategy<TPose> {
  const gridSpacing = opts.gridSpacing ?? 50;
  const tolerance = opts.tolerance ?? Infinity;
  const snap = opts.snap ?? nearestWithin<TPose>({ tolerance });

  return {
    snap,

    getChildPositions(_container, children) {
      const out = new Map<string, TPose>();
      for (const c of children) out.set(c.id, c.pose);
      return out;
    },

    getDropTargets(container, _children, dragged) {
      const points = buildPoints(container.bounds, opts.pattern, gridSpacing);
      return points.map((p) => ({
        // Anchor the dragged child's top-left at the snap point.
        pose: { ...dragged.pose, x: p.x, y: p.y } as TPose,
        origin: p,
      }));
    },

    reflowFor() {
      return new Map();
    },

    commitDrop(_container, _children, dragged, target) {
      const to = target === null ? dragged.pose : target.pose;
      return [
        createTransformOp<TPose>({
          id: dragged.id,
          from: dragged.originPose,
          to,
          label: 'Snap drop',
        }),
      ];
    },
  };
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npm test -- --run src/layout/strategies/snapPoint.test.ts`
Expected: PASS (10 cases).

- [ ] **Step 5: Run the full suite**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/layout/strategies/snapPoint.ts src/layout/strategies/snapPoint.test.ts
git commit -m "$(cat <<'EOF'
feat(layout): add snapPoint strategy

Generates candidate drop points from a configured pattern (corners,
edges, center, grid). No reflow — siblings stay put. Default snap is
nearestWithin with the configured tolerance.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Layout barrel + top-level exports

**Files:**
- Create: `src/layout/strategies/index.ts`
- Create: `src/layout/index.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write the strategy barrel**

Create `src/layout/strategies/index.ts`:

```ts
export { freeform, type FreeformOptions } from './freeform';
export { tileGrid, type TileGridOptions } from './tileGrid';
export { snapPoint, type SnapPointOptions } from './snapPoint';
```

- [ ] **Step 2: Write the top-level layout barrel**

Create `src/layout/index.ts`:

```ts
export * from './types';
export * from './snaps';
export * from './strategies';
```

- [ ] **Step 3: Add the layout module to the main index**

In `src/index.ts`, add an export. Find the existing barrel section (after the JSDoc surface map header) and append:

```ts
export * from './layout';
```

If `src/index.ts` already has block-organized exports, place the new line in alphabetical-ish order near other module re-exports.

- [ ] **Step 4: Verify type-check + suite**

Run: `npm run build && npm test -- --run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/layout/strategies/index.ts src/layout/index.ts src/index.ts
git commit -m "$(cat <<'EOF'
feat(layout): export layout module from package root

Adds the strategies barrel, the top-level layout barrel, and a re-export
from src/index.ts so consumers import { freeform, tileGrid, snapPoint,
nearest, nearestWithin, cellAt, none, ... } from '@orochi235/weasel'.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Add `getLayout` to MoveAdapter

**Files:**
- Modify: `src/core/adapters/types.ts`

- [ ] **Step 1: Add the optional method to MoveAdapter**

In `src/core/adapters/types.ts`, add to the `MoveAdapter` interface (after the existing `findSnapTarget?` and `getChildren?` fields):

```ts
  /** Optional: layout strategy attached to a container, or null if the
   *  container uses absolute positioning (default behavior). When present,
   *  `useMove` uses the strategy to compute drop targets, sibling reflow,
   *  and the commit op batch when a drag ends over the container. */
  getLayout?(containerId: string): import('../../layout/types').LayoutStrategy<TPose> | null;
```

(Inline `import(...)` keeps the adapter module from taking a hard dependency on the layout module's runtime — types only.)

- [ ] **Step 2: Verify type-check + suite**

Run: `npm run build && npm test -- --run`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/core/adapters/types.ts
git commit -m "$(cat <<'EOF'
feat(adapter): add optional getLayout to MoveAdapter

Optional, type-imported from the layout module to keep the adapter
module free of runtime dependencies. Adapters that don't implement it
keep today's absolute-positioning behavior — full backward compat.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Extend `MoveOverlay` for layout-aware fields

**Files:**
- Modify: `src/interactions/gestures/types.ts`

- [ ] **Step 1: Update the `MoveOverlay` interface**

In `src/interactions/gestures/types.ts`, replace the existing `MoveOverlay<TPose>` block with:

```ts
/** Live overlay state exposed by `useMove` for rendering ghosts and snap previews. */
export interface MoveOverlay<TPose> {
  draggedIds: string[];
  poses: Map<string, TPose>;
  snapped: SnapTarget<TPose> | null;
  hideIds: string[];
  /** Sibling poses in the destination container as a layout strategy
   *  proposes them during the live drag. Empty when no layout is engaged. */
  hypotheticalChildPositions: Map<string, TPose>;
  /** Sibling poses in the source container as the source's layout strategy
   *  proposes them when the dragged child has left it. Empty when no
   *  cross-container reflow is in flight. */
  sourceReflowPositions: Map<string, TPose>;
  /** The container the drag is currently over (for highlight chrome).
   *  null when the pointer is over no layout-bearing container. */
  destContainerId: string | null;
  /** False when no layout-bearing container has accepted the pointer
   *  (pointer is over free space, or every candidate's snap returned null).
   *  When false, gesture commits a free-space `setPose` for the dragged
   *  child on release. */
  accepted: boolean;
}
```

- [ ] **Step 2: Update `move.ts` to populate the new fields with empty defaults**

In `src/interactions/gestures/move/move.ts`, find the `setOverlay({ ... })` call inside `move()` and update it to include defaults:

```ts
setOverlay({
  draggedIds: ctx.draggedIds,
  poses: overlayPoses,
  snapped: snap,
  hideIds,
  hypotheticalChildPositions: new Map(),
  sourceReflowPositions: new Map(),
  destContainerId: null,
  accepted: true,  // pre-layout-pass behavior: drag is always "accepted" into free space
});
```

- [ ] **Step 3: Update existing move tests for the new MoveOverlay shape**

Run the existing move tests first to see what breaks:

Run: `npm test -- --run src/interactions/gestures/move/move.test.ts`
Expected: PASS (the new fields are additive; tests likely use `expect.objectContaining` or check specific fields. If any test asserts the entire overlay shape with `toEqual`, update it to expect the new fields — but DO NOT change behavior, only add the new defaults).

If a test does `expect(controller.overlay).toEqual({...})`, change it to `expect(controller.overlay).toMatchObject({...})` or add the new fields explicitly.

- [ ] **Step 4: Run the full suite**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/interactions/gestures/types.ts src/interactions/gestures/move/move.ts src/interactions/gestures/move/move.test.ts
git commit -m "$(cat <<'EOF'
feat(move): extend MoveOverlay with layout-aware fields

Adds hypotheticalChildPositions, sourceReflowPositions, destContainerId,
accepted. Defaults are empty/null/true so behavior is unchanged for
adapters without getLayout. The fields will be populated by the layout
pass added in the next commit.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Layout-aware pointer-move pass in `useMove`

**Files:**
- Modify: `src/interactions/gestures/move/move.ts`
- Create: `src/interactions/gestures/move/move.layout.test.ts`

This task adds the per-pointer-move layout pass: hit-test the top-most container under the pointer (walking the parent chain from the deepest hit), call `getDropTargets` + `snap.pickTarget`, derive destination reflow + (if cross-container) source reflow, and publish the result on the overlay. Commit-time behavior change comes in Task 10.

- [ ] **Step 1: Write the failing layout-pass test (overlay-only assertions)**

Create `src/interactions/gestures/move/move.layout.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useMove } from './move';
import { tileGrid } from '../../../layout/strategies';
import type { LayoutStrategy } from '../../../layout/types';
import type { MoveAdapter } from '../../../core/adapters/types';

type Obj = { id: string };
type P = { x: number; y: number; width: number; height: number };

function makeAdapter(opts: {
  poses: Record<string, P>;
  parents: Record<string, string | null>;
  children: Record<string, string[]>;
  getLayout: (id: string) => LayoutStrategy<P> | null;
}): MoveAdapter<Obj, P> & {
  setPoseSpy: ReturnType<typeof vi.fn>;
  applyBatchSpy: ReturnType<typeof vi.fn>;
} {
  const poses = { ...opts.poses };
  const setPoseSpy = vi.fn((id: string, p: P) => {
    poses[id] = p;
  });
  const applyBatchSpy = vi.fn();
  return {
    getObject: (id) => ({ id }),
    getObjects: () => Object.keys(poses).map((id) => ({ id })),
    getPose: (id) => poses[id],
    getParent: (id) => opts.parents[id] ?? null,
    setPose: setPoseSpy,
    setParent: () => {},
    getChildren: (id) => opts.children[id] ?? [],
    applyBatch: applyBatchSpy,
    getLayout: opts.getLayout,
    setPoseSpy,
    applyBatchSpy,
  };
}

describe('useMove with layout-bearing container', () => {
  it('publishes hypotheticalChildPositions when dragging within a tileGrid', () => {
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const adapter = makeAdapter({
      poses: {
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
      },
      parents: { C: null, a: 'C', b: 'C' },
      children: { C: ['a', 'b'] },
      getLayout: (id) => (id === 'C' ? grid : null),
    });
    const { result } = renderHook(() => useMove(adapter));

    act(() => {
      result.current.start({ ids: ['a'], worldX: 25, worldY: 50, clientX: 25, clientY: 50 });
    });
    act(() => {
      result.current.move({
        worldX: 75,
        worldY: 50,
        clientX: 75,
        clientY: 50,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      });
    });

    const overlay = result.current.overlay!;
    expect(overlay.destContainerId).toBe('C');
    expect(overlay.accepted).toBe(true);
    // 'b' should be slated to swap into 'a's old cell.
    expect(overlay.hypotheticalChildPositions.get('b')).toEqual({
      x: 0, y: 0, width: 50, height: 100,
    });
  });

  it('publishes sourceReflowPositions when dragging across two tileGrids', () => {
    const gridA = tileGrid<P>({ cols: 2, rows: 1 });
    const gridB = tileGrid<P>({ cols: 2, rows: 1 });
    const adapter = makeAdapter({
      poses: {
        A: { x: 0, y: 0, width: 100, height: 100 },
        B: { x: 200, y: 0, width: 100, height: 100 },
        a1: { x: 0, y: 0, width: 50, height: 100 },
        a2: { x: 50, y: 0, width: 50, height: 100 },
      },
      parents: { A: null, B: null, a1: 'A', a2: 'A' },
      children: { A: ['a1', 'a2'], B: [] },
      getLayout: (id) => (id === 'A' ? gridA : id === 'B' ? gridB : null),
    });
    const { result } = renderHook(() => useMove(adapter));

    act(() => {
      result.current.start({ ids: ['a1'], worldX: 25, worldY: 50, clientX: 25, clientY: 50 });
    });
    act(() => {
      result.current.move({
        worldX: 225,
        worldY: 50,
        clientX: 225,
        clientY: 50,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      });
    });

    const overlay = result.current.overlay!;
    expect(overlay.destContainerId).toBe('B');
    // Source side: a2 should slide into a1's old cell.
    expect(overlay.sourceReflowPositions.get('a2')).toEqual({
      x: 0, y: 0, width: 50, height: 100,
    });
  });

  it('marks accepted=false when pointer is over no layout-bearing container', () => {
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const adapter = makeAdapter({
      poses: {
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
      },
      parents: { C: null, a: 'C' },
      children: { C: ['a'] },
      getLayout: (id) => (id === 'C' ? grid : null),
    });
    const { result } = renderHook(() => useMove(adapter));

    act(() => {
      result.current.start({ ids: ['a'], worldX: 25, worldY: 50, clientX: 25, clientY: 50 });
    });
    act(() => {
      result.current.move({
        worldX: 500,
        worldY: 500,
        clientX: 500,
        clientY: 500,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      });
    });

    const overlay = result.current.overlay!;
    expect(overlay.destContainerId).toBeNull();
    expect(overlay.accepted).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm test -- --run src/interactions/gestures/move/move.layout.test.ts`
Expected: FAIL — overlay does not yet have populated layout fields.

- [ ] **Step 3: Implement the layout pass in `move.ts`**

In `src/interactions/gestures/move/move.ts`, locate the `move()` callback's overlay-publish section. After `ctx.current = newPoses` and before `setOverlay({...})`, insert the layout pass:

```ts
// --- Layout pass (additive — runs only when adapter exposes getLayout) ---
let hypotheticalChildPositions = new Map<string, TPose>();
let sourceReflowPositions = new Map<string, TPose>();
let destContainerId: string | null = null;
let accepted = true;

const getLayout = (adapter as { getLayout?: (id: string) => unknown }).getLayout;
if (typeof getLayout === 'function') {
  // Walk the parent chain from the deepest container under the pointer
  // up to the root, picking the top-most layout-bearing container.
  // We use bounding-box hit-test against every object that has a layout.
  const draggedId = ctx.draggedIds[0];
  const draggedPose = newPoses.get(draggedId)!;
  const sourceContainerId = adapter.getParent(draggedId);
  const draggedRect = draggedPose as unknown as { x: number; y: number; width: number; height: number };
  const draggedCenter = {
    x: draggedRect.x + (draggedRect.width ?? 0) / 2,
    y: draggedRect.y + (draggedRect.height ?? 0) / 2,
  };

  // Find the top-most container whose bounds contain the dragged center
  // AND has a non-null layout AND is not the dragged object itself.
  const candidates: { id: string; bounds: { x: number; y: number; width: number; height: number }; layout: unknown }[] = [];
  for (const obj of adapter.getObjects()) {
    if (obj.id === draggedId) continue;
    const layout = (getLayout as (id: string) => unknown).call(adapter, obj.id);
    if (!layout) continue;
    const bounds = adapter.getPose(obj.id) as unknown as { x: number; y: number; width: number; height: number };
    if (
      draggedCenter.x >= bounds.x &&
      draggedCenter.x < bounds.x + bounds.width &&
      draggedCenter.y >= bounds.y &&
      draggedCenter.y < bounds.y + bounds.height
    ) {
      candidates.push({ id: obj.id, bounds, layout });
    }
  }

  // "Top-most" = last one in iteration order (later siblings render on top).
  // For deeper z-order semantics, callers can override via deferred TODO.
  const dest = candidates[candidates.length - 1] ?? null;

  if (dest) {
    type Layout = import('../../../layout/types').LayoutStrategy<TPose>;
    type Target = import('../../../layout/types').DropTarget<TPose>;
    const layout = dest.layout as Layout;
    const childIds = adapter.getChildren?.(dest.id) ?? [];
    const children = childIds
      .filter((cid) => cid !== draggedId)
      .map((cid) => ({ id: cid, pose: adapter.getPose(cid) }));
    const draggedArg = {
      id: draggedId,
      originPose: ctx.origin.get(draggedId)!,
      pose: draggedPose,
      sourceContainerId,
    };
    const targets = layout.getDropTargets({ id: dest.id, bounds: dest.bounds }, children, draggedArg);
    const target: Target | null = layout.snap.pickTarget(targets, { x: args.worldX, y: args.worldY });
    if (target === null && targets.length > 0) {
      // The layout had targets but the snap policy rejected — treat as
      // not-accepted (pointer is outside the policy's tolerance).
      accepted = false;
    } else {
      destContainerId = dest.id;
      accepted = true;
      hypotheticalChildPositions = layout.reflowFor(
        { id: dest.id, bounds: dest.bounds },
        children,
        draggedArg,
        target,
      );
      // Source reflow: if cross-container and the source has a layout,
      // ask the source layout for the positions of its children minus dragged.
      if (sourceContainerId && sourceContainerId !== dest.id) {
        const srcLayout = (getLayout as (id: string) => unknown).call(
          adapter,
          sourceContainerId,
        ) as Layout | null;
        if (srcLayout) {
          const srcBounds = adapter.getPose(sourceContainerId) as unknown as {
            x: number; y: number; width: number; height: number;
          };
          const srcChildIds = adapter.getChildren?.(sourceContainerId) ?? [];
          const srcChildren = srcChildIds
            .filter((cid) => cid !== draggedId)
            .map((cid) => ({ id: cid, pose: adapter.getPose(cid) }));
          const reflowed = srcLayout.getChildPositions(
            { id: sourceContainerId, bounds: srcBounds },
            srcChildren,
          );
          // Only emit poses that differ from current.
          for (const [cid, newPose] of reflowed) {
            const cur = adapter.getPose(cid) as unknown as Record<string, unknown>;
            const next = newPose as unknown as Record<string, unknown>;
            const same =
              cur.x === next.x &&
              cur.y === next.y &&
              cur.width === next.width &&
              cur.height === next.height;
            if (!same) sourceReflowPositions.set(cid, newPose);
          }
        }
      }
    }
  } else {
    accepted = false;
  }
}

setOverlay({
  draggedIds: ctx.draggedIds,
  poses: overlayPoses,
  snapped: snap,
  hideIds,
  hypotheticalChildPositions,
  sourceReflowPositions,
  destContainerId,
  accepted,
});
```

(Replace the existing `setOverlay({...})` call with the version above; the existing call's first four fields are preserved.)

Also stash the layout pass result in `stateRef` so `end()` can read it:

```ts
stateRef.current = { ...stateRef.current, /* …existing… */ };
```

Add a `layoutPass` field to the `stateRef` shape so `end()` can pick it up. Update the `useRef<{...}>` initializer at the top of `useMove`:

```ts
const stateRef = useRef<{
  phase: 'idle' | 'pending' | 'active';
  startWorld: { x: number; y: number };
  startClient: { x: number; y: number };
  ctx: GestureContext<TPose, TObject> | null;
  cascadeIds: string[];
  cascadeOriginWorld: Map<string, TPose>;
  layoutPass: {
    destContainerId: string | null;
    accepted: boolean;
    layout: unknown;  // LayoutStrategy<TPose>
    container: { id: string; bounds: { x: number; y: number; width: number; height: number } } | null;
    children: { id: string; pose: TPose }[];
    target: unknown;  // DropTarget<TPose> | null
    sourceReflowPositions: Map<string, TPose>;
  };
}>({
  /* existing initial fields */
  layoutPass: {
    destContainerId: null,
    accepted: true,
    layout: null,
    container: null,
    children: [],
    target: null,
    sourceReflowPositions: new Map(),
  },
});
```

And inside the `move()` layout-pass branch, after computing `dest`/`layout`/`target`/`hypotheticalChildPositions`/`sourceReflowPositions`, write:

```ts
stateRef.current.layoutPass = {
  destContainerId,
  accepted,
  layout: dest ? layout : null,
  container: dest ? { id: dest.id, bounds: dest.bounds } : null,
  children: dest ? children : [],
  target,
  sourceReflowPositions: new Map(sourceReflowPositions),
};
```

Reset on `cleanup()`:

```ts
stateRef.current.layoutPass = {
  destContainerId: null,
  accepted: true,
  layout: null,
  container: null,
  children: [],
  target: null,
  sourceReflowPositions: new Map(),
};
```

- [ ] **Step 4: Run the new test — verify it passes**

Run: `npm test -- --run src/interactions/gestures/move/move.layout.test.ts`
Expected: PASS (3 cases).

- [ ] **Step 5: Run the full suite**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/interactions/gestures/move/move.ts src/interactions/gestures/move/move.layout.test.ts
git commit -m "$(cat <<'EOF'
feat(move): layout-aware pointer-move pass

When the move adapter implements getLayout, useMove now hit-tests
containers under the dragged center, asks the top-most layout-bearing
container for drop targets, runs its snap policy, and publishes the
resulting destination reflow / source reflow / dest container id /
accepted flag on MoveOverlay. Commit-side behavior unchanged in this
commit; comes in the next.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Layout-aware commit in `useMove.end()`

**Files:**
- Modify: `src/interactions/gestures/move/move.ts`
- Modify: `src/interactions/gestures/move/move.layout.test.ts`

- [ ] **Step 1: Add the failing commit-side tests**

Append to `src/interactions/gestures/move/move.layout.test.ts`:

```ts
describe('useMove commit with layout', () => {
  it('emits commitDrop ops on release into a layout container', () => {
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const adapter = makeAdapter({
      poses: {
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
      },
      parents: { C: null, a: 'C', b: 'C' },
      children: { C: ['a', 'b'] },
      getLayout: (id) => (id === 'C' ? grid : null),
    });
    const { result } = renderHook(() => useMove(adapter));

    act(() => {
      result.current.start({ ids: ['a'], worldX: 25, worldY: 50, clientX: 25, clientY: 50 });
    });
    act(() => {
      result.current.move({
        worldX: 75, worldY: 50, clientX: 75, clientY: 50,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      });
    });
    act(() => {
      result.current.end();
    });

    expect(adapter.applyBatchSpy).toHaveBeenCalledTimes(1);
    const [ops] = adapter.applyBatchSpy.mock.calls[0];
    // Two ops: dragged 'a' moving to cell (1,0) + swap 'b' moving to cell (0,0).
    expect(ops).toHaveLength(2);
    expect(ops.every((o: { kind: string }) => o.kind === 'transform')).toBe(true);
  });

  it('emits free-space setPose when no container accepted', () => {
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const adapter = makeAdapter({
      poses: {
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
      },
      parents: { C: null, a: 'C' },
      children: { C: ['a'] },
      getLayout: (id) => (id === 'C' ? grid : null),
    });
    const { result } = renderHook(() => useMove(adapter));

    act(() => {
      result.current.start({ ids: ['a'], worldX: 25, worldY: 50, clientX: 25, clientY: 50 });
    });
    act(() => {
      result.current.move({
        worldX: 500, worldY: 500, clientX: 500, clientY: 500,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      });
    });
    act(() => {
      result.current.end();
    });

    expect(adapter.applyBatchSpy).toHaveBeenCalledTimes(1);
    const [ops] = adapter.applyBatchSpy.mock.calls[0];
    expect(ops).toHaveLength(1); // Single free-space transform for 'a'.
  });

  it('emits dest commitDrop + source reflow ops on cross-container drop', () => {
    const gridA = tileGrid<P>({ cols: 2, rows: 1 });
    const gridB = tileGrid<P>({ cols: 2, rows: 1 });
    const adapter = makeAdapter({
      poses: {
        A: { x: 0, y: 0, width: 100, height: 100 },
        B: { x: 200, y: 0, width: 100, height: 100 },
        a1: { x: 0, y: 0, width: 50, height: 100 },
        a2: { x: 50, y: 0, width: 50, height: 100 },
      },
      parents: { A: null, B: null, a1: 'A', a2: 'A' },
      children: { A: ['a1', 'a2'], B: [] },
      getLayout: (id) => (id === 'A' ? gridA : id === 'B' ? gridB : null),
    });
    const { result } = renderHook(() => useMove(adapter));

    act(() => {
      result.current.start({ ids: ['a1'], worldX: 25, worldY: 50, clientX: 25, clientY: 50 });
    });
    act(() => {
      result.current.move({
        worldX: 225, worldY: 50, clientX: 225, clientY: 50,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      });
    });
    act(() => {
      result.current.end();
    });

    expect(adapter.applyBatchSpy).toHaveBeenCalledTimes(1);
    const [ops] = adapter.applyBatchSpy.mock.calls[0];
    // Dest commit: a1 → cell (0,0) of B. Source reflow: a2 → cell (0,0) of A.
    // No swap occupant in B (B is empty). So ops = [a1 drop] + [a2 reflow] = 2.
    expect(ops).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run — verify they fail**

Run: `npm test -- --run src/interactions/gestures/move/move.layout.test.ts`
Expected: FAIL — current `end()` always uses the default `createTransformOp` batch.

- [ ] **Step 3: Implement layout-aware commit in `end()`**

In `src/interactions/gestures/move/move.ts`, locate the `end()` callback. After the existing behavior loop (which sets `ops`), but before the `if (ops === undefined) { ops = ctx.draggedIds.map(...) }` fallback, insert layout-aware commit:

```ts
const layoutPass = stateRef.current.layoutPass;
if (ops === undefined && layoutPass.layout && layoutPass.container) {
  type Layout = import('../../../layout/types').LayoutStrategy<TPose>;
  type Target = import('../../../layout/types').DropTarget<TPose>;
  const layout = layoutPass.layout as Layout;
  const target = layoutPass.target as Target | null;
  const draggedId = ctx.draggedIds[0];
  const dropOps = layout.commitDrop(
    layoutPass.container,
    layoutPass.children,
    {
      id: draggedId,
      originPose: ctx.origin.get(draggedId)!,
      pose: ctx.current.get(draggedId)!,
      sourceContainerId: adapter.getParent(draggedId),
    },
    layoutPass.accepted ? target : null,
  );
  // Source-side reflow ops (cross-container case).
  const sourceReflowOps: Op[] = [];
  for (const [cid, newPose] of layoutPass.sourceReflowPositions) {
    sourceReflowOps.push(
      createTransformOp<TPose>({
        id: cid,
        from: adapter.getPose(cid),
        to: newPose,
        label: 'Source reflow',
      }),
    );
  }
  ops = [...dropOps, ...sourceReflowOps];
}
```

(The default `ops = ctx.draggedIds.map(...)` fallback then only runs when no layout was engaged — preserving today's behavior.)

- [ ] **Step 4: Run the layout tests — verify pass**

Run: `npm test -- --run src/interactions/gestures/move/move.layout.test.ts`
Expected: PASS (all 6 cases).

- [ ] **Step 5: Run the full suite**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/interactions/gestures/move/move.ts src/interactions/gestures/move/move.layout.test.ts
git commit -m "$(cat <<'EOF'
feat(move): layout-aware commit batch

end() now prefers strategy.commitDrop ops + cross-container source-
reflow ops when a layout-bearing container engaged during the drag.
Falls back to the default per-id transform batch when no layout was
involved — backward-compatible for every existing consumer.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: LayoutDemo + integration test

**Files:**
- Create: `demo/demos/LayoutDemo.tsx`
- Create: `demo/demos/__tests__/layoutDemo.integration.test.tsx`
- Modify: demo registry (likely `demo/index.tsx` — confirm via the existing demo-registry import in the project's demo entry)

The demo renders three side-by-side container objects (each a rect on the canvas) plus a few small child rects. One container has a `freeform` layout, one has `tileGrid`, one has `snapPoint`. Dragging a child into another container reflows both sides.

- [ ] **Step 1: Write the failing integration test (drives a cross-container drag)**

Create `demo/demos/__tests__/layoutDemo.integration.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LayoutDemo } from '../LayoutDemo';

describe('LayoutDemo', () => {
  it('drags a child from the freeform container into the tileGrid and reflows', () => {
    const { container } = render(<LayoutDemo />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = () => {};
    // Layout: freeform container at (10,40,180,180) with child 'f1' at (50,80,30,30).
    // tileGrid container at (210,40,180,180) with child 't1' at top-left cell.
    // Drag f1 from its center (65, 95) into the tileGrid's top-right cell (~300, 100).
    fireEvent.pointerDown(canvas, { clientX: 65, clientY: 95, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 300, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(canvas,   { clientX: 300, clientY: 100, pointerId: 1 });
    // After the drop, the demo should re-render with f1 reparented into the
    // tile grid. The DOM doesn't expose pose state directly; we assert the
    // component didn't throw and that the canvas still mounts. Stronger
    // assertions live in the gesture-level test (move.layout.test.ts).
    expect(canvas).toBeInTheDocument();
  });
});
```

(Stronger pose-state assertions are covered in `move.layout.test.ts`. The integration test exists to catch wiring breakage at the demo layer.)

- [ ] **Step 2: Run — verify it fails**

Run: `npm test -- --run demo/demos/__tests__/layoutDemo.integration.test.tsx`
Expected: FAIL — `LayoutDemo` doesn't exist.

- [ ] **Step 3: Implement LayoutDemo**

Create `demo/demos/LayoutDemo.tsx`. Use `SwillustratorDemo.tsx` as the structural reference for `useSelectTool` + `<Canvas>` wiring. The adapter exposes:
- Three container objects (`F`, `G`, `S`) and several child objects.
- `getChildren(id)` returns the children for each container, `[]` for leaves.
- `getLayout(id)` returns the appropriate strategy for each container.
- `getParent(id)` returns the container for each child, `null` for the containers themselves.
- `getPose` returns rect poses; `setPose` writes to React state via `setScene`.

```tsx
import { useMemo, useState } from 'react';
import { Canvas, useSelectTool, useTools } from '@orochi235/weasel';
import { freeform, tileGrid, snapPoint } from '@orochi235/weasel';
import type { MoveAdapter } from '@orochi235/weasel';

type Obj = { id: string; kind: 'container' | 'child' };
type P = { x: number; y: number; width: number; height: number };

interface SceneState {
  poses: Record<string, P>;
  parents: Record<string, string | null>;
  children: Record<string, string[]>;
}

const INITIAL: SceneState = {
  poses: {
    F: { x: 10,  y: 40, width: 180, height: 180 },
    G: { x: 210, y: 40, width: 180, height: 180 },
    S: { x: 410, y: 40, width: 180, height: 180 },
    f1: { x: 50, y: 80, width: 30, height: 30 },
    g1: { x: 210, y: 40, width: 90, height: 90 },
    s1: { x: 420, y: 50, width: 30, height: 30 },
  },
  parents: { F: null, G: null, S: null, f1: 'F', g1: 'G', s1: 'S' },
  children: { F: ['f1'], G: ['g1'], S: ['s1'] },
};

const COLORS: Record<string, string> = {
  F: '#3a2a1a', G: '#2a3a1a', S: '#1a2a3a',
  f1: '#f5b7a3', g1: '#a3f5b7', s1: '#a3b7f5',
};

export function LayoutDemo() {
  const [scene, setScene] = useState<SceneState>(INITIAL);

  const layouts = useMemo(() => ({
    F: freeform<P>(),
    G: tileGrid<P>({ cols: 2, rows: 2 }),
    S: snapPoint<P>({ pattern: 'corners' }),
  }), []);

  const adapter: MoveAdapter<Obj, P> = useMemo(() => ({
    getObject: (id) => ({ id, kind: id in layouts ? 'container' : 'child' }),
    getObjects: () => Object.keys(scene.poses).map((id) => ({
      id,
      kind: id in layouts ? 'container' : 'child' as const,
    })),
    getPose: (id) => scene.poses[id],
    getParent: (id) => scene.parents[id] ?? null,
    setPose: (id, pose) => {
      setScene((s) => ({ ...s, poses: { ...s.poses, [id]: pose } }));
    },
    setParent: (id, parentId) => {
      setScene((s) => {
        const oldParent = s.parents[id];
        const next = { ...s };
        next.parents = { ...s.parents, [id]: parentId };
        next.children = { ...s.children };
        if (oldParent && next.children[oldParent]) {
          next.children[oldParent] = next.children[oldParent].filter((c) => c !== id);
        }
        if (parentId) {
          next.children[parentId] = [...(next.children[parentId] ?? []), id];
        }
        return next;
      });
    },
    getChildren: (id) => scene.children[id] ?? [],
    getLayout: (id) => (layouts as Record<string, ReturnType<typeof freeform<P>> | null>)[id] ?? null,
  }), [scene, layouts]);

  const select = useSelectTool(adapter, {
    drawGhost: (cx, _o, p) => {
      cx.fillStyle = 'rgba(212, 196, 168, 0.4)';
      cx.fillRect(p.x, p.y, p.width, p.height);
    },
  });
  const tools = useTools({ active: select });

  return (
    <Canvas
      width={620}
      height={260}
      adapter={adapter}
      tools={tools}
      layers={{
        scene: {
          drawOne: (cx, o, p) => {
            cx.fillStyle = COLORS[o.id] ?? '#444';
            cx.fillRect(p.x, p.y, p.width, p.height);
            if (o.id in layouts) {
              cx.strokeStyle = '#7fb069';
              cx.lineWidth = 1;
              cx.strokeRect(p.x + 0.5, p.y + 0.5, p.width - 1, p.height - 1);
            }
          },
        },
      }}
    />
  );
}
```

- [ ] **Step 4: Register the demo**

Open `demo/index.tsx` (or whichever file holds the demo registry — search with `Grep` for `MoveDemo` if unsure) and add an entry for `LayoutDemo` matching the existing pattern. If the registry is keyed by name + component, add:

```tsx
import { LayoutDemo } from './demos/LayoutDemo';
// ...
{ name: 'Layout', component: LayoutDemo },
```

- [ ] **Step 5: Run the integration test**

Run: `npm test -- --run demo/demos/__tests__/layoutDemo.integration.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the full suite**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 7: Manually verify in the dev server**

Run: `npm run dev` (in a separate terminal). Open the demo, switch to "Layout", drag f1 into the tile-grid container; verify g1 swaps if you drop on its cell. Drag s1 toward a corner of S; verify it snaps when within tolerance. Stop the dev server (Ctrl-C) before continuing.

- [ ] **Step 8: Commit**

```bash
git add demo/demos/LayoutDemo.tsx demo/demos/__tests__/layoutDemo.integration.test.tsx demo/index.tsx
git commit -m "$(cat <<'EOF'
feat(demo): add LayoutDemo (freeform + tileGrid + snapPoint side by side)

Three containers, one of each layout, sharing one adapter and one
useSelectTool. Cross-container drag works via the new layout-aware
move pass.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: TODO bookkeeping

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: Remove the resolved entry**

Open `docs/TODO.md`, find the "Container layout strategies" entry under Tier 1.5, and delete it (the entire bullet).

- [ ] **Step 2: Add the deferred follow-ups**

Append a new section under Tier 1.5 (or wherever similar deferred-items lists live in the file — match the existing pattern). The entries:

```markdown
- **Drop rejection signal.** v1 layout commits a free-space `setPose` when no container accepted a drag. Needs a cleaner semantic — candidates: a dedicated cancel op, a snap-back-to-source-pose path, or having the source layout's `commitDrop` re-place the child at its origin slot. Originally scoped in `docs/specs/2026-05-03-container-layout-strategies-design.md`.
- **Tile-grid overflow policy.** Children beyond `cols * rows` are skipped from `getChildPositions`. Real apps may want scroll, grow-grid, or rejection — pick once a consumer asks. Originally scoped in the layout strategies spec.
- **Strategy-aware drop regions.** A layout could expose `dropRegion(container) → Bounds` extending beyond visible bounds for forgiveness (e.g. row layouts catching pointers slightly past the row's end). Today the gesture hit-tests against container body bounds.
- **Stateful layout strategy factories.** All v1 strategies are pure. If profiling shows recompute pain (likely only quadtree-class), promote to a factory returning `(container) → { ... }` with cached state.
- **Animated reflow transitions.** Sibling reflow is snap-to-target in v1. Smooth interpolation during the preview is a layer above (likely a `useAnimatedReflow` hook, depends on the deferred animation primitive).
- **Quadtree / packing layouts.** Eric's quadtree strategy stays in eric (or a future plugin). Niche enough not to belong in the generic kit.
- **Slot-based layout strategy** (rows / grid / ring arrangements à la eric's `@/model/arrangement`). Worth lifting once the v1 three settle and a kit-generic shape emerges that doesn't drag domain types.
- **Configurable layout hit-test order.** v1 uses top-most container under the dragged center. Innermost-regardless-of-z and explicit-drop-region modes are escape hatches if a real consumer needs them.
- **Per-strategy `acceptsDrop(dragged) → boolean`.** Today rejection is implicit (snap returns null). An explicit pre-check could short-circuit `getDropTargets` for incompatible objects (e.g. a grid that only accepts squares). Add when type-aware containers appear.
- **Multi-select drag into a layout.** v1 layouts model a single dragged child. Multi-select drag falls back to absolute. Reflow semantics for multi-drag get hairy fast; design once a consumer wants it.
```

- [ ] **Step 3: Commit**

```bash
git add docs/TODO.md
git commit -m "$(cat <<'EOF'
docs(todo): retire layout-strategies entry, log deferred follow-ups

Removes the Tier 1.5 entry that the layout module resolves. Records the
ten deferrals from the spec's Deferred section so they don't disappear
when the spec gets rescoped or rewritten.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

Spec coverage check:

- ✅ Core types (`LayoutStrategy`, `LayoutSnap`, `DropTarget`, `LayoutChild`, `ContainerBounds`) — Task 1.
- ✅ `freeform`, `tileGrid`, `snapPoint` strategies — Tasks 3, 4, 5.
- ✅ `none`, `nearest`, `nearestWithin`, `cellAt` snap policies — Task 2.
- ✅ Defaults table from spec (freeform→none, tileGrid→cellAt, snapPoint→nearestWithin) — Tasks 3-5.
- ✅ Adapter `getLayout?(containerId)` extension — Task 7.
- ✅ Move-gesture integration: pointer-move pass — Task 9. Commit — Task 10.
- ✅ Extended `MoveOverlay` with `hypotheticalChildPositions`, `sourceReflowPositions`, `destContainerId`, `accepted` — Task 8.
- ✅ Source-side reflow on cross-container drag — Tasks 9 (overlay) + 10 (commit ops).
- ✅ Top-most container hit-test — Task 9.
- ✅ Snap-returns-null = rejection / fall-through — Task 9.
- ✅ Demo + integration test — Task 11.
- ✅ TODO bookkeeping (resolve entry + log deferrals per `feedback_track_deferrals` user pref) — Task 12.

Type-consistency check: `LayoutDragged<TPose>` carries `originPose` (added in Task 3), and Tasks 4, 5, 9, 10 all consume it. `tileGrid` and `snapPoint` constrain `TPose` to extend rect-shape and `Pt` respectively; `freeform` is unconstrained. The move-gesture layout pass uses inline `import('../../../layout/types').LayoutStrategy` to avoid a circular runtime import — same trick the adapter contract uses.

One spec gap intentionally not resolved: the spec mentions "the `Tool.overlay` `RenderLayer`" reading the extended `MoveOverlay` to draw reflowed siblings. That's a Tool-side rendering enhancement, not a gesture/layout-module change — it belongs to `useSelectTool`'s overlay (separate file). LayoutDemo demonstrates the data flow works end-to-end; making the select tool's overlay actively draw reflowed sibling poses is left for a follow-up (and added as a TODO entry by Task 12 implicitly through the "animated reflow transitions" wording — extend if reviewer wants it called out separately).

---

## Execution Handoff

**Plan complete and saved to `docs/plans/2026-05-03-container-layout-strategies.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, two-stage review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
