# Registry unification — Phase 6: moveAction descriptor + dispatcher validation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `moveAction` as the first real `ongoing` action descriptor. Prove the dispatcher's drag pump end-to-end (pointerdown → start → pointermove → onMove* → pointerup → onEnd('commit')). Add tool-switch-cancels-in-flight wiring (Q2). DO NOT fully migrate `useSelectTool`'s drag route table — that's Phase 7's job because it requires resolving coexistence between the May-12 declarative route tables and the Phase 3 GestureSpec dispatcher (a question Phase 7 has to settle).

**Architecture:** `moveAction` becomes the first ongoing-action descriptor with a `drag` GestureSpec binding. It uses the existing `useMove`'s core logic (extracted into shared helpers if needed) inside its invoker's `start` / `onMove` / `onEnd` callbacks. The existing `useSelectTool` route-table path stays the authoritative move dispatcher pre-Phase-7; Phase 6 demonstrates the new path works in isolation (via ambient registration + a dedicated integration test) without flipping the switch.

**Tech Stack:** TypeScript, React, Vitest. Builds on Phases 1–5.

---

## Prerequisites

Phase 5 must be shipped on main. Verify:
```
grep -q "ActiveToolContextProvider" src/canvas/SceneCanvas.tsx && grep -q "useDepSource('activeTool'" src/interactions/actions/useStandardActions.ts
```

## File map

**Create:**
- `src/interactions/actions/defaults/move.ts` — `moveAction` ongoing-action descriptor.
- `src/interactions/actions/defaults/move.test.ts` — descriptor unit tests.
- `src/interactions/dispatcher/move.integration.test.tsx` — end-to-end integration: mount dispatcher + register moveAction + simulate drag → assert ops produced.

**Modify:**
- `src/interactions/actions/useStandardActions.ts` — add `moveAction` to the kit-standard descriptors list (with the legacy bridge step skipped for ongoing actions — useStandardActions's bridge wrapper is immediate-only).
- `src/interactions/actions/defaults/index.ts` — export `moveAction`.
- `src/interactions/dispatcher/useGestureDispatcher.tsx` — add a useEffect that calls `dispatcher.cancelAll('cancel')` when `useActiveToolContext().active` changes (Q2 — tool-switch cancellation).
- `src/index.ts` — barrel-export `moveAction`.

**Not modified in Phase 6:**
- `src/interactions/actions/move/move.ts` (the existing `useMove` hook) — stays as-is; other tools continue to use it.
- `src/tools/builtin/useSelectTool/useSelectTool.ts` — stays on the route-table path. Phase 7 migrates it once the coexistence story is settled.

## Scope boundaries

- Does NOT migrate `useSelectTool`'s drag route. (Phase 7.)
- Does NOT delete `useMove`. (Phase 10.)
- Does NOT replace the route-table dispatcher. (Phase 7+.)
- Does NOT port resize/rotate/areaSelect/insert/clone/editAnchors as ongoing actions. (Phase 7.)
- Does NOT introduce target classification beyond `{ kindOf }` predicate form. (Phase 7 may extend.)

## Design — moveAction descriptor

```ts
import type { Action } from '../registry';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Scene } from 'core/scene/types';
import { translatePose } from 'interactions/actions/move/move';  // or wherever the per-frame helper lives
import { RECT_POSE_DESCRIPTOR } from 'core/poseDescriptors';

interface MoveScratch {
  startPoses: Map<string, unknown>;  // id → original pose
  ids: string[];
}

export const moveAction: Action<readonly ['selection', 'scene']> = {
  id: 'move',
  label: 'Move',
  gestureBinding: { kind: 'drag' },  // Phase 6: any-drag wildcard; Phase 7 refines target
  requires: ['selection', 'scene'] as const,
  invoker: {
    timing: 'ongoing',
    start: (ctx, opts) => {
      const { selection, scene } = ctx.deps;
      const ids = selection.get();
      if (ids.length === 0) return {};

      const scratch: MoveScratch = {
        startPoses: new Map(ids.map(id => [id, getPose(scene, id)])),
        ids,
      };

      return {
        onMove: (ctx) => {
          if (!ctx.drag) return;
          const { dx, dy } = ctx.drag.delta;
          for (const id of scratch.ids) {
            const startPose = scratch.startPoses.get(id);
            const nextPose = translatePose(startPose, dx, dy, RECT_POSE_DESCRIPTOR as any);
            setPose(scene, id, nextPose);  // live update
          }
        },
        onEnd: (ctx, reason) => {
          if (reason === 'cancel') {
            // Restore start poses
            for (const id of scratch.ids) {
              setPose(scene, id, scratch.startPoses.get(id));
            }
            return;
          }
          // Commit: ops have already been emitted via setPose calls in onMove;
          // or alternatively, emit a single batched op here. Decide based on
          // existing useMove pattern.
        },
      };
    },
  },
  enabled: ({ selection }) => selection.get().length > 0
    ? true
    : ActionDisabledReason.SelectionRequired,
};
```

The exact body depends on how `useMove` currently builds ops. Read `src/interactions/actions/move/move.ts` to understand the pattern. Likely the existing hook produces a batched transform op at the end of the drag — the descriptor should mirror that.

If the existing logic is large, extract a helper `applyMoveDelta(scratch, scene, dx, dy)` to share between `useMove` and `moveAction`.

## Behaviors

Per Q3, behaviors come via `BindingOpts.behaviors`. The descriptor's invoker reads `opts?.behaviors ?? []` and runs them in order on each `onMove` to refine the proposed delta (snap, clamp, etc.). Mirror the existing `useMove`'s behavior pipeline.

For Phase 6's first ambient registration, NO behaviors are attached (consumers haven't migrated to register custom behaviors yet). The action just translates by the drag delta.

