# Drag-Insert Primitive Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `useInsert` (gesture hook) with click-path semantics so `useTextTool` can become a thin Tool veneer over the same gesture hook `useInsertTool` already wraps.

**Architecture:** Two new options on `useInsert` — `pointInsert` (sub-threshold-drag fallback) and `clickOnly` (drag-disabled). A shared `applyHitExistingGate` helper at the tool layer keeps selection out of the gesture hook. `useTextTool` is rewritten as a thin wrapper; `useInsertTool` gains optional `pointInsert` + `hitExisting` passthroughs.

**Tech Stack:** TypeScript, React 18, Vitest, @testing-library/react.

---

## File map

- Modify: `src/interactions/gestures/insert/insert.ts` — add `pointInsert`, `clickOnly` options; teach `end()` to use them.
- Modify: `src/interactions/gestures/insert/insert.test.ts` — new tests for click-path behavior.
- Create: `src/tools/builtin/hitExistingGate.ts` — shared helper.
- Create: `src/tools/builtin/hitExistingGate.test.ts` — helper tests.
- Modify: `src/tools/builtin/index.ts` — export the helper.
- Rewrite: `src/tools/builtin/useTextTool.ts` — thin veneer over `useInsert`.
- Rewrite: `src/tools/builtin/useTextTool.test.ts` — assert wiring.
- Modify: `src/tools/builtin/useInsertTool.ts` — forward `pointInsert` + `hitExisting`.
- Modify: `src/tools/builtin/useInsertTool.test.ts` — opt-in cases.
- Modify: `apps/swillustrator/src/App.tsx` — rename callbacks to new contract.

---

## Task 1: Extend `useInsert` with `pointInsert` (sub-threshold fallback)

**Files:**
- Modify: `src/interactions/gestures/insert/insert.ts`
- Modify: `src/interactions/gestures/insert/insert.test.ts`

- [ ] **Step 1: Write failing test for sub-threshold pointInsert fallback**

Append to `src/interactions/gestures/insert/insert.test.ts`:

```ts
describe('useInsert — pointInsert fallback', () => {
  it('sub-threshold release with pointInsert dispatches an InsertOp at the start point', () => {
    const { adapter, batches } = makeAdapter();
    const pointInsert = vi.fn((p: { x: number; y: number }) => ({
      id: 'p-0', x: p.x, y: p.y, width: 0, height: 0,
    }));
    const { result } = renderHook(() =>
      useInsert<Obj, { x: number; y: number }>(adapter, {
        minBounds: { width: 4, height: 4 },
        pointInsert,
      }),
    );
    act(() => {
      result.current.start(10, 20, { alt: false, shift: false, meta: false, ctrl: false });
      result.current.move(11, 21, { alt: false, shift: false, meta: false, ctrl: false });
      result.current.end();
    });
    expect(pointInsert).toHaveBeenCalledWith({ x: 10, y: 20 });
    expect(batches.length).toBe(1);
    expect(batches[0].ops.length).toBe(1);
  });

  it('sub-threshold release with pointInsert returning null does not dispatch', () => {
    const { adapter, batches } = makeAdapter();
    const pointInsert = vi.fn(() => null);
    const { result } = renderHook(() =>
      useInsert<Obj, { x: number; y: number }>(adapter, {
        minBounds: { width: 4, height: 4 },
        pointInsert,
      }),
    );
    act(() => {
      result.current.start(10, 20, { alt: false, shift: false, meta: false, ctrl: false });
      result.current.end();
    });
    expect(pointInsert).toHaveBeenCalledWith({ x: 10, y: 20 });
    expect(batches.length).toBe(0);
  });

  it('above-threshold release still uses commitInsert (pointInsert ignored)', () => {
    const { adapter, batches } = makeAdapter();
    const pointInsert = vi.fn();
    const { result } = renderHook(() =>
      useInsert<Obj, { x: number; y: number }>(adapter, {
        minBounds: { width: 4, height: 4 },
        pointInsert,
      }),
    );
    act(() => {
      result.current.start(10, 20, { alt: false, shift: false, meta: false, ctrl: false });
      result.current.move(50, 80, { alt: false, shift: false, meta: false, ctrl: false });
      result.current.end();
    });
    expect(pointInsert).not.toHaveBeenCalled();
    expect(batches.length).toBe(1);
  });
});
```

Imports already present at top of file (`vi` from `'vitest'`). If `vi` isn't imported, add it: change `import { describe, expect, it } from 'vitest';` → `import { describe, expect, it, vi } from 'vitest';`.

- [ ] **Step 2: Run tests — verify the three new ones fail**

Run: `npx vitest run src/interactions/gestures/insert/insert.test.ts`
Expected: 3 new tests fail (`pointInsert not in options type` or `not called`).

- [ ] **Step 3: Add `pointInsert` to options interface**

In `src/interactions/gestures/insert/insert.ts`, modify `UseInsertOptions<TPose>`:

