# Revive Container Layout Reflow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconnect layout-driven container reflow to the live action path so dragging a single node into a layout-bearing container previews and commits sibling reflow.

**Architecture:** Port the reflow pass from the deleted `useMove` hook into `moveAction`, wire layout strategies in via a new optional `layout` dep sourced from `SceneCanvas`'s existing `layouts` prop, and render reflowing siblings through the existing preview-ghost channel (fold their poses into `moveAction`'s `previews` map). Plus a name-quality pass on `LayoutStrategy`.

**Tech Stack:** TypeScript, React, Vitest. Kit internals: `Scene`, `Action`/`OngoingHandle` (dispatcher), `LayoutStrategy`, `DepSchema`/`useDepSource`, `createTransformOp`.

**Spec:** `docs/superpowers/specs/2026-06-15-revive-container-layout-reflow-design.md`

**Reference (recovered deleted code):** the original hook-era pass is at `git show 0d9c0759^:src/interactions/actions/move/move.ts` — the layout pass is lines ~199–390 and the commit is ~490–525. The plan below reproduces the ported equivalents; the recovered file is only a cross-check.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/layout/types.ts` | `LayoutStrategy` contract | Modify — rename two methods |
| `src/layout/strategies/{freeform,tileGrid,snapPoint}.ts` | Built-in strategies | Modify — rename method impls |
| `src/layout/strategies/{freeform,tileGrid,snapPoint}.test.ts` | Strategy unit tests | Modify — rename calls |
| `src/interactions/gestures/types.ts` | Gesture/overlay types | Modify — delete `MoveOverlay` |
| `src/index.ts` | Public barrel | Modify — drop `MoveOverlay` export |
| `src/interactions/actions/depSchema.ts` | Action dep contracts | Modify — add `LayoutDep` + `layout` entry |
| `src/canvas/deps/layout.ts` | `layout` dep source | Create |
| `src/canvas/deps/index.ts` | deps barrel | Modify — export new source |
| `src/canvas/SceneCanvas.tsx` | Wires deps from props | Modify — call `useLayoutDepSource` |
| `src/interactions/actions/defaults/move.ts` | Move action | Modify — reflow pass + commit |
| `src/interactions/actions/defaults/move.layout.test.ts` | Action-path layout tests | Create |
| `demo/demos/__tests__/layoutDemo.integration.test.tsx` | E2E demo proof | Modify — unskip assertion |

---

## Task 1: Rename `LayoutStrategy` methods

Rename `getChildPositions → childPoses` (resting layout) and `reflowFor → reflowPoses` (mid-drag layout) — a parallel, pose-aligned pair. Pure rename across the strategy contract, the three implementations, and their tests. No behavior change.

**Files:**
- Modify: `src/layout/types.ts:53`, `:64`
- Modify: `src/layout/strategies/freeform.ts:21`, `:31`
- Modify: `src/layout/strategies/snapPoint.ts:64`, `:79`
- Modify: `src/layout/strategies/tileGrid.ts:81` (comment), `:117`, `:146`, `:170` (`this.getChildPositions`)
- Modify: `src/layout/strategies/freeform.test.ts`, `snapPoint.test.ts`, `tileGrid.test.ts`

- [ ] **Step 1: Rename in the contract** — `src/layout/types.ts`

Change the two method names in `interface LayoutStrategy<TPose>`:

```ts
  childPoses(
    container: LayoutContainer,
    children: ReadonlyArray<LayoutChild<TPose>>,
  ): Map<string, TPose>;
```

and

```ts
  reflowPoses(
    container: LayoutContainer,
    children: ReadonlyArray<LayoutChild<TPose>>,
    dragged: LayoutDragged<TPose>,
    target: DropTarget<TPose> | null,
  ): Map<string, TPose>;
