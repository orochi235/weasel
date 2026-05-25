# Color/Opacity via Action Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route apps/draw fill color, stroke color, fill opacity, and stroke opacity changes through the kit's action router as **ongoing actions** with a new UI-facing `begin/update/end` surface — collapsing today's three divergent mutation paths (`applyFillToSelection`, `applyStrokeToSelection`, `patchSelection`) into one router-mediated path with single-undo-entry semantics per drag.

**Architecture:** The router today supports two invoker shapes: `Immediate` (callable via `registry.trigger`) and `Ongoing` (callable only from the gesture dispatcher via drag/keybind). This plan extends `ActionsRegistry` with a `begin(id, params) → { update, end }` API that drives `Ongoing` invokers from UI controls (color picker, opacity slider), reusing the same `OngoingHandle` lifecycle and `previewData(id)` rendering path that SceneCanvas already consumes for move/resize/rotate. Four new ongoing actions (`setFill`, `setStroke`, `setFillOpacity`, `setStrokeOpacity`) write to the scene in `onEnd('commit')` under a single `scene.batch`, producing exactly one undo entry per drag. Opacity stays embedded in hex8 (`#rrggbbaa`) — actions synthesize the merged color from `{ color?, alpha01? }` params; no data-model change.

**Tech Stack:** TypeScript, React, vitest, @testing-library/react. Existing kit primitives: `ActionsRegistry` (`src/interactions/actions/registry.tsx`), `Dispatcher` (`src/interactions/dispatcher/dispatcher.ts`), `OngoingInvoker` (`src/interactions/actions/invoker.ts`), `Scene.batch` / `Scene.update`. apps/draw consumer: `ActiveSwatches.tsx`, `App.tsx`, `PropertiesPanel.tsx`, `ColorContextProvider.tsx`.

---

## File Structure

**Kit (`src/`)** — surface extensions and new actions:
- Modify: `src/interactions/actions/invoker.ts` — add `params?` to `InvocationCtx`
- Modify: `src/interactions/dispatcher/dispatcher.ts` — add `beginUiOngoing(actionId, deps, params)` → `UiOngoingControl`
- Modify: `src/interactions/actions/registry.tsx` — add `begin(id, params)` → `UiOngoingControl`, plumb dispatcher ref
- Create: `src/interactions/actions/defaults/setFill.ts` — ongoing action
- Create: `src/interactions/actions/defaults/setStroke.ts` — ongoing action
- Create: `src/interactions/actions/defaults/setFillOpacity.ts` — ongoing action
- Create: `src/interactions/actions/defaults/setStrokeOpacity.ts` — ongoing action
- Modify: `src/interactions/actions/useStandardActions.ts` — register the 4 new actions
- Create: tests for each new file

**App (`apps/draw/src/`)** — switch consumer to new API, delete dead paths:
- Modify: `apps/draw/src/ActiveSwatches.tsx` — swatch `onChange` dispatches via `registry.begin`
- Modify: `apps/draw/src/ui/PropertiesPanel/PropertiesPanel.tsx` — `PropertyColorInput` dispatches via `registry.begin`
- Modify: `apps/draw/src/App.tsx` — palette grid dispatches via `registry.begin`; remove `buildUpdateSelected`'s fill/stroke responsibility; remove `patchSelection` calls for fill/stroke from PropertyColorInput wiring
- Modify: `apps/draw/src/tools/colorContext/ColorContextProvider.tsx` — remove `applyFillToSelection`, `applyStrokeToSelection`, scene-write surface from `ColorContextValue`

---

## Key Design Decisions

### Why ongoing (not immediate) for color/opacity

A color picker drag emits many `input` events. Immediate actions would either (a) produce one undo entry per tick (worse than today) or (b) require batch coalescing in the history layer (its own can of worms). Ongoing actions already have the right shape: `start` snapshots state, `onMove` (called via UI `update`) refreshes a preview, `onEnd('commit')` writes one batch. The renderer already reads `previewData(id)` from in-flight handles (`SceneCanvas.tsx:1219`) — preview-during-drag works for free.

### How `begin/update/end` maps to native input events

| Native event | UI action |
|---|---|
| First `input` on `<input type="color">` or `<input type="range">` after a fresh open/focus | `registry.begin(id, params)` → store control |
| Subsequent `input` events | `control.update(params)` |
| `change` event (commit per HTML spec) | `control.end('commit')`; discard control |
| Blur without change | `control.end('cancel')` |
| New `begin` before previous `end` | previous control auto-commits (`end('commit')`) |

The auto-commit-on-overlap rule keeps lifecycle robust without requiring consumers to track gesture boundaries perfectly.

### Why params flow via `InvocationCtx.params`

`OngoingHandle.onMove(ctx)` takes only `ctx`. To thread updated values from UI ticks into the action, `InvocationCtx` gains an optional `params?: Record<string, unknown>` field. Existing ongoing actions (move, resize, rotate, etc.) don't read it and aren't affected. New color actions read it on `start` (for initial value) and `onMove` (for updates).

### Why opacity stays in hex8

User confirmed: don't split alpha into a separate `fillOpacity` field. The actions synthesize the merged color using existing `withAlpha01(rgb6, alpha01)` and `mergeAlphaFromPrev(picked, prev)` helpers. Color actions accept `{ color: '#rrggbb' }` (preserves existing alpha); opacity actions accept `{ alpha01: number }` (preserves existing RGB).

### What does *not* change

- `Scene` API. `scene.batch` and `scene.update` are untouched.
- `Action` descriptor shape. New actions follow the existing `OngoingInvoker` contract.
- Existing ongoing actions (move, resize, rotate, …). They ignore the new `ctx.params` field.
- `registry.trigger`. Still immediate-only. Color/opacity use `registry.begin`.
- The `ColorContextProvider` swatch UI state (`fill`, `stroke`, `focused`, `setFocusedColor`, etc.). Only the scene-write methods are removed.

---

## Conventions for tasks below

- All file paths are absolute under `/Users/mike/src/weasel/.claude/worktrees/tint-render-layer`.
- Tests use vitest. Run with `npx vitest run <path>` from the worktree root.
- After every task: `npm run typecheck` (or `tsc --noEmit`) must pass. Don't commit if it doesn't.
- Commit messages follow conventional commits: `feat:`, `refactor:`, `test:`.

---

## Task 1: Add `params?` to `InvocationCtx`

**Files:**
- Modify: `src/interactions/actions/invoker.ts`
- Test: `src/interactions/actions/invoker.test.ts` (create if absent — verify type only)

- [ ] **Step 1: Add `params?` field to `InvocationCtx`**

In `src/interactions/actions/invoker.ts`, find the `InvocationCtx` interface (around lines 60–107). Add this field alongside the other optional gesture-kind-specific fields (`drag?`, `key?`, `wheel?`, `multiTouch?`):

```typescript
  /**
   * Per-invocation parameters. Populated by `ActionsRegistry.begin()` for
   * UI-driven ongoing actions (color picker, opacity slider) so handles can
   * read the current value on `start` and updated values on `onMove`. The
   * gesture dispatcher does not populate this field; gesture-driven actions
   * receive params via `BindingOpts.params` on `start` (the `opts` arg).
   */
  params?: Record<string, unknown>;
```

- [ ] **Step 2: Confirm no existing action reads `ctx.params`**

Run:

```bash
grep -rn "ctx\.params\|invocationCtx\.params" src/interactions/actions/defaults/
```

Expected: no matches. Existing actions read params via the `opts` arg to `start` (gesture-bound) or the second arg to `run` (immediate). Adding `ctx.params` is purely additive.

- [ ] **Step 3: Typecheck**

```bash
cd /Users/mike/src/weasel/.claude/worktrees/tint-render-layer && npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/interactions/actions/invoker.ts
git commit -m "feat(actions): add InvocationCtx.params for UI-driven ongoing actions"
```

---

## Task 2: Add `Dispatcher.beginUiOngoing`

**Files:**
- Modify: `src/interactions/dispatcher/dispatcher.ts`
- Test: `src/interactions/dispatcher/dispatcher.uiOngoing.test.ts`

The dispatcher already owns `inFlightHandles: Map<string, OngoingHandle>` (line 192). UI-driven handles live in the same map keyed by a synthetic gestureId so SceneCanvas's `getInFlightHandles()` iterator sees them without changes.

- [ ] **Step 1: Add `UiOngoingControl` type and method to the `Dispatcher` interface**

In `src/interactions/dispatcher/dispatcher.ts`, find the `Dispatcher` interface (around lines 100–183). Above the interface, add:

```typescript
/**
 * Handle returned by `Dispatcher.beginUiOngoing()` for driving an
 * ongoing invoker from a UI control (color picker, slider).
 *
 *  - `update(params)` rebuilds an `InvocationCtx` with the new params and
 *    calls the handle's `onMove`. Safe to call many times.
 *  - `end(reason)` calls `onEnd(ctx, reason)` once and removes the handle
 *    from the in-flight map. Idempotent — further calls are no-ops.
 */
export interface UiOngoingControl {
  readonly gestureId: string;
  update(params?: Record<string, unknown>): void;
  end(reason: 'commit' | 'cancel'): void;
}
```

Inside the `Dispatcher` interface, after `cancelAll`, add:

```typescript
  /**
   * Start an ongoing action driven by UI (not a gesture). Builds an
   * `InvocationCtx` with the given `deps` and `params`, calls
   * `action.invoker.start(ctx, { params })`, and registers the returned
   * handle in the in-flight map so `getInFlightHandles()` reports it —
   * enabling preview rendering via `SceneCanvas`.
   *
   * Returns `null` if `actionId` is unknown, the action's invoker is not
   * ongoing, or `start` returned an empty handle.
   *
   * If a UI-driven handle for the same `actionId` is already in flight,
   * it is committed (`end('commit')`) before the new one starts.
   */
  beginUiOngoing(
    actionId: string,
    deps: ActionDeps,
    params?: Record<string, unknown>,
  ): UiOngoingControl | null;
```

- [ ] **Step 2: Update the `Dispatcher` interface imports**

Near the top of `dispatcher.ts`, ensure `ActionDeps` is imported from `'../actions/invoker'` if not already. (It is — verify by reading lines 1–30; add only if missing.)

- [ ] **Step 3: Add a private counter and the implementation inside `createDispatcher`**

In `src/interactions/dispatcher/dispatcher.ts`, inside `createDispatcher` (after the existing private state declarations like `inFlightHandles`, `dragOrigins`, around line 235), add:

```typescript
  /** Monotonic counter for synthesizing unique gestureIds for UI-driven
   *  ongoing handles. Each `beginUiOngoing` call increments this. */
  let uiOngoingSeq = 0;

  /** actionId → gestureId of the currently in-flight UI-driven handle for
   *  that action, if any. Used to auto-commit a prior handle when a new
   *  `beginUiOngoing(sameActionId, …)` arrives. */
  const uiOngoingByAction = new Map<string, string>();
```

Inside `createDispatcher`'s returned object (the `Dispatcher` impl, near `cancelAll`), add the implementation. You will also need a reference to the actions registry — see Step 4. For now, implement against a `getAction` callback that the registry will supply:

Add at the top of `createDispatcher` (parameter list area — `createDispatcher()` currently takes no args; change its signature):

```typescript
export function createDispatcher(opts?: {
  getAction?: (id: string) => Action | undefined;
}): Dispatcher {
```

Add inside the returned `Dispatcher` impl:

```typescript
    beginUiOngoing(
      actionId: string,
      deps: ActionDeps,
      params?: Record<string, unknown>,
    ): UiOngoingControl | null {
      const getAction = opts?.getAction;
      if (!getAction) return null;
      const action = getAction(actionId);
      if (!action || !action.invoker || action.invoker.timing !== 'ongoing') {
        return null;
      }

      // Auto-commit any prior UI-driven handle for the same action.
      const prevGestureId = uiOngoingByAction.get(actionId);
      if (prevGestureId !== undefined) {
        const prevHandle = inFlightHandles.get(prevGestureId);
        if (prevHandle?.onEnd) {
          const prevCtx: InvocationCtx = {
            world: { x: 0, y: 0 },
            screen: { x: 0, y: 0 },
            modifiers: { alt: false, ctrl: false, meta: false, shift: false },
            deps,
          };
          try { prevHandle.onEnd(prevCtx, 'commit'); }
          catch (e) { console.error(`weasel dispatcher: prior UI handle for "${actionId}" threw on auto-commit`, e); }
        }
        inFlightHandles.delete(prevGestureId);
        inFlightOwners.delete(prevGestureId);
        uiOngoingByAction.delete(actionId);
      }

      const gestureId = `ui-${actionId}-${++uiOngoingSeq}`;
      const startCtx: InvocationCtx = {
        world: { x: 0, y: 0 },
        screen: { x: 0, y: 0 },
        modifiers: { alt: false, ctrl: false, meta: false, shift: false },
        deps,
        params,
      };
      let handle: OngoingHandle;
      try {
        handle = action.invoker.start(startCtx, { params });
      } catch (e) {
        console.error(`weasel dispatcher: action "${actionId}" threw on start`, e);
        return null;
      }
      // Treat empty handles ({} with no onMove or onEnd) as "did not engage".
      if (!handle.onMove && !handle.onEnd && !handle.previewIds) {
        return null;
      }

      inFlightHandles.set(gestureId, handle);
      inFlightOwners.set(gestureId, null);
      uiOngoingByAction.set(actionId, gestureId);
      notify();

      let ended = false;
      return {
        gestureId,
        update(nextParams) {
          if (ended) return;
          if (!handle.onMove) return;
          const moveCtx: InvocationCtx = {
            world: { x: 0, y: 0 },
            screen: { x: 0, y: 0 },
            modifiers: { alt: false, ctrl: false, meta: false, shift: false },
            deps,
            params: nextParams,
          };
          try { handle.onMove(moveCtx); }
          catch (e) { console.error(`weasel dispatcher: action "${actionId}" threw on onMove`, e); }
          notify();
        },
        end(reason) {
          if (ended) return;
          ended = true;
          if (handle.onEnd) {
            const endCtx: InvocationCtx = {
              world: { x: 0, y: 0 },
              screen: { x: 0, y: 0 },
              modifiers: { alt: false, ctrl: false, meta: false, shift: false },
              deps,
            };
            try { handle.onEnd(endCtx, reason); }
            catch (e) { console.error(`weasel dispatcher: action "${actionId}" threw on onEnd`, e); }
          }
          inFlightHandles.delete(gestureId);
          inFlightOwners.delete(gestureId);
          if (uiOngoingByAction.get(actionId) === gestureId) {
            uiOngoingByAction.delete(actionId);
          }
          notify();
        },
      };
    },
```

- [ ] **Step 4: Write tests for `beginUiOngoing`**

Create `src/interactions/dispatcher/dispatcher.uiOngoing.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { Action, OngoingHandle, InvocationCtx } from '../actions/invoker';

function makeOngoingAction(id: string, hooks: Partial<OngoingHandle> & {
  onStart?: (ctx: InvocationCtx) => void;
}): Action {
  return {
    id,
    label: id,
    invoker: {
      timing: 'ongoing',
      start(ctx) {
        hooks.onStart?.(ctx);
        return {
          onMove: hooks.onMove,
          onEnd: hooks.onEnd,
          previewIds: hooks.previewIds,
          previewData: hooks.previewData,
          previewPose: hooks.previewPose,
        };
      },
    },
  };
}

describe('Dispatcher.beginUiOngoing', () => {
  it('returns null when the action is unknown', () => {
    const d = createDispatcher({ getAction: () => undefined });
    expect(d.beginUiOngoing('missing', {})).toBeNull();
  });

  it('returns null when the invoker is not ongoing', () => {
    const action: Action = {
      id: 'immediate',
      label: 'immediate',
      invoker: { timing: 'immediate', run: () => {} },
    };
    const d = createDispatcher({ getAction: (id) => id === action.id ? action : undefined });
    expect(d.beginUiOngoing('immediate', {})).toBeNull();
  });

  it('calls start with the given params, then onMove on update, then onEnd on end', () => {
    const onStart = vi.fn();
    const onMove = vi.fn();
    const onEnd = vi.fn();
    const action = makeOngoingAction('test', { onStart, onMove, onEnd });
    const d = createDispatcher({ getAction: (id) => id === 'test' ? action : undefined });

    const ctrl = d.beginUiOngoing('test', { selection: 'sel-stub' }, { color: '#ff0000' });
    expect(ctrl).not.toBeNull();
    expect(onStart).toHaveBeenCalledOnce();
    expect(onStart.mock.calls[0][0].params).toEqual({ color: '#ff0000' });
    expect(onStart.mock.calls[0][0].deps).toEqual({ selection: 'sel-stub' });

    ctrl!.update({ color: '#00ff00' });
    expect(onMove).toHaveBeenCalledOnce();
    expect(onMove.mock.calls[0][0].params).toEqual({ color: '#00ff00' });

    ctrl!.end('commit');
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onEnd.mock.calls[0][1]).toBe('commit');
  });

  it('registers the handle in inFlight so getInFlightHandles reports it', () => {
    const action = makeOngoingAction('test', {
      onMove: vi.fn(),
      onEnd: vi.fn(),
      previewIds: () => ['a'],
    });
    const d = createDispatcher({ getAction: () => action });

    const ctrl = d.beginUiOngoing('test', {}, {});
    expect(ctrl).not.toBeNull();
    expect([...d.getInFlightHandles()].length).toBe(1);
    ctrl!.end('commit');
    expect([...d.getInFlightHandles()].length).toBe(0);
  });

  it('end is idempotent', () => {
    const onEnd = vi.fn();
    const action = makeOngoingAction('test', { onMove: vi.fn(), onEnd });
    const d = createDispatcher({ getAction: () => action });

    const ctrl = d.beginUiOngoing('test', {}, {})!;
    ctrl.end('commit');
    ctrl.end('cancel');
    ctrl.end('commit');
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('update is a no-op after end', () => {
    const onMove = vi.fn();
    const action = makeOngoingAction('test', { onMove, onEnd: vi.fn() });
    const d = createDispatcher({ getAction: () => action });

    const ctrl = d.beginUiOngoing('test', {}, {})!;
    ctrl.end('commit');
    ctrl.update({ color: '#abcdef' });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('auto-commits a prior UI handle for the same actionId before starting a new one', () => {
    const onEnd = vi.fn();
    const action = makeOngoingAction('test', { onMove: vi.fn(), onEnd });
    const d = createDispatcher({ getAction: () => action });

    const a = d.beginUiOngoing('test', {}, { v: 1 })!;
    const b = d.beginUiOngoing('test', {}, { v: 2 })!;
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onEnd.mock.calls[0][1]).toBe('commit');
    expect(a.gestureId).not.toBe(b.gestureId);
    b.end('commit');
  });

  it('returns null when start returns an empty handle', () => {
    const action = makeOngoingAction('test', {});
    const d = createDispatcher({ getAction: () => action });
    expect(d.beginUiOngoing('test', {}, {})).toBeNull();
  });

  it('subscribers are notified on begin / update / end', () => {
    const action = makeOngoingAction('test', { onMove: vi.fn(), onEnd: vi.fn() });
    const d = createDispatcher({ getAction: () => action });
    const sub = vi.fn();
    d.subscribe(sub);

    const ctrl = d.beginUiOngoing('test', {}, {})!;
    expect(sub).toHaveBeenCalledTimes(1);
    ctrl.update({ x: 1 });
    expect(sub).toHaveBeenCalledTimes(2);
    ctrl.end('commit');
    expect(sub).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 5: Run tests — expect failures, then passes**

```bash
npx vitest run src/interactions/dispatcher/dispatcher.uiOngoing.test.ts
```

Expected: all pass (we implemented before testing in this task because the implementation is tightly coupled to the new test surface — verify all 9 tests pass).

If any fail, debug and fix the implementation before proceeding. **Do not move on with red tests.**

- [ ] **Step 6: Verify no existing dispatcher tests broke**

```bash
npx vitest run src/interactions/dispatcher/
```

Expected: all pass.

- [ ] **Step 7: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors. **Note:** changing `createDispatcher()` to `createDispatcher(opts?)` is backward-compatible (opts is optional), but verify any call sites that destructure or rely on the signature.

```bash
grep -rn "createDispatcher(" src/ apps/ demo/ --include="*.ts" --include="*.tsx"
```

Expected: all call sites either pass nothing (still valid) or are updated in a later task.

- [ ] **Step 8: Commit**

```bash
git add src/interactions/dispatcher/dispatcher.ts src/interactions/dispatcher/dispatcher.uiOngoing.test.ts
git commit -m "feat(dispatcher): add beginUiOngoing for UI-driven ongoing actions"
```

---

## Task 3: Add `ActionsRegistry.begin`

**Files:**
- Modify: `src/interactions/actions/registry.tsx`
- Test: `src/interactions/actions/registry.begin.test.tsx`

The registry exposes the user-facing API. It delegates to dispatcher's `beginUiOngoing`. The registry needs a dispatcher ref; it gets one via a new optional `dispatcher` prop on the registry provider (or context wiring — see Step 2).

- [ ] **Step 1: Add `begin` to `ActionsRegistry` interface**

In `src/interactions/actions/registry.tsx`, find the `ActionsRegistry` interface (lines 196–214). Re-export the `UiOngoingControl` type from dispatcher at the top of the file:

```typescript
export type { UiOngoingControl } from '../dispatcher/dispatcher';
```

Add to the interface, after `trigger`:

```typescript
  /**
   * Start an ongoing action driven by UI (color picker, opacity slider).
   * Returns a control object with `update(params)` and `end(reason)`.
   *
   * Returns `null` if no dispatcher is wired into this registry, the
   * action is unknown, or its invoker is not ongoing.
   *
   * See `Dispatcher.beginUiOngoing` for full semantics including
   * auto-commit when a prior UI handle for the same action is in flight.
   */
  begin(id: string, params?: Record<string, unknown>): UiOngoingControl | null;
