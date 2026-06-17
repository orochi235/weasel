# Slice Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a WeaselDraw "Slice" tool — drag a straight line and every closed path the drawn segment crosses is split into separate closed pieces (Illustrator Knife).

**Architecture:** A pure kit geometry primitive `splitPathByLine` does the cut. A kit `sliceAction` (ongoing drag invoker) tracks the line, draws the live preview, and on release calls a consumer-supplied `SliceDep.commit(a, b)`. WeaselDraw supplies that commit (scene scan + split + undoable batch), an app-local `slice` Tool (palette entry + drag binding + knife cursor), and the wiring — mirroring the existing `insertAction`/`useBooleansAdapter` pattern. Geometry in `src/features/paths/`; action/dep in `src/interactions/actions/` + `src/canvas/deps/`; tool + commit in `apps/draw/src/tools/slice/`.

**Tech Stack:** TypeScript, React, Vitest. Existing kit deps: `polygon-clipping` (boolean ops), `PathBuilder`, `extractPolylines`, `pathInWorld`, the action/dep registry.

**Spec:** `docs/superpowers/specs/2026-06-17-slice-tool-design.md`

**Working-tree note:** the repo has unrelated uncommitted WIP (a scene-layer feature) touching `scene.ts`, `Canvas.tsx`, `SceneCanvas.tsx`, `layerOrder.ts`, etc. Do **not** stage those. Each commit below must `git add` only the exact files it lists. Before each commit, run `git status --short` and confirm no WIP files are staged.

**Reference signatures (verified in the codebase):**

```ts
// src/features/paths/types.ts
export const PATH_M=0, PATH_L=1, PATH_C=2, PATH_Q=3, PATH_Z=4;
export type PathFillRule = 'nonzero' | 'evenodd';
export interface PolygonPath { kind:'polygon'; commands:Uint8Array; coords:Float32Array; fillRule:PathFillRule; }
export interface RectPath { kind:'rect'; x:number; y:number; width:number; height:number; }
export type Path = PolygonPath | RectPath;

// src/features/paths/builder.ts
export class PathBuilder { moveTo(x,y):this; lineTo(x,y):this; close():this; build():PolygonPath; }
export function polygonFromPoints(points: readonly {x:number;y:number}[], opts?:{fillRule?:PathFillRule}): PolygonPath;
export function linePath(a:{x:number;y:number}, b:{x:number;y:number}): PolygonPath;

// src/features/paths/bounds.ts
export function boundsOfPath(path: Path): RectPath;
// src/features/paths/tessellate/polyline.ts
export interface Polyline { points:number[]; closed:boolean; /* ...optional anchor arrays */ }
export function extractPolylines(path: Path, opts?:{flattenTolerance?:number}): Polyline[];
// src/features/paths/booleans.ts  (flattens beziers; output nonzero M/L/Z)
export function pathIntersect(...paths: Path[]): PolygonPath;
// src/features/paths/pathInWorld.ts
export function pathInWorld(path: Path, pose:{x:number;y:number;width:number;height:number;rotation?:number}): Path;

// src/core/ops/create.ts / delete.ts
export function createInsertOp<TNode extends {id:string}>(a:{node:TNode;label?:string;index?:number}): Op;
export function createDeleteOp<TNode extends {id:string}>(a:{node:TNode;label?:string;index:number}): Op;

// src/interactions/actions/invoker.ts
export interface Point2 { x:number; y:number; }
export interface InvocationCtx { world:Point2; screen:Point2; modifiers:{alt:boolean;ctrl:boolean;meta:boolean;shift:boolean}; deps:ActionDeps; drag?:{ start:Point2; current:Point2; delta:Point2; points?:Point2[] }; params?:Record<string,unknown>; }
export interface OngoingHandle { kind?:string; onMove?(ctx:InvocationCtx):void; onEnd?(ctx:InvocationCtx, reason:'commit'|'cancel'):void; overlay?():OngoingOverlay|null; }
export type OngoingOverlay = | { kind:'commands'; commands:DrawCommand[]; space?:'world'|'screen' } | /* ...other kinds */ ;

// src/interactions/actions/depRegistry: useDepSource<K>(name, ()=>DepSchema[K])  (kit-internal; only kit files use it)
// src/canvas/SceneCanvas.tsx props:  actions?: Record<string, ActionEntry>;  tools?: Record<string, AnyTool|true|false> | ToolsApi;

// apps/draw/src/App.tsx
interface WeaselDrawPose { x:number; y:number; width:number; height:number; rotation?:number; }
interface WeaselDrawData { path?:Path; text?:string; fill?:string; stroke?:string; strokeWidth?:number; label?:string; }
```