```ts
export interface UseInsertOptions<TPose, TObject extends { id: string } = { id: string }> {
  behaviors?: InsertBehavior<TPose>[];
  insertLabel?: string;
  /** Reserved; insert is never transient in practice. Ignored. */
  transient?: boolean;
  /** Strictly-greater-than thresholds; bounds with width <= or height <= abort
   *  unless `pointInsert` is set, in which case sub-threshold release falls
   *  back to `pointInsert(start)`. Default { width: 0, height: 0 }. */
  minBounds?: { width: number; height: number };
  /** Construct the in-flight pose from the drag bounds. Defaults to the
   *  identity cast (treat bounds as TPose). Override for non-rect TPose
   *  (e.g. `(b) => rectPath(b)` or a polygon factory). */
  posefromBounds?: (bounds: ResizePose) => TPose;
  /** Click / sub-threshold-drag fallback. When provided, a release whose
   *  bounds fall <= minBounds calls `pointInsert(start)` instead of aborting.
   *  Returning null aborts. The created object is dispatched as an InsertOp
   *  under the same `insertLabel`. */
  pointInsert?: (point: { x: number; y: number }) => TObject | null;
  onGestureStart?: () => void;
  onGestureEnd?: (committed: boolean) => void;
}
```

Note: the second generic `TObject` defaults to `{ id: string }` so existing call sites (`UseInsertOptions<TPose>`) compile unchanged. Update the function generics:

```ts
export function useInsert<TObject extends { id: string }, TPose>(
  adapter: InsertAdapter<TObject>,
  options: UseInsertOptions<TPose, TObject> = {},
): InsertController<TObject, TPose> {
```

- [ ] **Step 4: Wire `pointInsert` into the existing `end()`**

In `src/interactions/gestures/insert/insert.ts`, replace the destructure and `end()` body:

```ts
  const {
    behaviors = [],
    insertLabel = 'Insert',
    minBounds = { width: 0, height: 0 },
    posefromBounds = (b) => b as unknown as TPose,
    pointInsert,
    onGestureStart,
    onGestureEnd,
  } = options;
```

Add a ref:

```ts
  const pointInsertRef = useRef(pointInsert);
  pointInsertRef.current = pointInsert;
```

Replace `end`:

```ts
  const end = useCallback(() => {
    const s = stateRef.current;
    const adapter = adapterRef.current;
    const insertLabel = insertLabelRef.current;
    const minBounds = minBoundsRef.current;
    const onGestureEnd = onGestureEndRef.current;
    const pointInsert = pointInsertRef.current;
    if (!s.active || !s.ctx) {
      cleanup();
      onGestureEnd?.(false);
      return;
    }
    const ctx = s.ctx;
    const sp = ctx.origin.get(GID) as unknown as InsertPoint;
    const cp = ctx.current.get(GID) as unknown as InsertPoint;
    const bounds = boundsFrom(sp, cp);
    if (bounds.width <= minBounds.width || bounds.height <= minBounds.height) {
      // Sub-threshold: try the pointInsert fallback before aborting.
      if (pointInsert) {
        const created = pointInsert({ x: sp.x, y: sp.y });
        if (created) {
          const ops: Op[] = [createInsertOp({ object: created, label: insertLabel })];
          dispatchApplyBatch(adapter, ops, insertLabel);
          cleanup();
          onGestureEnd?.(true);
          return;
        }
      }
      cleanup();
      onGestureEnd?.(false);
      return;
    }
    const created = adapter.commitInsert(bounds);
    if (!created) {
      cleanup();
      onGestureEnd?.(false);
      return;
    }
    const ops: Op[] = [createInsertOp({ object: created, label: insertLabel })];
    dispatchApplyBatch(adapter, ops, insertLabel);
    cleanup();
    onGestureEnd?.(true);
  }, [cleanup]);
```

- [ ] **Step 5: Run tests — verify they pass**

Run: `npx vitest run src/interactions/gestures/insert/insert.test.ts`
Expected: all tests pass (existing + 3 new).

- [ ] **Step 6: Commit**

```bash
git add src/interactions/gestures/insert/insert.ts src/interactions/gestures/insert/insert.test.ts
git commit -m "feat(insert): pointInsert sub-threshold-drag fallback option"
```

---

## Task 2: Add `clickOnly` mode to `useInsert`

**Files:**
- Modify: `src/interactions/gestures/insert/insert.ts`
- Modify: `src/interactions/gestures/insert/insert.test.ts`

- [ ] **Step 1: Write failing tests for `clickOnly`**

Append to `src/interactions/gestures/insert/insert.test.ts`:

```ts
describe('useInsert — clickOnly', () => {
  it('clickOnly: above-threshold release still routes to pointInsert (commitInsert never called)', () => {
    const { adapter, batches } = makeAdapter();
    const commitSpy = vi.spyOn(adapter, 'commitInsert');
    const pointInsert = vi.fn((p: { x: number; y: number }) => ({
      id: 'p-0', x: p.x, y: p.y, width: 0, height: 0,
    }));
    const { result } = renderHook(() =>
      useInsert<Obj, { x: number; y: number }>(adapter, {
        clickOnly: true,
        pointInsert,
        minBounds: { width: 4, height: 4 },
      }),
    );
    act(() => {
      result.current.start(10, 20, { alt: false, shift: false, meta: false, ctrl: false });
      result.current.move(80, 90, { alt: false, shift: false, meta: false, ctrl: false });
      result.current.end();
    });
    expect(commitSpy).not.toHaveBeenCalled();
    expect(pointInsert).toHaveBeenCalledWith({ x: 10, y: 20 });
    expect(batches.length).toBe(1);
  });

  it('clickOnly with pointInsert returning null does not dispatch', () => {
    const { adapter, batches } = makeAdapter();
    const { result } = renderHook(() =>
      useInsert<Obj, { x: number; y: number }>(adapter, {
        clickOnly: true,
        pointInsert: () => null,
      }),
    );
    act(() => {
      result.current.start(10, 20, { alt: false, shift: false, meta: false, ctrl: false });
      result.current.end();
    });
    expect(batches.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests — verify the two new ones fail**

Run: `npx vitest run src/interactions/gestures/insert/insert.test.ts`
Expected: 2 new tests fail (above-threshold drag still calls `commitInsert`).

- [ ] **Step 3: Add `clickOnly` to options + wire into `end()`**

In `src/interactions/gestures/insert/insert.ts`, add to `UseInsertOptions`:

```ts
  /** Drag-disabled mode. When true, every release routes to pointInsert(start)
   *  regardless of bounds — commitInsert is never called. Used by tool hooks
   *  that wire only pointer.onClick (no marquee). */
  clickOnly?: boolean;