```

- [ ] **Step 2: Rename impls in the three strategies**

In `freeform.ts`: `getChildPositions(_container, children)` → `childPoses(_container, children)`; `reflowFor()` → `reflowPoses()`.

In `snapPoint.ts`: `getChildPositions(_container, children)` → `childPoses(_container, children)`; `reflowFor()` → `reflowPoses()`.

In `tileGrid.ts`: `getChildPositions(container, children)` → `childPoses(container, children)`; `reflowFor(container, children, dragged, target)` → `reflowPoses(container, children, dragged, target)`; the internal call `this.getChildPositions(container, children)` (line ~170) → `this.childPoses(container, children)`; update the comment at line ~81 (`reflowFor` → `reflowPoses`).

- [ ] **Step 3: Rename in the three test files**

Replace every `.getChildPositions(` with `.childPoses(` and every `.reflowFor(` with `.reflowPoses(` in `freeform.test.ts`, `snapPoint.test.ts`, `tileGrid.test.ts`. Also update the `it('getChildPositions …')` / `it('reflowFor …')` description strings to the new names.

- [ ] **Step 4: Run the strategy tests**

Run: `npx vitest run src/layout/strategies`
Expected: PASS (same assertions, new method names).

- [ ] **Step 5: Verify no stale references remain**

Run: `grep -rn "getChildPositions\|reflowFor" src/ demo/ apps/`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/layout
git commit -m "refactor(layout): rename LayoutStrategy getChildPositions->childPoses, reflowFor->reflowPoses"
```

---

## Task 2: Delete the orphaned `MoveOverlay` type

`MoveOverlay<TPose>` (carrying the dead `hypotheticalChildPositions` / `sourceReflowPositions` fields) is exported publicly but never constructed — `useMove` was its only producer. Delete it. (`MoveOverlayStyle` in `useSelectTool.ts` is a *different* type — leave it.)

**Files:**
- Modify: `src/interactions/gestures/types.ts:114-135`
- Modify: `src/index.ts:578`

- [ ] **Step 1: Confirm it's truly orphaned**

Run: `grep -rn "MoveOverlay\b" src/ | grep -v "MoveOverlayStyle"`
Expected: only the `interface MoveOverlay` definition (`gestures/types.ts`) and its re-export (`index.ts`).

- [ ] **Step 2: Delete the interface**

In `src/interactions/gestures/types.ts`, remove the entire `/** Live overlay state … */ export interface MoveOverlay<TPose> { … }` block (the `draggedIds`/`poses`/`snapped`/`hideIds`/`hypotheticalChildPositions`/`sourceReflowPositions`/`destContainerId`/`accepted` interface).

- [ ] **Step 3: Drop the barrel export**

In `src/index.ts`, remove the `MoveOverlay,` line from the type export block (line ~578).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no remaining references).

- [ ] **Step 5: Commit**

```bash
git add src/interactions/gestures/types.ts src/index.ts
git commit -m "refactor(gestures): delete orphaned MoveOverlay type (no producer since useMove removal)"
```

---

## Task 3: Add the `layout` dep + wire it from `SceneCanvas`

A new optional `layout` dep gives `moveAction` access to per-container layout strategies. Sourced from `SceneCanvas`'s existing `layouts` prop (which today only feeds the unused canvas-adapter `getLayout`).

**Files:**
- Modify: `src/interactions/actions/depSchema.ts`
- Create: `src/canvas/deps/layout.ts`
- Modify: `src/canvas/deps/index.ts`
- Modify: `src/canvas/SceneCanvas.tsx` (near line 1989, the `use*DepSource` block)
- Test: `src/canvas/deps/layout.test.tsx`

- [ ] **Step 1: Add `LayoutDep` interface + schema entry** — `src/interactions/actions/depSchema.ts`

Add this interface near the other dep interfaces (e.g. above the `declare module './depRegistry'` block):

```ts
/**
 * Layout-strategy lookup by container id, consumed by `moveAction` to run
 * the drag-time reflow pass. Sourced by `<SceneCanvas>` from its `layouts`
 * prop. Optional: `getLayout` returns null for any container when no layout
 * is configured, so the reflow pass is a no-op then.
 */
export interface LayoutDep {
  getLayout(containerId: string): import('../../layout/types').LayoutStrategy<unknown> | null;
}
```

Add the entry inside `interface DepSchema { … }`:

```ts
    /**
     * Layout-strategy lookup. Sourced by `<SceneCanvas>` from `layouts`.
     * Optional: absent (or all-null) → `moveAction` skips reflow.
     */
    layout?: LayoutDep;
```

- [ ] **Step 2: Create the dep source** — `src/canvas/deps/layout.ts`

```ts
/**
 * `useLayoutDepSource` — wires the `layout` dep consumed by `moveAction`'s
 * drag-time reflow pass. Normalizes `<SceneCanvas>`'s `layouts` prop (a static
 * map or a resolver fn) into a single `getLayout(containerId)`. Always
 * registers; returns null per-container when no layout is configured, so the
 * reflow pass is a no-op without churning dep registration on prop changes.
 */
import { useRef } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { LayoutDep } from 'interactions/actions/depSchema';
import type { LayoutStrategy } from 'layout/types';

type LayoutsProp =
  | Record<string, LayoutStrategy<unknown>>
  | ((containerId: string) => LayoutStrategy<unknown> | null);

export function useLayoutDepSource(layouts: LayoutsProp | undefined): void {
  const ref = useRef(layouts);
  ref.current = layouts;

  useDepSource('layout', (): LayoutDep => ({
    getLayout: (containerId) => {
      const l = ref.current;
      if (!l) return null;
      return typeof l === 'function' ? l(containerId) : (l[containerId] ?? null);
    },
  }));
}
```

- [ ] **Step 3: Export from the deps barrel** — `src/canvas/deps/index.ts`

Add:

```ts
export { useLayoutDepSource } from './layout';
```

- [ ] **Step 4: Call it in `SceneCanvas`** — `src/canvas/SceneCanvas.tsx`

In `SceneCanvasInner`, in the `use*DepSource` block (just after `useNodeAtPointDepSource(pickEvery);`, ~line 1990), add:

```ts
  useLayoutDepSource(layouts);
```

`layouts` is already destructured from props (line ~703). Ensure `useLayoutDepSource` is imported from `./deps` (the file already imports the other `use*DepSource` hooks from there — add it to that import).

- [ ] **Step 5: Write the dep-source test** — `src/canvas/deps/layout.test.tsx`

```tsx
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { DepRegistryProvider, useDep } from 'interactions/actions/depRegistry';
import { useLayoutDepSource } from './layout';
import { freeform } from 'layout/strategies';
import type { ReactNode } from 'react';

const wrapper = ({ children }: { children: ReactNode }) => (
  <DepRegistryProvider>{children}</DepRegistryProvider>
);

describe('useLayoutDepSource', () => {
  it('resolves a static map by container id', () => {
    const ff = freeform<unknown>();
    const { result } = renderHook(() => {
      useLayoutDepSource({ C: ff });
      return useDep('layout');
    }, { wrapper });
    expect(result.current?.getLayout('C')).toBe(ff);
    expect(result.current?.getLayout('missing')).toBeNull();
  });

  it('resolves a resolver function', () => {
    const ff = freeform<unknown>();
    const { result } = renderHook(() => {
      useLayoutDepSource((id) => (id === 'X' ? ff : null));
      return useDep('layout');
    }, { wrapper });
    expect(result.current?.getLayout('X')).toBe(ff);
    expect(result.current?.getLayout('Y')).toBeNull();
  });

  it('returns null for every container when layouts is undefined', () => {
    const { result } = renderHook(() => {
      useLayoutDepSource(undefined);
      return useDep('layout');
    }, { wrapper });
    expect(result.current?.getLayout('C')).toBeNull();
  });
});
```

> NOTE: confirm the import names `DepRegistryProvider` / `useDep` against `src/interactions/actions/depRegistry.tsx` and an existing deps test (e.g. `src/canvas/deps/areaSelect.test.tsx`); match whatever provider/reader those use.

- [ ] **Step 6: Run the dep-source test**

Run: `npx vitest run src/canvas/deps/layout.test.tsx`
Expected: PASS.

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add src/interactions/actions/depSchema.ts src/canvas/deps/layout.ts src/canvas/deps/index.ts src/canvas/deps/layout.test.tsx src/canvas/SceneCanvas.tsx
git commit -m "feat(deps): add layout dep sourced from SceneCanvas layouts prop"
```

---

## Task 4: `moveAction` onMove reflow pass

Add the drag-time layout pass: walk containers for the deepest/topmost layout candidate under the dragged center, run snap, and fold destination + source reflow poses into `scratch.previews` so they render as ghosts via the existing preview channel. Single-select only.

**Files:**
- Modify: `src/interactions/actions/defaults/move.ts`
- Test: `src/interactions/actions/defaults/move.layout.test.ts` (created here; extended in Task 5)

- [ ] **Step 1: Add imports** — top of `move.ts`

Add to existing imports:

```ts
import type { Op } from 'core/ops/types';
import { createTransformOp } from 'core/ops/transform';
import { asNodeId } from 'core/scene/types';
import type { LayoutDep } from '../depSchema';
import type { LayoutStrategy, LayoutContainer, LayoutChild, DropTarget } from 'layout/types';
```

`NodeId` is already imported from `core/scene/types`; add `asNodeId` to that import rather than duplicating.

- [ ] **Step 2: Add the `LayoutPass` type + scratch fields**

Above `interface MoveScratch`, add:

```ts
/** Resolved layout drop for the latest onMove frame. Only set when a layout
 *  container accepted the drag (non-null snap target), single-select. */
interface LayoutPass {
  layout: LayoutStrategy<unknown>;
  container: LayoutContainer;
  children: LayoutChild<unknown>[];
  target: DropTarget<unknown>;
  /** Source-container leftovers that actually moved (id → new pose). */
  sourceReflow: Map<string, unknown>;
}
```

Add these fields to `interface MoveScratch`:

```ts
  /** Layout dep captured at start; undefined when not registered. */
  layout: LayoutDep | undefined;
  /** Ids folded into `previews` solely for sibling reflow (dest + source).
   *  Recomputed each onMove frame; tracked apart from roots/cascade so the
   *  commit path doesn't treat them as moved roots. */
  reflowIds: Set<NodeId>;
  /** Latest resolved layout pass, or null when no container accepted. */
  layoutPass: LayoutPass | null;
```

- [ ] **Step 3: Populate the new scratch fields in `start`**

Where `const policy = ctx.deps.resizePolicy …` is read, also read:

```ts
      const layout = ctx.deps.layout as LayoutDep | undefined;
```

In the `const scratch: MoveScratch = { … }` literal, add:

```ts
        layout,
        reflowIds: new Set<NodeId>(),
        layoutPass: null,
```

- [ ] **Step 4: Add the `runLayoutPass` helper** — module scope in `move.ts` (e.g. after `translatePoseGeneric`)

```ts
/** Drag-time layout pass. Walks containers for the deepest/topmost layout
 *  candidate under the dragged center, runs the strategy's snap, and folds
 *  destination + source reflow poses into `scratch.previews` (so they render
 *  as ghosts) and `scratch.reflowIds`. Sets `scratch.layoutPass` when a
 *  container accepts. Single-select only — caller guards on `ids.length === 1`. */
function runLayoutPass(scratch: MoveScratch, moveCtx: InvocationCtx): void {
  const layoutDep = scratch.layout;
  if (!layoutDep || !moveCtx.drag) return;
  const scene = scratch.scene;
  const draggedId = scratch.ids[0];
  const draggedPose = scratch.previews.get(draggedId);
  if (draggedPose === undefined) return;
  const sourceContainerId = scene.get(draggedId)?.parent ?? null;
  const dr = draggedPose as { x: number; y: number; width?: number; height?: number };
  const draggedCenter = { x: dr.x + (dr.width ?? 0) / 2, y: dr.y + (dr.height ?? 0) / 2 };

  type Layout = LayoutStrategy<unknown>;
  interface Candidate {
    id: NodeId;
    bounds: { x: number; y: number; width: number; height: number };
    layout: Layout;
    zPath: number[];
    depth: number;
  }
  const candidates: Candidate[] = [];
  const testInside = (cPose: unknown, layout: Layout): boolean => {
    if (layout.contains) return layout.contains(cPose, draggedCenter);
    const b = cPose as { x: number; y: number; width: number; height: number };
    return draggedCenter.x >= b.x && draggedCenter.x < b.x + b.width
      && draggedCenter.y >= b.y && draggedCenter.y < b.y + b.height;
  };
  const consider = (id: NodeId, zPath: number[]): void => {
    if (id === draggedId) return;
    const layout = layoutDep.getLayout(id as string);
    if (!layout) return;
    const node = scene.get(id);
    if (!node) return;
    if (!testInside(node.pose, layout)) return;
    candidates.push({
      id,
      bounds: node.pose as { x: number; y: number; width: number; height: number },
      layout,
      zPath,
      depth: zPath.length,
    });
  };
  const walk = (parentId: NodeId | null, parentPath: number[]): void => {
    const childIds = parentId === null ? scene.roots : scene.childrenOf(parentId);
    for (let i = 0; i < childIds.length; i++) {
      const childPath = [...parentPath, i];
      consider(childIds[i], childPath);
      walk(childIds[i], childPath);
    }
  };
  walk(null, []);

  // Deepest wins; sibling-index path breaks ties (higher z = later index).
  let dest: Candidate | null = null;
  for (const c of candidates) {
    if (dest === null) { dest = c; continue; }
    if (c.depth > dest.depth) { dest = c; continue; }
    if (c.depth < dest.depth) continue;
    let cAfter = false;
    for (let i = 0; i < c.zPath.length; i++) {
      if (c.zPath[i] > dest.zPath[i]) { cAfter = true; break; }
      if (c.zPath[i] < dest.zPath[i]) { cAfter = false; break; }
    }
    if (cAfter) dest = c;
  }
  if (!dest) return;

  const layout = dest.layout;
  const container: LayoutContainer = { id: dest.id as string, bounds: dest.bounds };
  const children: LayoutChild<unknown>[] = scene.childrenOf(dest.id)
    .filter((cid) => cid !== draggedId || sourceContainerId === (dest!.id as string))
    .map((cid) => ({ id: cid as string, pose: scene.get(cid)!.pose }));
  const draggedArg = {
    id: draggedId as string,
    originPose: scratch.startPoses.get(draggedId)!,
    pose: draggedPose,
    sourceContainerId,
  };
  const targets = layout.getDropTargets(container, children, draggedArg);
  const target = layout.snap.pickTarget(targets, { x: moveCtx.drag.current.x, y: moveCtx.drag.current.y });
  if (!target) return; // not accepted

  // Destination reflow → fold into previews (skip the dragged id itself).
  for (const [cid, pose] of layout.reflowPoses(container, children, draggedArg, target)) {
    if (asNodeId(cid) === draggedId) continue;
    scratch.previews.set(asNodeId(cid), pose);
    scratch.reflowIds.add(asNodeId(cid));
  }

  // Source reflow (cross-container) → fold changed leftovers into previews.
  const sourceReflow = new Map<string, unknown>();
  if (sourceContainerId && sourceContainerId !== (dest.id as string)) {
    const srcLayout = layoutDep.getLayout(sourceContainerId);
    const srcNode = scene.get(asNodeId(sourceContainerId));
    if (srcLayout && srcNode) {
      const srcContainer: LayoutContainer = {
        id: sourceContainerId,
        bounds: srcNode.pose as { x: number; y: number; width: number; height: number },
      };
      const srcChildren: LayoutChild<unknown>[] = scene.childrenOf(asNodeId(sourceContainerId))
        .filter((cid) => cid !== draggedId)
        .map((cid) => ({ id: cid as string, pose: scene.get(cid)!.pose }));
      for (const [cid, pose] of srcLayout.childPoses(srcContainer, srcChildren)) {
        const cur = scene.get(asNodeId(cid))!.pose as Record<string, unknown>;
        const next = pose as Record<string, unknown>;
        const same = cur.x === next.x && cur.y === next.y
          && cur.width === next.width && cur.height === next.height;
        if (same) continue;
        sourceReflow.set(cid, pose);
        scratch.previews.set(asNodeId(cid), pose);
        scratch.reflowIds.add(asNodeId(cid));
      }
    }
  }

  scratch.layoutPass = { layout, container, children, target, sourceReflow };
}
```

- [ ] **Step 5: Call the pass at the end of `onMove`**

In `onMove`, immediately after the existing `scratch.previews` repopulation loop (the `for (const [id, ori] of scratch.startPoses) { scratch.previews.set(...) }` that ends at line ~393), add:

```ts
          // Layout reflow pass — single-select only; no-op without a layout dep.
          scratch.reflowIds.clear();
          scratch.layoutPass = null;
          if (scratch.ids.length === 1) runLayoutPass(scratch, moveCtx);
```

(`previewIds()` already returns `scratch.previews.keys()`, so reflow ids are surfaced automatically.)

- [ ] **Step 6: Write the onMove test** — `src/interactions/actions/defaults/move.layout.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { moveAction } from './move';
import type { InvocationCtx } from '../invoker';
import { tileGrid } from 'layout/strategies';
import type { LayoutDep } from '../depSchema';
import type { NodeId } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';

type P = { x: number; y: number; width: number; height: number };

interface StubScene {
  poses: Map<string, P>;
  childMap: Map<string, NodeId[]>;
  roots: NodeId[];
  appliedBatches: Array<{ label: string; ops: Array<{ id: string; to: unknown }> }>;
  get(id: NodeId): { pose: P; parent: NodeId | null } | undefined;
  childrenOf(id: NodeId): readonly NodeId[];
  setPose(id: NodeId, pose: P): void;
  batch<T>(label: string, fn: () => T): T;
  applyBatch(ops: ReadonlyArray<{ id: string; to: unknown; label?: string }>, label: string): void;
  renderOrder(): NodeId[];
  move(): void;
  remove(): void;
  add(): NodeId;
}

function makeScene(
  poses: Record<string, P>,
  parents: Record<string, string | null>,
  childMap: Record<string, string[]>,
  roots: string[],
): StubScene {
  const p = new Map(Object.entries(poses));
  const c = new Map(Object.entries(childMap).map(([k, v]) => [k, v as NodeId[]]));
  return {
    poses: p,
    childMap: c,
    roots: roots as NodeId[],
    appliedBatches: [],
    get(id) {
      if (!p.has(id)) return undefined;
      return { pose: p.get(id)!, parent: (parents[id] ?? null) as NodeId | null };
    },
    childrenOf(id) { return c.get(id) ?? []; },
    setPose(id, pose) { p.set(id, pose); },
    batch(_label, fn) { return fn(); },
    applyBatch(ops, label) {
      this.appliedBatches.push({ label, ops: ops.map((o) => ({ id: o.id, to: o.to })) });
    },
    renderOrder() { return [...p.keys()] as NodeId[]; },
    move() {}, remove() {}, add() { return asNodeId('new'); },
  };
}

function makeCtx(scene: StubScene, selectionIds: string[], drag?: InvocationCtx['drag']): InvocationCtx {
  const grid = tileGrid<P>({ cols: 2, rows: 1 });
  const layout: LayoutDep = { getLayout: (id) => (id === 'C' ? (grid as never) : null) };
  return {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: { get: () => selectionIds as NodeId[] }, scene, layout },
    drag,
  } as unknown as InvocationCtx;
}

describe('moveAction layout reflow', () => {
  it('folds destination reflow into previews when dragging within a tileGrid', () => {
    // C is a 2x1 grid at (0,0,100,100); a in cell 0, b in cell 1.
    const scene = makeScene(
      {
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
      },
      { C: null, a: 'C', b: 'C' },
      { C: ['a', 'b'] },
      ['C'],
    );
    const handle = moveAction.invoker.start(makeCtx(scene, ['a']));
    // Drag a's center from cell 0 (x=25) to cell 1 (x=75): grid swaps b back to cell 0.
    handle.onMove!(makeCtx(scene, ['a'], {
      start: { x: 25, y: 50 },
      current: { x: 75, y: 50 },
      delta: { x: 50, y: 0 },
    }) as InvocationCtx);

    const ids = [...(handle.previewIds!() as Iterable<string>)];
    expect(ids).toContain('b'); // sibling reflowed into the preview channel
    const bPose = handle.previewPose!('b') as P;
    expect(bPose.x).toBe(0); // b moved to cell 0
  });
});
```

> NOTE: the exact grid swap geometry depends on `tileGrid`'s cell math — cross-check the expected `bPose.x` against `src/layout/strategies/tileGrid.test.ts` (`reflowPoses swaps occupant…`). Adjust the literal to match the strategy's actual output; the structural assertion (`ids` contains the sibling, its preview pose changed) is the invariant.

- [ ] **Step 7: Run the onMove test**

Run: `npx vitest run src/interactions/actions/defaults/move.layout.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck + run the full move suite (no regression)**

Run: `npx tsc --noEmit && npx vitest run src/interactions/actions/defaults/move.test.ts src/interactions/actions/defaults/move.behaviors.integration.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/interactions/actions/defaults/move.ts src/interactions/actions/defaults/move.layout.test.ts
git commit -m "feat(move): drag-time layout reflow pass folds sibling poses into preview channel"
```

---

## Task 5: `moveAction` onEnd layout commit

When a layout container accepted the drag (single-select), commit via the strategy's `commitDrop` plus source-reflow transform ops — one undoable batch — taking precedence over reparent-on-drop.

**Files:**
- Modify: `src/interactions/actions/defaults/move.ts` (the `onEnd` `'commit'` path)
- Test: `src/interactions/actions/defaults/move.layout.test.ts` (extend)

- [ ] **Step 1: Insert the layout-commit block in `onEnd`**

In `onEnd`, after the behavior-pipeline block and after the `if (dx === 0 && dy === 0) { scratch.previews.clear(); return; }` no-op guard, and **before** the `resolveParams(opts?.params)` reparent resolution, add:

```ts
          // Layout drop commit — takes precedence over reparent-on-drop when a
          // layout container accepted the drag this gesture (single-select).
          if (scratch.layout && scratch.ids.length === 1 && scratch.layoutPass) {
            const lp = scratch.layoutPass;
            const draggedId = scratch.ids[0];
            const draggedArg = {
              id: draggedId as string,
              originPose: scratch.startPoses.get(draggedId)!,
              pose: scratch.previews.get(draggedId) ?? scratch.startPoses.get(draggedId)!,
              sourceContainerId: scratch.scene.get(draggedId)?.parent ?? null,
            };
            const dropOps = lp.layout.commitDrop(lp.container, lp.children, draggedArg, lp.target);
            const reflowOps: Op[] = [];
            for (const [cid, pose] of lp.sourceReflow) {
              reflowOps.push(createTransformOp<unknown>({
                id: cid,
                from: scratch.scene.get(asNodeId(cid))!.pose,
                to: pose,
                label: 'Source reflow',
              }));
            }
            const ops = [...dropOps, ...reflowOps];
            if (ops.length > 0) {
              scratch.scene.applyBatch(ops, ops[0].label ?? 'Move', scratch.adapter);
            }
            scratch.previews.clear();
            return;
          }
```

- [ ] **Step 2: Extend the test with a commit assertion** — `move.layout.test.ts`

Add inside the `describe`:

```ts
  it('commits commitDrop ops on a same-container grid swap', () => {
    const scene = makeScene(
      {
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
      },
      { C: null, a: 'C', b: 'C' },
      { C: ['a', 'b'] },
      ['C'],
    );
    const handle = moveAction.invoker.start(makeCtx(scene, ['a']));
    const drag = { start: { x: 25, y: 50 }, current: { x: 75, y: 50 }, delta: { x: 50, y: 0 } };
    handle.onMove!(makeCtx(scene, ['a'], drag) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag) as InvocationCtx, 'commit');

    expect(scene.appliedBatches.length).toBe(1);
    const batch = scene.appliedBatches[0];
    // commitDrop relocates the dragged child; assert it produced ops.
    expect(batch.ops.length).toBeGreaterThan(0);
    expect(batch.ops.some((o) => o.id === 'a')).toBe(true);
  });

  it('falls through to translate commit when no layout accepts (no layoutPass)', () => {
    const scene = makeScene(
      { a: { x: 0, y: 0, width: 10, height: 10 } },
      { a: null }, {}, ['a'],
    );
    const handle = moveAction.invoker.start(makeCtx(scene, ['a']));
    const drag = { start: { x: 0, y: 0 }, current: { x: 5, y: 5 }, delta: { x: 5, y: 5 } };
    handle.onMove!(makeCtx(scene, ['a'], drag) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag) as InvocationCtx, 'commit');
    // No layoutPass → applyBatch NOT used; default path uses scene.batch+setPose.
    expect(scene.appliedBatches.length).toBe(0);
    expect(scene.poses.get('a')).toEqual({ x: 5, y: 5, width: 10, height: 10 });
  });
```

> NOTE: the second test's default-path expectation assumes the translate commit writes via `scene.batch` + `setPose` (the stub's `batch` just runs the fn, and `setPose` mutates `poses`). Confirm against `move.test.ts`'s existing default-commit assertions and adjust if the stub needs a `batch`-recording shim like that file uses.

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/interactions/actions/defaults/move.layout.test.ts`
Expected: PASS.

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add src/interactions/actions/defaults/move.ts src/interactions/actions/defaults/move.layout.test.ts
git commit -m "feat(move): commit layout drop via commitDrop + source-reflow ops"
```

---

## Task 6: Unskip the LayoutDemo integration proof + manual verification

The demo already wires `layouts` into `SceneCanvas`; its real reflow assertion is `.skip`ped. With the feature live, unskip and confirm end-to-end.

**Files:**
- Modify: `demo/demos/__tests__/layoutDemo.integration.test.tsx`

- [ ] **Step 1: Read the skipped test**

Run: `sed -n '1,120p' demo/demos/__tests__/layoutDemo.integration.test.tsx`
Identify the `it.skip('selects the child …')` block and the reflow assertions (`fLast`, `f1Last`, the `expect(...).toBe(10)` / `.not.toBe(50)` checks).

- [ ] **Step 2: Unskip and align**

Change `it.skip(` → `it(`. The skip reason cited a "2D ctx-stubbed assertion no longer applies under GL-only backend" — if the test drives the canvas through pointer events and asserts on committed scene poses (not 2D-context calls), it should now pass on the live reflow path. If the assertion reads canvas-2d state, rewrite it to assert on the scene's committed child poses after the simulated drag instead.

- [ ] **Step 3: Run the integration test**

Run: `npx vitest run demo/demos/__tests__/layoutDemo.integration.test.tsx`
Expected: PASS. If it fails on geometry literals, reconcile the expected poses against the actual `tileGrid`/`freeform` output (the strategies are the source of truth) — do NOT weaken to a smoke test.

- [ ] **Step 4: Manual verification in the dev server**

Start the demo dev server (background) and open the LayoutDemo. Drag a child from the freeform container (F) into the tileGrid (G):
- siblings in G reflow live (as ghosts) to make room;
- the source container's leftovers close the gap;
- on release the drop commits and a single Undo reverts the whole thing.

- [ ] **Step 5: Full release gate**

Run: `npx tsc --noEmit && npx vitest run && npx tsup build`
Expected: PASS (matches CI's release gate).

- [ ] **Step 6: Commit**

```bash
git add demo/demos/__tests__/layoutDemo.integration.test.tsx
git commit -m "test(layout): unskip LayoutDemo reflow integration proof"
```

---

## Task 7: Update TODO.md

Resolve the bullets this work closes; keep the genuinely-deferred ones.

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: Remove the status note + reword the closed bullets**

In the "Container layout strategies (deferred…)" section: delete the "Status note (2026-06-15): the layout-reflow feature is currently disconnected…" block (the feature is reconnected). Delete the "(P2) Overlay rendering of reflowed siblings" bullet (done) and the "(P3) Name-quality pass on the layout/overlay reflow surface" bullet (done). Leave TODO:182 (AABB-fallback), :183 (drop rejection), :184 (multi-select), :186 (z-order across non-container ancestors) and the other P3s — all still out of scope.

- [ ] **Step 2: Commit**

```bash
git add docs/TODO.md
git commit -m "docs(todo): close layout-reflow rendering + naming bullets"
```

---

## Self-Review

**Spec coverage:**
- Locked decision 1 (fold into previewIds) → Task 4 Step 5 (no separate render code). ✓
- Locked decision 2 (single-select guard) → Task 4 Step 5 + Task 5 Step 1 (`ids.length === 1`). ✓
- Locked decision 3 (rename methods) → Task 1. ✓
- New `layout` dep → Task 3. ✓
- onMove reflow pass → Task 4. ✓
- onEnd commit → Task 5. ✓
- Delete `MoveOverlay` → Task 2. ✓
- Restore `move.layout.test.ts` → Tasks 4–5. ✓
- Unskip LayoutDemo → Task 6. ✓
- Out-of-scope bullets retained → Task 7. ✓

**Type consistency:** `childPoses`/`reflowPoses` used consistently across Tasks 1, 4, 5. `LayoutDep.getLayout` defined in Task 3, consumed in Task 4. `LayoutPass` defined and consumed in Tasks 4–5. `createTransformOp<unknown>({ id, from, to, label })` matches `src/core/ops/transform.ts`'s `TransformArgs`. `scene.applyBatch(ops, label, adapter)` matches the call already in `move.ts`'s behavior path.

**Placeholder scan:** No TBDs. Three `NOTE` callouts flag literals/imports to cross-check against existing code (grid geometry, dep-provider import names, default-commit stub shape) — these are verification instructions, not deferred work; the structural assertions are concrete.

**Known follow-up risk:** the `tileGrid` swap geometry literals in Tasks 4/6 must match the strategy's actual math — the plan instructs cross-checking against `tileGrid.test.ts` rather than guessing.