---

## File Structure

**Kit (new):**
- `src/features/paths/splitByLine.ts` — `splitPathByLine` + local segment-intersection helper.
- `src/features/paths/splitByLine.test.ts`
- `src/interactions/actions/defaults/slice.ts` — `sliceAction` descriptor + `SliceDep` type.
- `src/interactions/actions/defaults/slice.test.ts`
- `src/canvas/deps/slice.ts` — `useSliceDep(dep)` public passthrough hook.

**Kit (modify):**
- `src/interactions/actions/depSchema.ts` — augment `DepSchema` with `slice: SliceDep`.
- `src/index.ts` — export `splitPathByLine`, `sliceAction`, `SliceDep`, `useSliceDep`.

**App (new):**
- `apps/draw/src/tools/slice/sliceCommit.ts` — pure `computeSliceOps(...)`.
- `apps/draw/src/tools/slice/sliceCommit.test.ts`
- `apps/draw/src/tools/slice/useSliceTool.tsx` — the `slice` Tool (binding + presentation).
- `apps/draw/src/tools/slice/SliceDepPublisher.tsx` — registers the commit via `useSliceDep`.

**App (modify):**
- `apps/draw/src/App.tsx` — instantiate the tool, pass `tools`/`actions`, render the publisher.

---

## Task 1: Kit geometry — `splitPathByLine`

**Files:**
- Create: `src/features/paths/splitByLine.ts`
- Test: `src/features/paths/splitByLine.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/features/paths/splitByLine.test.ts
import { describe, it, expect } from 'vitest';
import { splitPathByLine } from './splitByLine';
import { rectPath, polygonFromPoints } from './builder';
import { boundsOfPath } from './bounds';

const polyArea = (p: import('./types').Path): number => {
  // shoelace over the first contour's flattened points (test helper)
  const { extractPolylines } = require('./tessellate/polyline');
  let total = 0;
  for (const pl of extractPolylines(p) as Array<{ points: number[] }>) {
    const pts = pl.points; let a = 0;
    for (let i = 0; i < pts.length; i += 2) {
      const j = (i + 2) % pts.length;
      a += pts[i] * pts[j + 1] - pts[j] * pts[i + 1];
    }
    total += Math.abs(a) / 2;
  }
  return total;
};

describe('splitPathByLine', () => {
  it('returns null when the segment does not cross the path boundary', () => {
    const sq = rectPath(0, 0, 100, 100);
    // segment entirely to the left of the square, never crossing it
    expect(splitPathByLine(sq, { x: -50, y: 50 }, { x: -10, y: 50 })).toBeNull();
  });

  it('splits an axis-aligned square crossed left-to-right into two pieces', () => {
    const sq = rectPath(0, 0, 100, 100);
    const pieces = splitPathByLine(sq, { x: -20, y: 50 }, { x: 120, y: 50 });
    expect(pieces).not.toBeNull();
    expect(pieces!.length).toBe(2);
  });

  it('conserves total area across the cut', () => {
    const sq = rectPath(0, 0, 100, 100);
    const pieces = splitPathByLine(sq, { x: -20, y: 50 }, { x: 120, y: 50 })!;
    const sum = pieces.reduce((s, p) => s + polyArea(p), 0);
    expect(sum).toBeCloseTo(100 * 100, 0);
  });

  it('preserves fillRule on the pieces', () => {
    const tri = polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }], { fillRule: 'evenodd' });
    const pieces = splitPathByLine(tri, { x: -10, y: 40 }, { x: 110, y: 40 })!;
    expect(pieces.every((p) => p.kind === 'polygon' && p.fillRule === 'evenodd')).toBe(true);
  });

  it('returns null when only one side has area (degenerate/tangent)', () => {
    const sq = rectPath(0, 0, 100, 100);
    // collinear with the bottom edge — no real division
    expect(splitPathByLine(sq, { x: -10, y: 0 }, { x: 110, y: 0 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx vitest run src/features/paths/splitByLine.test.ts`