```

Update the destructure:

```ts
  const {
    behaviors = [],
    insertLabel = 'Insert',
    minBounds = { width: 0, height: 0 },
    posefromBounds = (b) => b as unknown as TPose,
    pointInsert,
    clickOnly = false,
    onGestureStart,
    onGestureEnd,
  } = options;
```

Add a ref:

```ts
  const clickOnlyRef = useRef(clickOnly);
  clickOnlyRef.current = clickOnly;
```

Modify the bounds-check branch in `end()`:

```ts
    const bounds = boundsFrom(sp, cp);
    const subThreshold = bounds.width <= minBounds.width || bounds.height <= minBounds.height;
    if (clickOnlyRef.current || subThreshold) {
      if (pointInsert) {
        const created = pointInsert({ x: sp.x, y: sp.y });
        if (created) {
          const ops: Op[] = [createInsertOp({ object: created, label: insertLabel })];
          dispatchApplyBatch(adapter, ops, insertLabel);
          cleanup();
          onGestureEnd?.(true);
          return;
        }
      }
      cleanup();
      onGestureEnd?.(false);
      return;
    }
```

(Replaces the prior `if (bounds.width <= minBounds.width || bounds.height <= minBounds.height) { ... }` block. The `commitInsert` path below it is unchanged.)

- [ ] **Step 4: Run tests — verify they pass**

Run: `npx vitest run src/interactions/gestures/insert/insert.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/interactions/gestures/insert/insert.ts src/interactions/gestures/insert/insert.test.ts
git commit -m "feat(insert): clickOnly mode (drag-disabled, point-only insertion)"
```

---

## Task 3: Add `applyHitExistingGate` helper

**Files:**
- Create: `src/tools/builtin/hitExistingGate.ts`
- Create: `src/tools/builtin/hitExistingGate.test.ts`
- Modify: `src/tools/builtin/index.ts`

- [ ] **Step 1: Write failing test**

Create `src/tools/builtin/hitExistingGate.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { applyHitExistingGate } from './hitExistingGate';
import type { ToolCtx } from '../types';

function makeCtx(over: Partial<ToolCtx<unknown>> = {}): ToolCtx<unknown> {
  return {
    worldX: 10,
    worldY: 20,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: [], set: vi.fn() } as unknown as ToolCtx['selection'],
    adapter: {},
    applyBatch: vi.fn(),
    view: { x: 0, y: 0, scale: 1 },
    setView: () => {},
    canvasRect: new DOMRect(),
    scratch: undefined,
    ...over,
  };
}

describe('applyHitExistingGate', () => {
  it('returns false when hitExisting is undefined', () => {
    expect(applyHitExistingGate(makeCtx(), undefined)).toBe(false);
  });

  it('returns false when hitExisting returns null', () => {
    const ctx = makeCtx();
    expect(applyHitExistingGate(ctx, () => null)).toBe(false);
    expect(ctx.selection.set).not.toHaveBeenCalled();
  });

  it('selects single id and returns true', () => {
    const set = vi.fn();
    const ctx = makeCtx({ selection: { current: [], set } as any });
    expect(applyHitExistingGate(ctx, () => 'id-1')).toBe(true);
    expect(set).toHaveBeenCalledWith(['id-1']);
  });

  it('selects array of ids and returns true', () => {
    const set = vi.fn();
    const ctx = makeCtx({ selection: { current: [], set } as any });
    expect(applyHitExistingGate(ctx, () => ['a', 'b'])).toBe(true);
    expect(set).toHaveBeenCalledWith(['a', 'b']);
  });

  it('passes the world point to the hit-test callback', () => {
    const hit = vi.fn(() => null);
    applyHitExistingGate(makeCtx({ worldX: 42, worldY: 99 }), hit);
    expect(hit).toHaveBeenCalledWith({ x: 42, y: 99 });
  });
});
```

- [ ] **Step 2: Run test — verify failure**

Run: `npx vitest run src/tools/builtin/hitExistingGate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement helper**

Create `src/tools/builtin/hitExistingGate.ts`:

```ts
import type { ToolCtx } from '../types';

/** Hit-existing gate shared by the drag-insert tool hooks. When the consumer
 *  supplies a `hitExisting` callback, run it at the cursor's world point.
 *  On hit (string id or array of ids), set the selection and return `true` —
 *  the caller should claim and skip insertion. On miss or when no callback
 *  is supplied, return `false`. */
export function applyHitExistingGate(
  ctx: ToolCtx<unknown>,
  hitExisting:
    | ((p: { x: number; y: number }) => string | string[] | null)
    | undefined,
): boolean {
  if (!hitExisting) return false;
  const hit = hitExisting({ x: ctx.worldX, y: ctx.worldY });
  if (!hit) return false;
  ctx.selection.set(Array.isArray(hit) ? hit : [hit]);
  return true;
}
```

