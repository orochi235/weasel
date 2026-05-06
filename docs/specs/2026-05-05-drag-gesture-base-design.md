# Drag-Gesture Base Primitive Design

**Status:** Spec — pending implementation plan
**Goal:** Extract the imperative-controller scaffolding shared by `useDragRect` and `useMove` into a single primitive `useDragGesture<TScratch>` that owns the phase machine, threshold gating, scratch lifecycle, and `onGestureStart`/`onGestureEnd` resilience. The two existing hooks keep their public surface and become thin wrappers. `useResize`/`useRotate` are explicitly out of scope; they migrate later if and only if they fit cleanly.

---

## Motivation

`useDragRect` (167 lines) and `useMove` (618 lines) duplicate the same scaffolding shape:

- `idle` → `pending` → `active` (or `idle` → `active`) phase machine driven by `start()`/`move()`/`end()`/`cancel()`.
- A scratch object initialized at `start()` and exposed to behaviors/callbacks throughout the gesture.
- `onGestureStart`/`onGestureEnd` lifecycle hooks paired around the active span, with `committed: boolean` on end.
- Stable controller identity via `useMemo` + `overlayRef` getter so re-renders don't drop pointer capture during a drag.
- A try/finally pattern around `onEnd` so `onGestureEnd(committed)` always fires, even if a behavior throws.

`useDragInsert` (the primitive landed in the prior plan) reused parts of this through `useDragRect`, but its shape — `start: Point, current: Point, bounds` — is dragRect-specific. Anything more elaborate (per-id pose maps, behaviors, op dispatch) had to live in the wrapper.

This design pulls the scaffolding out *below* `useDragRect`, leaving:
- **`useDragGesture`** — the bare-minimum imperative gesture controller.
- **`useDragRect`** — a wrapper that adds the bounds-derived ctx, `setStart`/`setCurrent` mutators, and end-time `wasSubThreshold` flag.
- **`useMove`** — a wrapper that adds the pose-map ctx, behaviors loop, layout pass, cascade-children, and op dispatch.

---

## Non-goals

- **No migration of `useResize`/`useRotate` in this plan.** Their state shapes (per-id pose map keyed by handle/center, multi-target union) deserve their own evaluation. Forcing them in now repeats the B-trap from the prior brainstorm.
- **No new public surface beyond `useDragGesture`.** `useDragRect` and `useMove` keep their existing signatures and exports. Consumers see no API change.
- **No behavior change.** Every existing test must pass without modification (modulo internal restructuring tests that exercise private state).
- **No behavior loop in the base.** Behaviors are wrapper-owned. Move's `MoveBehavior<TPose>` and dragRect's pass-through-to-consumer model are different shapes; unifying them is a separate concern.

---

## Design

### Public API