```

- [ ] **Step 2: Wire dispatcher into the registry provider**

Find the `ActionsRegistryProvider` (or whichever exported component owns the registry's React lifecycle — check the file around lines 240–360 for the actual component name and ref pattern). The registry currently holds a `depRegRef`. Add a parallel `dispatcherRef` ref slot the same way, plus a setter on the registry's external API for the dispatcher (or accept it as a prop — match the existing pattern for `depRegRef`).

Read the registry file to find the pattern, then mirror it:

```bash
grep -n "depRegRef\|setDepRegistry\|setDispatcher" src/interactions/actions/registry.tsx
```

If `depRegRef` is set via a `setDependencyRegistry` method or a ref prop, add a parallel `setDispatcher(d: Dispatcher | null): void` to `ActionsRegistry`:

```typescript
  /** Wire a dispatcher into the registry so `begin()` can delegate to it.
   *  Call with `null` to detach. Idempotent. */
  setDispatcher(d: Dispatcher | null): void;
```

Inside the registry implementation, add:

```typescript
  const dispatcherRef = { current: null as Dispatcher | null };
```

And the impl methods:

```typescript
    setDispatcher: (d: Dispatcher | null) => {
      dispatcherRef.current = d;
    },
    begin: (id: string, params?: Record<string, unknown>) => {
      const disp = dispatcherRef.current;
      if (!disp) return null;
      const r = depRegRef.current;
      const deps = r
        ? {
            selection: r.get('selection' as DepName),
            scene: r.get('scene' as DepName),
            history: r.get('history' as DepName),
            view: r.get('view' as DepName),
            pointer: r.get('pointer' as DepName),
            activeTool: r.get('activeTool' as DepName),
            booleansAdapter: r.get('booleansAdapter' as DepName),
          }
        : {};
      return disp.beginUiOngoing(id, deps as never, params);
    },
```

Import `Dispatcher` at top of `registry.tsx`:

```typescript
import type { Dispatcher } from '../dispatcher/dispatcher';
```

- [ ] **Step 3: Wire registry ↔ dispatcher at the SceneCanvas seam**

Find where `createDispatcher` is called and the registry is created (likely in `SceneCanvas.tsx` or a hook it uses). Update the call to construct a dispatcher that can resolve actions from the registry, and vice versa:

```bash
grep -n "createDispatcher\b" src/
```

Locate the call site. Update from `createDispatcher()` to:

```typescript
const dispatcher = useMemo(
  () => createDispatcher({ getAction: (id) => registry.list().find((a) => a.id === id) }),
  [registry],
);
useEffect(() => {
  registry.setDispatcher(dispatcher);
  return () => registry.setDispatcher(null);
}, [registry, dispatcher]);
```

(Adapt to existing patterns — if the dispatcher is created at a non-React layer, wire `setDispatcher` from the same place.)

- [ ] **Step 4: Test `registry.begin` end-to-end**

Create `src/interactions/actions/registry.begin.test.tsx`. The test verifies (a) `begin` returns null when no dispatcher is wired, (b) `begin` returns a control after `setDispatcher` is called, (c) `begin` returns null for an unknown action, (d) `begin` returns null for an immediate action:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createActionsRegistry } from './registry'; // adapt to actual export name
import { createDispatcher } from '../dispatcher/dispatcher';
import type { Action } from './invoker';

function ongoing(id: string): Action {
  return {
    id,
    label: id,
    invoker: {
      timing: 'ongoing',
      start: () => ({ onMove: vi.fn(), onEnd: vi.fn() }),
    },
  };
}

function immediate(id: string): Action {
  return { id, label: id, invoker: { timing: 'immediate', run: vi.fn() } };
}

describe('ActionsRegistry.begin', () => {
  it('returns null with no dispatcher wired', () => {
    const reg = createActionsRegistry();
    reg.register(ongoing('foo'));
    expect(reg.begin('foo', {})).toBeNull();
  });

  it('returns null for an unknown action', () => {
    const reg = createActionsRegistry();
    const d = createDispatcher({ getAction: (id) => reg.list().find((a) => a.id === id) });
    reg.setDispatcher(d);
    expect(reg.begin('missing', {})).toBeNull();
  });

  it('returns null for an immediate action', () => {
    const reg = createActionsRegistry();
    reg.register(immediate('imm'));
    const d = createDispatcher({ getAction: (id) => reg.list().find((a) => a.id === id) });
    reg.setDispatcher(d);
    expect(reg.begin('imm', {})).toBeNull();
  });

  it('returns a working control for an ongoing action', () => {
    const reg = createActionsRegistry();
    reg.register(ongoing('drag'));
    const d = createDispatcher({ getAction: (id) => reg.list().find((a) => a.id === id) });
    reg.setDispatcher(d);
    const ctrl = reg.begin('drag', { foo: 'bar' });
    expect(ctrl).not.toBeNull();
    expect(typeof ctrl!.update).toBe('function');
    expect(typeof ctrl!.end).toBe('function');
    ctrl!.end('commit');
  });
});
```

**Note:** If the actual factory export name in `registry.tsx` differs from `createActionsRegistry`, adjust the import. Check first:

```bash
grep -n "^export.*ActionsRegistry\|^export function createActions\|^export const createActions" src/interactions/actions/registry.tsx
```

- [ ] **Step 5: Run the new test**

```bash
npx vitest run src/interactions/actions/registry.begin.test.tsx
```

Expected: all 4 pass.

- [ ] **Step 6: Run full registry + dispatcher test suite**

```bash
npx vitest run src/interactions/actions/ src/interactions/dispatcher/
```

Expected: all pass.

- [ ] **Step 7: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/interactions/actions/registry.tsx src/interactions/actions/registry.begin.test.tsx src/canvas/SceneCanvas.tsx
git commit -m "feat(actions): ActionsRegistry.begin delegates to dispatcher.beginUiOngoing"
```

(Adjust file list to include whatever you touched for Step 3's wire-up.)

---

## Task 4: Create `setFillAction` (ongoing)

**Files:**
- Create: `src/interactions/actions/defaults/setFill.ts`
- Test: `src/interactions/actions/defaults/setFill.test.ts`

This action handles fill color changes. Params: `{ color: string }` — an RGB hex (`#rrggbb`) or hex8 (`#rrggbbaa`). The action preserves each node's existing alpha if a 6-char hex is supplied, using the existing kit helper `mergeAlphaFromPrev` (currently lives in `apps/draw/src/ActiveSwatches.tsx:72`). **Move this helper into the kit** so the action can use it without depending on the app — see Step 1.