- [ ] **Step 4: Export from package**

In `src/tools/builtin/index.ts`, append:

```ts
export { applyHitExistingGate } from './hitExistingGate';
```

- [ ] **Step 5: Run tests — verify pass**

Run: `npx vitest run src/tools/builtin/hitExistingGate.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/tools/builtin/hitExistingGate.ts src/tools/builtin/hitExistingGate.test.ts src/tools/builtin/index.ts
git commit -m "feat(tools): applyHitExistingGate helper for drag-insert tools"
```

---

## Task 4: Rewrite `useTextTool` as a thin veneer over `useInsert`

**Files:**
- Rewrite: `src/tools/builtin/useTextTool.ts`
- Rewrite: `src/tools/builtin/useTextTool.test.ts`

- [ ] **Step 1: Replace test file**

Overwrite `src/tools/builtin/useTextTool.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTextTool } from './useTextTool';
import type { ToolCtx } from '../types';

function makeCtx(over: Partial<ToolCtx<unknown>> = {}): ToolCtx<unknown> {
  return {
    worldX: 100,
    worldY: 200,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: [], set: vi.fn() } as unknown as ToolCtx['selection'],
    adapter: {},
    applyBatch: vi.fn(),
    view: { x: 0, y: 0, scale: 1 },
    setView: () => {},
    canvasRect: new DOMRect(),
    scratch: undefined,
    ...over,
  };
}

function pe(): PointerEvent {
  const e = new Event('click') as PointerEvent;
  Object.assign(e, { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
  return e;
}

describe('useTextTool — declarations', () => {
  it('declares id "text", T keybinding, text cursor', () => {
    const { result } = renderHook(() =>
      useTextTool({ pointInsert: () => ({ id: 't', x: 0, y: 0, width: 0, height: 0, text: '' }) }),
    );
    expect(result.current.id).toBe('text');
    expect(result.current.keybinding).toBe('T');
    expect(result.current.cursor).toBe('text');
  });

  it('has no drag handlers when commitInsert is omitted (click-only)', () => {
    const { result } = renderHook(() =>
      useTextTool({ pointInsert: () => ({ id: 't', x: 0, y: 0, width: 0, height: 0, text: '' }) }),
    );
    expect(result.current.drag).toBeUndefined();
  });

  it('has drag handlers and overlay when commitInsert is supplied', () => {
    const { result } = renderHook(() =>
      useTextTool({
        pointInsert: () => ({ id: 't', x: 0, y: 0, width: 0, height: 0, text: '' }),
        commitInsert: (b) => ({ id: 't', ...b, text: '' }),
      }),
    );
    expect(result.current.drag).toBeDefined();
    expect(result.current.overlay).toBeDefined();
    expect(result.current.overlay!.space).toBe('screen');
  });
});

describe('useTextTool — click path', () => {
  it('pointer.onClick on empty space dispatches an InsertOp via applyBatch', () => {
    const pointInsert = vi.fn((p: { x: number; y: number }) => ({
      id: 't1', x: p.x, y: p.y, width: 120, height: 32, text: '',
    }));
    const applyBatch = vi.fn();
    const { result } = renderHook(() => useTextTool({ pointInsert }));
    let decision: unknown;
    act(() => {
      decision = result.current.pointer!.onClick!(pe(), makeCtx({ worldX: 50, worldY: 75, applyBatch }));
    });
    expect(decision).toBe('claim');
    expect(pointInsert).toHaveBeenCalledWith({ x: 50, y: 75 });
    expect(applyBatch).toHaveBeenCalledTimes(1);
    const [ops, label] = applyBatch.mock.calls[0] as [Array<{ apply: unknown; invert: unknown }>, string];
    expect(label).toBe('Insert text');
    expect(ops.length).toBe(1);
  });

  it('pointer.onClick with pointInsert returning null is a no-op pass', () => {
    const pointInsert = vi.fn(() => null);
    const applyBatch = vi.fn();
    const { result } = renderHook(() => useTextTool({ pointInsert }));
    let decision: unknown;
    act(() => {
      decision = result.current.pointer!.onClick!(pe(), makeCtx({ applyBatch }));
    });
    expect(decision).toBe('pass');
    expect(applyBatch).not.toHaveBeenCalled();
  });

  it('pointer.onClick with hitExisting hit selects and skips insertion', () => {
    const pointInsert = vi.fn();
    const set = vi.fn();
    const hitExisting = vi.fn(() => 'existing-1');
    const applyBatch = vi.fn();
    const { result } = renderHook(() => useTextTool({ pointInsert, hitExisting }));
    let decision: unknown;
    act(() => {
      decision = result.current.pointer!.onClick!(
        pe(),
        makeCtx({ applyBatch, selection: { current: [], set } as any }),
      );
    });
    expect(decision).toBe('claim');
    expect(set).toHaveBeenCalledWith(['existing-1']);
    expect(pointInsert).not.toHaveBeenCalled();
    expect(applyBatch).not.toHaveBeenCalled();
  });
});

describe('useTextTool — drag path', () => {
  it('drag above threshold commits via commitInsert', () => {
    const pointInsert = vi.fn();
    const commitInsert = vi.fn((b: { x: number; y: number; width: number; height: number }) => ({
      id: 't1', x: b.x, y: b.y, width: b.width, height: b.height, text: '',
    }));
    const applyBatch = vi.fn();
    const { result } = renderHook(() => useTextTool({ pointInsert, commitInsert }));
    const ctx = makeCtx({ applyBatch, worldX: 10, worldY: 20 });
    act(() => {
      result.current.drag!.onStart!(pe(), ctx);
      ctx.worldX = 110;
      ctx.worldY = 80;
      result.current.drag!.onMove!(pe(), ctx);
      result.current.drag!.onEnd!(pe(), ctx);
    });
    expect(commitInsert).toHaveBeenCalledWith({ x: 10, y: 20, width: 100, height: 60 });
    expect(pointInsert).not.toHaveBeenCalled();
    expect(applyBatch).toHaveBeenCalledTimes(1);
  });

  it('drag below threshold falls back to pointInsert at the start point', () => {
    const pointInsert = vi.fn(() => ({ id: 't1', x: 10, y: 20, width: 0, height: 0, text: '' }));
    const commitInsert = vi.fn();
    const applyBatch = vi.fn();
    const { result } = renderHook(() =>
      useTextTool({ pointInsert, commitInsert, minBounds: { width: 10, height: 10 } }),
    );
    const ctx = makeCtx({ applyBatch, worldX: 10, worldY: 20 });
    act(() => {
      result.current.drag!.onStart!(pe(), ctx);
      ctx.worldX = 12;
      ctx.worldY = 21;
      result.current.drag!.onMove!(pe(), ctx);
      result.current.drag!.onEnd!(pe(), ctx);
    });
    expect(commitInsert).not.toHaveBeenCalled();
    expect(pointInsert).toHaveBeenCalledWith({ x: 10, y: 20 });
    expect(applyBatch).toHaveBeenCalledTimes(1);
  });

  it('drag.onStart with hitExisting hit selects and does not start the controller', () => {
    const pointInsert = vi.fn();
    const commitInsert = vi.fn();
    const set = vi.fn();
    const hitExisting = vi.fn(() => 'hit-1');
    const applyBatch = vi.fn();
    const { result } = renderHook(() => useTextTool({ pointInsert, commitInsert, hitExisting }));
    const ctx = makeCtx({ applyBatch, worldX: 10, worldY: 20, selection: { current: [], set } as any });
    let decision: unknown;
    act(() => {
      decision = result.current.drag!.onStart!(pe(), ctx);
      // Subsequent onMove/onEnd are no-ops because the controller wasn't started.
      result.current.drag!.onMove!(pe(), ctx);
      result.current.drag!.onEnd!(pe(), ctx);
    });
    expect(decision).toBe('claim');
    expect(set).toHaveBeenCalledWith(['hit-1']);
    expect(commitInsert).not.toHaveBeenCalled();
    expect(pointInsert).not.toHaveBeenCalled();
    expect(applyBatch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — verify failure**

Run: `npx vitest run src/tools/builtin/useTextTool.test.ts`
Expected: FAIL — option name mismatch (`pointInsert` not in `UseTextToolOptions`).

- [ ] **Step 3: Replace `useTextTool` implementation**

Overwrite `src/tools/builtin/useTextTool.ts`:

```ts
import { useMemo, useRef } from 'react';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import type { RenderLayer } from '../../core/layers/render';
import { useInsert } from '../../interactions/gestures/insert/insert';
import type { InsertAdapter } from '../../core/adapters/types';
import { applyHitExistingGate } from './hitExistingGate';
import { viewToTransform } from '../../features/viewport/view';
import { worldToScreen } from '../../features/viewport/viewTransform';