```ts
// src/interactions/gestures/dragGesture.ts

import type { ModifierState } from './types';

export interface DragGesturePoint {
  worldX: number;
  worldY: number;
  clientX: number;
  clientY: number;
}

export interface DragGestureCtx<TScratch = unknown> {
  /** Pointer at start(). Frozen for the gesture's lifetime. */
  start: DragGesturePoint;
  /** Pointer at the latest move() call. Updates each move. */
  current: DragGesturePoint;
  /** Live modifier state from the most recent start/move call. */
  modifiers: ModifierState;
  /** Wrapper-owned scratch initialized at start(). */
  scratch: TScratch;
  /** Phase. 'pending' until thresholdReached returns true; 'active' afterwards.
   *  When thresholdReached is omitted, the gesture activates on start() — phase
   *  is 'active' from the first onMove. */
  phase: 'pending' | 'active';
}

export interface DragGestureEndCtx<TScratch = unknown>
  extends DragGestureCtx<TScratch> {
  /** True if the gesture ended without ever transitioning to 'active'.
   *  Wrappers use this to decide whether to commit (e.g. dragRect treats
   *  a sub-threshold gesture as "click, not drag"). */
  wasSubThreshold: boolean;
}

export interface UseDragGestureOptions<TScratch = unknown> {
  /** Build the per-gesture scratch at start(). Default: `{} as TScratch`. */
  initScratch?: () => TScratch;
  /** Predicate called on each move while phase === 'pending'. Return true to
   *  transition to 'active'. The transition fires onActivate before the
   *  triggering move's onMove. When omitted, activation happens at start()
   *  (phase is 'active' from the first onMove). */
  thresholdReached?: (ctx: DragGestureCtx<TScratch>) => boolean;
  /** Fires at start(), phase 'pending' (or 'active' if no thresholdReached). */
  onStart?: (ctx: DragGestureCtx<TScratch>) => void;
  /** Fires the first time thresholdReached returns true. Skipped entirely
   *  when thresholdReached is omitted (start() is the activation moment;
   *  use onStart). */
  onActivate?: (ctx: DragGestureCtx<TScratch>) => void;
  /** Fires every move() call after start(), regardless of phase. */
  onMove?: (ctx: DragGestureCtx<TScratch>) => void;
  /** Fires at end() if a gesture was in flight. Return false to mark the
   *  gesture uncommitted (onGestureEnd receives committed=false); any other
   *  return value (including void) marks committed. */
  onEnd?: (ctx: DragGestureEndCtx<TScratch>) => boolean | void;
  /** Fires at cancel() if a gesture was in flight. */
  onCancel?: (ctx: DragGestureCtx<TScratch>) => void;
  /** Fires once at start() (paired with onGestureEnd). Wrappers use this for
   *  side effects that need start/end pairing regardless of commit outcome. */
  onGestureStart?: () => void;
  /** Fires once at end() or cancel(). committed=true only when onEnd returned
   *  non-false. Always fires (try/finally), even if onEnd throws. */
  onGestureEnd?: (committed: boolean) => void;
}

export interface DragGestureController {
  start(point: DragGesturePoint, modifiers: ModifierState): void;
  /** Returns true if the move was processed (gesture was in flight),
   *  false otherwise. Same return contract as useDragRect today. */
  move(point: DragGesturePoint, modifiers: ModifierState): boolean;
  end(): void;
  cancel(): void;
  /** Live phase. 'idle' when no gesture is in flight. */
  readonly phase: 'idle' | 'pending' | 'active';
  /** Convenience: phase !== 'idle'. */
  readonly isActive: boolean;
}

export function useDragGesture<TScratch = unknown>(
  options?: UseDragGestureOptions<TScratch>,
): DragGestureController;
```

### Phase machine

```
                    start()             move() && thresholdReached(ctx)
            ┌───────────────────┐ ┌────────────────────────────────────┐
            ▼                   │ ▼                                    │
  [idle] ──────────► [pending] ──────────► [active] ────────────────┐  │
            │                                                       │  │
            │ start() (no thresholdReached)                          │  │
            └──────────────────────────────► [active] ──────────────┤  │
                                                                    ▼  │
                                                end() / cancel() ──► [idle]
```

- `start()` sets `phase = 'pending'` (or `'active'` if `thresholdReached` is omitted), initializes scratch, fires `onGestureStart` then `onStart`.
- `move()`:
  - If `phase === 'idle'`, returns false.
  - Updates `current` and `modifiers`.
  - If `phase === 'pending'`, calls `thresholdReached(ctx)`. If true: `phase = 'active'`, then `onActivate(ctx)`. (Always uses the live `current` from this move.)
  - Calls `onMove(ctx)`. Returns true.
- `end()`:
  - If `phase === 'idle'`, fires `onGestureEnd(false)` and returns.
  - Builds end-ctx with `wasSubThreshold = phase === 'pending'`.
  - Calls `onEnd(endCtx)` inside a try/finally; `committed = onEnd's return !== false`.
  - Resets state in finally; fires `onGestureEnd(committed)`.
- `cancel()`:
  - If a gesture was in flight, calls `onCancel(ctx)`, then resets state, then fires `onGestureEnd(false)`.

### Restart-while-active

If `start()` is called while `phase !== 'idle'`, the base **silently replaces state**: no `onCancel`, no `onEnd`, no `onGestureEnd` from the prior gesture. New `onGestureStart`/`onStart` fire for the new gesture.

This matches today's `useDragRect` ("Restart while active replaces state silently"). Wrappers that need different semantics call `cancel()` themselves before `start()`.

### Stable controller identity