- [ ] **Step 1: Move `mergeAlphaFromPrev` (and required helpers) into the kit**

The helper currently lives in `apps/draw/src/ActiveSwatches.tsx`. Create a new kit module so both the action (in `src/`) and `ActiveSwatches.tsx` (in `apps/draw/`) can import from it.

Create `src/util/color.ts`:

```typescript
/** Color hex8 helpers. All inputs are CSS color strings; outputs are hex8
 *  (`#rrggbbaa`) when possible, pass-through otherwise. */

const HEX_RE = /^#([0-9a-f]{3,8})$/i;

/** Expand any hex form (#rgb, #rgba, #rrggbb, #rrggbbaa) to hex8. */
export function toHex8(color: string): string {
  const m = HEX_RE.exec(color);
  if (!m) return color;
  const h = m[1];
  if (h.length === 3) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}ff`;
  if (h.length === 4) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  if (h.length === 6) return `#${h}ff`;
  if (h.length === 8) return `#${h}`;
  return color;
}

/** Return alpha 0..1 from any hex form. Non-hex inputs return 1. */
export function getAlpha01(color: string): number {
  const eight = toHex8(color);
  if (!eight.startsWith('#') || eight.length !== 9) return 1;
  const aa = eight.slice(7, 9);
  return parseInt(aa, 16) / 255;
}

/** Replace alpha channel of `color` with `alpha01` (clamped 0..1).
 *  Pass-through for non-hex inputs. */
export function withAlpha01(color: string, alpha01: number): string {
  const a = Math.max(0, Math.min(1, alpha01));
  const aa = Math.round(a * 255).toString(16).padStart(2, '0');
  const eight = toHex8(color);
  if (!eight.startsWith('#') || eight.length !== 9) return color;
  return `${eight.slice(0, 7)}${aa}`;
}

/** Adopt the RGB of `picked` and the alpha of `prev`. If `picked` already
 *  carries an alpha channel (length 9), it is used as-is. */
export function mergeAlphaFromPrev(picked: string, prev: string): string {
  if (picked.length === 9) return picked;
  return withAlpha01(picked, getAlpha01(prev));
}
```

Add test `src/util/color.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { toHex8, getAlpha01, withAlpha01, mergeAlphaFromPrev } from './color';

describe('toHex8', () => {
  it('expands #rgb to #rrggbbff', () => {
    expect(toHex8('#abc')).toBe('#aabbccff');
  });
  it('expands #rgba to #rrggbbaa', () => {
    expect(toHex8('#abcd')).toBe('#aabbccdd');
  });
  it('expands #rrggbb to #rrggbbff', () => {
    expect(toHex8('#aabbcc')).toBe('#aabbccff');
  });
  it('returns #rrggbbaa unchanged', () => {
    expect(toHex8('#aabbccdd')).toBe('#aabbccdd');
  });
  it('passes through non-hex', () => {
    expect(toHex8('rgb(1,2,3)')).toBe('rgb(1,2,3)');
  });
});

describe('getAlpha01', () => {
  it('reads alpha from hex8', () => {
    expect(getAlpha01('#aabbcc80')).toBeCloseTo(0x80 / 255);
  });
  it('returns 1 for hex without alpha', () => {
    expect(getAlpha01('#aabbcc')).toBe(1);
  });
  it('returns 1 for non-hex', () => {
    expect(getAlpha01('red')).toBe(1);
  });
});

describe('withAlpha01', () => {
  it('replaces alpha', () => {
    expect(withAlpha01('#aabbccff', 0.5)).toBe('#aabbcc80');
  });
  it('clamps below 0', () => {
    expect(withAlpha01('#aabbccff', -1)).toBe('#aabbcc00');
  });
  it('clamps above 1', () => {
    expect(withAlpha01('#aabbcc00', 2)).toBe('#aabbccff');
  });
  it('passes through non-hex', () => {
    expect(withAlpha01('red', 0.5)).toBe('red');
  });
});

describe('mergeAlphaFromPrev', () => {
  it('keeps explicit alpha from picked when length is 9', () => {
    expect(mergeAlphaFromPrev('#aabbcc80', '#000000ff')).toBe('#aabbcc80');
  });
  it('borrows alpha from prev when picked is 7-char', () => {
    expect(mergeAlphaFromPrev('#aabbcc', '#11223380')).toBe('#aabbcc80');
  });
});
```

Run:

```bash
npx vitest run src/util/color.test.ts
```

Expected: all pass.

- [ ] **Step 2: Replace the inline helpers in `ActiveSwatches.tsx` with re-exports / imports**

In `apps/draw/src/ActiveSwatches.tsx` (lines 34–74 — `toHex8`, `getAlpha01`, `withAlpha01`, `mergeAlphaFromPrev`), delete the inline definitions and replace with:

```typescript
import { toHex8, getAlpha01, withAlpha01, mergeAlphaFromPrev } from '@orochi235/weasel/util/color';
// (or the actual public path — check apps/draw/src for existing kit imports)
```

If `@orochi235/weasel/util/color` is not a public path, add it to the kit's public exports (look at `package.json` `exports` field or `src/index.ts`). For this task, the safe path is `from '../../../src/util/color'` relative to the file — but match whatever existing kit imports in apps/draw use.

Check existing imports first:

```bash
grep -n "from '@orochi235/weasel\|from '\.\./\.\./\.\./src" apps/draw/src/ActiveSwatches.tsx | head -5
```

If `PropertyColorInput` in `PropertiesPanel.tsx` also has its own copy of `toHex8` / `getAlpha01` / `withAlpha01` (it does — lines 190–220 use them), update its imports too:

```bash
grep -n "toHex8\|getAlpha01\|withAlpha01" apps/draw/src/ui/PropertiesPanel/PropertiesPanel.tsx
```

Replace any inline duplicates with imports from the same kit module.

- [ ] **Step 3: Run app tests to confirm nothing broke**

```bash
npx vitest run apps/draw/
```

Expected: all pass (this was a pure refactor — no behavior change).

- [ ] **Step 4: Write `setFillAction` test first**

Create `src/interactions/actions/defaults/setFill.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { setFillAction } from './setFill';
import type { InvocationCtx, OngoingHandle, BindingOpts } from '../invoker';
import { asNodeId } from 'core/scene/types';
import type { NodeId } from 'core/scene/types';

interface FakeNode { id: NodeId; kind: 'leaf'; pose: unknown; data: { fill?: string; stroke?: string } }

function makeScene(nodes: Record<string, { fill?: string }>) {
  const current: Record<string, FakeNode> = {};
  for (const [id, d] of Object.entries(nodes)) {
    current[id] = { id: asNodeId(id), kind: 'leaf', pose: {}, data: { ...d } };
  }
  const updates: Array<{ id: string; data: unknown }> = [];
  const batches: string[] = [];
  return {
    get: (id: NodeId) => current[id as unknown as string] ?? null,
    update: vi.fn((id: NodeId, patch: { data: unknown }) => {
      updates.push({ id: id as unknown as string, data: patch.data });
      current[id as unknown as string].data = patch.data as never;
    }),
    setPose: vi.fn(),
    batch: vi.fn((label: string, fn: () => void) => { batches.push(label); fn(); }),
    updates,
    batches,
  };
}

function makeSelection(ids: string[]) {
  return {
    get: () => ids.map(asNodeId),
    current: ids.map(asNodeId),
    set: vi.fn(), add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), clear: vi.fn(),
    contains: vi.fn().mockReturnValue(false),
  };
}

function makeCtx(opts: {
  selectionIds: string[];
  scene: ReturnType<typeof makeScene>;
  params?: Record<string, unknown>;
}): InvocationCtx {
  return {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: makeSelection(opts.selectionIds), scene: opts.scene },
    params: opts.params,
  };
}

function getInvoker(): { start: (ctx: InvocationCtx, opts?: BindingOpts) => OngoingHandle } {
  if (setFillAction.invoker?.timing !== 'ongoing') throw new Error('not ongoing');
  return setFillAction.invoker;
}

