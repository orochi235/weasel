# Drag-Gesture Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `useDragGesture<TScratch>` base primitive defined in `docs/specs/2026-05-05-drag-gesture-base-design.md`, then migrate `useDragRect` and `useMove` to be thin wrappers around it. Public surface of both wrappers stays the same except for one breaking rename: `DragRectEndCtx.wasSubThreshold` → `isSubThreshold`.

**Architecture:** The base owns the phase machine (`idle` → `pending` → `active`), threshold gating via a wrapper-supplied predicate, scratch lifecycle, `onGestureStart`/`onGestureEnd` resilience (try/finally around `onEnd`), and stable controller identity. State shape, behaviors loops, op dispatch, and overlay shape stay in the wrappers. `useResize`/`useRotate` are not migrated in this plan (deferred per spec; tracked in TODO).

**Tech Stack:** React 18 + TypeScript, Vitest + React Testing Library. Reference patterns:
- `src/interactions/gestures/dragRect.ts` — current dragRect impl (drives the base's phase/scratch/resilience design).
- `src/interactions/gestures/move/move.ts` — current useMove impl (drives the threshold-predicate and pre-threshold-onStart split).
- `src/interactions/gestures/types.ts` — `ModifierState`, `GestureContext`, `MoveBehavior`, etc.

---

## File map

**Create:**
- `src/interactions/gestures/dragGesture.ts` — the new base primitive.
- `src/interactions/gestures/dragGesture.test.ts` — unit tests covering phase machine, threshold gating, restart-while-active, error resilience, controller stability.

**Modify (Task 2 — dragRect migration + rename):**
- `src/interactions/gestures/dragRect.ts` — collapse to wrapper around `useDragGesture`. Rename `wasSubThreshold` → `isSubThreshold`.
- `src/interactions/gestures/dragRect.test.ts` — update the one assertion site for the field rename. Add a regression test for restart-while-active.
- `src/interactions/gestures/insert/insert.ts:152` — update consumer reading `ctx.wasSubThreshold`.
- `src/interactions/gestures/index.ts` — export `useDragGesture` and its types.

**Modify (Task 3 — useMove migration):**
- `src/interactions/gestures/move/move.ts` — collapse phase-machine portion to a wrapper around `useDragGesture`. Behaviors, layout pass, cascade, op dispatch stay.
- `src/interactions/gestures/move/move.test.ts` — runs unmodified.

**Tests stay (assert public surfaces — already comprehensive):**
- `src/interactions/gestures/dragRect.test.ts` — except for the field rename (Task 2 Step 2).
- `src/interactions/gestures/move/move.test.ts`
- `src/interactions/gestures/insert/insert.test.ts`
- `src/interactions/gestures/area-select/areaSelect.test.ts`
- All behavior-specific test suites under `src/interactions/gestures/move/behaviors/` and `src/interactions/gestures/resize/behaviors/`.

---

## Task ordering rationale

1. **Task 1 (base + tests)** — green, no consumers yet. Validates the base in isolation before any migration.
2. **Task 2 (dragRect migration + rename)** — smaller wrapper; flushes out base API issues with the simpler consumer. The `isSubThreshold` rename ships in this same task because dragRect owns the field.
3. **Task 3 (useMove migration)** — larger wrapper; benefits from any base refinements made in Task 2.
4. **Task 4 (verification)** — full suite + demo smoke.

Each task ends with the build green and the suite passing.

---

## Task 1: Build `useDragGesture` base primitive

**Files:**
- Create: `src/interactions/gestures/dragGesture.ts`
- Create: `src/interactions/gestures/dragGesture.test.ts`

- [ ] **Step 1: Write the test file (TDD)**

Create `src/interactions/gestures/dragGesture.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDragGesture, type DragGestureCtx, type DragGestureEndCtx } from './dragGesture';
import type { ModifierState } from './types';

const NO_MODS: ModifierState = { shift: false, alt: false, meta: false, ctrl: false };
const SHIFT: ModifierState = { shift: true, alt: false, meta: false, ctrl: false };
const P = (worldX: number, worldY: number, clientX = worldX, clientY = worldY) =>
  ({ worldX, worldY, clientX, clientY });

describe('useDragGesture', () => {
  describe('phase machine — no thresholdReached', () => {
    it('start activates immediately, fires onGestureStart and onStart', () => {
      const onStart = vi.fn();
      const onGestureStart = vi.fn();
      const { result } = renderHook(() => useDragGesture({ onStart, onGestureStart }));
      expect(result.current.phase).toBe('idle');
      act(() => result.current.start(P(10, 20), NO_MODS));
      expect(result.current.phase).toBe('active');
      expect(result.current.isActive).toBe(true);
      expect(onGestureStart).toHaveBeenCalledOnce();
      expect(onStart).toHaveBeenCalledOnce();
      const ctx = onStart.mock.calls[0][0] as DragGestureCtx;
      expect(ctx.phase).toBe('active');
      expect(ctx.start).toEqual(P(10, 20));
    });

    it('onActivate is never called when thresholdReached is omitted', () => {
      const onActivate = vi.fn();
      const { result } = renderHook(() => useDragGesture({ onActivate }));
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.move(P(50, 50), NO_MODS));
      expect(onActivate).not.toHaveBeenCalled();
    });
  });

  describe('phase machine — with thresholdReached', () => {
    it('starts in pending; activates only when predicate returns true', () => {
      const onStart = vi.fn();
      const onActivate = vi.fn();
      const onMove = vi.fn();
      const { result } = renderHook(() =>
        useDragGesture({
          thresholdReached: (ctx) =>
            Math.abs(ctx.current.clientX - ctx.start.clientX) >= 4,
          onStart,
          onActivate,
          onMove,
        }),
      );
      act(() => result.current.start(P(0, 0), NO_MODS));
      expect(result.current.phase).toBe('pending');
      expect(onStart).toHaveBeenCalledOnce();
      const startCtx = onStart.mock.calls[0][0] as DragGestureCtx;
      expect(startCtx.phase).toBe('pending');
      // Sub-threshold move: phase stays pending; onMove still fires; onActivate doesn't.
      act(() => result.current.move(P(2, 0), NO_MODS));
      expect(result.current.phase).toBe('pending');
      expect(onActivate).not.toHaveBeenCalled();
      expect(onMove).toHaveBeenCalledOnce();
      // Threshold-crossing move: phase flips before onMove for that move.
      act(() => result.current.move(P(5, 0), NO_MODS));
      expect(result.current.phase).toBe('active');
      expect(onActivate).toHaveBeenCalledOnce();
      const activateCtx = onActivate.mock.calls[0][0] as DragGestureCtx;
      expect(activateCtx.phase).toBe('active');
      expect(onMove).toHaveBeenCalledTimes(2);
      expect((onMove.mock.calls[1][0] as DragGestureCtx).phase).toBe('active');
    });

    it('thresholdReached called on every pending move; not after activation', () => {
      const thresholdReached = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
      const { result } = renderHook(() => useDragGesture({ thresholdReached }));
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.move(P(1, 0), NO_MODS));
      expect(thresholdReached).toHaveBeenCalledTimes(1);
      act(() => result.current.move(P(2, 0), NO_MODS));
      expect(thresholdReached).toHaveBeenCalledTimes(2);
      act(() => result.current.move(P(3, 0), NO_MODS));
      // After activation, predicate is no longer consulted.
      expect(thresholdReached).toHaveBeenCalledTimes(2);
    });
  });

  describe('move return value', () => {
    it('returns false when no gesture is in flight', () => {
      const { result } = renderHook(() => useDragGesture());
      expect(result.current.move(P(0, 0), NO_MODS)).toBe(false);
    });

    it('returns true after start, regardless of phase', () => {
      const { result } = renderHook(() =>
        useDragGesture({ thresholdReached: () => false }),
      );
      act(() => result.current.start(P(0, 0), NO_MODS));
      let r = false;
      act(() => { r = result.current.move(P(50, 50), NO_MODS); });
      expect(r).toBe(true);
      // Still pending — predicate keeps returning false.
      expect(result.current.phase).toBe('pending');
    });
  });

  describe('end + onEnd', () => {
    it('fires onEnd with wasSubThreshold=false when phase reached active', () => {
      const onEnd = vi.fn();
      const onGestureEnd = vi.fn();
      const { result } = renderHook(() => useDragGesture({ onEnd, onGestureEnd }));
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.end());
      expect(onEnd).toHaveBeenCalledOnce();
      const endCtx = onEnd.mock.calls[0][0] as DragGestureEndCtx;
      expect(endCtx.wasSubThreshold).toBe(false);
      expect(onGestureEnd).toHaveBeenCalledWith(true);
    });

    it('fires onEnd with wasSubThreshold=true when phase never went active', () => {
      const onEnd = vi.fn();
      const { result } = renderHook(() =>
        useDragGesture({ thresholdReached: () => false, onEnd }),
      );
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.move(P(1, 0), NO_MODS));
      act(() => result.current.end());
      expect((onEnd.mock.calls[0][0] as DragGestureEndCtx).wasSubThreshold).toBe(true);
    });

    it('committed=false when onEnd returns false', () => {
      const onGestureEnd = vi.fn();
      const { result } = renderHook(() =>
        useDragGesture({ onEnd: () => false, onGestureEnd }),
      );
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.end());
      expect(onGestureEnd).toHaveBeenCalledWith(false);
    });

    it('end with no active gesture fires onGestureEnd(false) only', () => {
      const onEnd = vi.fn();
      const onGestureEnd = vi.fn();
      const { result } = renderHook(() => useDragGesture({ onEnd, onGestureEnd }));
      act(() => result.current.end());
      expect(onEnd).not.toHaveBeenCalled();
      expect(onGestureEnd).toHaveBeenCalledWith(false);
    });

    it('phase resets to idle after end', () => {
      const { result } = renderHook(() => useDragGesture());
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.end());
      expect(result.current.phase).toBe('idle');
      expect(result.current.isActive).toBe(false);
    });

    it('onGestureEnd fires even when onEnd throws (try/finally)', () => {
      const onGestureEnd = vi.fn();
      const { result } = renderHook(() =>
        useDragGesture({
          onEnd: () => { throw new Error('boom'); },
          onGestureEnd,
        }),
      );
      act(() => result.current.start(P(0, 0), NO_MODS));
      expect(() => act(() => result.current.end())).toThrow('boom');
      expect(onGestureEnd).toHaveBeenCalledWith(false);
      expect(result.current.phase).toBe('idle');
    });
  });

  describe('cancel', () => {
    it('fires onCancel and onGestureEnd(false) on active gesture', () => {
      const onCancel = vi.fn();
      const onGestureEnd = vi.fn();
      const { result } = renderHook(() => useDragGesture({ onCancel, onGestureEnd }));
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.cancel());
      expect(onCancel).toHaveBeenCalledOnce();
      expect(onGestureEnd).toHaveBeenCalledWith(false);
      expect(result.current.phase).toBe('idle');
    });

    it('cancel during pending fires onCancel and onGestureEnd(false)', () => {
      const onCancel = vi.fn();
      const onGestureEnd = vi.fn();
      const { result } = renderHook(() =>
        useDragGesture({ thresholdReached: () => false, onCancel, onGestureEnd }),
      );
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.cancel());
      expect(onCancel).toHaveBeenCalledOnce();
      const ctx = onCancel.mock.calls[0][0] as DragGestureCtx;
      expect(ctx.phase).toBe('pending');
      expect(onGestureEnd).toHaveBeenCalledWith(false);
    });

    it('cancel with no active gesture fires only onGestureEnd(false)', () => {
      const onCancel = vi.fn();
      const onGestureEnd = vi.fn();
      const { result } = renderHook(() => useDragGesture({ onCancel, onGestureEnd }));
      act(() => result.current.cancel());
      expect(onCancel).not.toHaveBeenCalled();
      expect(onGestureEnd).toHaveBeenCalledWith(false);
    });
  });

  describe('restart while active', () => {
    it('silently replaces state — no onCancel, no onEnd, no prior onGestureEnd', () => {
      const onCancel = vi.fn();
      const onEnd = vi.fn();
      const onGestureEnd = vi.fn();
      const onStart = vi.fn();
      const onGestureStart = vi.fn();
      const { result } = renderHook(() =>
        useDragGesture({ onCancel, onEnd, onGestureEnd, onStart, onGestureStart }),
      );
      act(() => result.current.start(P(0, 0), NO_MODS));
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onGestureStart).toHaveBeenCalledTimes(1);
      act(() => result.current.start(P(50, 50), NO_MODS));
      expect(onCancel).not.toHaveBeenCalled();
      expect(onEnd).not.toHaveBeenCalled();
      expect(onGestureEnd).not.toHaveBeenCalled();
      expect(onStart).toHaveBeenCalledTimes(2);
      expect(onGestureStart).toHaveBeenCalledTimes(2);
      const ctx = onStart.mock.calls[1][0] as DragGestureCtx;
      expect(ctx.start).toEqual(P(50, 50));
    });
  });

  describe('scratch lifecycle', () => {
    it('initScratch builds scratch fresh per gesture', () => {
      const init = vi.fn(() => ({ count: 0 }));
      const { result } = renderHook(() =>
        useDragGesture<{ count: number }>({ initScratch: init }),
      );
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.end());
      act(() => result.current.start(P(0, 0), NO_MODS));
      expect(init).toHaveBeenCalledTimes(2);
    });

    it('scratch is shared across onStart/onMove/onActivate/onEnd within one gesture', () => {
      const seen: { count: number }[] = [];
      const { result } = renderHook(() =>
        useDragGesture<{ count: number }>({
          initScratch: () => ({ count: 0 }),
          onStart: (ctx) => { ctx.scratch.count += 1; seen.push({ ...ctx.scratch }); },
          onMove: (ctx) => { ctx.scratch.count += 1; seen.push({ ...ctx.scratch }); },
          onEnd: (ctx) => { ctx.scratch.count += 1; seen.push({ ...ctx.scratch }); },
        }),
      );
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.move(P(5, 5), NO_MODS));
      act(() => result.current.end());
      expect(seen).toEqual([{ count: 1 }, { count: 2 }, { count: 3 }]);
    });
  });

  describe('modifiers', () => {
    it('start captures initial modifiers; move updates them live', () => {
      const ctxs: DragGestureCtx[] = [];
      const { result } = renderHook(() =>
        useDragGesture({
          onStart: (ctx) => ctxs.push({ ...ctx, modifiers: { ...ctx.modifiers } } as DragGestureCtx),
          onMove: (ctx) => ctxs.push({ ...ctx, modifiers: { ...ctx.modifiers } } as DragGestureCtx),
        }),
      );
      act(() => result.current.start(P(0, 0), NO_MODS));
      act(() => result.current.move(P(5, 5), SHIFT));
      expect(ctxs[0].modifiers.shift).toBe(false);
      expect(ctxs[1].modifiers.shift).toBe(true);
    });
  });

  describe('controller stability', () => {
    it('controller identity stays stable across renders', () => {
      const { result, rerender } = renderHook(() => useDragGesture());
      const c1 = result.current;
      rerender();
      expect(result.current).toBe(c1);
    });

    it('controller methods stay stable across option-callback changes', () => {
      let onMove = vi.fn();
      const { result, rerender } = renderHook(() => useDragGesture({ onMove }));
      const move1 = result.current.move;
      onMove = vi.fn();
      rerender();
      expect(result.current.move).toBe(move1);
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm test --run src/interactions/gestures/dragGesture.test.ts`
Expected: FAIL — module `./dragGesture` not found.

- [ ] **Step 3: Implement `useDragGesture`**

Create `src/interactions/gestures/dragGesture.ts`:

```ts
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ModifierState } from './types';

/** Pointer position in both world (gesture-coord) and client (CSS-px) space. */
export interface DragGesturePoint {
  worldX: number;
  worldY: number;
  clientX: number;
  clientY: number;
}

/** Phase exposed on the public controller and inside ctx for callbacks. */
export type DragGesturePhase = 'idle' | 'pending' | 'active';

/** Live gesture context handed to lifecycle callbacks. Within callbacks, ctx
 *  reflects the moment the callback fires (e.g. ctx.phase is 'active' inside
 *  onActivate, even though the move that triggered it was during 'pending'). */
export interface DragGestureCtx<TScratch = unknown> {
  start: DragGesturePoint;
  current: DragGesturePoint;
  modifiers: ModifierState;
  scratch: TScratch;
  /** 'pending' or 'active'. Never 'idle' inside a callback. */
  phase: 'pending' | 'active';
}

export interface DragGestureEndCtx<TScratch = unknown>
  extends DragGestureCtx<TScratch> {
  /** True if phase never reached 'active'. Wrappers without thresholdReached
   *  always see false here (their gesture activates at start()). */
  wasSubThreshold: boolean;
}

export interface UseDragGestureOptions<TScratch = unknown> {
  initScratch?: () => TScratch;
  /** Predicate consulted on each move while phase === 'pending'. Return true
   *  to transition to 'active'. The transition fires onActivate before the
   *  triggering move's onMove. When omitted, gesture activates at start(). */
  thresholdReached?: (ctx: DragGestureCtx<TScratch>) => boolean;
  onStart?: (ctx: DragGestureCtx<TScratch>) => void;
  onActivate?: (ctx: DragGestureCtx<TScratch>) => void;
  onMove?: (ctx: DragGestureCtx<TScratch>) => void;
  onEnd?: (ctx: DragGestureEndCtx<TScratch>) => boolean | void;
  onCancel?: (ctx: DragGestureCtx<TScratch>) => void;
  onGestureStart?: () => void;
  onGestureEnd?: (committed: boolean) => void;
}

export interface DragGestureController {
  start(point: DragGesturePoint, modifiers: ModifierState): void;
  move(point: DragGesturePoint, modifiers: ModifierState): boolean;
  end(): void;
  cancel(): void;
  readonly phase: DragGesturePhase;
  readonly isActive: boolean;
}

interface InternalState<TScratch> {
  phase: 'pending' | 'active';
  start: DragGesturePoint;
  current: DragGesturePoint;
  modifiers: ModifierState;
  scratch: TScratch;
}

export function useDragGesture<TScratch = unknown>(
  options: UseDragGestureOptions<TScratch> = {},
): DragGestureController {
  const optsRef = useRef(options);
  optsRef.current = options;
  const stateRef = useRef<InternalState<TScratch> | null>(null);
  // Live phase exposed on the controller — backed by a ref the getters read.
  const [, setPhaseTick] = useState(0);
  const phaseRef = useRef<DragGesturePhase>('idle');
  const bumpPhase = useCallback((next: DragGesturePhase) => {
    phaseRef.current = next;
    setPhaseTick((n) => n + 1);
  }, []);

  const buildCtx = useCallback((): DragGestureCtx<TScratch> => {
    const s = stateRef.current!;
    return {
      get start() { return s.start; },
      get current() { return s.current; },
      get modifiers() { return s.modifiers; },
      get scratch() { return s.scratch; },
      get phase() { return s.phase; },
    };
  }, []);

  const start = useCallback((point: DragGesturePoint, modifiers: ModifierState) => {
    const opts = optsRef.current;
    const scratch = opts.initScratch ? opts.initScratch() : ({} as TScratch);
    const initialPhase: 'pending' | 'active' = opts.thresholdReached ? 'pending' : 'active';
    stateRef.current = {
      phase: initialPhase,
      start: point,
      current: point,
      modifiers,
      scratch,
    };
    bumpPhase(initialPhase);
    opts.onGestureStart?.();
    opts.onStart?.(buildCtx());
  }, [buildCtx, bumpPhase]);

  const move = useCallback((point: DragGesturePoint, modifiers: ModifierState): boolean => {
    const s = stateRef.current;
    if (!s) return false;
    s.current = point;
    s.modifiers = modifiers;
    const opts = optsRef.current;
    if (s.phase === 'pending' && opts.thresholdReached) {
      const ctx = buildCtx();
      if (opts.thresholdReached(ctx)) {
        s.phase = 'active';
        bumpPhase('active');
        opts.onActivate?.(buildCtx());
      }
    }
    opts.onMove?.(buildCtx());
    return true;
  }, [buildCtx, bumpPhase]);

  const end = useCallback(() => {
    const s = stateRef.current;
    const opts = optsRef.current;
    if (!s) {
      opts.onGestureEnd?.(false);
      return;
    }
    const wasSubThreshold = s.phase === 'pending';
    const baseCtx = buildCtx();
    const endCtx = Object.create(null) as DragGestureEndCtx<TScratch>;
    Object.defineProperties(endCtx, {
      start: Object.getOwnPropertyDescriptor(baseCtx, 'start')!,
      current: Object.getOwnPropertyDescriptor(baseCtx, 'current')!,
      modifiers: Object.getOwnPropertyDescriptor(baseCtx, 'modifiers')!,
      scratch: Object.getOwnPropertyDescriptor(baseCtx, 'scratch')!,
      phase: Object.getOwnPropertyDescriptor(baseCtx, 'phase')!,
    });
    (endCtx as { wasSubThreshold: boolean }).wasSubThreshold = wasSubThreshold;
    let committed = false;
    try {
      const r = opts.onEnd?.(endCtx);
      committed = r !== false;
    } finally {
      stateRef.current = null;
      bumpPhase('idle');
      opts.onGestureEnd?.(committed);
    }
  }, [buildCtx, bumpPhase]);

  const cancel = useCallback(() => {
    const s = stateRef.current;
    const opts = optsRef.current;
    if (s) opts.onCancel?.(buildCtx());
    stateRef.current = null;
    bumpPhase('idle');
    opts.onGestureEnd?.(false);
  }, [buildCtx, bumpPhase]);

  return useMemo<DragGestureController>(() => ({
    start, move, end, cancel,
    get phase() { return phaseRef.current; },
    get isActive() { return phaseRef.current !== 'idle'; },
  }), [start, move, end, cancel]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test --run src/interactions/gestures/dragGesture.test.ts`
Expected: PASS — all cases.

- [ ] **Step 5: Run full suite to confirm no regressions**

Run: `pnpm test --run`
Expected: 1219 passing tests + new dragGesture cases.

- [ ] **Step 6: Add export to gestures barrel**

Edit `src/interactions/gestures/index.ts`. Add:

```ts
export {
  useDragGesture,
  type UseDragGestureOptions,
  type DragGestureController,
  type DragGestureCtx,
  type DragGestureEndCtx,
  type DragGesturePoint,
  type DragGesturePhase,
} from './dragGesture';
```

(Match the file's existing export style.)

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add src/interactions/gestures/dragGesture.ts \
        src/interactions/gestures/dragGesture.test.ts \
        src/interactions/gestures/index.ts
git commit -m "feat(gestures): add useDragGesture base primitive"
```

---

## Task 2: Migrate `useDragRect` to wrapper + rename `wasSubThreshold` → `isSubThreshold`

**Files:**
- Modify: `src/interactions/gestures/dragRect.ts`
- Modify: `src/interactions/gestures/dragRect.test.ts`
- Modify: `src/interactions/gestures/insert/insert.ts`

After this task: `useDragRect`'s public surface is unchanged except for the field rename. The wrapper delegates all phase/scratch/lifecycle to `useDragGesture`.

- [ ] **Step 1: Update the dragRect test for the field rename and add a restart-while-active regression test**

Edit `src/interactions/gestures/dragRect.test.ts`. Find:

```ts
  it('end fires onEnd with wasSubThreshold flag and onGestureEnd(committed)', () => {
    ...
    expect(ctx.wasSubThreshold).toBe(true);
    ...
  });
```

Replace the test name and the assertion:

```ts
  it('end fires onEnd with isSubThreshold flag and onGestureEnd(committed)', () => {
    const onEnd = vi.fn((_ctx: DragRectEndCtx) => true);
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
    expect(ctx.isSubThreshold).toBe(true);
    expect(onGestureEnd).toHaveBeenCalledWith(true);
    expect(result.current.overlay).toBeNull();
    expect(result.current.isActive).toBe(false);
  });
```

At the end of the `describe('useDragRect')` block (before its closing `});`), add a regression test for restart-while-active:

```ts
  it('restart while active replaces state silently — no onCancel/onEnd/onGestureEnd', () => {
    const onCancel = vi.fn();
    const onEnd = vi.fn();
    const onGestureEnd = vi.fn();
    const onStart = vi.fn();
    const { result } = renderHook(() =>
      useDragRect({ onCancel, onEnd, onGestureEnd, onStart }),
    );
    act(() => result.current.start(0, 0, NO_MODS));
    act(() => result.current.start(50, 50, NO_MODS));
    expect(onCancel).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
    expect(onGestureEnd).not.toHaveBeenCalled();
    expect(onStart).toHaveBeenCalledTimes(2);
    expect(result.current.overlay!.start).toEqual({ x: 50, y: 50 });
  });