---

### Task 1: `moveAction` descriptor

**Files:**
- Create: `src/interactions/actions/defaults/move.ts`
- Create: `src/interactions/actions/defaults/move.test.ts`

- [ ] **Step 1: Read** `src/interactions/actions/move/move.ts` in full. Note:
  - Exact shape of the per-frame translate logic.
  - Op-emission pattern (per-frame setPose calls vs single batched op at end).
  - How `scene` is consumed (direct mutation or via adapter callbacks).
  - Where `translatePose` lives and what its signature is.

- [ ] **Step 2: Failing test** in `move.test.ts`:

```ts
describe('moveAction descriptor', () => {
  it('declares ongoing-timing with drag gestureBinding and requires selection+scene', () => {
    expect(moveAction.id).toBe('move');
    expect(moveAction.invoker.timing).toBe('ongoing');
    expect(moveAction.gestureBinding).toEqual({ kind: 'drag' });
    expect(moveAction.requires).toEqual(['selection', 'scene']);
  });

  it('start returns empty handle when selection is empty', () => {
    const selection = { get: () => [] };
    const scene = {} as any;
    if (moveAction.invoker.timing !== 'ongoing') throw new Error();
    const handle = moveAction.invoker.start({ deps: { selection, scene }, world: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, modifiers: {} as any } as any, undefined);
    expect(handle).toEqual({});
  });

  it('onMove translates selection by drag delta', () => {
    // Setup a scene with two nodes; mock selection to return both ids; call start; call onMove with a drag delta; assert scene poses updated.
    // Adapt to actual scene API.
  });

  it('onEnd("cancel") restores start poses', () => { /* ... */ });

  it('enabled returns SelectionRequired when empty', () => { /* ... */ });
});
```

- [ ] **Step 3: Implement** `move.ts` per the design above. Extract helpers if needed.

- [ ] **Step 4: Verify + commit.**

```
git add src/interactions/actions/defaults/move.ts src/interactions/actions/defaults/move.test.ts
git commit -m "feat(registry): add moveAction — first ongoing-action descriptor (Phase 6)"
```

---

### Task 2: Register moveAction via useStandardActions

**Files:**
- Modify: `src/interactions/actions/useStandardActions.ts`
- Modify: `src/interactions/actions/defaults/index.ts`
- Modify: `src/index.ts`
- Update: `src/interactions/actions/useStandardActions.test.tsx`