describe('setFillAction', () => {
  it('returns an empty handle when selection is empty', () => {
    const scene = makeScene({});
    const ctx = makeCtx({ selectionIds: [], scene });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    expect(h).toEqual({});
  });

  it('returns an empty handle when scene is missing', () => {
    const ctx: InvocationCtx = {
      world: { x: 0, y: 0 }, screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { selection: makeSelection(['a']) },
      params: { color: '#ff0000' },
    };
    const h = getInvoker().start(ctx, undefined);
    expect(h).toEqual({});
  });

  it('does not write to scene on start', () => {
    const scene = makeScene({ a: { fill: '#ffffffff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    getInvoker().start(ctx, { params: { color: '#ff0000' } });
    expect(scene.batch).not.toHaveBeenCalled();
    expect(scene.update).not.toHaveBeenCalled();
  });

  it('exposes the current color via previewData during the drag', () => {
    const scene = makeScene({ a: { fill: '#ffffffff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    const preview = h.previewData?.('a' as unknown as NodeId);
    expect(preview).toMatchObject({ fill: '#ff0000ff' });
  });

  it('onMove updates the preview color without touching scene', () => {
    const scene = makeScene({ a: { fill: '#ffffffff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onMove?.({ ...ctx, params: { color: '#00ff00' } });
    expect(h.previewData?.('a' as unknown as NodeId)).toMatchObject({ fill: '#00ff00ff' });
    expect(scene.update).not.toHaveBeenCalled();
  });

  it('onEnd("commit") writes one scene.batch with the final color', () => {
    const scene = makeScene({ a: { fill: '#ffffffff' }, b: { fill: '#000000ff' } });
    const ctx = makeCtx({ selectionIds: ['a', 'b'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onMove?.({ ...ctx, params: { color: '#00ff00' } });
    h.onEnd?.(ctx, 'commit');
    expect(scene.batches).toEqual(['Set fill']);
    expect(scene.updates).toHaveLength(2);
    expect((scene.updates[0].data as { fill: string }).fill).toBe('#00ff00ff');
    expect((scene.updates[1].data as { fill: string }).fill).toBe('#00ff00ff');
  });

  it('onEnd("cancel") does not write to scene', () => {
    const scene = makeScene({ a: { fill: '#ffffffff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onEnd?.(ctx, 'cancel');
    expect(scene.batch).not.toHaveBeenCalled();
    expect(scene.update).not.toHaveBeenCalled();
  });

  it('preserves existing alpha when a 6-char color is supplied', () => {
    const scene = makeScene({ a: { fill: '#11223380' } }); // alpha 0x80
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff0000' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff0000' } });
    h.onEnd?.(ctx, 'commit');
    expect((scene.updates[0].data as { fill: string }).fill).toBe('#ff000080');
  });

  it('uses supplied alpha when an 8-char color is provided', () => {
    const scene = makeScene({ a: { fill: '#11223380' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { color: '#ff000040' } });
    const h = getInvoker().start(ctx, { params: { color: '#ff000040' } });
    h.onEnd?.(ctx, 'commit');
    expect((scene.updates[0].data as { fill: string }).fill).toBe('#ff000040');
  });
});
```

- [ ] **Step 5: Run the test — expect failures (action doesn't exist yet)**

```bash
npx vitest run src/interactions/actions/defaults/setFill.test.ts
```

Expected: import error or all-fail.

- [ ] **Step 6: Implement `setFillAction`**

Create `src/interactions/actions/defaults/setFill.ts`:

```typescript
import type { Action, OngoingHandle, InvocationCtx, BindingOpts } from '../invoker';
import { ActionDisabledReason } from '../registry';
import type { NodeId, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import { mergeAlphaFromPrev } from '../../../util/color';
import type { SelectionApi } from '../../../selection/types';

interface SetFillScratch {
  ids: NodeId[];
  scene: Scene<{ fill?: string }, string, unknown>;
  startData: Map<NodeId, { fill?: string }>;
  currentColor: string;
  previews: Map<NodeId, { fill: string }>;
}

function refreshPreviews(scratch: SetFillScratch): void {
  scratch.previews.clear();
  for (const id of scratch.ids) {
    const prev = scratch.startData.get(id);
    const next = mergeAlphaFromPrev(scratch.currentColor, prev?.fill ?? '#ffffffff');
    scratch.previews.set(id, { ...(prev ?? {}), fill: next });
  }
}

export const setFillAction: Action & { requires: string[] } = {
  id: 'setFill',
  label: 'Set fill',
  requires: ['selection', 'scene'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const selection = ctx.deps.selection as SelectionApi | undefined;
      const scene = ctx.deps.scene as Scene<{ fill?: string }, string, unknown> | undefined;
      if (!selection || !scene) return {};

      const ids = selection.get() as NodeId[];
      if (ids.length === 0) return {};

      const initialColor =
        (ctx.params?.color as string | undefined) ??
        (opts?.params as { color?: string } | undefined)?.color ??
        '#000000ff';

      const startData = new Map<NodeId, { fill?: string }>();
      for (const id of ids) {
        const node = scene.get(id);
        if (node) startData.set(id, { ...(node.data as { fill?: string }) });
      }

      const scratch: SetFillScratch = {
        ids,
        scene,
        startData,
        currentColor: initialColor,
        previews: new Map(),
      };
      refreshPreviews(scratch);

      return {
        onMove(moveCtx: InvocationCtx): void {
          const next = moveCtx.params?.color as string | undefined;
          if (next === undefined) return;
          scratch.currentColor = next;
          refreshPreviews(scratch);
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          if (reason === 'cancel') {
            scratch.previews.clear();
            return;
          }
          scratch.scene.batch('Set fill', () => {
            for (const id of scratch.ids) {
              const prev = scratch.startData.get(id);
              const merged = mergeAlphaFromPrev(scratch.currentColor, prev?.fill ?? '#ffffffff');
              const nodeNow = scratch.scene.get(id);
              if (!nodeNow) continue;
              scratch.scene.update(id, {
                data: { ...(nodeNow.data as object), fill: merged } as never,
              });
            }
          });
          scratch.previews.clear();
        },
        previewIds: () => scratch.previews.keys(),
        previewData: (id: string) => scratch.previews.get(id as unknown as NodeId) ?? null,
      };
    },
  },
  enabled: (deps) => {
    const sel = deps?.selection as SelectionApi | undefined;
    if (!sel || (sel.get() as unknown[]).length === 0) {
      return ActionDisabledReason.SelectionRequired;
    }
    return true;
  },
};
```

**Note on import paths:** `core/scene/types` and `../../../selection/types` are placeholders — match what `move.ts` (`src/interactions/actions/defaults/move.ts`) uses for `Scene`, `NodeId`, `SelectionApi`. Check:

```bash
grep -n "^import" src/interactions/actions/defaults/move.ts | head -10
```

Use the exact same imports.

- [ ] **Step 7: Run the test — expect passes**

```bash
npx vitest run src/interactions/actions/defaults/setFill.test.ts
```

Expected: all 9 pass. Debug and fix until green.

- [ ] **Step 8: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add src/util/color.ts src/util/color.test.ts \
  src/interactions/actions/defaults/setFill.ts \
  src/interactions/actions/defaults/setFill.test.ts \
  apps/draw/src/ActiveSwatches.tsx \
  apps/draw/src/ui/PropertiesPanel/PropertiesPanel.tsx
git commit -m "feat(actions): add setFillAction (ongoing) + share color helpers via kit"
```

---

## Task 5: Create `setStrokeAction` (ongoing)

**Files:**
- Create: `src/interactions/actions/defaults/setStroke.ts`
- Test: `src/interactions/actions/defaults/setStroke.test.ts`

Identical shape to `setFillAction` but operates on `data.stroke` and labels the batch `'Set stroke'`.

- [ ] **Step 1: Write `setStrokeAction` test**

Create `src/interactions/actions/defaults/setStroke.test.ts`. Copy `setFill.test.ts` verbatim, then run:

```bash
sed -i.bak 's/setFillAction/setStrokeAction/g; s/setFill/setStroke/g; s/Set fill/Set stroke/g; s/fill:/stroke:/g; s/\.fill/.stroke/g; s/{ fill\?: string }/{ stroke?: string }/g' src/interactions/actions/defaults/setStroke.test.ts
rm src/interactions/actions/defaults/setStroke.test.ts.bak
```

Then manually read the file and verify:
- The action import path says `'./setStroke'`
- All `fill` references now say `stroke`
- The `'Set fill'` batch label is now `'Set stroke'`
- The fixture default fill `'#ffffffff'` should still be `'#000000ff'` for stroke (the default starting stroke). Update each scene fixture: `{ stroke: '#000000ff' }`.

Specifically, search for any leftover `#ffffffff` and decide case-by-case whether it should become `#000000ff` (stroke default).

- [ ] **Step 2: Run the test — expect failures (action doesn't exist)**

```bash
npx vitest run src/interactions/actions/defaults/setStroke.test.ts
```

- [ ] **Step 3: Implement `setStrokeAction`**

Create `src/interactions/actions/defaults/setStroke.ts`. Copy `setFill.ts` verbatim and apply the same substitutions: `setFillAction` → `setStrokeAction`, `'setFill'` → `'setStroke'`, `'Set fill'` → `'Set stroke'`, `fill` → `stroke`, default `'#ffffffff'` → `'#000000ff'`.

- [ ] **Step 4: Run the test — expect passes**

```bash
npx vitest run src/interactions/actions/defaults/setStroke.test.ts
```

Expected: all pass.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/interactions/actions/defaults/setStroke.ts src/interactions/actions/defaults/setStroke.test.ts
git commit -m "feat(actions): add setStrokeAction (ongoing)"
```

---

## Task 6: Create `setFillOpacityAction` (ongoing)

**Files:**
- Create: `src/interactions/actions/defaults/setFillOpacity.ts`
- Test: `src/interactions/actions/defaults/setFillOpacity.test.ts`

Reads `params.alpha01: number` (0..1). Preserves each node's existing RGB; replaces only the alpha channel via `withAlpha01`.

- [ ] **Step 1: Write the test**

Create `src/interactions/actions/defaults/setFillOpacity.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { setFillOpacityAction } from './setFillOpacity';
import type { InvocationCtx, OngoingHandle, BindingOpts } from '../invoker';
import { asNodeId } from 'core/scene/types';
import type { NodeId } from 'core/scene/types';

function makeScene(nodes: Record<string, { fill?: string }>) {
  const current: Record<string, { id: NodeId; kind: 'leaf'; pose: unknown; data: { fill?: string } }> = {};
  for (const [id, d] of Object.entries(nodes)) {
    current[id] = { id: asNodeId(id), kind: 'leaf', pose: {}, data: { ...d } };
  }
  const updates: Array<{ id: string; data: unknown }> = [];
  const batches: string[] = [];
  return {
    get: (id: NodeId) => current[id as unknown as string] ?? null,
    update: vi.fn((id: NodeId, patch: { data: unknown }) => {
      updates.push({ id: id as unknown as string, data: patch.data });
      current[id as unknown as string].data = patch.data as never;
    }),
    setPose: vi.fn(),
    batch: vi.fn((label: string, fn: () => void) => { batches.push(label); fn(); }),
    updates,
    batches,
  };
}

function makeSelection(ids: string[]) {
  return {
    get: () => ids.map(asNodeId),
    current: ids.map(asNodeId),
    set: vi.fn(), add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), clear: vi.fn(),
    contains: vi.fn().mockReturnValue(false),
  };
}

function makeCtx(opts: {
  selectionIds: string[];
  scene: ReturnType<typeof makeScene>;
  params?: Record<string, unknown>;
}): InvocationCtx {
  return {
    world: { x: 0, y: 0 }, screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: makeSelection(opts.selectionIds), scene: opts.scene },
    params: opts.params,
  };
}

function getInvoker() {
  if (setFillOpacityAction.invoker?.timing !== 'ongoing') throw new Error('not ongoing');
  return setFillOpacityAction.invoker as { start: (ctx: InvocationCtx, opts?: BindingOpts) => OngoingHandle };
}

describe('setFillOpacityAction', () => {
  it('preserves RGB, replaces alpha on commit', () => {
    const scene = makeScene({ a: { fill: '#aabbccff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 0.5 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 0.5 } });
    h.onEnd?.(ctx, 'commit');
    expect(scene.batches).toEqual(['Set fill opacity']);
    expect((scene.updates[0].data as { fill: string }).fill).toBe('#aabbcc80');
  });

  it('clamps alpha01 to [0, 1]', () => {
    const scene = makeScene({ a: { fill: '#aabbccff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 2 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 2 } });
    h.onEnd?.(ctx, 'commit');
    expect((scene.updates[0].data as { fill: string }).fill).toBe('#aabbccff');
  });

  it('returns empty handle when selection is empty', () => {
    const scene = makeScene({});
    const ctx = makeCtx({ selectionIds: [], scene, params: { alpha01: 0.5 } });
    expect(getInvoker().start(ctx, { params: { alpha01: 0.5 } })).toEqual({});
  });

  it('previewData carries the updated alpha during onMove', () => {
    const scene = makeScene({ a: { fill: '#aabbccff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 1 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 1 } });
    h.onMove?.({ ...ctx, params: { alpha01: 0.25 } });
    expect((h.previewData?.('a' as unknown as NodeId) as { fill: string }).fill).toBe('#aabbcc40');
  });

  it('cancel does not write', () => {
    const scene = makeScene({ a: { fill: '#aabbccff' } });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 0.5 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 0.5 } });
    h.onEnd?.(ctx, 'cancel');
    expect(scene.update).not.toHaveBeenCalled();
  });

  it('uses node default fill (#ffffffff) when node.data.fill is absent', () => {
    const scene = makeScene({ a: {} });
    const ctx = makeCtx({ selectionIds: ['a'], scene, params: { alpha01: 0.5 } });
    const h = getInvoker().start(ctx, { params: { alpha01: 0.5 } });
    h.onEnd?.(ctx, 'commit');
    expect((scene.updates[0].data as { fill: string }).fill).toBe('#ffffff80');
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
npx vitest run src/interactions/actions/defaults/setFillOpacity.test.ts
```

- [ ] **Step 3: Implement `setFillOpacityAction`**

Create `src/interactions/actions/defaults/setFillOpacity.ts`:

```typescript
import type { Action, OngoingHandle, InvocationCtx, BindingOpts } from '../invoker';
import { ActionDisabledReason } from '../registry';
import type { NodeId, Scene } from 'core/scene/types';
import { withAlpha01 } from '../../../util/color';
import type { SelectionApi } from '../../../selection/types';

interface SetFillOpacityScratch {
  ids: NodeId[];
  scene: Scene<{ fill?: string }, string, unknown>;
  startData: Map<NodeId, { fill?: string }>;
  currentAlpha: number;
  previews: Map<NodeId, { fill: string }>;
}

function refreshPreviews(scratch: SetFillOpacityScratch): void {
  scratch.previews.clear();
  for (const id of scratch.ids) {
    const prev = scratch.startData.get(id);
    const next = withAlpha01(prev?.fill ?? '#ffffffff', scratch.currentAlpha);
    scratch.previews.set(id, { ...(prev ?? {}), fill: next });
  }
}

export const setFillOpacityAction: Action & { requires: string[] } = {
  id: 'setFillOpacity',
  label: 'Set fill opacity',
  requires: ['selection', 'scene'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const selection = ctx.deps.selection as SelectionApi | undefined;
      const scene = ctx.deps.scene as Scene<{ fill?: string }, string, unknown> | undefined;
      if (!selection || !scene) return {};
      const ids = selection.get() as NodeId[];
      if (ids.length === 0) return {};

      const initialAlpha =
        (ctx.params?.alpha01 as number | undefined) ??
        (opts?.params as { alpha01?: number } | undefined)?.alpha01 ??
        1;

      const startData = new Map<NodeId, { fill?: string }>();
      for (const id of ids) {
        const node = scene.get(id);
        if (node) startData.set(id, { ...(node.data as { fill?: string }) });
      }

      const scratch: SetFillOpacityScratch = {
        ids, scene, startData,
        currentAlpha: initialAlpha,
        previews: new Map(),
      };
      refreshPreviews(scratch);

      return {
        onMove(moveCtx: InvocationCtx): void {
          const next = moveCtx.params?.alpha01 as number | undefined;
          if (next === undefined) return;
          scratch.currentAlpha = next;
          refreshPreviews(scratch);
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          if (reason === 'cancel') { scratch.previews.clear(); return; }
          scratch.scene.batch('Set fill opacity', () => {
            for (const id of scratch.ids) {
              const prev = scratch.startData.get(id);
              const merged = withAlpha01(prev?.fill ?? '#ffffffff', scratch.currentAlpha);
              const nodeNow = scratch.scene.get(id);
              if (!nodeNow) continue;
              scratch.scene.update(id, {
                data: { ...(nodeNow.data as object), fill: merged } as never,
              });
            }
          });
          scratch.previews.clear();
        },
        previewIds: () => scratch.previews.keys(),
        previewData: (id: string) => scratch.previews.get(id as unknown as NodeId) ?? null,
      };
    },
  },
  enabled: (deps) => {
    const sel = deps?.selection as SelectionApi | undefined;
    if (!sel || (sel.get() as unknown[]).length === 0) return ActionDisabledReason.SelectionRequired;
    return true;
  },
};
```

- [ ] **Step 4: Run test**

```bash
npx vitest run src/interactions/actions/defaults/setFillOpacity.test.ts
```

Expected: all pass.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/interactions/actions/defaults/setFillOpacity.ts src/interactions/actions/defaults/setFillOpacity.test.ts
git commit -m "feat(actions): add setFillOpacityAction (ongoing)"
```

---

## Task 7: Create `setStrokeOpacityAction` (ongoing)

**Files:**
- Create: `src/interactions/actions/defaults/setStrokeOpacity.ts`
- Test: `src/interactions/actions/defaults/setStrokeOpacity.test.ts`

Identical shape to `setFillOpacity` but operates on `data.stroke` with batch label `'Set stroke opacity'` and default `'#000000ff'`.

- [ ] **Step 1: Write the test**

Copy `setFillOpacity.test.ts` to `setStrokeOpacity.test.ts`. Apply substitutions:

```bash
sed -i.bak \
  -e 's/setFillOpacityAction/setStrokeOpacityAction/g' \
  -e 's/setFillOpacity/setStrokeOpacity/g' \
  -e 's/Set fill opacity/Set stroke opacity/g' \
  -e 's/{ fill\?: string }/{ stroke?: string }/g' \
  -e 's/\.fill/.stroke/g' \
  -e "s/'#aabbccff'/'#aabbccff'/g" \
  -e "s/'#ffffffff'/'#000000ff'/g" \
  -e "s/'#ffffff80'/'#00000080'/g" \
  src/interactions/actions/defaults/setStrokeOpacity.test.ts
rm src/interactions/actions/defaults/setStrokeOpacity.test.ts.bak
```

Read the result and verify the substitutions are consistent (e.g., the "preserves RGB" test still works against `#aabbccff` stroke and produces `#aabbcc80`).

- [ ] **Step 2: Run — expect failures**

```bash
npx vitest run src/interactions/actions/defaults/setStrokeOpacity.test.ts
```

- [ ] **Step 3: Implement**

Create `src/interactions/actions/defaults/setStrokeOpacity.ts`. Copy `setFillOpacity.ts`, apply: `Fill` → `Stroke`, `fill` → `stroke`, `'Set fill opacity'` → `'Set stroke opacity'`, default `'#ffffffff'` → `'#000000ff'`.

- [ ] **Step 4: Run test**

```bash
npx vitest run src/interactions/actions/defaults/setStrokeOpacity.test.ts
```

Expected: all pass.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/interactions/actions/defaults/setStrokeOpacity.ts src/interactions/actions/defaults/setStrokeOpacity.test.ts
git commit -m "feat(actions): add setStrokeOpacityAction (ongoing)"
```

---

## Task 8: Register the 4 new actions in `useStandardActions`

**Files:**
- Modify: `src/interactions/actions/useStandardActions.ts`

- [ ] **Step 1: Import the 4 new actions**

At the top of `src/interactions/actions/useStandardActions.ts`, add imports next to the existing action imports:

```typescript
import { setFillAction } from './defaults/setFill';
import { setStrokeAction } from './defaults/setStroke';
import { setFillOpacityAction } from './defaults/setFillOpacity';
import { setStrokeOpacityAction } from './defaults/setStrokeOpacity';
```

- [ ] **Step 2: Append to `KIT_STANDARD_DESCRIPTORS`**

Find the `KIT_STANDARD_DESCRIPTORS` array (around lines 98–160). Append the 4 actions at the end:

```typescript
  enterTextEditAction,        // 46
  setFillAction,              // 47
  setStrokeAction,            // 48
  setFillOpacityAction,       // 49
  setStrokeOpacityAction,     // 50
];
```

- [ ] **Step 3: Run the standard-actions test suite**

```bash
npx vitest run src/interactions/actions/useStandardActions.test.ts 2>/dev/null || npx vitest run src/interactions/actions/
```

Expected: all pass. If a test asserts the count of standard actions (e.g., "expect 46 registered"), update it to 50.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/interactions/actions/useStandardActions.ts
git commit -m "feat(actions): register setFill/setStroke/setFillOpacity/setStrokeOpacity in standard descriptors"
```

---

## Task 9: Wire `ActiveSwatches` color inputs through `registry.begin`

**Files:**
- Modify: `apps/draw/src/ActiveSwatches.tsx`

The current swatches at lines 145–167 call `colors.setStroke` / `colors.setFill` (UI state only, no scene write). The scene write happens later via the palette grid in `App.tsx:543–562` calling `colors.applyFillToSelection`. After this task, the swatch's `<input type="color">` will both update UI state AND dispatch the kit action.

**Design note:** keep `colors.setFill` / `setStroke` for the UI state cluster (focused swatch indicator). Add scene-dispatch alongside.

- [ ] **Step 1: Read the current swatch handlers**

Open `apps/draw/src/ActiveSwatches.tsx`. Locate the two `<input type="color">` elements at lines 145–167. Note: each currently dispatches via `colors.setFill` / `colors.setStroke` only.

- [ ] **Step 2: Add registry access**

The component already accepts a `colors` context; it needs the actions registry. Check whether there's an existing hook to get it:

```bash
grep -rn "useActionsRegistry\|useActions\b" apps/draw/src/ src/ | head -10
```

Use the existing hook. If none, the registry is typically provided via context — see how `ColorContextProvider` consumers reach it.

- [ ] **Step 3: Add `begin/update/end` wiring to the fill swatch input**

Replace the fill `<input type="color">` (around line 145–155 — locate the one with `aria-label="Fill color"`) with:

```typescript
{(() => {
  const actions = useActionsRegistry();
  const ctrlRef = useRef<ReturnType<typeof actions.begin>>(null);
  return (
    <input
      type="color"
      value={fillColor}
      onInput={(e) => {
        const v = mergeAlphaFromPrev((e.target as HTMLInputElement).value, fillPrev);
        colors.setFill({ kind: 'solid', color: v });
        if (!ctrlRef.current) {
          ctrlRef.current = actions.begin('setFill', { color: v });
        } else {
          ctrlRef.current.update({ color: v });
        }
      }}
      onChange={(e) => {
        const v = mergeAlphaFromPrev((e.target as HTMLInputElement).value, fillPrev);
        colors.setFill({ kind: 'solid', color: v });
        if (ctrlRef.current) {
          ctrlRef.current.update({ color: v });
          ctrlRef.current.end('commit');
          ctrlRef.current = null;
        }
      }}
      onBlur={() => {
        if (ctrlRef.current) {
          ctrlRef.current.end('commit');
          ctrlRef.current = null;
        }
      }}
      className="wd-swatch-input"
      aria-label="Fill color"
    />
  );
})()}
```

(Refactor the IIFE out into a named subcomponent `FillColorSwatch` if it makes the JSX cleaner — at your discretion.)

**Why both `onInput` and `onChange`:** browsers fire `input` continuously as the user drags inside the picker, `change` on commit (picker close). The auto-commit-on-overlap rule in dispatcher means if `change` happens without a prior `input`, the flow still works.

- [ ] **Step 4: Do the same for the stroke swatch input**

Around line 158–167 (the `aria-label="Stroke color"` input). Same pattern, but `setStroke` action and `colors.setStroke` UI setter.

- [ ] **Step 5: Manual verification (no automated test for this)**

Run the apps/draw dev server:

```bash
npm run dev --workspace=apps/draw
```

(Or wherever it's wired — check `package.json` scripts.)

Open the app, select an object, click the fill swatch, drag inside the native color picker, release. Verify:
- The object's fill updates live (preview rendering via `previewData`).
- One `Ctrl+Z` undoes the entire color change (not one undo per drag tick).
- Stroke swatch works the same.

If preview doesn't update live, check whether `previewData` is actually consumed for the leaf renderer. Look in `SceneCanvas.tsx` for `previewData` usages — line 1219 shows it's read for `livePathFor`, which renders polygon paths. If color changes aren't visible until commit, the renderer's leaf paint path may need to read `previewData` too — note this and surface to the user; do not silently expand scope.

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add apps/draw/src/ActiveSwatches.tsx
git commit -m "refactor(draw): swatch color inputs dispatch setFill/setStroke via registry.begin"
```

---

## Task 10: Wire palette grid (`App.tsx`) through `registry.begin`

**Files:**
- Modify: `apps/draw/src/App.tsx`

The palette grid at `App.tsx:543–562` is a click-to-pick UI (no drag). Each click is one discrete color change → use `begin → end('commit')` immediately, OR use a synthetic single-tick begin/update/end.

- [ ] **Step 1: Read the current palette wiring**

Open `apps/draw/src/App.tsx` lines 543–562. Note: `onChange={(v) => { colors.setFill(...); colors.applyFillToSelection(v); }}`.

- [ ] **Step 2: Replace `applyFillToSelection` / `applyStrokeToSelection` calls**

Replace the palette `<PropertySwatchGrid>` block with:

```typescript
<PropertySwatchGrid
  value={current}
  options={PALETTE}
  columns={10}
  onChange={(v) => {
    colors.setFill({ kind: 'solid', color: v });
    const ctrl = actions.begin('setFill', { color: v });
    ctrl?.end('commit');
  }}
  onAltChange={(v) => {
    colors.setStroke({ kind: 'solid', color: v });
    const ctrl = actions.begin('setStroke', { color: v });
    ctrl?.end('commit');
  }}
  leading={{
    active: colors.fill.kind === 'none',
    title: 'None',
    onClick: () => colors.setFill({ kind: 'none' }),
    onAltClick: () => colors.setStroke({ kind: 'none' }),
  }}
/>
```

`actions` here is the registry from `useActionsRegistry()` — hoist that hook call to the top of the component if not already available.

**Note:** the `onClick`/`onAltClick` for `'none'` is out of scope for this plan — `'none'` semantics live in `colors.setFill`/`setStroke` UI state and don't map cleanly to a color action. Leave them as-is. (The "None" fill clears the swatch but doesn't necessarily mutate selection — verify behavior matches prior to this refactor.)

- [ ] **Step 3: Verify by running the app**

Same as Task 9 Step 5. Click a palette color with selection: object color changes, one undo entry.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/draw/src/App.tsx
git commit -m "refactor(draw): palette grid dispatches setFill/setStroke via registry.begin"
```

---

## Task 11: Wire `PropertyColorInput` through `registry.begin`

**Files:**
- Modify: `apps/draw/src/ui/PropertiesPanel/PropertiesPanel.tsx`
- Modify: `apps/draw/src/App.tsx` (the `<PropertyColorInput>` call sites at lines 453–462)

`PropertyColorInput` currently has two inputs: a `<input type="color">` and a `<input type="range">` (opacity slider). It receives an `onChange(v: string)` callback that callers pass `patchSelection({ fill })` or `patchSelection({ stroke })` to.

This task replaces both inputs' `onChange` with `registry.begin/update/end` flows, parameterized on whether the action is `setFill`/`setStroke` (for the color input) or `setFillOpacity`/`setStrokeOpacity` (for the opacity slider).

- [ ] **Step 1: Change `PropertyColorInput`'s prop shape**

Currently:

```typescript
export function PropertyColorInput(props: {
  value: string;
  onChange: (v: string) => void;
}) { ... }
```

Change to:

```typescript
export function PropertyColorInput(props: {
  value: string;
  /** Action id for the color change (e.g., 'setFill' or 'setStroke'). */
  colorActionId: string;
  /** Action id for the opacity change (e.g., 'setFillOpacity' or 'setStrokeOpacity'). */
  opacityActionId: string;
}) { ... }
```

Remove `onChange`. Inside, get the registry via `useActionsRegistry()`. Wire begin/update/end for both inputs using the pattern from Task 9 Step 3:

```typescript
export function PropertyColorInput(props: {
  value: string;
  colorActionId: string;
  opacityActionId: string;
}) {
  const actions = useActionsRegistry();
  const hex8 = toHex8(props.value);
  const rgb6 = hex8.startsWith('#') && hex8.length >= 7 ? hex8.slice(0, 7) : '#000000';
  const alpha01 = getAlpha01(hex8);
  const alphaPct = Math.round(alpha01 * 100);
  const colorCtrlRef = useRef<ReturnType<typeof actions.begin>>(null);
  const opacityCtrlRef = useRef<ReturnType<typeof actions.begin>>(null);

  return (
    <span className={`${s.colorInputRow} ${s.span12}`}>
      <input
        className={s.colorInput}
        type="color"
        value={rgb6}
        onInput={(e: ChangeEvent<HTMLInputElement>) => {
          const v = e.target.value;
          if (!colorCtrlRef.current) {
            colorCtrlRef.current = actions.begin(props.colorActionId, { color: v });
          } else {
            colorCtrlRef.current.update({ color: v });
          }
        }}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const v = e.target.value;
          if (colorCtrlRef.current) {
            colorCtrlRef.current.update({ color: v });
            colorCtrlRef.current.end('commit');
            colorCtrlRef.current = null;
          } else {
            const ctrl = actions.begin(props.colorActionId, { color: v });
            ctrl?.end('commit');
          }
        }}
        onBlur={() => {
          colorCtrlRef.current?.end('commit');
          colorCtrlRef.current = null;
        }}
      />
      <input
        className={s.alphaRange}
        type="range"
        min={0}
        max={100}
        step={1}
        value={alphaPct}
        title="Opacity"
        aria-label="Opacity"
        onInput={(e: ChangeEvent<HTMLInputElement>) => {
          const a = Number(e.target.value) / 100;
          if (!opacityCtrlRef.current) {
            opacityCtrlRef.current = actions.begin(props.opacityActionId, { alpha01: a });
          } else {
            opacityCtrlRef.current.update({ alpha01: a });
          }
        }}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const a = Number(e.target.value) / 100;
          if (opacityCtrlRef.current) {
            opacityCtrlRef.current.update({ alpha01: a });
            opacityCtrlRef.current.end('commit');
            opacityCtrlRef.current = null;
          } else {
            const ctrl = actions.begin(props.opacityActionId, { alpha01: a });
            ctrl?.end('commit');
          }
        }}
        onBlur={() => {
          opacityCtrlRef.current?.end('commit');
          opacityCtrlRef.current = null;
        }}
      />
      <span className={s.alphaReadout}>{alphaPct}</span>
    </span>
  );
}
```

- [ ] **Step 2: Update the two call sites in `App.tsx`**

Open `apps/draw/src/App.tsx` around lines 453–462. Change:

```typescript
<PropertyColorInput
  value={(firstSelected.data as WeaselDrawData).fill ?? '#000000'}
  onChange={(fill) => patchSelection({ fill })}
/>
```

to:

```typescript
<PropertyColorInput
  value={(firstSelected.data as WeaselDrawData).fill ?? '#000000'}
  colorActionId="setFill"
  opacityActionId="setFillOpacity"
/>
```

And the analogous stroke block:

```typescript
<PropertyColorInput
  value={(firstSelected.data as WeaselDrawData).stroke ?? '#000000'}
  colorActionId="setStroke"
  opacityActionId="setStrokeOpacity"
/>
```

- [ ] **Step 3: Verify by running the app**

Select an object, open the properties panel, drag the opacity slider. Verify:
- Live preview as you drag (object opacity changes live).
- One undo entry covers the whole drag.
- Color picker behaves the same.

- [ ] **Step 4: Typecheck and run app tests**

```bash
npx tsc --noEmit
npx vitest run apps/draw/
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/draw/src/ui/PropertiesPanel/PropertiesPanel.tsx apps/draw/src/App.tsx
git commit -m "refactor(draw): PropertyColorInput dispatches setFill/setStroke/*Opacity actions"
```

---

## Task 12: Remove dead `applyFillToSelection` / `applyStrokeToSelection` / `applyStrokeWidthToSelection` from `ColorContextProvider`

**Files:**
- Modify: `apps/draw/src/tools/colorContext/ColorContextProvider.tsx`
- Modify: `apps/draw/src/tools/colorContext/ColorContextProvider.test.tsx`
- Modify: `apps/draw/src/App.tsx` (drop `updateSelected` prop passed into `<ColorContextProvider>` if it becomes unused)
- Modify: `apps/draw/src/App.tsx` (remove `buildUpdateSelected` if no other caller remains)

After Tasks 9–11, nothing in the app calls `colors.applyFillToSelection` / `applyStrokeToSelection` / `applyStrokeWidthToSelection`. Verify, then delete.

- [ ] **Step 1: Confirm no remaining callers**

```bash
grep -rn "applyFillToSelection\|applyStrokeToSelection\|applyStrokeWidthToSelection" apps/draw/ src/ demo/
```

Expected output: only the definitions in `ColorContextProvider.tsx` itself (and possibly tests in `ColorContextProvider.test.tsx`). If any other caller appears, route it through `registry.begin` first before continuing.

- [ ] **Step 2: Remove the methods from `ColorContextValue` type and the implementation**

In `apps/draw/src/tools/colorContext/ColorContextProvider.tsx`:

1. Remove lines 56–58 (the three `apply*` declarations) from the `ColorContextValue` interface.
2. Remove the `applyFillToSelection` (lines 196–209), `applyStrokeToSelection` (lines 211–218), and `applyStrokeWidthToSelection` (find by grep) implementations.
3. Remove the three properties from the context value passed via `<ColorContext.Provider value={...}>`.
4. Remove the `updateSelected` prop from `ColorContextProvider`'s prop type and its consumer in the function body, if `updateSelected` is no longer used anywhere inside.

```bash
grep -n "updateSelected\|updateSelectedRef" apps/draw/src/tools/colorContext/ColorContextProvider.tsx
```

If `updateSelected` becomes unused, drop it from the prop signature.

- [ ] **Step 3: Remove `<ColorContextProvider updateSelected={...}>` prop in `App.tsx`**

```bash
grep -n "ColorContextProvider\|buildUpdateSelected\|updateSelected" apps/draw/src/App.tsx
```

Drop the `updateSelected` prop from the JSX. If `buildUpdateSelected` (App.tsx:929–967) has no other callers, delete it entirely:

```bash
grep -n "buildUpdateSelected" apps/draw/src/
```

Expected: only the definition. Delete the function.

- [ ] **Step 4: Update `ColorContextProvider.test.tsx`**

```bash
grep -n "applyFillToSelection\|applyStrokeToSelection\|noopUpdateSelected\|makeWrapper" apps/draw/src/tools/colorContext/ColorContextProvider.test.tsx
```

Delete tests that exercise the removed methods. Delete the `noopUpdateSelected` shim if it's no longer referenced. Keep the state-cluster tests (e.g., the `reset` test from the reference file).

- [ ] **Step 5: Run tests**

```bash
npx vitest run apps/draw/src/tools/colorContext/
```

Expected: pass.

- [ ] **Step 6: Verify `patchSelection` no longer handles fill/stroke**

```bash
grep -n "patchSelection" apps/draw/src/App.tsx
```

`patchSelection` (lines 375–388) currently handles `Partial<WeaselDrawData>`, which historically included `fill` and `stroke`. After Task 11, the only remaining callers pass non-color props (path edits, etc.). Verify by listing the call sites:

```bash
grep -rn "patchSelection(" apps/draw/src/
```

For each call site, confirm it passes properties other than `fill`/`stroke`. If `patchSelection` has no remaining callers at all, delete it.

- [ ] **Step 7: Run full app test suite**

```bash
npx vitest run apps/draw/
```

Expected: pass.

- [ ] **Step 8: Run app manually for a regression sweep**

Verify: fill swatch, stroke swatch, palette fill click, palette stroke alt-click, properties panel fill color, properties panel stroke color, properties panel fill opacity slider, properties panel stroke opacity slider — all work, all produce one undo entry per gesture.

- [ ] **Step 9: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 10: Commit**

```bash
git add -A apps/draw/src/
git commit -m "refactor(draw): drop dead color/stroke scene-write paths now that router owns them"
```

---

## Task 13: Final verification — `prepublishOnly` gate

**Files:** none (verification only)

- [ ] **Step 1: Run the same gate CI runs before publish**

```bash
cd /Users/mike/src/weasel/.claude/worktrees/tint-render-layer
npx tsc --noEmit && npx vitest run && npx tsup build
```

Expected: all three steps pass. This catches typechecking gaps in production code that vitest alone wouldn't flag.

- [ ] **Step 2: Manual smoke test in apps/draw**

Run the dev server, exercise the full color/opacity matrix once more:
- Active fill swatch — drag, commit, undo
- Active stroke swatch — drag, commit, undo
- Palette grid — fill click, stroke alt-click, undo each
- Properties panel — fill color, stroke color, fill opacity, stroke opacity, undo each

If preview-during-drag does not work for the leaf paint path (i.e., colors only update on release), note this in the next iteration's todo — the `previewData` consumption may need to extend beyond the polygon-path `livePathFor` reader at `SceneCanvas.tsx:1201–1224`. Report this back to the user before scoping a fix.

- [ ] **Step 3: Report back to user**

Summarize:
- 4 new actions registered, 4 dead app paths removed
- One undo entry per color/opacity gesture (verify by undo count after drag)
- Preview rendering status (working / not working for leaf paint — if not, the gap is at `SceneCanvas`, not at the action layer)

---

## Out of scope (do not implement in this plan)

- Migrating opacity out of hex8 into a separate `fillOpacity`/`strokeOpacity` data field (user explicitly ruled this out — synthesize on the way through actions).
- `strokeWidth` changes (still routed via `patchSelection` if the panel exposes it; analogous action — `setStrokeWidth` — would be a follow-up).
- Wiring the `'none'` fill/stroke state through the router (it's UI-state-only today; would need an action variant or special-case in `setFill` to clear the value).
- `setFocusedAlpha` removal — it's orphaned today and stays orphaned. Routing it would require a "focused paint" concept on the action side. Note as a follow-up.
- Renderer extension to make `previewData` cascade through leaf paint. Verify whether it's needed in Task 13 Step 2; if so, file as a separate plan.