export interface UseTextToolOptions<TObject extends { id: string }> {
  /** Click / sub-threshold-drag insertion. Called with the cursor's world
   *  point on click and on tiny drags. Return `null` to decline (e.g. to
   *  treat the click as edit-entry on an existing object). The kit wraps
   *  the returned object in an InsertOp dispatched via `ctx.applyBatch`. */
  pointInsert: (point: { x: number; y: number }) => TObject | null;
  /** Optional drag-to-size path. When provided, dragging on the canvas
   *  draws a marquee preview and on release commits via
   *  `commitInsert(bounds)`. Sub-threshold releases fall back to
   *  `pointInsert(start)`. Omit to keep click-only behavior — no marquee,
   *  no drag handlers. */
  commitInsert?: InsertAdapter<TObject>['commitInsert'];
  /** Hit-test gate consulted before insertion. When it returns id(s), the
   *  tool selects them via `ctx.selection.set` and skips both the click
   *  and drag paths. Return `null` to fall through to insertion. */
  hitExisting?: (point: { x: number; y: number }) => string | string[] | null;
  /** Threshold below which a drag falls back to `pointInsert`. Default
   *  `{ width: 4, height: 4 }`. Ignored when `commitInsert` is omitted. */
  minBounds?: { width: number; height: number };
  /** Style for the drag-to-size marquee preview. */
  marqueeStyle?: {
    stroke?: string;
    dash?: number[];
    lineWidth?: number;
    fill?: string;
  };
}