```

- [ ] **Step 2: Run test to verify the rename test fails (rest still pass)**

Run: `pnpm test --run src/interactions/gestures/dragRect.test.ts`
Expected: 1 FAIL (`isSubThreshold` test — `ctx.isSubThreshold` is undefined). Other cases still pass.

- [ ] **Step 3: Rewrite `dragRect.ts` as a wrapper**

Replace the full body of `src/interactions/gestures/dragRect.ts` with:

```ts
import { useCallback, useMemo, useRef, useState } from 'react';
import { useDragGesture, type DragGestureCtx } from './dragGesture';
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
  /** True if the end-time bounds are at or below `minBounds` on either axis.
   *  Present-tense state check — distinct from the base's retrospective
   *  `wasSubThreshold`. Computed by this wrapper, not by `useDragGesture`. */
  isSubThreshold: boolean;
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

// dragRect's wrapper-level state: mirror of base's start/current as
// DragRectPoint, mutable so setStart/setCurrent can update them.
interface DragRectScratch<TConsumer> {
  start: DragRectPoint;
  current: DragRectPoint;
  consumer: TConsumer;
}

export function useDragRect<TScratch = unknown>(
  options: UseDragRectOptions<TScratch> = {},
): DragRectController {
  const optsRef = useRef(options);
  optsRef.current = options;

  const [overlay, setOverlay] = useState<DragRectController['overlay']>(null);
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

  // Live ref to the in-flight scratch so setStart/setCurrent (called from
  // consumer ctx) can mutate the same object the base sees.
  const scratchRef = useRef<DragRectScratch<TScratch> | null>(null);

  const writeOverlay = useCallback(() => {
    const s = scratchRef.current;
    if (!s) return;
    setOverlay({
      start: s.start,
      current: s.current,
      bounds: boundsFrom(s.start, s.current),
    });
  }, []);

  const buildConsumerCtx = useCallback((): DragRectCtx<TScratch> => {
    const s = scratchRef.current!;
    return {
      get start() { return s.start; },
      get current() { return s.current; },
      get bounds() { return boundsFrom(s.start, s.current); },
      get modifiers() {
        // Read live modifiers from the base via gestureRef snapshot below.
        return modifiersRef.current;
      },
      get scratch() { return s.consumer; },
      setStart(p) { s.start = p; writeOverlay(); },
      setCurrent(p) { s.current = p; writeOverlay(); },
    };
  }, [writeOverlay]);

  // Modifiers ref captured from each base callback so consumer ctx getters
  // can read them. Updated in onStart/onMove.
  const modifiersRef = useRef<ModifierState>({ shift: false, alt: false, meta: false, ctrl: false });

  const gesture = useDragGesture<DragRectScratch<TScratch>>({
    initScratch: () => {
      const init = optsRef.current.initScratch
        ? optsRef.current.initScratch()
        : ({} as TScratch);
      // start/current populated in onStart with the actual start point.
      return { start: { x: 0, y: 0 }, current: { x: 0, y: 0 }, consumer: init };
    },
    onStart: (ctx) => {
      const opts = optsRef.current;
      const p: DragRectPoint = { x: ctx.start.worldX, y: ctx.start.worldY };
      ctx.scratch.start = p;
      ctx.scratch.current = p;
      scratchRef.current = ctx.scratch;
      modifiersRef.current = ctx.modifiers;
      setOverlay({ start: p, current: p, bounds: { x: p.x, y: p.y, width: 0, height: 0 } });
      opts.onStart?.(buildConsumerCtx());
    },
    onMove: (ctx) => {
      const opts = optsRef.current;
      ctx.scratch.current = { x: ctx.current.worldX, y: ctx.current.worldY };
      modifiersRef.current = ctx.modifiers;
      writeOverlay();
      opts.onMove?.(buildConsumerCtx());
    },
    onEnd: (ctx) => {
      const opts = optsRef.current;
      const min = opts.minBounds ?? { width: 0, height: 0 };
      const b = boundsFrom(ctx.scratch.start, ctx.scratch.current);
      const isSubThreshold = b.width <= min.width || b.height <= min.height;
      const baseCtx = buildConsumerCtx();
      const endCtx = Object.create(null) as DragRectEndCtx<TScratch>;
      Object.defineProperties(endCtx, {
        start: Object.getOwnPropertyDescriptor(baseCtx, 'start')!,
        current: Object.getOwnPropertyDescriptor(baseCtx, 'current')!,
        bounds: Object.getOwnPropertyDescriptor(baseCtx, 'bounds')!,
        modifiers: Object.getOwnPropertyDescriptor(baseCtx, 'modifiers')!,
        scratch: Object.getOwnPropertyDescriptor(baseCtx, 'scratch')!,
      });
      endCtx.setStart = baseCtx.setStart;
      endCtx.setCurrent = baseCtx.setCurrent;
      (endCtx as { isSubThreshold: boolean }).isSubThreshold = isSubThreshold;
      let r: boolean | void;
      try {
        r = opts.onEnd?.(endCtx);
      } finally {
        scratchRef.current = null;
        setOverlay(null);
      }
      return r;
    },
    onCancel: () => {
      const opts = optsRef.current;
      if (scratchRef.current) opts.onCancel?.(buildConsumerCtx());
      scratchRef.current = null;
      setOverlay(null);
    },
    onGestureStart: () => optsRef.current.onGestureStart?.(),
    onGestureEnd: (committed) => optsRef.current.onGestureEnd?.(committed),
  });

  const start = useCallback((worldX: number, worldY: number, modifiers: ModifierState) => {
    gesture.start({ worldX, worldY, clientX: worldX, clientY: worldY }, modifiers);
  }, [gesture]);

  const move = useCallback((worldX: number, worldY: number, modifiers: ModifierState): boolean => {
    return gesture.move({ worldX, worldY, clientX: worldX, clientY: worldY }, modifiers);
  }, [gesture]);

  return useMemo<DragRectController>(() => ({
    start,
    move,
    end: gesture.end,
    cancel: gesture.cancel,
    get overlay() { return overlayRef.current; },
    get isActive() { return overlayRef.current !== null; },
  }), [start, move, gesture.end, gesture.cancel]);
}
```

Note the design choices:
- The base receives the dragRect point via `(worldX === clientX, worldY === clientY)` — dragRect doesn't distinguish; world IS its only space.
- `setStart`/`setCurrent` mutate the wrapper's mirrored scratch (used to compute bounds and overlay). The base's `start.worldX`/`worldY` are not mutated — the base never re-reads them after onStart for dragRect's case. The wrapper's mirror is the source of truth for ctx.start.
- `isSubThreshold` is computed from end-time bounds and shadows the base's `wasSubThreshold` (which would be `false` here since dragRect doesn't pass `thresholdReached`).

- [ ] **Step 4: Run dragRect tests**

Run: `pnpm test --run src/interactions/gestures/dragRect.test.ts`
Expected: PASS — all cases including the rename and restart-while-active.

- [ ] **Step 5: Update `useInsert`'s consumer of `wasSubThreshold`**

Edit `src/interactions/gestures/insert/insert.ts:152`. Find:

```ts
      if (clickOnly || ctx.wasSubThreshold) {
```

Replace with:

```ts
      if (clickOnly || ctx.isSubThreshold) {
```

- [ ] **Step 6: Run insert + areaSelect + full suite to confirm no other consumers broke**

Run: `pnpm test --run`
Expected: PASS — all 1219+ tests green. Search for any remaining `wasSubThreshold` references in source (excluding `dist/`):

Run: `grep -rn "wasSubThreshold" src demo apps 2>/dev/null` (or use the Grep tool).
Expected: zero matches.

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add src/interactions/gestures/dragRect.ts \
        src/interactions/gestures/dragRect.test.ts \
        src/interactions/gestures/insert/insert.ts
git commit -m "refactor(gestures): collapse useDragRect to useDragGesture wrapper; rename wasSubThreshold→isSubThreshold"
```

---

## Task 3: Migrate `useMove` to wrapper

**Files:**
- Modify: `src/interactions/gestures/move/move.ts`

After this task: `useMove`'s public surface is unchanged. The phase/threshold/scratch/lifecycle scaffolding moves to `useDragGesture`. Layout pass, cascade-children, behaviors loop, op dispatch all stay in the wrapper.

- [ ] **Step 1: Read the current `move.ts` end-to-end**

Run: Read tool on `src/interactions/gestures/move/move.ts` (lines 1–618).

Identify the four chunks that move to base callbacks:
- Phase machine (`phase: 'idle' | 'pending' | 'active'` in `stateRef`).
- Threshold (4px client-space gate at `move()` line 235–243).
- Try/finally cleanup pattern (currently absent — useMove just calls `cleanup()` on each branch).
- Stable controller via `useMemo` + `overlayRef`.

Identify what stays:
- All `LayoutPass`, cascade, layout-snap logic.
- `behaviors.onStart`/`onMove`/`onEnd` loops.
- `dispatchApplyBatch` + `createTransformOp` op dispatch in `end`.
- `MoveStartArgs` / `MoveMoveArgs` / `MoveOverlay` shapes.
- `expandIds`, `cascadeWorldPose`, `translatePose` defaulting.

- [ ] **Step 2: Rewrite `useMove` as a wrapper**

Replace the body of `useMove` (the function definition, lines 79–617). Keep all imports and surrounding type definitions unchanged. The new body:

```ts
export function useMove<TObject extends { id: string }, TPose>(
  adapter: MoveAdapter<TObject, TPose>,
  options: UseMoveOptions<TPose> = {},
): MoveController<TObject, TPose> {
  const {
    translatePose = translateRectPose as unknown as (pose: TPose, dx: number, dy: number) => TPose,
    behaviors = [],
    dragThresholdPx = 4,
    moveLabel = 'Move',
    onGestureStart,
    onGestureEnd,
    expandIds,
    cascadeWorldPose,
  } = options;

  // Latest-value refs so the wrapper's gesture callbacks can stay stable.
  const adapterRef = useRef(adapter); adapterRef.current = adapter;
  const behaviorsRef = useRef(behaviors); behaviorsRef.current = behaviors;
  const translatePoseRef = useRef(translatePose); translatePoseRef.current = translatePose;
  const dragThresholdPxRef = useRef(dragThresholdPx); dragThresholdPxRef.current = dragThresholdPx;
  const moveLabelRef = useRef(moveLabel); moveLabelRef.current = moveLabel;
  const onGestureStartRef = useRef(onGestureStart); onGestureStartRef.current = onGestureStart;
  const onGestureEndRef = useRef(onGestureEnd); onGestureEndRef.current = onGestureEnd;
  const expandIdsRef = useRef(expandIds); expandIdsRef.current = expandIds;

  const effectiveCascade = cascadeWorldPose
    ?? (adapter.getChildren ? (id: string) => {
      try { return adapter.getPose(id); } catch { return null; }
    } : undefined);
  const cascadeWorldPoseRef = useRef(effectiveCascade);
  cascadeWorldPoseRef.current = effectiveCascade;

  type LayoutPass = {
    destContainerId: string | null;
    accepted: boolean;
    layout: unknown;
    container: { id: string; bounds: { x: number; y: number; width: number; height: number } } | null;
    children: { id: string; pose: TPose }[];
    target: unknown;
    sourceReflowPositions: Map<string, TPose>;
  };
  const makeEmptyLayoutPass = (): LayoutPass => ({
    destContainerId: null,
    accepted: true,
    layout: null,
    container: null,
    children: [],
    target: null,
    sourceReflowPositions: new Map(),
  });

  // Wrapper-owned scratch threaded through the base.
  interface MoveScratch {
    ids: string[];
    ctx: GestureContext<TPose, TObject> | null;
    cascadeIds: string[];
    cascadeOriginWorld: Map<string, TPose>;
    layoutPass: LayoutPass;
    /** Buffered ids passed to start() — copied here in the closure that calls
     *  base.start, then read out in onStart. */
    pendingArgs: MoveStartArgs | null;
  }

  const [overlay, setOverlay] = useState<MoveOverlay<TPose> | null>(null);
  const overlayRef = useRef(overlay); overlayRef.current = overlay;

  // Reused implementation of the move-time translate/snap/cascade/layout
  // pass. Defined here so it closes over refs; called from gesture.onMove.
  const doMoveCompute = useCallback((
    scratch: MoveScratch,
    moveArgs: MoveMoveArgs,
  ) => {
    /* PORT FROM CURRENT move.ts LINES 244–510:
     *  - Compute dx/dy from worldX/worldY against scratch.ctx.origin's start
     *    (track via scratch.startWorld set in onStart — see Step 3).
     *  - Translate each origin pose by (dx, dy), run behaviors.onMove,
     *    populate newPoses, snap.
     *  - Compute cascade overlay poses.
     *  - Run the layout pass against adapter.getLayout if present.
     *  - Update scratch.ctx.current/snap/modifiers/pointer.
     *  - setOverlay(...) with the full MoveOverlay.
     *
     * The block is self-contained (no other call sites) — copy it verbatim
     * from the current move.ts body and replace `s.layoutPass = ...` with
     * `scratch.layoutPass = ...`.
     */
    // (kept inline — see step 3 for full code)
  }, []);

  const gesture = useDragGesture<MoveScratch & { startWorld: { x: number; y: number }; startClient: { x: number; y: number } }>({
    initScratch: () => ({
      ids: [],
      ctx: null,
      cascadeIds: [],
      cascadeOriginWorld: new Map(),
      layoutPass: makeEmptyLayoutPass(),
      pendingArgs: null,
      startWorld: { x: 0, y: 0 },
      startClient: { x: 0, y: 0 },
    }),
    thresholdReached: (ctx) => {
      const dxs = ctx.current.clientX - ctx.start.clientX;
      const dys = ctx.current.clientY - ctx.start.clientY;
      const t = dragThresholdPxRef.current;
      return dxs * dxs + dys * dys >= t * t;
    },
    onStart: (ctx) => {
      // Pre-threshold work: id expansion, cascade snapshot, ctx build.
      // Behaviors.onStart and consumer onGestureStart are deferred to onActivate.
      const adapter = adapterRef.current;
      const expandIds = expandIdsRef.current;
      const cascadeWorldPose = cascadeWorldPoseRef.current;
      const args = ctx.scratch.pendingArgs!;
      const ids = expandIds ? expandIds(args.ids) : args.ids;
      ctx.scratch.startWorld = { x: args.worldX, y: args.worldY };
      ctx.scratch.startClient = { x: args.clientX, y: args.clientY };
      ctx.scratch.ids = ids;
      if (ids.length === 0) {
        ctx.scratch.ctx = null;
        return;
      }
      const origin = new Map<string, TPose>();
      for (const id of ids) origin.set(id, adapter.getPose(id));
      const cascadeIds: string[] = [];
      const cascadeOriginWorld = new Map<string, TPose>();
      if (cascadeWorldPose && adapter.getChildren) {
        const draggedSet = new Set(ids);
        const visited = new Set<string>(ids);
        const queue: string[] = [...ids];
        while (queue.length > 0) {
          const next = queue.shift()!;
          const children = adapter.getChildren(next);
          if (!children) continue;
          for (const childId of children) {
            if (visited.has(childId)) continue;
            visited.add(childId);
            queue.push(childId);
            if (draggedSet.has(childId)) continue;
            const w = cascadeWorldPose(childId);
            if (w === null) continue;
            cascadeIds.push(childId);
            cascadeOriginWorld.set(childId, w);
          }
        }
      }
      ctx.scratch.ctx = {
        draggedIds: ids,
        origin,
        current: new Map(origin),
        snap: null,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
        pointer: { worldX: args.worldX, worldY: args.worldY, clientX: args.clientX, clientY: args.clientY },
        adapter,
        scratch: {},
      };
      ctx.scratch.cascadeIds = cascadeIds;
      ctx.scratch.cascadeOriginWorld = cascadeOriginWorld;
      ctx.scratch.layoutPass = makeEmptyLayoutPass();
    },
    onActivate: (ctx) => {
      if (!ctx.scratch.ctx) return;
      onGestureStartRef.current?.(ctx.scratch.ctx.draggedIds);
      for (const b of behaviorsRef.current) b.onStart?.(ctx.scratch.ctx);
    },
    onMove: (ctx) => {
      if (!ctx.scratch.ctx) return;
      // Only run the compute when active. Pre-threshold moves are no-ops
      // (matches today: behaviors.onMove only fires post-threshold).
      if (ctx.phase !== 'active') return;
      doMoveCompute(ctx.scratch, {
        worldX: ctx.current.worldX,
        worldY: ctx.current.worldY,
        clientX: ctx.current.clientX,
        clientY: ctx.current.clientY,
        modifiers: ctx.modifiers,
      });
    },
    onEnd: (ctx) => {
      const adapter = adapterRef.current;
      const moveLabel = moveLabelRef.current;
      if (!ctx.scratch.ctx || ctx.wasSubThreshold) {
        setOverlay(null);
        return false;
      }
      const moveCtx = ctx.scratch.ctx;
      let ops: Op[] | null | undefined;
      for (const b of behaviorsRef.current) {
        const r = b.onEnd?.(moveCtx);
        if (r === undefined) continue;
        ops = r;
        break;
      }
      if (ops === null) {
        setOverlay(null);
        return false;
      }
      const layoutPass = ctx.scratch.layoutPass;
      if (
        ops === undefined &&
        layoutPass.layout &&
        layoutPass.container &&
        moveCtx.draggedIds.length === 1
      ) {
        type Layout = import('../../../layout/types').LayoutStrategy<TPose>;
        type Target = import('../../../layout/types').DropTarget<TPose>;
        const layout = layoutPass.layout as Layout;
        const target = layoutPass.target as Target | null;
        const draggedId = moveCtx.draggedIds[0];
        const dropOps = layout.commitDrop(
          layoutPass.container,
          layoutPass.children,
          {
            id: draggedId,
            originPose: moveCtx.origin.get(draggedId)!,
            pose: moveCtx.current.get(draggedId)!,
            sourceContainerId: adapter.getParent?.(draggedId) ?? null,
          },
          layoutPass.accepted ? target : null,
        );
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
      if (ops === undefined) {
        ops = moveCtx.draggedIds.map((id) =>
          createTransformOp<TPose>({
            id,
            from: moveCtx.origin.get(id)!,
            to: moveCtx.current.get(id)!,
            label: moveLabel,
          }),
        );
      }
      if (ops.length > 0) {
        dispatchApplyBatch(adapter, ops, ops[0].label ?? moveLabel);
      }
      setOverlay(null);
      return true;
    },
    onCancel: () => {
      setOverlay(null);
    },
    onGestureEnd: (committed) => {
      onGestureEndRef.current?.(committed);
    },
  });

  // Public start/move signatures unchanged. Stash incoming args into scratch
  // before the base reads them in onStart.
  const start = useCallback((args: MoveStartArgs) => {
    // Direct write into scratch via the gesture controller is not possible —
    // base initializes scratch inside its own start(). We pass the args by
    // pre-priming a closure-side ref read in initScratch isn't right either.
    // The clean path: stash on a wrapper-level ref that initScratch reads.
    pendingArgsRef.current = args;
    gesture.start(
      { worldX: args.worldX, worldY: args.worldY, clientX: args.clientX, clientY: args.clientY },
      { alt: false, shift: false, meta: false, ctrl: false },
    );
  }, [gesture]);

  const pendingArgsRef = useRef<MoveStartArgs | null>(null);

  // Replace the initScratch function above (this is the corrected version):
  // Note: the closure will need to read pendingArgsRef.current. Implementer
  // moves the `pendingArgsRef` declaration above the useDragGesture call and
  // updates initScratch to read it instead of the placeholder.

  const move = useCallback((args: MoveMoveArgs): boolean => {
    return gesture.move(
      { worldX: args.worldX, worldY: args.worldY, clientX: args.clientX, clientY: args.clientY },
      args.modifiers,
    );
  }, [gesture]);

  const isActive = useCallback(() => gesture.phase === 'active', [gesture]);

  return useMemo<MoveController<TObject, TPose>>(() => ({
    start,
    move,
    end: gesture.end,
    cancel: gesture.cancel,
    isActive,
    get overlay() { return overlayRef.current; },
    get adapter() { return adapterRef.current; },
  }), [start, move, gesture.end, gesture.cancel, isActive]);
}
```

**Implementer note for the `pendingArgsRef` plumbing:** The cleanest restructuring is:
1. Declare `const pendingArgsRef = useRef<MoveStartArgs | null>(null);` *before* the `useDragGesture` call.
2. In `initScratch`, read `pendingArgsRef.current` (assert non-null since `start` always sets it before calling `gesture.start`).
3. In the wrapper's `start(args)`, set `pendingArgsRef.current = args` then call `gesture.start(...)`.

This reorders the listing above slightly — implement that order. The intent in the listing is correct.

- [ ] **Step 3: Port the `doMoveCompute` body**

The placeholder `/* PORT FROM CURRENT move.ts LINES 244–510 */` block in `doMoveCompute` must be filled with the verbatim translate/snap/cascade/layout-pass implementation from the current `move.ts`. Specifically:

1. Read `s.startWorld` from `scratch.startWorld`.
2. Compute `dx = moveArgs.worldX - scratch.startWorld.x`, `dy = moveArgs.worldY - scratch.startWorld.y`.
3. Update `scratch.ctx.modifiers` and `scratch.ctx.pointer` from `moveArgs`.
4. For each id in `scratch.ctx.draggedIds`, translate origin pose by (dx, dy), run behaviors.onMove on the primary id (first), populate `newPoses`, update `snap`.
5. Update `scratch.ctx.current = newPoses` and `scratch.ctx.snap = snap`.
6. Compute `overlayPoses` and `hideIds` via cascade.
7. Run the layout pass (current move.ts lines 285–489, including the candidate-walk z-order picker and dest reflow).
8. Write `scratch.layoutPass` with the result.
9. `setOverlay({ draggedIds, poses: overlayPoses, snapped: snap, hideIds, hypotheticalChildPositions, sourceReflowPositions, destContainerId, accepted })`.

The block is large but mechanical — copy from the current `move.ts:244–510`, replace `s.X` reads with `scratch.X`, replace `setOverlay(...)` call as-is.

- [ ] **Step 4: Run useMove tests**

Run: `pnpm test --run src/interactions/gestures/move`
Expected: PASS — all existing tests including `move.test.ts`, layout-pass tests, snap-back tests, container tests, behavior-specific tests under `move/behaviors/`.

If any test fails, the failure is the source of truth — fix the wrapper to match. Common likely failures and their causes:
- "behaviors.onStart called before threshold" — the wrapper is calling `onActivate` work in `onStart`. Move it.
- "onGestureEnd not fired on click without drag" — the base's `onGestureEnd` always fires; check the wrapper's `onCancel` and `onEnd` paths reach it.
- "`isActive()` returns true during pending" — `isActive` should test `gesture.phase === 'active'`, not `gesture.isActive` (which is `!== 'idle'`).

- [ ] **Step 5: Run full suite**

Run: `pnpm test --run`
Expected: 1219+ passing tests.

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add src/interactions/gestures/move/move.ts
git commit -m "refactor(gestures): collapse useMove to useDragGesture wrapper"
```

---

## Task 4: Final verification

**Files:** _none — verification only_

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 2: Full test suite**

Run: `pnpm test --run`
Expected: 1219+ tests, all green.

- [ ] **Step 3: Confirm no `wasSubThreshold` references remain in source**

Run: `grep -rn "wasSubThreshold" src demo apps 2>/dev/null` (or use the Grep tool).
Expected: zero matches in source. (`dist/index.d.ts` is regenerated; ignore.)

- [ ] **Step 4: Build the demo app**

Run: `pnpm build` (or whatever the demo build command is — check `package.json`).
Expected: clean build.

- [ ] **Step 5: Smoke-walkthrough the demos**

Start the dev server (`pnpm dev`) and exercise these gestures across the demos that touch dragRect or move:
- **Insert tool (any insert demo):** click+drag insert, sub-threshold click (no insert).
- **Area select (any selection demo):** marquee, shift-extend, sub-threshold (clears selection).
- **Move (LayoutDemo, MultiSelectDemo, GroupsDemo, NestedGroupsDemo):** body drag, multi-drag, group drag, cascade-children follow, layout snap, snap-back-or-delete.

If any regression: file a TODO entry and fix in this same task before commit. Do not paper over.

- [ ] **Step 6: No commit needed for verification.**

If all green, the migration is done. Implementation plan complete.

---

## Open issues / follow-ups

None for this plan. `useResize`/`useRotate` migration is tracked as a separate TODO entry per spec.