The returned controller is built once via `useMemo` and never re-created across renders, even when the consumer passes inline option callbacks. Live values (phase, isActive) are exposed via getters reading a `stateRef`. This preserves the constraint from `useMove` ("downstream consumers don't rebuild their pointer-event bindings — that rebind during a drag drops the browser's implicit pointer capture and can race `lostpointercapture` ahead of `pointerup`").

The `options` object is held in an `optsRef` and refreshed on every render, so callbacks always see the latest closure.

### Resilience

`onEnd` is wrapped in try/finally:

```ts
let committed = false;
try {
  const r = optsRef.current.onEnd?.(endCtx);
  committed = r !== false;
} finally {
  stateRef.current = null;
  optsRef.current.onGestureEnd?.(committed);
}
```

This matches `useDragRect`'s current behavior. If `onEnd` throws, state is still cleaned and `onGestureEnd(committed=false)` fires before the exception propagates.

---

## Wrapper migration

### `useDragRect` becomes a wrapper

The new dragRect:
- Calls `useDragGesture<DragRectInternalScratch>` where the internal scratch holds nothing extra (consumer scratch lives inside, alongside the imperative `setStart`/`setCurrent` overrides).
- Exposes its own ctx with `start: DragRectPoint`, `current: DragRectPoint`, `bounds: DragRectBounds`, `modifiers`, `scratch`, plus the `setStart`/`setCurrent` mutators that update both the base's `start`/`current` and the dragRect's overlay state.
- Owns the overlay state (`{ start, current, bounds }` with React `useState`).
- Renames its sub-threshold flag from `wasSubThreshold` to **`isSubThreshold`** to reflect the semantic distinction:
  - Base's `wasSubThreshold` (past tense) — "during this gesture, did phase ever go active?" Retrospective phase check.
  - dragRect's `isSubThreshold` (present tense) — "at this moment, does the end-time bounds fail the min-bounds check?" State at end.
- Computes `isSubThreshold` itself: `bounds.width <= minBounds.width || bounds.height <= minBounds.height`. Does not consult the base's `wasSubThreshold` (which would always be `false` for dragRect since it never has a 'pending' phase).
- Does not pass `thresholdReached` to the base — dragRect activates at `start()`.

The dragRect end-ctx becomes:

```ts
export interface DragRectEndCtx<TScratch> extends DragRectCtx<TScratch> {
  isSubThreshold: boolean;
}
```

This is a breaking rename of the existing `wasSubThreshold` field on `DragRectEndCtx`. Per project memory ("breaking changes are free at this stage"), call sites get updated in the same plan task. Audit during plan stage: grep `wasSubThreshold` across the repo to enumerate call sites.

The `setStart`/`setCurrent` mutators are dragRect-specific and stay in the wrapper. They write to the wrapper's overlay state and to scratch-stored copies that the wrapper hands to consumer callbacks.

**Public surface unchanged.** Test suite passes without modification.

### `useMove` becomes a wrapper