Expected: FAIL — `splitPathByLine is not a function` / module not found.

- [ ] **Step 3: Implement `splitByLine.ts`**

```ts
// src/features/paths/splitByLine.ts
import type { Path, PolygonPath, PathFillRule } from './types';
import { boundsOfPath } from './bounds';
import { extractPolylines } from './tessellate/polyline';
import { pathIntersect } from './booleans';
import { polygonFromPoints } from './builder';

export interface Point { x: number; y: number; }
export interface SplitByLineOptions {
  /** Polyline flattening tolerance for the boundary-crossing gate. */
  flattenTolerance?: number;
}

/** Proper segment intersection (excludes collinear / shared-endpoint touches). */
function segmentsProperlyCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const s = (p: Point, q: Point, r: Point) =>
    Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  const d1 = s(c, d, a), d2 = s(c, d, b), d3 = s(a, b, c), d4 = s(a, b, d);
  return d1 !== d2 && d3 !== d4;
}

/** Count how many boundary edges the finite segment a→b properly crosses. */
function countBoundaryCrossings(path: Path, a: Point, b: Point, tol: number): number {
  let n = 0;
  for (const pl of extractPolylines(path, { flattenTolerance: tol })) {
    const pts = pl.points;
    const count = pts.length / 2;
    const last = pl.closed ? count : count - 1;
    for (let i = 0; i < last; i++) {
      const j = (i + 1) % count;
      const c = { x: pts[i * 2], y: pts[i * 2 + 1] };
      const dd = { x: pts[j * 2], y: pts[j * 2 + 1] };
      if (segmentsProperlyCross(a, b, c, dd)) n++;
    }
  }
  return n;
}

/**
 * Split `path` along the finite segment a→b into closed pieces (Knife).
 *
 * Returns `null` unless the segment enters AND exits the path boundary
 * (≥2 proper crossings) and both half-planes yield non-empty area. Otherwise
 * returns one `PolygonPath` per side of the line. Béziers are flattened
 * (see `pathIntersect`). The infinite line is used *within* a gated shape, so a
 * concave shape only partly crossed may be cut at far-side crossings — accepted
 * (see spec non-goals).
 */
export function splitPathByLine(
  path: Path,
  a: Point,
  b: Point,
  opts: SplitByLineOptions = {},
): Path[] | null {
  const tol = opts.flattenTolerance ?? 0.5;
  if (a.x === b.x && a.y === b.y) return null;
  if (countBoundaryCrossings(path, a, b, tol) < 2) return null;

  // Line direction + normal.
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;     // unit along the line
  const nx = -uy, ny = ux;                // unit normal

  // Build two large half-plane quads sized to the padded AABB so each fully
  // covers the path on one side of the line.
  const bb = boundsOfPath(path);
  const R = (Math.hypot(bb.width, bb.height) + 1) * 4; // generous half-extent
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const p0 = { x: mid.x - ux * R, y: mid.y - uy * R };
  const p1 = { x: mid.x + ux * R, y: mid.y + uy * R };
  const sideQuad = (sign: 1 | -1): PolygonPath =>
    polygonFromPoints([
      p0,
      p1,
      { x: p1.x + nx * R * sign, y: p1.y + ny * R * sign },
      { x: p0.x + nx * R * sign, y: p0.y + ny * R * sign },
    ]);

  const fillRule: PathFillRule = path.kind === 'polygon' ? path.fillRule : 'nonzero';
  const sideA = withFillRule(pathIntersect(path, sideQuad(1)), fillRule);
  const sideB = withFillRule(pathIntersect(path, sideQuad(-1)), fillRule);

  const pieces = [sideA, sideB].filter((p) => p.commands.length > 0);
  return pieces.length === 2 ? pieces : null;
}

function withFillRule(p: PolygonPath, fillRule: PathFillRule): PolygonPath {
  return p.fillRule === fillRule ? p : { ...p, fillRule };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/features/paths/splitByLine.test.ts`
Expected: PASS (5 tests). If the "tangent" test fails because `pathIntersect` returns a zero-area sliver rather than empty, tighten the empty check to also drop pieces whose `boundsOfPath` area is `< 1e-6`.

