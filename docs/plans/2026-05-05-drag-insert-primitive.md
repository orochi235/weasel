# Drag-Insert Primitive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a gesture-layer base hook (`useDragRect`) that owns the drag-rectangle state machine, and a tool-veneer primitive (`defineDragInsertTool`) that owns Tool-record + overlay assembly. Reshape `useInsert`, `useAreaSelect`, `useInsertTool`, and `useTextTool` as thin wrappers, preserving every public surface.

**Architecture:** New base `src/interactions/gestures/dragRect.ts` owns scratch + bounds + lifecycle + `wasSubThreshold` flag via `onStart`/`onMove`/`onEnd`/`onCancel` callbacks with mutable ctx. Existing `useInsert` and `useAreaSelect` reshape to thin wrappers over it (public surfaces unchanged). New `src/tools/builtin/defineDragInsertTool.ts` consumes an `InsertController` (which gains `supportsPointInsert`/`supportsCommitInsert` flags) and assembles the Tool record + overlay; `useInsertTool` and `useTextTool` collapse to ~10–25 lines each. The `applyBatch` capture asymmetry is absorbed by passing a shared ref between the text wrapper and the primitive.

**Tech Stack:** TypeScript, React (function hooks + refs), Vitest.

**Spec:** `docs/specs/2026-05-05-drag-insert-primitive-design.md`

---

## Status snapshot (pre-work)

- May 4 work shipped: `useInsert` already has `pointInsert`/`clickOnly`/`applyBatch`; `useTextTool` and `useInsertTool` already share `applyHitExistingGate` + `drawMarquee` + `InsertOverlayStyle`; both delegate to `useInsert`.
- `useAreaSelect` is monolithic — has its own scratch + bounds + overlay code.
- `WeaselDraw` migration shipped; no other consumers.

## Resolved deferrals (from spec)

The spec deferred three decisions to the plan; this plan resolves them:

1. **ctx-mutator API for behaviors mutating start/current mid-gesture.** `DragRectCtx` will expose `setStart(p: { x: number; y: number }): void` and `setCurrent(p: { x: number; y: number }): void`. They update the underlying state, recompute `bounds`, and update the live overlay so the next `move` (and the `endCtx`) reflect the new value. This matches today's behavior in `useInsert`'s move loop where behaviors return `{ start?, current? }` to override.
2. **`applyBatchRef` wiring mechanic.** `defineDragInsertTool` accepts an optional `applyBatchRef` from the caller. The text wrapper creates the ref, passes it both to `useInsert.applyBatch` (via a closure that reads `ref.current`) and to `defineDragInsertTool` (which writes to `ref.current` on handler entry / clears on end-or-cancel). Single ref, no bidirectional sync. The insert wrapper omits `applyBatchRef` entirely; the primitive allocates its own internal ref and never exposes it (since insert's adapter owns dispatch).
3. **`defineDragInsertTool` public export.** Yes — re-export from `src/index.ts` alongside `useInsertTool`/`useTextTool`. Future external drag-insert tools can compose without going through the wrappers.

## File structure

- **Add:** `src/interactions/gestures/dragRect.ts` — `useDragRect` + types.
- **Add:** `src/interactions/gestures/dragRect.test.ts` — base-hook isolation tests.
- **Add:** `src/tools/builtin/defineDragInsertTool.ts` — Tool-veneer primitive.
- **Add:** `src/tools/builtin/defineDragInsertTool.test.ts` — primitive isolation tests.
- **Rewrite:** `src/interactions/actions/insert/insert.ts` — wrap `useDragRect`. Add `supportsPointInsert`/`supportsCommitInsert` to controller.
- **Rewrite:** `src/interactions/actions/area-select/areaSelect.ts` — wrap `useDragRect`.
- **Rewrite:** `src/tools/builtin/useInsertTool.ts` — collapse to ~10 lines.
- **Rewrite:** `src/tools/builtin/useTextTool.ts` — collapse to ~25 lines.
- **Modify:** `src/interactions/actions/insert/insert.test.ts` — add `supports*` cases.
- **Modify:** `src/index.ts` — re-export `defineDragInsertTool` + types.

Tests `useInsertTool.test.ts` / `useTextTool.test.ts` / `areaSelect.test.ts` should pass unchanged — they verify behavior preservation.

---

## Task 1: useDragRect base hook (TDD)

**Files:**
- Create: `src/interactions/gestures/dragRect.ts`
- Create: `src/interactions/gestures/dragRect.test.ts`

- [ ] **Step 1: Write the failing test for start + overlay shape**

```ts
// src/interactions/gestures/dragRect.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDragRect } from './dragRect';

const NO_MODS = { shift: false, alt: false, meta: false, ctrl: false };

describe('useDragRect', () => {
  it('start sets overlay and fires onGestureStart and onStart', () => {
    const onStart = vi.fn();
    const onGestureStart = vi.fn();
    const { result } = renderHook(() => useDragRect({ onStart, onGestureStart }));
    act(() => result.current.start(10, 20, NO_MODS));
    expect(result.current.overlay).toEqual({
      start: { x: 10, y: 20 },
      current: { x: 10, y: 20 },
      bounds: { x: 10, y: 20, width: 0, height: 0 },
    });
    expect(result.current.isActive).toBe(true);
    expect(onStart).toHaveBeenCalledOnce();
    expect(onGestureStart).toHaveBeenCalledOnce();
    const ctx = onStart.mock.calls[0][0];
    expect(ctx.start).toEqual({ x: 10, y: 20 });
    expect(ctx.bounds).toEqual({ x: 10, y: 20, width: 0, height: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run src/interactions/gestures/dragRect.test.ts`
Expected: FAIL — `Cannot find module './dragRect'`.

- [ ] **Step 3: Implement `useDragRect` minimally to pass step 1**

```ts
// src/interactions/gestures/dragRect.ts
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ModifierState } from './types';

export interface DragRectPoint { x: number; y: number }
export interface DragRectBounds { x: number; y: number; width: number; height: number }

export interface DragRectCtx<TScratch = unknown> {
  start: DragRectPoint;
  current: DragRectPoint;
  bounds: DragRectBounds;
  modifiers: ModifierState;
  scratch: TScratch;
  /** Override the start point mid-gesture. Recomputes bounds and updates the
   *  live overlay so the next move (and the end ctx) reflect the new value. */
  setStart(p: DragRectPoint): void;
  /** Override the current point mid-gesture (between start and end). */
  setCurrent(p: DragRectPoint): void;
}

export interface DragRectEndCtx<TScratch = unknown> extends DragRectCtx<TScratch> {
  wasSubThreshold: boolean;
}

export interface UseDragRectOptions<TScratch = unknown> {
  minBounds?: { width: number; height: number };
  initScratch?: () => TScratch;
  onStart?: (ctx: DragRectCtx<TScratch>) => void;
  onMove?: (ctx: DragRectCtx<TScratch>) => void;
  onEnd?: (ctx: DragRectEndCtx<TScratch>) => boolean | void;
  onCancel?: (ctx: DragRectCtx<TScratch>) => void;
  onGestureStart?: () => void;
  onGestureEnd?: (committed: boolean) => void;
}

export interface DragRectController {
  start(worldX: number, worldY: number, modifiers: ModifierState): void;
  move(worldX: number, worldY: number, modifiers: ModifierState): boolean;
  end(): void;
  cancel(): void;
  overlay: { start: DragRectPoint; current: DragRectPoint; bounds: DragRectBounds } | null;
  readonly isActive: boolean;
}

function boundsFrom(start: DragRectPoint, current: DragRectPoint): DragRectBounds {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
}

interface InternalState<TScratch> {
  active: boolean;
  start: DragRectPoint;
  current: DragRectPoint;
  modifiers: ModifierState;
  scratch: TScratch;
}

export function useDragRect<TScratch = unknown>(
  options: UseDragRectOptions<TScratch> = {},
): DragRectController {
  const optsRef = useRef(options);
  optsRef.current = options;
  const stateRef = useRef<InternalState<TScratch> | null>(null);
  const [overlay, setOverlay] = useState<DragRectController['overlay']>(null);
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

  const buildCtx = useCallback((): DragRectCtx<TScratch> => {
    const s = stateRef.current!;
    const ctx: DragRectCtx<TScratch> = {
      get start() { return s.start; },
      get current() { return s.current; },
      get bounds() { return boundsFrom(s.start, s.current); },
      get modifiers() { return s.modifiers; },
      get scratch() { return s.scratch; },
      setStart(p) {
        s.start = p;
        setOverlay({ start: s.start, current: s.current, bounds: boundsFrom(s.start, s.current) });
      },
      setCurrent(p) {
        s.current = p;
        setOverlay({ start: s.start, current: s.current, bounds: boundsFrom(s.start, s.current) });
      },
    };
    return ctx;
  }, []);

  const start = useCallback((worldX: number, worldY: number, modifiers: ModifierState) => {
    const opts = optsRef.current;
    const init = opts.initScratch ? opts.initScratch() : ({} as TScratch);
    const p: DragRectPoint = { x: worldX, y: worldY };
    stateRef.current = {
      active: true,
      start: p,
      current: p,
      modifiers,
      scratch: init,
    };
    setOverlay({ start: p, current: p, bounds: { x: p.x, y: p.y, width: 0, height: 0 } });
    opts.onStart?.(buildCtx());
    opts.onGestureStart?.();
  }, [buildCtx]);

  const move = useCallback((worldX: number, worldY: number, modifiers: ModifierState): boolean => {
    const s = stateRef.current;
    if (!s || !s.active) return false;
    s.current = { x: worldX, y: worldY };
    s.modifiers = modifiers;
    setOverlay({ start: s.start, current: s.current, bounds: boundsFrom(s.start, s.current) });
    optsRef.current.onMove?.(buildCtx());
    return true;
  }, [buildCtx]);

  const end = useCallback(() => {
    const s = stateRef.current;
    const opts = optsRef.current;
    if (!s || !s.active) {
      opts.onGestureEnd?.(false);
      return;
    }
    const min = opts.minBounds ?? { width: 0, height: 0 };
    const b = boundsFrom(s.start, s.current);
    const wasSubThreshold = b.width <= min.width || b.height <= min.height;
    const baseCtx = buildCtx();
    const endCtx: DragRectEndCtx<TScratch> = Object.assign(
      Object.create(Object.getPrototypeOf(baseCtx)),
      baseCtx,
      { wasSubThreshold },
    );
    // Object.assign on a getter-bearing ctx requires manual property copy:
    Object.defineProperties(endCtx, {
      start: Object.getOwnPropertyDescriptor(baseCtx, 'start')!,
      current: Object.getOwnPropertyDescriptor(baseCtx, 'current')!,
      bounds: Object.getOwnPropertyDescriptor(baseCtx, 'bounds')!,
      modifiers: Object.getOwnPropertyDescriptor(baseCtx, 'modifiers')!,
      scratch: Object.getOwnPropertyDescriptor(baseCtx, 'scratch')!,
    });
    endCtx.setStart = baseCtx.setStart;
    endCtx.setCurrent = baseCtx.setCurrent;
    let committed: boolean;
    try {
      const r = opts.onEnd?.(endCtx);
      committed = r === false ? false : true;
    } finally {
      stateRef.current = null;
      setOverlay(null);
    }
    opts.onGestureEnd?.(committed);
  }, [buildCtx]);

  const cancel = useCallback(() => {
    const s = stateRef.current;
    const opts = optsRef.current;
    if (s && s.active) opts.onCancel?.(buildCtx());
    stateRef.current = null;
    setOverlay(null);
    opts.onGestureEnd?.(false);
  }, [buildCtx]);

  return useMemo<DragRectController>(() => ({
    start, move, end, cancel,
    get overlay() { return overlayRef.current; },
    get isActive() { return overlayRef.current !== null; },
  }), [start, move, end, cancel]);
}
```

- [ ] **Step 4: Run step-1 test to verify pass**

Run: `pnpm test --run src/interactions/gestures/dragRect.test.ts`
Expected: PASS.

- [ ] **Step 5: Add tests for move + bounds derivation**

Append to `dragRect.test.ts`:

```ts
  it('move updates current and bounds; returns true while active', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useDragRect({ onMove }));
    expect(result.current.move(50, 50, NO_MODS)).toBe(false);
    act(() => result.current.start(10, 10, NO_MODS));
    let returned = false;
    act(() => { returned = result.current.move(40, 30, NO_MODS); });
    expect(returned).toBe(true);
    expect(result.current.overlay).toEqual({
      start: { x: 10, y: 10 },
      current: { x: 40, y: 30 },
      bounds: { x: 10, y: 10, width: 30, height: 20 },
    });
    expect(onMove).toHaveBeenCalledOnce();
  });

  it('bounds normalize when current is above-left of start', () => {
    const { result } = renderHook(() => useDragRect());
    act(() => result.current.start(50, 50, NO_MODS));
    act(() => result.current.move(20, 10, NO_MODS));
    expect(result.current.overlay!.bounds).toEqual({ x: 20, y: 10, width: 30, height: 40 });
  });
```

Run: `pnpm test --run src/interactions/gestures/dragRect.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 6: Add tests for end + wasSubThreshold + onGestureEnd**

Append:

```ts
  it('end fires onEnd with wasSubThreshold flag and onGestureEnd(committed)', () => {
    const onEnd = vi.fn(() => true);
    const onGestureEnd = vi.fn();
    const { result } = renderHook(() =>
      useDragRect({ minBounds: { width: 4, height: 4 }, onEnd, onGestureEnd }),
    );
    act(() => result.current.start(10, 10, NO_MODS));
    act(() => result.current.move(12, 12, NO_MODS));
    act(() => result.current.end());
    expect(onEnd).toHaveBeenCalledOnce();
    const ctx = onEnd.mock.calls[0][0];
    expect(ctx.bounds).toEqual({ x: 10, y: 10, width: 2, height: 2 });
    expect(ctx.wasSubThreshold).toBe(true);
    expect(onGestureEnd).toHaveBeenCalledWith(true);
    expect(result.current.overlay).toBeNull();
    expect(result.current.isActive).toBe(false);
  });

  it('end with onEnd returning false reports onGestureEnd(false)', () => {
    const onGestureEnd = vi.fn();
    const { result } = renderHook(() => useDragRect({ onEnd: () => false, onGestureEnd }));
    act(() => result.current.start(0, 0, NO_MODS));
    act(() => result.current.move(100, 100, NO_MODS));
    act(() => result.current.end());
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });

  it('end with no active gesture is a no-op except onGestureEnd(false)', () => {
    const onEnd = vi.fn();
    const onGestureEnd = vi.fn();
    const { result } = renderHook(() => useDragRect({ onEnd, onGestureEnd }));
    act(() => result.current.end());
    expect(onEnd).not.toHaveBeenCalled();
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });
```

Run: `pnpm test --run src/interactions/gestures/dragRect.test.ts`
Expected: all PASS.

- [ ] **Step 7: Add tests for cancel + scratch + setStart/setCurrent**

Append:

```ts
  it('cancel calls onCancel with active ctx and onGestureEnd(false)', () => {
    const onCancel = vi.fn();
    const onGestureEnd = vi.fn();
    const { result } = renderHook(() => useDragRect({ onCancel, onGestureEnd }));
    act(() => result.current.start(10, 10, NO_MODS));
    act(() => result.current.move(20, 20, NO_MODS));
    act(() => result.current.cancel());
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCancel.mock.calls[0][0].current).toEqual({ x: 20, y: 20 });
    expect(onGestureEnd).toHaveBeenCalledWith(false);
    expect(result.current.overlay).toBeNull();
  });

  it('initScratch is invoked at start; mutations persist across callbacks', () => {
    interface S { hits: number }
    const init = vi.fn<[], S>(() => ({ hits: 0 }));
    const onStart = vi.fn((c: DragRectCtx<S>) => { c.scratch.hits++; });
    const onMove = vi.fn((c: DragRectCtx<S>) => { c.scratch.hits++; });
    const onEnd = vi.fn((c: DragRectEndCtx<S>) => {
      expect(c.scratch.hits).toBe(2);
    });
    const { result } = renderHook(() =>
      useDragRect<S>({ initScratch: init, onStart, onMove, onEnd }),
    );
    act(() => result.current.start(0, 0, NO_MODS));
    act(() => result.current.move(10, 10, NO_MODS));
    act(() => result.current.end());
    expect(init).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('setStart and setCurrent mid-gesture update bounds and overlay', () => {
    const { result } = renderHook(() =>
      useDragRect({
        onMove: (c) => {
          if (c.current.x === 30) c.setStart({ x: 5, y: 5 });
        },
      }),
    );
    act(() => result.current.start(10, 10, NO_MODS));
    act(() => result.current.move(30, 30, NO_MODS));
    expect(result.current.overlay).toEqual({
      start: { x: 5, y: 5 },
      current: { x: 30, y: 30 },
      bounds: { x: 5, y: 5, width: 25, height: 25 },
    });
  });
```

You'll need to import `DragRectCtx`/`DragRectEndCtx` at the top of the test file:

```ts
import { useDragRect, type DragRectCtx, type DragRectEndCtx } from './dragRect';
```

Run: `pnpm test --run src/interactions/gestures/dragRect.test.ts`
Expected: all PASS.

- [ ] **Step 8: Typecheck and commit**

```bash
pnpm typecheck
git add src/interactions/gestures/dragRect.ts src/interactions/gestures/dragRect.test.ts
git commit -m "feat(gestures): add useDragRect base hook"
```

---

## Task 2: Reshape useInsert over useDragRect

**Files:**
- Modify: `src/interactions/actions/insert/insert.ts`
- Test: `src/interactions/actions/insert/insert.test.ts` (preserve existing; verify pass)

- [ ] **Step 1: Run existing insert tests as baseline**

Run: `pnpm test --run src/interactions/actions/insert/insert.test.ts`
Expected: all PASS (this is the existing baseline; capture green before refactoring).

- [ ] **Step 2: Rewrite `useInsert` body to wrap `useDragRect`**

Replace the body of `useInsert` (everything from `const behaviorsRef = useRef(behaviors);` down to the `return controller;` line) with:

```ts
  const {
    behaviors = [],
    insertLabel = 'Insert',
    minBounds = { width: 0, height: 0 },
    posefromBounds = (b) => b as unknown as TPose,
    pointInsert,
    clickOnly = false,
    applyBatch,
    onGestureStart,
    onGestureEnd,
  } = options;

  const behaviorsRef = useRef(behaviors);
  behaviorsRef.current = behaviors;
  const posefromBoundsRef = useRef(posefromBounds);
  posefromBoundsRef.current = posefromBounds;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const insertLabelRef = useRef(insertLabel);
  insertLabelRef.current = insertLabel;
  const pointInsertRef = useRef(pointInsert);
  pointInsertRef.current = pointInsert;
  const clickOnlyRef = useRef(clickOnly);
  clickOnlyRef.current = clickOnly;
  const applyBatchOptionRef = useRef(applyBatch);
  applyBatchOptionRef.current = applyBatch;

  // Bridge: build a behavior-style GestureContext on demand from the dragRect ctx.
  const buildGestureCtx = (drCtx: DragRectCtx<unknown>): GestureContext<TPose> => {
    const startPoint: InsertPoint = drCtx.start;
    return {
      draggedIds: [GID],
      origin: new Map([[GID, startPoint as unknown as TPose]]),
      current: new Map([[GID, drCtx.current as unknown as TPose]]),
      snap: null,
      modifiers: drCtx.modifiers,
      pointer: { worldX: drCtx.current.x, worldY: drCtx.current.y, clientX: 0, clientY: 0 },
      adapter: adapterRef.current as unknown as GestureContext<TPose>['adapter'],
      scratch: {},
    };
  };

  const dr = useDragRect({
    minBounds,
    onStart: (ctx) => {
      const gctx = buildGestureCtx(ctx);
      for (const b of behaviorsRef.current) b.onStart?.(gctx);
    },
    onMove: (ctx) => {
      const gctx = buildGestureCtx(ctx);
      const startPoint: InsertPoint = ctx.start;
      const current: InsertPoint = ctx.current;
      const bounds = ctx.bounds;
      const pose = posefromBoundsRef.current(bounds);
      for (const b of behaviorsRef.current) {
        const r = b.onMove?.(gctx, { start: startPoint, current, bounds, pose });
        if (!r) continue;
        if (r.start !== undefined) ctx.setStart(r.start);
        if (r.current !== undefined) ctx.setCurrent(r.current);
      }
    },
    onEnd: (ctx) => {
      const insertLabel = insertLabelRef.current;
      const pointInsert = pointInsertRef.current;
      const clickOnly = clickOnlyRef.current;
      const applyBatchOverride = applyBatchOptionRef.current;
      const adapter = adapterRef.current;
      const dispatch = (ops: Op[]) => {
        if (applyBatchOverride) applyBatchOverride(ops, insertLabel);
        else dispatchApplyBatch(adapter, ops, insertLabel);
      };
      if (clickOnly || ctx.wasSubThreshold) {
        if (pointInsert) {
          const created = pointInsert({ x: ctx.start.x, y: ctx.start.y });
          if (created) {
            dispatch([createInsertOp({ object: created, label: insertLabel })]);
            return true;
          }
        }
        return false;
      }
      const created = adapter.commitInsert(ctx.bounds);
      if (!created) return false;
      dispatch([createInsertOp({ object: created, label: insertLabel })]);
      return true;
    },
    onGestureStart,
    onGestureEnd,
  });

  // The InsertController surface is preserved (start/move/end/cancel +
  // overlay + isInserting + adapter). Map dragRect's overlay to InsertOverlay.
  const overlayRef = useRef<InsertOverlay<TPose> | null>(null);
  overlayRef.current = dr.overlay
    ? {
        start: dr.overlay.start,
        current: dr.overlay.current,
        bounds: dr.overlay.bounds,
        pose: posefromBoundsRef.current(dr.overlay.bounds),
      }
    : null;

  return useMemo<InsertController<TNode, TPose>>(
    () => ({
      start: dr.start,
      move: dr.move,
      end: dr.end,
      cancel: dr.cancel,
      get overlay() { return overlayRef.current; },
      get isInserting() { return overlayRef.current !== null; },
      get adapter() { return adapterRef.current; },
      get supportsPointInsert() { return pointInsertRef.current != null; },
      get supportsCommitInsert() { return !clickOnlyRef.current; },
    }),
    [dr.start, dr.move, dr.end, dr.cancel],
  );
```

Update imports at the top:

```ts
import { useMemo, useRef } from 'react';
import { createInsertOp } from '../../../core/ops/create';
import type { Op } from '../../../core/ops/types';
import { dispatchApplyBatch } from '../../../core/applyOps';
import type { InsertAdapter } from '../../../core/adapters/types';
import type {
  GestureContext,
  InsertBehavior,
  InsertOverlay,
  InsertPoint,
  ModifierState,
  ResizePose,
} from '../types';
import { useDragRect, type DragRectCtx } from '../dragRect';
```

Drop the now-unused `boundsFrom` helper and the local `useState`/`useCallback` imports, and the `cleanup`/`stateRef`/`useState<InsertOverlay>` block.

Update the `InsertController` interface (still in this file) to add the two new flags:

```ts
export interface InsertController<TNode extends { id: string }, TPose> {
  start(worldX: number, worldY: number, modifiers: ModifierState): void;
  move(worldX: number, worldY: number, modifiers: ModifierState): boolean;
  end(): void;
  cancel(): void;
  isInserting: boolean;
  overlay: InsertOverlay<TPose> | null;
  adapter: InsertAdapter<TNode>;
  /** True iff `pointInsert` was supplied. */
  readonly supportsPointInsert: boolean;
  /** True iff a non-clickOnly path is wired (drag commits will reach
   *  `adapter.commitInsert`). False when `clickOnly: true`. */
  readonly supportsCommitInsert: boolean;
}
```

- [ ] **Step 3: Run existing insert tests; expect green**

Run: `pnpm test --run src/interactions/actions/insert/insert.test.ts`
Expected: all PASS (existing tests are the regression suite).

- [ ] **Step 4: Add a test asserting `supports*` flags**

Append to `src/interactions/actions/insert/insert.test.ts`:

```ts
describe('supports* flags', () => {
  it('supportsPointInsert reflects whether pointInsert was supplied', () => {
    const adapter = makeAdapter(); // existing helper from this test file
    const without = renderHook(() => useInsert(adapter, {})).result.current;
    expect(without.supportsPointInsert).toBe(false);
    const withFn = renderHook(() => useInsert(adapter, { pointInsert: () => null })).result.current;
    expect(withFn.supportsPointInsert).toBe(true);
  });

  it('supportsCommitInsert is false in clickOnly mode', () => {
    const adapter = makeAdapter();
    const drag = renderHook(() => useInsert(adapter, {})).result.current;
    expect(drag.supportsCommitInsert).toBe(true);
    const click = renderHook(() => useInsert(adapter, { clickOnly: true })).result.current;
    expect(click.supportsCommitInsert).toBe(false);
  });
});
```

Note: if `makeAdapter`/equivalent isn't exported in the existing test file, inline a minimal stub:

```ts
const makeAdapter = (): InsertAdapter<{ id: string }> => ({
  commitInsert: () => ({ id: 'x' }),
  commitPaste: () => [],
  snapshotSelection: () => ({ items: [] }),
  insertNode: () => {},
  setSelection: () => {},
  getSelection: () => [],
});
```

Run: `pnpm test --run src/interactions/actions/insert/insert.test.ts`
Expected: all PASS.

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm typecheck
git add src/interactions/actions/insert/insert.ts src/interactions/actions/insert/insert.test.ts
git commit -m "refactor(gestures): reshape useInsert as useDragRect wrapper"
```

---

## Task 3: Reshape useAreaSelect over useDragRect

**Files:**
- Modify: `src/interactions/actions/area-select/areaSelect.ts`
- Test: `src/interactions/actions/area-select/areaSelect.test.ts` (preserve)

- [ ] **Step 1: Run existing area-select tests as baseline**

Run: `pnpm test --run src/interactions/actions/area-select/areaSelect.test.ts`
Expected: all PASS.

- [ ] **Step 2: Rewrite `useAreaSelect` body to wrap `useDragRect`**

Replace everything inside `useAreaSelect(adapter, options = {})` with:

```ts
  const { behaviors = [], transient: transientOpt, label = 'Area select', onGestureStart, onGestureEnd, debug } = options;
  const behaviorsRef = useRef(behaviors);
  behaviorsRef.current = behaviors;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const labelRef = useRef(label);
  labelRef.current = label;
  const transientOptRef = useRef(transientOpt);
  transientOptRef.current = transientOpt;
  const debugRef = useRef(debug);
  debugRef.current = debug;

  const buildGestureCtx = (
    drCtx: DragRectCtx<unknown>,
    startPose: AreaSelectPose,
  ): GestureContext<AreaSelectPose> => ({
    draggedIds: [GID],
    origin: new Map([[GID, startPose]]),
    current: new Map([[GID, { worldX: drCtx.current.x, worldY: drCtx.current.y, shiftHeld: startPose.shiftHeld }]]),
    snap: null,
    modifiers: drCtx.modifiers,
    pointer: { worldX: drCtx.current.x, worldY: drCtx.current.y, clientX: 0, clientY: 0 },
    adapter: adapterRef.current as unknown as GestureContext<AreaSelectPose>['adapter'],
    scratch: {},
  });

  interface AreaScratch { startPose: AreaSelectPose }

  const dr = useDragRect<AreaScratch>({
    initScratch: () => ({ startPose: { worldX: 0, worldY: 0, shiftHeld: false } }),
    onStart: (ctx) => {
      const startPose: AreaSelectPose = {
        worldX: ctx.start.x,
        worldY: ctx.start.y,
        shiftHeld: ctx.modifiers.shift,
      };
      ctx.scratch.startPose = startPose;
      const gctx = buildGestureCtx(ctx, startPose);
      for (const b of behaviorsRef.current) b.onStart?.(gctx);
    },
    onMove: (ctx) => {
      const startPose = ctx.scratch.startPose;
      const gctx = buildGestureCtx(ctx, startPose);
      for (const b of behaviorsRef.current) {
        b.onMove?.(gctx, {
          start: { worldX: startPose.worldX, worldY: startPose.worldY },
          current: { worldX: ctx.current.x, worldY: ctx.current.y },
          shiftHeld: startPose.shiftHeld,
        });
      }
      debugRef.current?.recordBounds('area-select', ctx.bounds);
    },
    onEnd: (ctx) => {
      const adapter = adapterRef.current;
      const label = labelRef.current;
      const transientOpt = transientOptRef.current;
      const startPose = ctx.scratch.startPose;
      const gctx = buildGestureCtx(ctx, startPose);
      let collected: Op[] | null | undefined;
      for (const b of behaviorsRef.current) {
        const r = b.onEnd?.(gctx);
        if (r === undefined) continue;
        collected = r;
        break;
      }
      if (collected === null) return false;
      if (collected === undefined || collected.length === 0) return false;
      const transient = transientOpt ?? behaviorsRef.current.some((b) => b.defaultTransient === true);
      if (transient) {
        (adapter as AreaSelectAdapter).applyOps?.(collected);
      } else {
        const adapterWithBatch = adapter as AreaSelectAdapter & {
          applyBatch?: (ops: Op[], label: string) => void;
        };
        adapterWithBatch.applyBatch?.(collected, label);
      }
      return true;
    },
    onGestureStart,
    onGestureEnd,
  });

  // Map dragRect overlay to AreaSelectOverlay.
  const overlayRef = useRef<AreaSelectOverlay | null>(null);
  overlayRef.current = dr.overlay
    ? {
        start: { worldX: dr.overlay.start.x, worldY: dr.overlay.start.y },
        current: { worldX: dr.overlay.current.x, worldY: dr.overlay.current.y },
        shiftHeld: false, // populated below from in-flight scratch via getter on the controller
      }
    : null;

  return useMemo<AreaSelectController>(
    () => ({
      start: dr.start,
      move: dr.move,
      end: dr.end,
      cancel: dr.cancel,
      get overlay() { return overlayRef.current; },
      get isAreaSelecting() { return overlayRef.current !== null; },
      get adapter() { return adapterRef.current; },
    }),
    [dr.start, dr.move, dr.end, dr.cancel],
  );
```

**`shiftHeld` on overlay:** today's overlay carries the *start*-time shift state, not the live one. The simplest preservation is to capture it inside the getter by reading from `useDragRect`'s scratch via a ref. Implement that by adding above the `useMemo`:

```ts
  const dragShiftHeldRef = useRef<boolean>(false);
  // In the dr options, modify onStart: ctx.scratch.startPose = startPose; dragShiftHeldRef.current = startPose.shiftHeld;
  // In the dr options, modify onCancel/onEnd: dragShiftHeldRef.current = false; (use onCancel option)
```

Then in the `overlayRef.current` mapping:

```ts
  overlayRef.current = dr.overlay
    ? {
        start: { worldX: dr.overlay.start.x, worldY: dr.overlay.start.y },
        current: { worldX: dr.overlay.current.x, worldY: dr.overlay.current.y },
        shiftHeld: dragShiftHeldRef.current,
      }
    : null;
```

And add `onCancel: () => { dragShiftHeldRef.current = false; }` and update `onEnd` to also clear `dragShiftHeldRef.current = false;` after the return statement... that's awkward. Better: read shiftHeld directly off the overlay's scratch via a *second* ref written from `onStart`/`onMove`.

**Cleaner approach:** keep `dragShiftHeldRef` written from `onStart` and cleared from `onCancel`; for `onEnd`, the cleanup happens after the gesture is teardown anyway (overlay becomes null, getter returns null overlay). So just:

```ts
  const dragShiftHeldRef = useRef<boolean>(false);
  // ... in the dr config:
  onStart: (ctx) => {
    const startPose: AreaSelectPose = {
      worldX: ctx.start.x, worldY: ctx.start.y, shiftHeld: ctx.modifiers.shift,
    };
    ctx.scratch.startPose = startPose;
    dragShiftHeldRef.current = startPose.shiftHeld;
    // ... behaviors ...
  },
  onCancel: () => { dragShiftHeldRef.current = false; },
```

Update imports at top:

```ts
import { useMemo, useRef } from 'react';
import type { Op } from '../../../core/ops/types';
import type { AreaSelectAdapter } from '../../../core/adapters/types';
import type {
  AreaSelectBehavior,
  AreaSelectOverlay,
  AreaSelectPose,
  GestureContext,
} from '../types';
import type { DebugSink } from '../../../debug/types';
import { useDragRect, type DragRectCtx } from '../dragRect';

const GID = 'gesture';
```

Drop the now-unused `useCallback`, `useState`, `cleanup`, internal `State` interface.

- [ ] **Step 3: Run existing area-select tests; expect green**

Run: `pnpm test --run src/interactions/actions/area-select/areaSelect.test.ts`
Expected: all PASS.

- [ ] **Step 4: Run all interaction tests**

Run: `pnpm test --run src/interactions/`
Expected: all PASS.

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm typecheck
git add src/interactions/actions/area-select/areaSelect.ts
git commit -m "refactor(gestures): reshape useAreaSelect as useDragRect wrapper"
```

---

## Task 4: defineDragInsertTool primitive (TDD)

**Files:**
- Create: `src/tools/builtin/defineDragInsertTool.ts`
- Create: `src/tools/builtin/defineDragInsertTool.test.ts`

- [ ] **Step 1: Write the failing test for Tool record assembly + conditional handlers**

```ts
// src/tools/builtin/defineDragInsertTool.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { defineDragInsertTool } from './defineDragInsertTool';
import type { InsertController } from '../../interactions/actions/insert/insert';

const makeController = (overrides: Partial<InsertController<{ id: string }, unknown>> = {}) => ({
  start: vi.fn(),
  move: vi.fn(() => true),
  end: vi.fn(),
  cancel: vi.fn(),
  overlay: null,
  isInserting: false,
  adapter: {} as InsertController<{ id: string }, unknown>['adapter'],
  supportsPointInsert: false,
  supportsCommitInsert: true,
  ...overrides,
}) as InsertController<{ id: string }, unknown>;

const DEFAULT_STYLE = { fill: '#aaa', stroke: '#bbb', dash: [2, 2], lineWidth: 1 };

describe('defineDragInsertTool', () => {
  it('builds a Tool with id/cursor/keybinding and overlay', () => {
    const controller = makeController();
    const { result } = renderHook(() =>
      defineDragInsertTool({
        id: 'x',
        cursor: 'crosshair',
        keybinding: 'X',
        controller,
        overlayId: 'x-overlay',
        overlayLabel: 'X overlay',
        defaultStyle: DEFAULT_STYLE,
      }),
    );
    expect(result.current.tool.id).toBe('x');
    expect(result.current.tool.cursor).toBe('crosshair');
    expect(result.current.tool.keybinding).toBe('X');
    expect(result.current.tool.overlay?.id).toBe('x-overlay');
  });

  it('omits drag handlers when controller.supportsCommitInsert is false', () => {
    const controller = makeController({ supportsCommitInsert: false, supportsPointInsert: true });
    const { result } = renderHook(() =>
      defineDragInsertTool({
        id: 't', cursor: 'text', controller,
        overlayId: 't-overlay', overlayLabel: 'T overlay', defaultStyle: DEFAULT_STYLE,
      }),
    );
    expect(result.current.tool.drag).toBeUndefined();
    expect(result.current.tool.pointer?.onClick).toBeDefined();
  });

  it('omits pointer.onClick when controller.supportsPointInsert is false', () => {
    const controller = makeController({ supportsPointInsert: false, supportsCommitInsert: true });
    const { result } = renderHook(() =>
      defineDragInsertTool({
        id: 'i', cursor: 'crosshair', controller,
        overlayId: 'i-overlay', overlayLabel: 'I overlay', defaultStyle: DEFAULT_STYLE,
      }),
    );
    expect(result.current.tool.pointer?.onClick).toBeUndefined();
    expect(result.current.tool.drag).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test; verify it fails**

Run: `pnpm test --run src/tools/builtin/defineDragInsertTool.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `defineDragInsertTool`**

```ts
// src/tools/builtin/defineDragInsertTool.ts
import { useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import type { RenderLayer } from '../../core/layers/render';
import type { Op } from '../../core/ops/types';
import { applyHitExistingGate } from './hitExistingGate';
import { drawMarquee, type InsertOverlayStyle } from './marquee';
import type { InsertController } from '../../interactions/actions/insert/insert';

type ApplyBatch = (ops: Op[], label: string) => void;

export interface DragInsertToolConfig<TNode extends { id: string }, TPose> {
  id: string;
  cursor: string;
  keybinding?: string;
  controller: InsertController<TNode, TPose>;
  overlayId: string;
  overlayLabel: string;
  defaultStyle: { fill: string; stroke: string; dash: number[]; lineWidth: number };
  overlayStyle?: InsertOverlayStyle;
  hitExisting?: (point: { x: number; y: number }) => string | string[] | null;
  /** Optional ref to receive the active tool ctx's `applyBatch` while a
   *  pointer.onClick or drag.onStart→onEnd is in flight. Cleared on
   *  end/cancel. Wrappers that synthesize an adapter (e.g. `useTextTool`)
   *  pass a ref they also read from in their `useInsert.applyBatch` option;
   *  wrappers whose adapter owns dispatch (e.g. `useInsertTool`) omit. */
  applyBatchRef?: MutableRefObject<ApplyBatch | null>;
}

export interface DragInsertToolResult {
  tool: Tool<undefined>;
  applyBatchRef: MutableRefObject<ApplyBatch | null>;
}

export function defineDragInsertTool<TNode extends { id: string }, TPose>(
  config: DragInsertToolConfig<TNode, TPose>,
): DragInsertToolResult {
  const cfgRef = useRef(config);
  cfgRef.current = config;
  const internalRef = useRef<ApplyBatch | null>(null);
  const applyBatchRef = config.applyBatchRef ?? internalRef;

  const overlay = useMemo<RenderLayer<unknown>>(() => ({
    id: config.overlayId,
    label: config.overlayLabel,
    space: 'screen',
    draw: (ctx, _data, view) => {
      const cfg = cfgRef.current;
      const ov = cfg.controller.overlay;
      if (!ov) return;
      drawMarquee(ctx, view, ov.bounds, cfg.overlayStyle, cfg.defaultStyle);
    },
  }), [config.overlayId, config.overlayLabel]);

  const tool = useMemo<Tool<undefined>>(() => {
    const { id, cursor, keybinding, controller, hitExisting } = config;
    const supportsClick = controller.supportsPointInsert;
    const supportsDrag = controller.supportsCommitInsert;
    return defineTool({
      id,
      cursor,
      ...(keybinding ? { keybinding } : {}),
      overlay,
      ...(supportsClick
        ? {
            pointer: {
              onClick: (_e, ctx) => {
                if (applyHitExistingGate(ctx, hitExisting)) return 'claim';
                applyBatchRef.current = ctx.applyBatch;
                controller.start(ctx.worldX, ctx.worldY, ctx.modifiers);
                controller.end();
                applyBatchRef.current = null;
                return 'claim';
              },
            },
          }
        : {}),
      ...(supportsDrag
        ? {
            drag: {
              onStart: (_e, ctx) => {
                if (applyHitExistingGate(ctx, hitExisting)) return 'claim';
                applyBatchRef.current = ctx.applyBatch;
                controller.start(ctx.worldX, ctx.worldY, ctx.modifiers);
                return 'claim';
              },
              onMove: (_e, ctx) => {
                controller.move(ctx.worldX, ctx.worldY, ctx.modifiers);
                return 'claim';
              },
              onEnd: () => {
                controller.end();
                applyBatchRef.current = null;
                return 'claim';
              },
              onCancel: () => {
                controller.cancel();
                applyBatchRef.current = null;
              },
            },
          }
        : {}),
    });
  }, [
    config.id,
    config.cursor,
    config.keybinding,
    config.controller,
    config.hitExisting,
    overlay,
    applyBatchRef,
  ]);

  return { tool, applyBatchRef };
}
```

- [ ] **Step 4: Run tests; expect green**

Run: `pnpm test --run src/tools/builtin/defineDragInsertTool.test.ts`
Expected: all PASS.

- [ ] **Step 5: Add tests for hitExisting gate + applyBatch capture**

Append:

```ts
  it('hitExisting gate fires on pointer.onClick and skips controller.start', () => {
    const controller = makeController({ supportsPointInsert: true });
    const hitExisting = vi.fn(() => 'obj-1');
    const { result } = renderHook(() =>
      defineDragInsertTool({
        id: 't', cursor: 'text', controller,
        overlayId: 't-overlay', overlayLabel: 'T overlay', defaultStyle: DEFAULT_STYLE,
        hitExisting,
      }),
    );
    const setSel = vi.fn();
    const ctx = {
      worldX: 5, worldY: 6,
      modifiers: { shift: false, alt: false, meta: false, ctrl: false },
      selection: { set: setSel } as any,
      applyBatch: vi.fn(),
      scratch: undefined,
    } as any;
    const verdict = result.current.tool.pointer!.onClick!({} as any, ctx);
    expect(hitExisting).toHaveBeenCalledWith({ x: 5, y: 6 });
    expect(setSel).toHaveBeenCalledWith(['obj-1']);
    expect(controller.start).not.toHaveBeenCalled();
    expect(verdict).toBe('claim');
  });

  it('captures ctx.applyBatch on drag.onStart and clears on onEnd', () => {
    const controller = makeController();
    const { result } = renderHook(() =>
      defineDragInsertTool({
        id: 'i', cursor: 'crosshair', controller,
        overlayId: 'i-overlay', overlayLabel: 'I overlay', defaultStyle: DEFAULT_STYLE,
      }),
    );
    const applyBatch = vi.fn();
    const ctx = {
      worldX: 0, worldY: 0,
      modifiers: { shift: false, alt: false, meta: false, ctrl: false },
      selection: { set: vi.fn() } as any,
      applyBatch,
      scratch: undefined,
    } as any;
    result.current.tool.drag!.onStart!({} as any, ctx);
    expect(result.current.applyBatchRef.current).toBe(applyBatch);
    result.current.tool.drag!.onEnd!({} as any, ctx);
    expect(result.current.applyBatchRef.current).toBeNull();
  });
```

Run: `pnpm test --run src/tools/builtin/defineDragInsertTool.test.ts`
Expected: all PASS.

- [ ] **Step 6: Typecheck and commit**

```bash
pnpm typecheck
git add src/tools/builtin/defineDragInsertTool.ts src/tools/builtin/defineDragInsertTool.test.ts
git commit -m "feat(tools): add defineDragInsertTool primitive"
```

---

## Task 5: Collapse useInsertTool

**Files:**
- Modify: `src/tools/builtin/useInsertTool.ts`
- Test: `src/tools/builtin/useInsertTool.test.ts` (preserve)

- [ ] **Step 1: Run existing tests as baseline**

Run: `pnpm test --run src/tools/builtin/useInsertTool.test.ts`
Expected: all PASS.

- [ ] **Step 2: Replace `useInsertTool` body**

Replace the entire file with:

```ts
import { useInsert, type UseInsertOptions } from '../../interactions/actions/insert/insert';
import type { InsertAdapter } from '../../core/adapters/types';
import type { Tool } from '../types';
import { defineDragInsertTool } from './defineDragInsertTool';
import { type InsertOverlayStyle } from './marquee';

export type { InsertOverlayStyle };

export interface UseInsertToolOptions<TPose, TNode extends { id: string } = { id: string }>
  extends UseInsertOptions<TPose, TNode> {
  overlayStyle?: InsertOverlayStyle;
  /** Hit-test gate consulted before insertion. On hit, selects via
   *  ctx.selection.set and skips both the click and drag paths. */
  hitExisting?: (point: { x: number; y: number }) => string | string[] | null;
}

export function useInsertTool<TNode extends { id: string }, TPose>(
  adapter: InsertAdapter<TNode>,
  options: UseInsertToolOptions<TPose, TNode> = {},
): Tool<undefined> {
  const { hitExisting, overlayStyle, ...gestureOptions } = options;
  const controller = useInsert<TNode, TPose>(adapter, gestureOptions);
  const { tool } = defineDragInsertTool({
    id: 'insert',
    cursor: 'crosshair',
    controller,
    overlayId: 'insert-overlay',
    overlayLabel: 'Insert overlay',
    defaultStyle: { fill: 'rgba(127, 176, 105, 0.25)', stroke: '#7fb069', dash: [4, 4], lineWidth: 1 },
    overlayStyle,
    hitExisting,
  });
  return tool;
}
```

- [ ] **Step 3: Run existing tests; expect green**

Run: `pnpm test --run src/tools/builtin/useInsertTool.test.ts`
Expected: all PASS.

- [ ] **Step 4: Typecheck and commit**

```bash
pnpm typecheck
git add src/tools/builtin/useInsertTool.ts
git commit -m "refactor(tools): collapse useInsertTool to defineDragInsertTool wrapper"
```

---

## Task 6: Collapse useTextTool

**Files:**
- Modify: `src/tools/builtin/useTextTool.ts`
- Test: `src/tools/builtin/useTextTool.test.ts` (preserve)

- [ ] **Step 1: Run existing tests as baseline**

Run: `pnpm test --run src/tools/builtin/useTextTool.test.ts`
Expected: all PASS.

- [ ] **Step 2: Replace `useTextTool` body**

Replace the entire file with:

```ts
import { useMemo, useRef } from 'react';
import type { Op } from '../../core/ops/types';
import type { Tool } from '../types';
import { useInsert } from '../../interactions/actions/insert/insert';
import type { InsertAdapter } from '../../core/adapters/types';
import { defineDragInsertTool } from './defineDragInsertTool';
import { type InsertOverlayStyle } from './marquee';

type ApplyBatch = (ops: Op[], label: string) => void;

export interface UseTextToolOptions<TNode extends { id: string }> {
  pointInsert: (point: { x: number; y: number }) => TNode | null;
  commitInsert?: InsertAdapter<TNode>['commitInsert'];
  hitExisting?: (point: { x: number; y: number }) => string | string[] | null;
  minBounds?: { width: number; height: number };
  marqueeStyle?: InsertOverlayStyle;
}

export function useTextTool<TNode extends { id: string }>(
  options: UseTextToolOptions<TNode>,
): Tool<undefined> {
  const { pointInsert, commitInsert, hitExisting, minBounds, marqueeStyle } = options;

  // Single ref shared between useInsert.applyBatch and defineDragInsertTool's
  // capture/clear. The primitive writes ctx.applyBatch into this ref on entry
  // and clears it on end/cancel; useInsert.applyBatch reads through it.
  const applyBatchRef = useRef<ApplyBatch | null>(null);

  const adapter = useMemo<InsertAdapter<TNode>>(
    () => ({
      commitInsert: (b) => (commitInsert ? commitInsert(b) : null),
      commitPaste: () => [],
      snapshotSelection: () => ({ items: [] }),
      insertNode: () => {},
      setSelection: () => {},
      getSelection: () => [],
    }),
    [commitInsert],
  );

  const controller = useInsert<TNode, { x: number; y: number; width: number; height: number }>(
    adapter,
    {
      pointInsert,
      clickOnly: !commitInsert,
      minBounds: minBounds ?? { width: 4, height: 4 },
      insertLabel: 'Insert text',
      applyBatch: (ops, label) => applyBatchRef.current?.(ops, label),
    },
  );

  const { tool } = defineDragInsertTool({
    id: 'text',
    keybinding: 'T',
    cursor: 'text',
    controller,
    overlayId: 'text-overlay',
    overlayLabel: 'Text overlay',
    defaultStyle: { fill: 'rgba(164, 139, 212, 0.10)', stroke: '#a48bd4', dash: [3, 3], lineWidth: 1 },
    overlayStyle: marqueeStyle,
    hitExisting,
    applyBatchRef,
  });

  return tool;
}
```

- [ ] **Step 3: Run existing tests; expect green**

Run: `pnpm test --run src/tools/builtin/useTextTool.test.ts`
Expected: all PASS.

- [ ] **Step 4: Typecheck and commit**

```bash
pnpm typecheck
git add src/tools/builtin/useTextTool.ts
git commit -m "refactor(tools): collapse useTextTool to defineDragInsertTool wrapper"
```

---

## Task 7: Public re-export

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Inspect existing exports**

Run: `grep -n 'useInsertTool\|useTextTool\|useInsert\b' src/index.ts`
Expected: confirm where the existing wrappers are re-exported so the new symbol can sit alongside.

- [ ] **Step 2: Add re-exports**

Append (or insert at the relevant section, near `useInsertTool`):

```ts
export { defineDragInsertTool } from './tools/builtin/defineDragInsertTool';
export type {
  DragInsertToolConfig,
  DragInsertToolResult,
} from './tools/builtin/defineDragInsertTool';
export { useDragRect } from './interactions/gestures/dragRect';
export type {
  DragRectController,
  DragRectCtx,
  DragRectEndCtx,
  UseDragRectOptions,
  DragRectPoint,
  DragRectBounds,
} from './interactions/gestures/dragRect';
```

- [ ] **Step 3: Typecheck and confirm bundles build**

```bash
pnpm typecheck
pnpm build
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat(api): re-export useDragRect and defineDragInsertTool"
```

---

## Task 8: Final verification

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 2: Full test suite**

Run: `pnpm test --run`
Expected: all PASS, no skipped legacy cases. Verify the test count is at least the pre-refactor count plus the new dragRect.test.ts and defineDragInsertTool.test.ts cases.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: clean ESM + DTS build.

- [ ] **Step 4: Manual demo walkthrough**

Start the dev server and exercise:
- **InsertDemo** — click empty canvas: should not insert (no `pointInsert` wired). Drag a rect: rect appears.
- **TextDemo** (or WeaselDraw's text tool) — click empty: text object appears at click point. Drag: text object sized to drag bounds.
- **MultiSelectDemo / area-select** — drag-rect to lasso multiple objects: behaviors fire, selection updates.
- **WeaselDraw full** — exercise insert + text + select all in one place, including the text-tool history (undo a click-inserted text).

Document any visible regressions; do not commit if any appear (re-open the relevant task).

- [ ] **Step 5: Update audit (optional, only if exports changed)**

If the audit at `docs/audits/2026-05-05-exported-api.md` is being maintained as a living document, regenerate it. Otherwise note the new exports in passing.

(No commit for verification; this task is the green-light gate.)

---

## Self-review

Spec coverage check (against `docs/specs/2026-05-05-drag-insert-primitive-design.md`):

- [x] `useDragRect` base hook with start/move/end/cancel + scratch + bounds + wasSubThreshold + setStart/setCurrent — Task 1.
- [x] `useInsert` reshape with `supportsPointInsert`/`supportsCommitInsert` flags — Task 2.
- [x] `useAreaSelect` reshape preserving public surface — Task 3.
- [x] `defineDragInsertTool` primitive with conditional handler registration + applyBatch ref — Task 4.
- [x] `useInsertTool` collapse — Task 5.
- [x] `useTextTool` collapse with shared `applyBatchRef` wiring — Task 6.
- [x] Public re-export — Task 7.
- [x] Final verification — Task 8.

Type consistency: `DragRectCtx` / `DragRectEndCtx` / `DragRectController` / `UseDragRectOptions` / `DragRectPoint` / `DragRectBounds` consistent across Tasks 1, 2, 3, 7. `DragInsertToolConfig` / `DragInsertToolResult` consistent across Tasks 4, 5, 6, 7. `applyBatchRef` is `MutableRefObject<((ops: Op[], label: string) => void) | null>` in all references.

Placeholder scan: no TBDs. The two spec-deferred decisions are resolved at the top of this plan and applied in the relevant tasks.