The new useMove:
- Calls `useDragGesture<MoveInternalScratch>` where `MoveInternalScratch` carries the GestureContext, cascade ids/origins, layout pass, and dragged-id list.
- Sets `thresholdReached: (ctx) => clientDistSq(ctx) >= dragThresholdPx²` — the existing 4px client-space gate.
- In `onStart`, expands ids, snapshots cascade world poses, builds the GestureContext into scratch. Does **not** call `behaviors.onStart` here — that's deferred to onActivate.
- In `onActivate`, fires `onGestureStart(draggedIds)` on the consumer and `behaviors.onStart(ctx)`. (This matches today's behavior: behaviors only see active gestures.)
- In `onMove`, does the existing translate/snap/cascade/layout-pass work and updates the public `MoveOverlay`.
- In `onEnd`, if `wasSubThreshold` is true (the gesture never activated), commits nothing — same as today's "phase !== 'active' on end → no ops" behavior.
- In `onCancel`, fires `onGestureEnd(false)` on consumer. (Today's `cancel()` is just `cleanup()` + `onGestureEnd(false)`; the base provides this for free.)

useMove's existing `MoveStartArgs` (with `ids: string[]`) maps to the base's `start(point, modifiers)` plus a wrapper-side stash of `ids` into scratch before calling base.start. The wrapper's `start(args)` signature is unchanged.

useMove's `move(args: MoveMoveArgs): boolean` returns the base's `move()` return.

useMove's `isActive(): boolean` reads the base's `phase === 'active'`.

**Public surface unchanged.** Test suite passes without modification.

---

## What `useDragInsert` and `useAreaSelect` do

Both already build on `useDragRect`. They get the base scaffolding transitively via dragRect's migration — no direct change needed in their files. Their tests must keep passing.

If a future drag-insert variant wants to skip the bounds shape and go straight to the base, it can — but that's not in scope here.

---

## What `useResize` and `useRotate` do

**Nothing.** They keep their existing direct implementation. After this plan lands, the `useDragGesture` base exists and can be adopted by them in a follow-up if/when their state shapes are evaluated.

A TODO entry tracks the deferred evaluation.

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Stable-controller invariant gets broken by the wrapper layer (e.g., wrapper rebuilds its controller while base is stable). | Wrappers also use `useMemo` for their controller, with the same `[start, move, end, cancel]` deps. The new `useDragGesture` returns stable functions, so the wrappers see no churn. |
| Sub-threshold semantics diverge between base (`wasSubThreshold`) and dragRect (`isSubThreshold`). | Different names by design — past-tense for the base's "did phase ever go active" check, present-tense for dragRect's "bounds-at-end fails min-bounds" check. Test both paths. |
| `onActivate` never fires for dragRect (it skips threshold), creating dead code in dragRect's wrapper. | dragRect doesn't pass `onActivate`. Base only calls it when `thresholdReached` is supplied. |
| `useMove`'s pre-threshold `start()` work (id expansion, cascade snapshot) ends up in the wrong phase callback. | Wrapper does that work in `onStart` (which fires at start time even when threshold gates activation). Behaviors and consumer's `onGestureStart` move to `onActivate`. |
| Restart-while-active behavior differs subtly between dragRect's existing impl and the new base. | Direct port: base's restart silently replaces state with no callbacks. Same as today. |
| `useMove`'s `cancel()` currently does NOT fire any consumer callback when phase === 'idle' or 'pending'. The base fires `onGestureEnd(false)` always. | Behavior change is acceptable — `onGestureEnd(false)` already fires in useMove's cancel today via `cleanup()` then `onGestureEndRef.current?.(false)`. Confirmed compatible. |
| Test files reach into private state via type assertions and break. | Audit the existing dragRect/move test files during plan stage; any private-state-touching tests get rewritten to use public surface. |

---

## File map

**Create:**
- `src/interactions/gestures/dragGesture.ts` — the new base primitive.
- `src/interactions/gestures/dragGesture.test.ts` — unit tests for the phase machine, threshold gating, restart-while-active, error resilience.

**Modify:**
- `src/interactions/gestures/dragRect.ts` — collapse to wrapper around `useDragGesture`.
- `src/interactions/gestures/move/move.ts` — collapse the phase-machine portion to a wrapper around `useDragGesture`. Keep behaviors loop, layout pass, cascade, op dispatch in the wrapper.
- `src/interactions/gestures/index.ts` — export `useDragGesture` and its types.
- `docs/TODO.md` — add deferral entry for `useResize`/`useRotate` evaluation against `useDragGesture`.

**Tests stay:**
- `src/interactions/gestures/dragRect.test.ts` — unchanged. Asserts the dragRect public surface.
- `src/interactions/gestures/move/move.test.ts` (and behavior-specific suites) — unchanged. Asserts move's public surface.

If any test reaches into private state and breaks, rewrite it to use the public surface in the same task that introduces the migration.

---

## Open questions

None for the spec stage. Implementation-stage choices (e.g., whether to expose the base's controller as the wrapper's internal field for testability, exact name of the internal scratch types) are decided in the plan.

---

## Out-of-scope deferrals

- **`useResize`/`useRotate` migration to `useDragGesture`.** Tracked in TODO.
- **Behaviors loop unification.** Move's `MoveBehavior<TPose>` and dragRect's pass-through model are different shapes; not consolidated here.
- **Op dispatch in the base.** Wrappers commit differently (move dispatches a TransformOp batch; dragRect calls a consumer `onEnd` boolean).