`useStandardActions` currently registers immediate-action descriptors with a legacy `run` bridge. moveAction is ongoing — it has no `run` field and the bridge wrapper is immediate-only. The registration needs to handle both:

```ts
const KIT_STANDARD_DESCRIPTORS: Action<any>[] = [
  // ... existing immediate descriptors
  moveAction,
];

function withLegacyRunBridge(action: Action<any>, depReg: DepRegistry): Action {
  if (!action.invoker || action.invoker.timing !== 'immediate') return action;  // ongoing actions pass through unchanged
  // ... existing immediate bridge body
}
```

The `withLegacyRunBridge` already (per Phase 4 T8) returns `action` unchanged for non-immediate invokers. So ongoing actions like `moveAction` are registered as-is — the dispatcher (Phase 3) handles them via the new path; the legacy `useKeybinding` is keystroke-only and irrelevant for drag actions.

- [ ] **Step 1: Add `moveAction` to the descriptors list** in `useStandardActions.ts`.

- [ ] **Step 2: Update the count test** in `useStandardActions.test.tsx` — the kit-standard descriptor count was 29; now 30.

- [ ] **Step 3: Add export from `defaults/index.ts` and barrel-export from `src/index.ts`.**

- [ ] **Step 4: Verify + commit.**

```
git add src/interactions/actions/useStandardActions.ts src/interactions/actions/useStandardActions.test.tsx src/interactions/actions/defaults/index.ts src/index.ts
git commit -m "feat(registry): register moveAction with useStandardActions (Phase 6)"
```

---

### Task 3: Tool-switch cancels in-flight gestures

**Files:**
- Modify: `src/interactions/dispatcher/useGestureDispatcher.tsx`
- Modify: `src/interactions/dispatcher/useGestureDispatcher.test.tsx`

Per Q2: when the active tool changes, in-flight ongoing handles should be cancelled.

Implementation: in `useGestureDispatcher`, add a `useEffect` that calls `dispatcher.cancelAll('cancel')` whenever `useActiveToolContext().active` changes.

```ts
const activeToolCtx = useActiveToolContext();
useEffect(() => {
  return () => {
    // On active-tool change, cancel any in-flight handles before the next
    // tool's bindings come into scope. The dispatcher's gestureId scheme
    // ensures handles are uniquely identified; cancelAll synthesizes
    // onEnd('cancel') for each.
    dispatcherRef.current?.cancelAll('cancel');
  };
}, [activeToolCtx.active]);  // re-runs when active changes
```

Or — equivalent — call `cancelAll` from the effect body on subsequent renders (skipping the first):

```ts
const prevActiveRef = useRef(activeToolCtx.active);
useEffect(() => {
  if (prevActiveRef.current !== activeToolCtx.active) {
    dispatcherRef.current?.cancelAll('cancel');
    prevActiveRef.current = activeToolCtx.active;
  }
});
```

Pick whichever reads cleaner. The cleanup-form (`return () => …`) is slightly more idiomatic for "react to dep change."

Tests:
- Start an ongoing gesture (e.g. via a stub action with timing: 'ongoing').
- Assert it's in `dispatcher.inFlight()`.
- Call `setActive('rect')` on the active-tool context.
- Assert the handle's `onEnd('cancel')` was called and `inFlight()` is empty.

- [ ] **Step 1: Failing test.**
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Verify + commit.**

```
git add src/interactions/dispatcher/useGestureDispatcher.tsx src/interactions/dispatcher/useGestureDispatcher.test.tsx
git commit -m "feat(dispatcher): tool-switch cancels in-flight ongoing handles (Q2 wiring)"
```

---

### Task 4: End-to-end integration test for moveAction via dispatcher

**Files:**
- Create: `src/interactions/dispatcher/move.integration.test.tsx`

Prove the full chain: register moveAction → mount dispatcher inside SceneCanvas-equivalent providers → simulate pointerdown + 3 pointermoves + pointerup → assert scene nodes moved by the cumulative delta.