- [ ] **Step 5: Commit**

```bash
git status --short   # confirm only the two new files are untracked
git add src/features/paths/splitByLine.ts src/features/paths/splitByLine.test.ts
git commit -m "feat(paths): splitPathByLine — half-plane knife cut into closed pieces

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Export `splitPathByLine` from the public surface

**Files:**
- Modify: `src/index.ts` (find the `features/paths` export block — grep `from './features/paths`)

- [ ] **Step 1: Add the export**

Locate the paths export region in `src/index.ts` and add:

```ts
export { splitPathByLine } from './features/paths/splitByLine';
export type { Point as SplitPoint, SplitByLineOptions } from './features/paths/splitByLine';
```

- [ ] **Step 2: Verify typecheck + barrel test**

Run: `npm run typecheck`
Expected: clean.
Run: `npx vitest run src/index.barrel.test.ts` (if present)
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git status --short
git add src/index.ts
git commit -m "feat(paths): export splitPathByLine from public surface

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `SliceDep` type + `DepSchema` augmentation

**Files:**
- Create: `src/interactions/actions/defaults/slice.ts` (the `SliceDep` type lives with the action)
- Modify: `src/interactions/actions/depSchema.ts`

- [ ] **Step 1: Define `SliceDep` in `slice.ts` (action added in Task 4)**

```ts
// src/interactions/actions/defaults/slice.ts
import type { Point2 } from '../invoker';

/**
 * Consumer-supplied commit for the Slice action. `commit` receives the finite
 * slice segment (world coords); the consumer scans the scene, splits crossed
 * paths via `splitPathByLine`, and applies the result as one undoable batch.
 */
export interface SliceDep {
  commit(a: Point2, b: Point2): void;
}
```

- [ ] **Step 2: Augment `DepSchema`**

In `src/interactions/actions/depSchema.ts`, add the import and the schema entry in the existing `declare module './depRegistry'` block:

```ts
import type { SliceDep } from './defaults/slice';
// ...inside `declare module './depRegistry' { interface DepSchema { ... } }`:
    slice: SliceDep;
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git status --short
git add src/interactions/actions/defaults/slice.ts src/interactions/actions/depSchema.ts
git commit -m "feat(actions): SliceDep type + DepSchema augmentation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `sliceAction` (ongoing drag invoker)

**Files:**
- Modify: `src/interactions/actions/defaults/slice.ts`
- Test: `src/interactions/actions/defaults/slice.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/interactions/actions/defaults/slice.test.ts
import { describe, it, expect, vi } from 'vitest';
import { sliceAction } from './slice';
import type { SliceDep } from './slice';
import type { InvocationCtx } from '../invoker';

const ctxAt = (x: number, y: number, start = { x: 0, y: 0 }): InvocationCtx => ({
  world: { x, y },
  screen: { x, y },
  modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  deps: {} as never,
  drag: { start, current: { x, y }, delta: { x: x - start.x, y: y - start.y } },
});