/** Active-slot Tool: click to create a new text object at the cursor;
 *  optionally drag to size its bounding box.
 *
 *  Thin Tool veneer over `useInsert` — same gesture hook `useInsertTool`
 *  uses, just with click-path semantics enabled by `pointInsert`. When
 *  `commitInsert` is omitted the gesture hook runs in `clickOnly` mode
 *  and no drag handlers register on the Tool record.
 *
 *  Consumers wanting double-click-to-edit on existing nodes wire that
 *  separately via `useTextEdit`. */
export function useTextTool<TObject extends { id: string }>(
  options: UseTextToolOptions<TObject>,
): Tool<undefined> {
  const { pointInsert, commitInsert, hitExisting, minBounds, marqueeStyle } = options;
  const minW = minBounds?.width ?? 4;
  const minH = minBounds?.height ?? 4;

  // Build an InsertAdapter for the gesture hook. When the consumer omits
  // commitInsert we run the gesture hook in clickOnly mode, so this
  // commitInsert is never called — but the type still requires it.
  const adapter = useMemo<InsertAdapter<TObject>>(() => ({
    commitInsert: (b) => (commitInsert ? commitInsert(b) : null),
    commitPaste: () => [],
    snapshotSelection: () => ({ items: [] }),
    insertObject: () => {},
    setSelection: () => {},
    getSelection: () => [],
  }), [commitInsert]);

  const ctl = useInsert<TObject, { x: number; y: number; width: number; height: number }>(
    adapter,
    {
      pointInsert,
      clickOnly: !commitInsert,
      minBounds: { width: minW, height: minH },
      insertLabel: 'Insert text',
    },
  );

  const styleRef = useRef(marqueeStyle);
  styleRef.current = marqueeStyle;
  const ctlRef = useRef(ctl);
  ctlRef.current = ctl;

  const overlay = useMemo<RenderLayer<unknown>>(() => ({
    id: 'text-overlay',
    label: 'Text overlay',
    space: 'screen',
    draw: (ctx, _data, view) => {
      const ov = ctlRef.current.overlay;
      if (!ov) return;
      const cfg = styleRef.current ?? {};
      const stroke = cfg.stroke ?? '#a48bd4';
      const dash = cfg.dash ?? [3, 3];
      const lineWidth = cfg.lineWidth ?? 1;
      const fill = cfg.fill ?? 'rgba(164, 139, 212, 0.10)';
      const t = viewToTransform(view);
      const { x, y, width: w, height: h } = ov.bounds;
      const [sx, sy] = worldToScreen(x, y, t);
      const sw = w * view.scale;
      const sh = h * view.scale;
      ctx.save();
      ctx.fillStyle = fill;
      ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash(dash);
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.setLineDash([]);
      ctx.restore();
    },
  }), []);

  return useMemo(
    () =>
      defineTool({
        id: 'text',
        keybinding: 'T',
        cursor: 'text',
        overlay: commitInsert ? overlay : undefined,
        pointer: {
          onClick: (_e, ctx) => {
            if (applyHitExistingGate(ctx, hitExisting)) return 'claim';
            // Drive a zero-bounds drag through the gesture hook so the click
            // path lands in the same end() branch as a sub-threshold drag.
            ctl.start(ctx.worldX, ctx.worldY, ctx.modifiers);
            ctl.end();
            // The gesture hook only dispatches when pointInsert returned
            // an object; if it returned null, no batch fired. We still
            // claim either way to preserve "I handled this click".
            return 'claim';
          },
        },
        ...(commitInsert
          ? {
              drag: {
                onStart: (_e, ctx) => {
                  if (applyHitExistingGate(ctx, hitExisting)) return 'claim';
                  ctl.start(ctx.worldX, ctx.worldY, ctx.modifiers);
                  return 'claim';
                },
                onMove: (_e, ctx) => {
                  ctl.move(ctx.worldX, ctx.worldY, ctx.modifiers);
                  return 'claim';
                },
                onEnd: () => {
                  ctl.end();
                  return 'claim';
                },
                onCancel: () => {
                  ctl.cancel();
                },
              },
            }
          : {}),
      }),
    [ctl, commitInsert, overlay, hitExisting],
  );
}
```

Note: the `pointInsert` returning `null` test expects decision `'pass'`, but the implementation above always returns `'claim'`. Reconcile: change the test to expect `'claim'` (the click was handled — declining isn't a pass-through). Update the relevant test:

```ts
  it('pointer.onClick with pointInsert returning null is a claim with no batch', () => {
    const pointInsert = vi.fn(() => null);
    const applyBatch = vi.fn();
    const { result } = renderHook(() => useTextTool({ pointInsert }));
    let decision: unknown;
    act(() => {
      decision = result.current.pointer!.onClick!(pe(), makeCtx({ applyBatch }));
    });
    expect(decision).toBe('claim');
    expect(applyBatch).not.toHaveBeenCalled();
  });
```

(Make this edit in the test file from Step 1 before running Step 4.)

- [ ] **Step 4: Run tests — verify pass**

Run: `npx vitest run src/tools/builtin/useTextTool.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Run full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: all suites pass (1100+ tests).

- [ ] **Step 6: Commit**

```bash
git add src/tools/builtin/useTextTool.ts src/tools/builtin/useTextTool.test.ts
git commit -m "refactor(tools): rewrite useTextTool as thin veneer over useInsert"
```

---

## Task 5: Forward `pointInsert` + `hitExisting` through `useInsertTool`

**Files:**
- Modify: `src/tools/builtin/useInsertTool.ts`
- Modify: `src/tools/builtin/useInsertTool.test.ts`