```tsx
describe('moveAction integration via gesture dispatcher', () => {
  it('drag-pointerdown→move→up translates selected nodes by delta', () => {
    // Setup: scene with 2 nodes, selection includes both.
    // Mount: <DepRegistryProvider><ActiveToolContextProvider><ActionsProvider><DispatcherPresenceProvider> + selection/scene dep sources + register moveAction + mount dispatcher.
    // Act: simulate pointerdown at (0,0), pointermove to (10, 5), pointermove to (20, 10), pointerup at (20, 10).
    // Assert: each node's pose translated by (20, 10).
  });

  it('drag cancelled mid-gesture restores poses', () => {
    // Same setup; cancel via pointercancel or tool-switch; assert poses restored.
  });

  it('drag with empty selection is a no-op', () => { /* ... */ });
});
```

This is the load-bearing validation of the dispatcher's drag pump. If the test passes, the dispatcher contract for ongoing actions is proven on a real case.

- [ ] **Step 1-3:** Write the test (this is the implementation — no separate "implement" step since the dispatcher already exists). Run. Fix any dispatcher bugs that surface (likely real — this is the first real ongoing-action exercise of the pump).

- [ ] **Step 4: Commit.**

```
git add src/interactions/dispatcher/move.integration.test.tsx
git commit -m "test(dispatcher): moveAction end-to-end integration — drag pump validation (Phase 6)"
```

If dispatcher fixes were needed, include them in this commit OR a separate `fix(dispatcher)` commit beforehand.

---

### Task 5: End-to-end verification + TODO note

**Files:** none modified except docs.

- [ ] **Step 1: Verify gates** (kit + weasel-ui + swillustrator).

- [ ] **Step 2: Update `docs/TODO.md`** Phase status block:

```
- Phase 6 (moveAction descriptor + drag-pump validation): shipped 2026-05-17 — first ongoing-action descriptor lands; dispatcher's drag pump (start → onMove* → onEnd) validated end-to-end via integration test. Tool-switch cancels in-flight handles (Q2). useSelectTool's existing drag route stays on the legacy route-table path; Phase 7 resolves the route-table-vs-new-dispatcher coexistence and migrates useSelectTool.
```

Update "Phases 6–10: pending" → "Phases 7–10: pending."

- [ ] **Step 3: Commit + done.**

## Done criteria

- `moveAction` registered with the actions registry via `useStandardActions`.
- Integration test proves drag-pump end-to-end behavior.
- Tool-switch cancels in-flight handles.
- All vitest + tsc + build:demo green.
- `useSelectTool` unchanged.
- No demos broken (no consumer-facing behavior change — moveAction is registered but not yet load-bearing for any tool).

## Risks / open items

- **`useMove`'s op-emission pattern.** If `useMove` emits a single batched transform op at end-of-drag, moveAction's invoker needs to do the same. If it does per-frame `setPose` calls, the dispatcher's onMove pattern fits naturally. Read carefully.

- **Route-table-vs-new-dispatcher conflict.** If moveAction is ambient AND useSelectTool's route-table also routes drag, both fire on the same pointerdown. For Phase 6, this is OK because moveAction has `gestureBinding: { kind: 'drag' }` with NO target (matches any drag — but the dispatcher needs `selection.get().length > 0` to actually move anything; if selection is empty, the start returns empty handle and does nothing). The route-table path still does its thing. Phase 7 resolves the coexistence (likely: when dispatcher handles a drag, suppress route-table dispatch — analogous to the DispatcherPresence pattern for keys).

- **Drag-pump first real exercise.** Phase 3's dispatcher tests covered the pump with synthesized events but no real consumer. Phase 6's integration test is the first real exercise. Expect to find and fix bugs (e.g., `drag.delta` calculation, pointermove coalescing, pointerup not firing onEnd).

- **Cursor / overlay.** moveAction doesn't render any overlay. Phase 7's useSelectTool migration handles overlay (the drag ghost), which the existing useSelectTool already does via Tool.overlay.

## What's next

Phase 7 — port the remaining ongoing actions (resize, rotate, areaSelect, lassoSelect, insert, clone, editAnchors, viewport.pinchZoom) AND migrate `useSelectTool`'s drag route table to use the new dispatcher exclusively. Resolves the route-table-vs-new-dispatcher coexistence. Will be its own plan.