describe('sliceAction', () => {
  it('is an ongoing drag action with id "slice"', () => {
    expect(sliceAction.id).toBe('slice');
    expect(sliceAction.invoker?.timing).toBe('ongoing');
    expect(sliceAction.defaultBinding).toEqual({ kind: 'drag' });
  });

  it('no-ops (empty handle) when no slice dep is present', () => {
    const handle = (sliceAction.invoker as { start: Function }).start(ctxAt(0, 0));
    expect(handle).toBeTruthy();
    expect(() => handle.onEnd?.(ctxAt(10, 10), 'commit')).not.toThrow();
  });

  it('calls dep.commit(start, current) on commit', () => {
    const commit = vi.fn();
    const dep: SliceDep = { commit };
    const start = { x: 1, y: 2 };
    const startCtx: InvocationCtx = { ...ctxAt(1, 2, start), deps: { slice: dep } as never };
    const handle = (sliceAction.invoker as { start: Function }).start(startCtx);
    handle.onMove?.({ ...ctxAt(40, 60, start), deps: { slice: dep } as never });
    handle.onEnd?.({ ...ctxAt(40, 60, start), deps: { slice: dep } as never }, 'commit');
    expect(commit).toHaveBeenCalledWith({ x: 1, y: 2 }, { x: 40, y: 60 });
  });

  it('does not commit on cancel', () => {
    const commit = vi.fn();
    const dep: SliceDep = { commit };
    const startCtx: InvocationCtx = { ...ctxAt(0, 0), deps: { slice: dep } as never };
    const handle = (sliceAction.invoker as { start: Function }).start(startCtx);
    handle.onEnd?.({ ...ctxAt(5, 5), deps: { slice: dep } as never }, 'cancel');
    expect(commit).not.toHaveBeenCalled();
  });

  it('overlay returns a world-space line command while dragging', () => {
    const dep: SliceDep = { commit: vi.fn() };
    const startCtx: InvocationCtx = { ...ctxAt(0, 0), deps: { slice: dep } as never };
    const handle = (sliceAction.invoker as { start: Function }).start(startCtx);
    handle.onMove?.({ ...ctxAt(30, 0), deps: { slice: dep } as never });
    const ov = handle.overlay?.();
    expect(ov?.kind).toBe('commands');
    expect(ov?.space).toBe('world');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/interactions/actions/defaults/slice.test.ts`
Expected: FAIL — `sliceAction` not exported.

- [ ] **Step 3: Implement `sliceAction`**

Append to `src/interactions/actions/defaults/slice.ts`:

```ts
import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle, OngoingOverlay, Point2 } from '../invoker';
import { linePath } from '../../../features/paths/builder';
import type { DrawCommand } from '../../../renderer/draw'; // adjust import to where DrawCommand lives

const SLICE_STROKE = '#e23b3b';
const SLICE_WIDTH = 1;
const SLICE_DASH = [6, 4];

/**
 * @experimental
 * Ongoing drag action: tracks the slice segment, renders a live line overlay,
 * and on release calls the consumer-supplied `SliceDep.commit(a, b)`.
 */
export const sliceAction: Action & { requires: string[] } = {
  id: 'slice',
  label: 'Slice',
  group: 'edit',
  defaultBinding: { kind: 'drag' },
  eligible: { capability: 'edits-page' },
  requires: ['slice'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx): OngoingHandle {
      const dep = ctx.deps.slice as SliceDep | undefined;
      const a: Point2 = ctx.drag?.start ?? ctx.world;
      let current: Point2 = ctx.drag?.current ?? ctx.world;
      let open = true;
      return {
        kind: 'slice',
        onMove(moveCtx: InvocationCtx): void {
          current = moveCtx.drag?.current ?? moveCtx.world;
        },
        overlay(): OngoingOverlay | null {
          if (!open) return null;
          const cmd: DrawCommand = {
            kind: 'path',
            path: linePath(a, current),
            stroke: { paint: { color: SLICE_STROKE }, width: SLICE_WIDTH, dash: SLICE_DASH },
          };
          return { kind: 'commands', commands: [cmd], space: 'world' };
        },
        onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          open = false;
          if (reason === 'cancel' || !dep) return;
          const b: Point2 = endCtx.drag?.current ?? endCtx.world;
          dep.commit(a, b);
        },
      };
    },
  },
  enabled: () => true as const,
};
```

NOTE for implementer: confirm the exact import path/type name for `DrawCommand` (grep `export .*DrawCommand`) and for the `linePath`/stroke shape used by overlays — copy the stroke object shape verbatim from `src/tools/builtin/line/useLineTool.tsx` if it differs.

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/interactions/actions/defaults/slice.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git status --short
git add src/interactions/actions/defaults/slice.ts src/interactions/actions/defaults/slice.test.ts
git commit -m "feat(actions): sliceAction — ongoing drag invoker + live line overlay

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `useSliceDep` public hook + exports

**Files:**
- Create: `src/canvas/deps/slice.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Implement the passthrough hook**

Model on `src/canvas/deps/insert.ts`:

```ts
// src/canvas/deps/slice.ts
import { useDepSource } from '../../interactions/actions/depRegistry';
import type { SliceDep } from '../../interactions/actions/defaults/slice';
import { useRef } from 'react';

/**
 * Register a consumer-supplied `SliceDep` into the surrounding dep registry so
 * the kit `sliceAction` can call it on drag-release. Call inside a component
 * mounted under `<SceneCanvas>` (which provides `<DepRegistryProvider>`).
 */
export function useSliceDep(dep: SliceDep): void {
  const depRef = useRef(dep);
  depRef.current = dep;
  useDepSource('slice', () => depRef.current);
}
```

- [ ] **Step 2: Export from `src/index.ts`**

```ts
export { sliceAction } from './interactions/actions/defaults/slice';
export type { SliceDep } from './interactions/actions/defaults/slice';
export { useSliceDep } from './canvas/deps/slice';
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git status --short
git add src/canvas/deps/slice.ts src/index.ts
git commit -m "feat(canvas): useSliceDep hook; export sliceAction + SliceDep

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: App — pure `computeSliceOps`

**Files:**
- Create: `apps/draw/src/tools/slice/sliceCommit.ts`
- Test: `apps/draw/src/tools/slice/sliceCommit.test.ts`

This is the pure heart of the commit: given the scene's leaf paths (already in world space) and the segment, produce the undoable op list. Kept React-free for testing.

- [ ] **Step 1: Write failing test**

```ts
// apps/draw/src/tools/slice/sliceCommit.test.ts
import { describe, it, expect } from 'vitest';
import { computeSliceOps } from './sliceCommit';
import { rectPath } from '@weasel-js/core';

describe('computeSliceOps', () => {
  const leaf = {
    id: 'n1',
    index: 0,
    worldPath: rectPath(0, 0, 100, 100),
    data: { path: rectPath(0, 0, 100, 100), fill: '#abc', stroke: '#000', strokeWidth: 2 },
    parent: null as string | null,
    layer: 'default',
  };

  it('emits delete + 2 inserts for a crossed leaf', () => {
    let n = 0;
    const ops = computeSliceOps({
      leaves: [leaf],
      a: { x: -10, y: 50 }, b: { x: 110, y: 50 },
      nextId: () => `p${n++}`,
    });
    // 1 delete + 2 inserts
    expect(ops.length).toBe(3);
    expect(ops[0].name).toBe('delete');
    expect(ops[1].name).toBe('insert');
    expect(ops[2].name).toBe('insert');
  });

  it('emits nothing for a leaf the segment misses', () => {
    const ops = computeSliceOps({
      leaves: [leaf],
      a: { x: -50, y: 50 }, b: { x: -10, y: 50 }, // never reaches the square
      nextId: () => 'x',
    });
    expect(ops).toEqual([]);
  });

  it('carries fill/stroke onto the pieces', () => {
    let n = 0;
    const ops = computeSliceOps({
      leaves: [leaf], a: { x: -10, y: 50 }, b: { x: 110, y: 50 }, nextId: () => `p${n++}`,
    });
    const inserted = (ops[1] as { args: { node: { data: { fill?: string; stroke?: string } } } }).args.node;
    expect(inserted.data.fill).toBe('#abc');
    expect(inserted.data.stroke).toBe('#000');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run apps/draw/src/tools/slice/sliceCommit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `sliceCommit.ts`**

```ts
// apps/draw/src/tools/slice/sliceCommit.ts
import {
  splitPathByLine, boundsOfPath, createDeleteOp, createInsertOp,
  type Path, type Op,
} from '@weasel-js/core';

export interface SliceLeaf {
  id: string;
  index: number;          // z-order index (from scene.renderOrder())
  worldPath: Path;        // geometry already baked to world space
  data: { path?: Path; fill?: string; stroke?: string; strokeWidth?: number; [k: string]: unknown };
  parent: string | null;
  layer: string;
}

export interface ComputeSliceOpsArgs {
  leaves: readonly SliceLeaf[];
  a: { x: number; y: number };
  b: { x: number; y: number };
  nextId: () => string;
}

/** Produce the undoable op list for slicing every crossed leaf. */
export function computeSliceOps(args: ComputeSliceOpsArgs): Op[] {
  const { leaves, a, b, nextId } = args;
  const ops: Op[] = [];
  for (const leaf of leaves) {
    const pieces = splitPathByLine(leaf.worldPath, a, b);
    if (!pieces) continue;
    ops.push(createDeleteOp({ node: { id: leaf.id }, index: leaf.index, label: 'Slice' }));
    for (const piece of pieces) {
      const bb = boundsOfPath(piece);
      const node = {
        id: nextId(),
        kind: 'leaf' as const,
        layer: leaf.layer,
        parent: leaf.parent,
        pose: { x: bb.x, y: bb.y, width: bb.width, height: bb.height },
        data: { ...leaf.data, path: piece },
      };
      ops.push(createInsertOp({ node, index: leaf.index, label: 'Slice' }));
    }
  }
  return ops;
}
```

NOTE: `createDeleteOp` only needs `{ id }` on the node to remove it, but its `invert()` re-inserts that same node — for faithful undo, pass the **full original node** instead of `{ id: leaf.id }`. Adjust `SliceLeaf` to carry the full node object and pass it here. (The publisher in Task 8 has the full node from `scene.get`.)

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run apps/draw/src/tools/slice/sliceCommit.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git status --short
git add apps/draw/src/tools/slice/sliceCommit.ts apps/draw/src/tools/slice/sliceCommit.test.ts
git commit -m "feat(draw): computeSliceOps — pure slice→ops for crossed leaves

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: App — the `slice` Tool

**Files:**
- Create: `apps/draw/src/tools/slice/useSliceTool.tsx`

The tool is minimal — palette presentation + the drag binding to `sliceAction`. The live overlay is supplied by the action's handle (Task 4), so the tool needs no overlay.

- [ ] **Step 1: Implement the tool**

```tsx
// apps/draw/src/tools/slice/useSliceTool.tsx
import { useMemo, createElement } from 'react';
import { defineTool, type Tool } from '@weasel-js/core';
// If no slice icon exists, reuse an existing icon or a simple inline SVG.

/** WeaselDraw "Slice" tool: drag a straight line; crossed paths split (Knife). */
export function useSliceTool(): Tool<null> {
  return useMemo(
    () =>
      defineTool<null>({
        id: 'slice',
        capabilities: ['edits-page'],
        cursor: 'crosshair',
        presentation: {
          label: 'Slice',
          group: 'shape',
          // icon: createElement(SomeKnifeIcon),
        },
        bindings: [{ spec: { kind: 'drag' }, actionId: 'slice' }],
        initial: {},
      }),
    [],
  );
}
```

NOTE: confirm `defineTool` and `Tool` are exported from `@weasel-js/core` (grep the barrel). If `defineTool` is not public, construct the tool object literally implementing the `Tool` interface instead (id/capabilities/cursor/presentation/bindings). The `shortcut: 'K'` is wired in App via the actions/keybindings layer, not here, to match how other tool shortcuts resolve.

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: clean (no test for this thin wrapper; it's exercised in Task 9).

- [ ] **Step 3: Commit**

```bash
git status --short
git add apps/draw/src/tools/slice/useSliceTool.tsx
git commit -m "feat(draw): slice Tool — drag binding + palette entry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: App — `SliceDepPublisher`

**Files:**
- Create: `apps/draw/src/tools/slice/SliceDepPublisher.tsx`

Mirror `BooleansAdapterPublisher` (App.tsx:934-1017, rendered at ~1446). It must be a child of `<SceneCanvas>` so `useSliceDep` reaches the `<DepRegistryProvider>`.

- [ ] **Step 1: Implement the publisher**

```tsx
// apps/draw/src/tools/slice/SliceDepPublisher.tsx
import { useSliceDep, pathInWorld, type Op } from '@weasel-js/core';
import { computeSliceOps, type SliceLeaf } from './sliceCommit';

interface SliceDepPublisherProps {
  // The app's Scene + the undoable ops applier it already uses elsewhere
  // (the same facility feeding BooleansAdapterPublisher / scene mutation).
  scene: { renderOrder(): Iterable<string>; get(id: string): any };
  applyOps: (ops: Op[], label: string) => void;
  nextId: () => string;
}

/** Registers the Slice commit. Render as a child of <SceneCanvas>. */
export function SliceDepPublisher({ scene, applyOps, nextId }: SliceDepPublisherProps) {
  useSliceDep({
    commit(a, b) {
      const order = [...scene.renderOrder()];
      const leaves: SliceLeaf[] = [];
      order.forEach((id, index) => {
        const node = scene.get(id);
        if (!node || node.kind !== 'leaf' || !node.data?.path) return;
        leaves.push({
          id,
          index,
          worldPath: pathInWorld(node.data.path, node.pose),
          data: node.data,
          parent: node.parent ?? null,
          layer: node.layer,
          // pass the full node too if Task 6's SliceLeaf carries it (for faithful undo)
          ...( { node } as object ),
        });
      });
      const ops = computeSliceOps({ leaves, a, b, nextId });
      if (ops.length) applyOps(ops, 'Slice');
    },
  });
  return null;
}
```

NOTE: type `scene`/`node` precisely using the app's `Scene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>` and `Node` types (import from `@weasel-js/core` / the app's type aliases) rather than `any`. Resolve `applyOps`: use the same ops-applier the app already uses for undoable mutation (see how `BooleansAdapterPublisher`/the scene adapter applies ops in `App.tsx`); if the app exposes it as `adapter.applyOps`, pass that.

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git status --short
git add apps/draw/src/tools/slice/SliceDepPublisher.tsx
git commit -m "feat(draw): SliceDepPublisher — registers the slice commit dep

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: App — wire into `App.tsx`

**Files:**
- Modify: `apps/draw/src/App.tsx`

- [ ] **Step 1: Import + instantiate**

Near the other tool imports:

```ts
import { sliceAction } from '@weasel-js/core';
import { useSliceTool } from './tools/slice/useSliceTool';
import { SliceDepPublisher } from './tools/slice/SliceDepPublisher';
```

Inside the component, alongside other hooks:

```ts
const sliceTool = useSliceTool();
```

- [ ] **Step 2: Pass `tools` + `actions` to `<SceneCanvas>`**

Add to the existing `<SceneCanvas ...>` props (it already has `toolBundle="exhaustive"`):

```tsx
  tools={{ slice: sliceTool }}
  actions={{ slice: sliceAction }}
```

(`tools` record form merges with `toolBundle`; `actions` adds the new action by id.)

- [ ] **Step 3: Render the publisher as a SceneCanvas child**

Match the `BooleansAdapterPublisher` placement (App.tsx ~1446):

```tsx
<SceneCanvas ...>
  {/* ...existing children e.g. <BooleansAdapterPublisher .../> ... */}
  <SliceDepPublisher scene={scene} applyOps={/* app ops applier */} nextId={/* app id counter */} />
</SceneCanvas>
```

- [ ] **Step 4: Verify typecheck + build the app**

Run: `npm run typecheck`
Expected: clean.
Run: `npm run build:demo` (or the app build) — confirm no errors.

- [ ] **Step 5: Manual smoke (dev server already runs on :5174)**

- Select the **Slice** tool from the palette (or its shortcut).
- Drag a straight line fully across a filled rectangle → it becomes two filled pieces; the dashed preview line disappears (ephemeral).
- Drag across several shapes → all crossed shapes split.
- Drag a stroke that doesn't fully cross a shape → no change.
- Cmd+Z → the original single shape returns.

- [ ] **Step 6: Commit**

```bash
git status --short   # ensure ONLY App.tsx (your change) is staged, not WIP
git add apps/draw/src/App.tsx
git commit -m "feat(draw): wire Slice tool (tool + action + commit dep)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review notes (carried into execution)

- **Spec coverage:** Knife/closed-pieces (Task 1), every crossed path (Task 6/8 scan), finite-segment gate (Task 1 `countBoundaryCrossings`), ephemeral line (Task 4 overlay only), kit-geometry + app-tool split (Tasks 1–5 kit / 6–9 app), undoable batch (Task 6/8), style preservation (Task 6), rotation via `pathInWorld` (Task 8), testing (Tasks 1/4/6). ✓
- **Known integration unknowns to resolve during execution (flagged inline, not placeholders):** (a) exact `DrawCommand` import path + overlay stroke shape — copy from `useLineTool.tsx`; (b) the app's undoable `applyOps` facility for `SliceDepPublisher` — reuse the one already feeding `BooleansAdapterPublisher`; (c) whether `defineTool` is public — fall back to a literal `Tool` object if not; (d) `createDeleteOp` should carry the full original node for faithful undo (adjust `SliceLeaf`).
- **v1 limitations (documented in spec, not bugs):** béziers flatten; concave partial-cross may over-cut; open/stroke-only paths, text, images, containers skipped (Task 8 filters to `kind==='leaf'` with `data.path`).