- [ ] **Step 1: Write failing tests for opt-in behavior**

Append to `src/tools/builtin/useInsertTool.test.ts`:

```ts
describe('useInsertTool — opt-in click + hitExisting', () => {
  it('registers pointer.onClick when pointInsert is supplied', () => {
    const adapter = {
      getSelection: () => [],
      commitInsert: vi.fn(),
      commitPaste: vi.fn(() => []),
      snapshotSelection: vi.fn(),
      insertObject: vi.fn(),
      setSelection: vi.fn(),
      applyBatch: vi.fn(),
    } as any;
    const { result } = renderHook(() =>
      useInsertTool(adapter, {
        pointInsert: (p) => ({ id: 'i', x: p.x, y: p.y, width: 0, height: 0 }),
      }),
    );
    expect(result.current.pointer?.onClick).toBeDefined();
  });

  it('does not register pointer.onClick when pointInsert is omitted', () => {
    const adapter = {
      getSelection: () => [],
      commitInsert: vi.fn(),
      commitPaste: vi.fn(() => []),
      snapshotSelection: vi.fn(),
      insertObject: vi.fn(),
      setSelection: vi.fn(),
      applyBatch: vi.fn(),
    } as any;
    const { result } = renderHook(() => useInsertTool(adapter, {}));
    expect(result.current.pointer?.onClick).toBeUndefined();
  });

  it('drag.onStart with hitExisting hit selects and does not start the controller', () => {
    const commitInsert = vi.fn();
    const adapter = {
      getSelection: () => [],
      commitInsert,
      commitPaste: vi.fn(() => []),
      snapshotSelection: vi.fn(),
      insertObject: vi.fn(),
      setSelection: vi.fn(),
      applyBatch: vi.fn(),
    } as any;
    const set = vi.fn();
    const { result } = renderHook(() =>
      useInsertTool(adapter, { hitExisting: () => 'hit-1' }),
    );
    const ctx = makeCtx({ selection: { current: [], set } as any });
    let decision: unknown;
    act(() => {
      decision = result.current.drag!.onStart!(pe(), ctx);
      result.current.drag!.onEnd!(pe(), ctx);
    });
    expect(decision).toBe('claim');
    expect(set).toHaveBeenCalledWith(['hit-1']);
    expect(commitInsert).not.toHaveBeenCalled();
  });
});
```

Add `act` to the imports if not present: `import { renderHook, act } from '@testing-library/react';`.

- [ ] **Step 2: Run tests — verify failure**

Run: `npx vitest run src/tools/builtin/useInsertTool.test.ts`
Expected: 3 new tests fail.

- [ ] **Step 3: Update `useInsertTool` to accept and forward the new options**

Overwrite `src/tools/builtin/useInsertTool.ts`:

```ts
import { useMemo, useRef } from 'react';
import { useInsert, type UseInsertOptions } from '../../interactions/gestures/insert/insert';
import type { InsertAdapter } from '../../core/adapters/types';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import { applyHitExistingGate } from './hitExistingGate';
import { viewToTransform } from '../../features/viewport/view';
import { worldToScreen } from '../../features/viewport/viewTransform';
import type { RenderLayer } from '../../core/layers/render';

export interface InsertOverlayStyle {
  fill?: string;
  stroke?: string;
  dash?: number[];
  lineWidth?: number;
}

export interface UseInsertToolOptions<TPose, TObject extends { id: string } = { id: string }>
  extends UseInsertOptions<TPose, TObject> {
  overlayStyle?: InsertOverlayStyle;
  /** Hit-test gate consulted before insertion. On hit, selects via
   *  ctx.selection.set and skips both the click and drag paths. */
  hitExisting?: (point: { x: number; y: number }) => string | string[] | null;
}

/** Active-slot Tool wrapping `useInsert`. Declares cursor `'crosshair'`.
 *  No keybinding by default — consumer activates via
 *  `useKeybindings({ overrides: { i: 'insert' } })` or similar. */
export function useInsertTool<TObject extends { id: string }, TPose>(
  adapter: InsertAdapter<TObject>,
  options: UseInsertToolOptions<TPose, TObject> = {},
): Tool<undefined> {
  const { hitExisting, overlayStyle, ...gestureOptions } = options;
  const ctl = useInsert<TObject, TPose>(adapter, gestureOptions);

  const styleRef = useRef(overlayStyle);
  styleRef.current = overlayStyle;

  const overlay = useMemo<RenderLayer<unknown>>(() => ({
    id: 'insert-overlay',
    label: 'Insert overlay',
    space: 'screen',
    draw: (ctx, _data, view) => {
      const ov = ctl.overlay;
      if (!ov) return;
      const cfg = styleRef.current ?? {};
      const fill = cfg.fill ?? 'rgba(127, 176, 105, 0.25)';
      const stroke = cfg.stroke ?? '#7fb069';
      const dash = cfg.dash ?? [4, 4];
      const lineWidth = cfg.lineWidth ?? 1;
      const t = viewToTransform(view);
      const { x, y, width: w, height: h } = ov.bounds;
      const [sx, sy] = worldToScreen(x, y, t);
      const sw = w * view.scale;
      const sh = h * view.scale;
      ctx.save();
      ctx.fillStyle = fill;
      ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash(dash);
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.setLineDash([]);
      ctx.restore();
    },
  }), [ctl]);

  const hasPointInsert = !!gestureOptions.pointInsert;

  return useMemo(
    () =>
      defineTool({
        id: 'insert',
        cursor: 'crosshair',
        overlay,
        ...(hasPointInsert
          ? {
              pointer: {
                onClick: (_e, ctx) => {
                  if (applyHitExistingGate(ctx, hitExisting)) return 'claim';
                  ctl.start(ctx.worldX, ctx.worldY, ctx.modifiers);
                  ctl.end();
                  return 'claim';
                },
              },
            }
          : {}),
        drag: {
          onStart: (_e, ctx) => {
            if (applyHitExistingGate(ctx, hitExisting)) return 'claim';
            ctl.start(ctx.worldX, ctx.worldY, ctx.modifiers);
            return 'claim';
          },
          onMove: (_e, ctx) => {
            ctl.move(ctx.worldX, ctx.worldY, ctx.modifiers);
            return 'claim';
          },
          onEnd: () => {
            ctl.end();
            return 'claim';
          },
          onCancel: () => {
            ctl.cancel();
          },
        },
      }),
    [ctl, overlay, hasPointInsert, hitExisting],
  );
}
```

- [ ] **Step 4: Run tests — verify pass**

Run: `npx vitest run src/tools/builtin/useInsertTool.test.ts`
Expected: PASS (existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/useInsertTool.ts src/tools/builtin/useInsertTool.test.ts
git commit -m "feat(tools): useInsertTool forwards pointInsert + hitExisting"
```

---

## Task 6: Migrate Swillustrator consumer to new contract

**Files:**
- Modify: `apps/swillustrator/src/App.tsx`

- [ ] **Step 1: Read current text-tool wiring**

Confirm the existing block in `apps/swillustrator/src/App.tsx` (around the `useTextTool` call):

```ts
  const text = useTextTool<TextObj>({
    hitExisting: ({ worldX, worldY }) => {
      const hit = [...itemsRef.current].reverse().find(
        (o): o is TextObj => o.kind === 'text'
          && worldX >= o.x && worldX <= o.x + o.width
          && worldY >= o.y && worldY <= o.y + o.height,
      );
      return hit ? hit.id : null;
    },
    commitInsert: ({ worldX, worldY }) => {
      const id = `t${nextId.current++}`;
      return { id, kind: 'text', x: worldX, y: worldY, width: 180, height: 28, text: 'New text', style: { fontSize: 16, fill: { fill: 'solid', color: fillRef.current } } };
    },
    commitInsertBounds: ({ x, y, width, height }) => {
      const id = `t${nextId.current++}`;
      const fontSize = Math.max(8, Math.round(height * 0.7));
      return { id, kind: 'text', x, y, width, height, text: 'New text', style: { fontSize, fill: { fill: 'solid', color: fillRef.current } } };
    },
  });
```

- [ ] **Step 2: Rewrite the call to use the new contract**

Replace the block above with:

```ts
  const text = useTextTool<TextObj>({
    hitExisting: ({ x, y }) => {
      const hit = [...itemsRef.current].reverse().find(
        (o): o is TextObj => o.kind === 'text'
          && x >= o.x && x <= o.x + o.width
          && y >= o.y && y <= o.y + o.height,
      );
      return hit ? hit.id : null;
    },
    pointInsert: ({ x, y }) => {
      const id = `t${nextId.current++}`;
      return { id, kind: 'text', x, y, width: 180, height: 28, text: 'New text', style: { fontSize: 16, fill: { fill: 'solid', color: fillRef.current } } };
    },
    commitInsert: ({ x, y, width, height }) => {
      const id = `t${nextId.current++}`;
      const fontSize = Math.max(8, Math.round(height * 0.7));
      return { id, kind: 'text', x, y, width, height, text: 'New text', style: { fontSize, fill: { fill: 'solid', color: fillRef.current } } };
    },
  });
```

Three renames: callback param shape `{ worldX, worldY }` → `{ x, y }` (matches the gesture-hook point shape), `commitInsert` (click) → `pointInsert`, `commitInsertBounds` → `commitInsert`.

- [ ] **Step 3: Type-check the app**

Run: `npx tsc --noEmit`
Expected: no new errors in `apps/swillustrator/src/App.tsx`. (Pre-existing errors in `demo/` and `src/canvas/layers.test.ts` are unrelated.)

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Live-test in browser**

Run dev server (background):

```bash
npm run dev:swill
```

Open `http://localhost:5174/weasel/swillustrator/` (or whichever port Vite reports).

Manual checks:
1. Press `T` to activate the text tool; click on empty space → a text object appears at the cursor.
2. Drag a marquee on empty space → a text object appears at the marquee's bounds with font size matched to height.
3. Click on an existing text object → it becomes selected; no new object is inserted.
4. Drag starting on an existing text object → it becomes selected; no marquee, no new object.
5. Press `R` (rect tool); drag still works as before (regression check).
6. Cmd+A still selects all (regression check).

If any check fails, debug before committing. Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add apps/swillustrator/src/App.tsx
git commit -m "feat(swillustrator): migrate text tool to pointInsert/commitInsert contract"
```

---

## Task 7: Final cleanup pass

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite once more**

Run: `npx vitest run`
Expected: all suites pass.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this plan.

- [ ] **Step 3: Confirm git log is clean**

Run: `git log --oneline -10`
Expected: 6 commits from this plan, all on `main` (or the working branch).
