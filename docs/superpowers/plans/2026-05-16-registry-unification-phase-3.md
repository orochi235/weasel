# Registry unification — Phase 3: dep registry + gesture dispatcher

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the gesture dispatcher and dep registry so registered Actions with `gestureBinding` can actually fire end-to-end. Legacy `useKeybinding` still handles actions without `gestureBinding`; the two coexist via a dispatcher-presence context.

**Architecture:** Three pure modules (dep registry, gesture matcher, dispatcher orchestrator) + one React seam (`useGestureDispatcher` hook) + a small coexistence flag. Auto-mount in `<SceneCanvas>`. After this phase, the Phase 2 immediate-action populations (escape, selectAll, delete, …) start dispatching through the new path; the legacy `useKeybinding` step bypasses them.

**Tech Stack:** TypeScript, React, Vitest. Builds on Phase 1 types and Phase 2 populations.

---

## File map

**Create:**
- `src/interactions/actions/depRegistry.tsx` — `DepSchema` (extensible), `DepName`, `DepSourceProvider` component, `useDepRegistry()` hook, `useDepSource()` helper for individual sources.
- `src/interactions/dispatcher/matcher.ts` — pure `matchModifiers`, `matchKey`, `matchSpec(event, spec)`, `matchBest(event, bindings, scope)` returning the winning `(binding, scope)` or null.
- `src/interactions/dispatcher/dispatcher.ts` — pure orchestrator class/module exposing `handleInput(event, ctx)`. Tracks in-flight `OngoingHandle`s in a private `Map<gestureId, OngoingHandle>`. No React, no event listeners.
- `src/interactions/dispatcher/useGestureDispatcher.tsx` — React seam. Reads ActiveToolContext + DepRegistry + action registry; wires window keydown, canvas wheel, `usePointerGestures`, multi-touch; routes each event to `dispatcher.handleInput`.
- `src/interactions/dispatcher/dispatcherPresence.tsx` — tiny React context (`<DispatcherPresenceProvider>`, `useIsDispatcherMounted()`) used for legacy coexistence.
- Tests co-located per file (each `*.ts(x)` gets a `*.test.ts(x)`).

**Modify:**
- `src/interactions/actions/useKeybinding.ts` — read `useIsDispatcherMounted()` + check if the action has `gestureBinding`; bypass legacy dispatch for actions where both conditions are true.
- `src/canvas/SceneCanvas.tsx` (or its tools file) — auto-mount `<DispatcherPresenceProvider>` + `useGestureDispatcher` so consumers get the new path for free.
- `src/index.ts` — barrel-export the new public surface.

**Not modified:**
- Existing action factories — already populated `gestureBinding` in Phase 2; no further changes needed in this phase.
- `Tool.bindings` — stays empty pre-Phase-6. The dispatcher reads from ActiveToolContext but per-tool bindings remain empty until Phase 6+ populates them. Pre-Phase-6, only ambient bindings (from action `gestureBinding`s) fire.

## Scope boundaries

- Does NOT migrate factories to descriptor form (Phase 4).
- Does NOT port ongoing actions (Phase 6+).
- Does NOT touch ambient wrapper-tools (Phase 8).
- Does NOT support `ClickSpec` / `DragSpec` / `MultiTouchSpec` target classification beyond the `{ kindOf: predicate }` escape hatch — string sugar (`kind:rect`, `affordance:handle:*`) is blocked on the object-kind registry. For Phase 3, only `KeySpec`, `KeyHeldSpec`, and `WheelSpec` dispatch is end-to-end load-bearing (since Phase 2 only populated keystroke bindings); the pointer/drag/multitouch paths land structurally but exercise primarily via tests with mocked targets.

## Ambient bindings: where they come from

The dispatcher needs a list of ambient bindings. Source: walk the action registry, collect every action with a non-empty `gestureBinding`; treat each as an ambient binding `{ spec: g, actionId: action.id }`. (For arrays, fan out into multiple bindings.) This is a derived view — no extra registration step.

Per-tool bindings (Phase 6+) come from `tool.bindings` on the active tool's descriptor. Phase 3 reads `Tool.bindings ?? []` (empty pre-Phase-6).

---

### Task 1: Dep registry — types + provider + hook

**Files:**
- Create: `src/interactions/actions/depRegistry.tsx`
- Create: `src/interactions/actions/depRegistry.test.tsx`

The registry uses React state at the React-seam level but exposes a non-React-y `get(name)` for the dispatcher to call at invocation time. Live sources register via the `<DepSourceProvider>` component or the `useDepSource(name, value)` hook (which calls `register` on mount and unregister on unmount).

`DepSchema` is intentionally an `interface` so consumers can extend via declaration merging.

- [ ] **Step 1: Write the failing test**

Create `depRegistry.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import {
  DepRegistryProvider,
  useDepSource,
  useDepRegistry,
  type DepRegistry,
} from './depRegistry';

function CaptureRegistry({ onRegistry }: { onRegistry: (r: DepRegistry) => void }) {
  const r = useDepRegistry();
  onRegistry(r);
  return null;
}

describe('DepRegistry', () => {
  it('initially returns undefined for any name', () => {
    let reg!: DepRegistry;
    render(
      <DepRegistryProvider>
        <CaptureRegistry onRegistry={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    expect(reg.get('selection' as any)).toBeUndefined();
  });

  it('useDepSource registers a live source; get returns latest value', () => {
    let reg!: DepRegistry;
    let value = 1;
    function Source() {
      useDepSource('selection' as any, () => value);
      return null;
    }
    render(
      <DepRegistryProvider>
        <Source />
        <CaptureRegistry onRegistry={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    expect(reg.get('selection' as any)).toBe(1);
    act(() => { value = 42; });
    expect(reg.get('selection' as any)).toBe(42);
  });

  it('unmounting a source removes it from the registry', () => {
    let reg!: DepRegistry;
    function Source() {
      useDepSource('selection' as any, () => 'live');
      return null;
    }
    function Holder({ withSource }: { withSource: boolean }) {
      return <>{withSource && <Source />}<CaptureRegistry onRegistry={(r) => { reg = r; }} /></>;
    }
    const { rerender } = render(
      <DepRegistryProvider><Holder withSource={true} /></DepRegistryProvider>,
    );
    expect(reg.get('selection' as any)).toBe('live');
    rerender(<DepRegistryProvider><Holder withSource={false} /></DepRegistryProvider>);
    expect(reg.get('selection' as any)).toBeUndefined();
  });

  it('useDepRegistry outside provider throws a clear error', () => {
    expect(() => render(<CaptureRegistry onRegistry={() => {}} />)).toThrow(/DepRegistryProvider/);
  });
});
```

(The `as any` casts on `'selection'` are because Phase 3 doesn't fill in concrete `DepSchema` entries yet — the central interface is empty at this point. Consumers / later phases declaration-merge to add named deps.)

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/interactions/actions/depRegistry.test.tsx` — expect FAIL (module missing).

- [ ] **Step 3: Implement `depRegistry.tsx`**

```tsx
/**
 * Dep registry — Phase 3 of registry unification.
 *
 * Holds named "live source" thunks. Actions declare `requires: ['selection']`;
 * the dispatcher calls `registry.get('selection')` at invocation time to
 * build a typed Deps bag.
 *
 * `DepSchema` is intentionally an empty interface so consumers (apps,
 * features) augment it via declaration merging. The kit ships extensions
 * for `selection`, `view`, etc. as feature modules land.
 */
import {
  createContext, useContext, useEffect, useMemo, useRef,
  type ReactNode,
} from 'react';

// Empty by design — see module JSDoc. Phase 4+ extend via declaration merging.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DepSchema {}
export type DepName = keyof DepSchema;

export interface DepRegistry {
  register<K extends DepName>(name: K, source: () => DepSchema[K]): () => void;
  get<K extends DepName>(name: K): DepSchema[K] | undefined;
}

const DepRegistryContext = createContext<DepRegistry | null>(null);

export function DepRegistryProvider({ children }: { children: ReactNode }) {
  const sourcesRef = useRef<Map<DepName, () => unknown>>(new Map());

  const registry = useMemo<DepRegistry>(() => ({
    register: <K extends DepName>(name: K, source: () => DepSchema[K]) => {
      sourcesRef.current.set(name, source as () => unknown);
      return () => { sourcesRef.current.delete(name); };
    },
    get: <K extends DepName>(name: K) =>
      sourcesRef.current.get(name)?.() as DepSchema[K] | undefined,
  }), []);

  return <DepRegistryContext.Provider value={registry}>{children}</DepRegistryContext.Provider>;
}

export function useDepRegistry(): DepRegistry {
  const r = useContext(DepRegistryContext);
  if (r === null) {
    throw new Error('useDepRegistry: no DepRegistryProvider in scope. Wrap your tree with <DepRegistryProvider> (typically inside <SceneCanvas>).');
  }
  return r;
}

/** Register a live source for `name` for the lifetime of the calling
 *  component. The `source` thunk is called at dispatch time and should
 *  return the latest value. */
export function useDepSource<K extends DepName>(name: K, source: () => DepSchema[K]) {
  const registry = useDepRegistry();
  const sourceRef = useRef(source);
  sourceRef.current = source;
  useEffect(() => {
    return registry.register(name, () => sourceRef.current());
  }, [name, registry]);
}
```

- [ ] **Step 4: Verify pass + tsc clean**

```
npx vitest run src/interactions/actions/depRegistry.test.tsx
npx tsc --noEmit
```

Expected: 4 tests pass; tsc clean.

- [ ] **Step 5: Commit**

```
git add src/interactions/actions/depRegistry.tsx src/interactions/actions/depRegistry.test.tsx
git commit -m "feat(registry): add DepRegistry — typed dep sources for action invocation"
```

---

### Task 2: Pure gesture matcher

**Files:**
- Create: `src/interactions/dispatcher/matcher.ts`
- Create: `src/interactions/dispatcher/matcher.test.ts`

Pure functions, no React, no state. The dispatcher uses these to decide which binding (if any) a given input event triggers.

**API surface:**

```ts
export function matchModifiers(event: { altKey, ctrlKey, metaKey, shiftKey }, spec: ModSpec | undefined, isMac: boolean): boolean;
export function matchKey(eventKey: string, specKey: string | string[]): boolean;
export function matchSpec(event: InputEvent, spec: GestureSpec, isMac: boolean): boolean;
export function matchBest(
  event: InputEvent,
  bindings: { spec: GestureSpec; scope: 'ambient' | 'active' | 'hotkey'; ref: GestureBinding }[],
  isMac: boolean,
): { binding: GestureBinding; scope: 'ambient' | 'active' | 'hotkey' } | null;
```

`InputEvent` is a discriminated union of normalized event shapes (`{ kind: 'key'; … }`, `{ kind: 'wheel'; … }`, `{ kind: 'pointerdown'; … }`, etc.) the React seam (Task 4) hands to `matchBest`.

**Matching rules:**

- **Modifiers**: strict per Q1 decision. Omitted modifier MUST NOT be held. `'optional'` (shift only) accepts either. `mod: true` matches `metaKey` on mac or `ctrlKey` elsewhere.
- **Key**: case-insensitive; array form ORs the keys.
- **Precedence (matchBest)**: `hotkey > active > ambient`. Within a scope, more-specific-target wins (per Q2 user decision). Defer the target-specificity ranking until Task 3 — for Task 2, within-scope tie-breaker is declaration order (first-registered wins).

- [ ] **Step 1: Failing tests** in `matcher.test.ts`. Sketch (write all explicitly in the test file):

```ts
describe('matchModifiers (strict)', () => {
  // omitted = must be absent
  // explicit true = must be held
  // shift 'optional' = either acceptable
  // mod shorthand = metaKey on mac, ctrlKey elsewhere
  // (8+ tests covering each cell)
});

describe('matchKey', () => {
  // single key, case-insensitive
  // array of keys, any matches
});

describe('matchSpec', () => {
  // KeySpec dispatched to matchKey + matchModifiers
  // KeyHeldSpec — same as KeySpec but only on keydown events of held nature
  // WheelSpec — modifier check only
  // ClickSpec / DragSpec / MultiTouchSpec — structural test stubs (Task 3 fills in)
});

describe('matchBest', () => {
  // returns null when no bindings match
  // precedence: hotkey > active > ambient when multiple match
  // within scope: first declared wins (Task 3 adds target specificity)
});
```

- [ ] **Step 2: Implement `matcher.ts`** with the API above. Use strict modifier semantics per `docs/superpowers/specs/2026-05-16-registry-unification-design.md` § "Types — full surface" ModSpec note.

- [ ] **Step 3: Verify** all matcher tests pass; tsc clean.

- [ ] **Step 4: Commit**

```
git add src/interactions/dispatcher/matcher.ts src/interactions/dispatcher/matcher.test.ts
git commit -m "feat(dispatcher): add pure GestureSpec matcher (strict modifier semantics)"
```

---

### Task 3: Dispatcher orchestrator (pure)

**Files:**
- Create: `src/interactions/dispatcher/dispatcher.ts`
- Create: `src/interactions/dispatcher/dispatcher.test.ts`

The orchestrator is the heart of the dispatcher. Pure module (no React, no event listeners) so it can be tested directly with synthesized events. The React seam (Task 4) wires it to real input.

**API:**

```ts
export interface DispatcherContext {
  actions: ActionsRegistry;
  depRegistry: DepRegistry;
  activeToolId: string;
  hotkeyStack: readonly string[];
  toolsById: ReadonlyMap<string, Tool>;
  // ambient bindings derived from actions registry — walk action.gestureBinding
  ambientBindings: readonly { binding: GestureBinding; action: Action }[];
  isMac: boolean;
}

export interface Dispatcher {
  handleInput(event: InputEvent, ctx: DispatcherContext): 'handled' | 'unhandled';
  cancelAll(reason: 'commit' | 'cancel'): void;
  inFlight(): ReadonlyMap<string, OngoingHandle>;
}

export function createDispatcher(): Dispatcher;
```

Responsibilities:

1. **Scope assembly.** Combine ambient + active-tool bindings + hotkey-stack tool bindings; each tagged with its scope and source action.
2. **Match.** Call `matchBest` from Task 2.
3. **Enabled gate.** Skip if `action.enabled?(deps)` returns false / disabled-reason.
4. **Invoke.**
   - Immediate: build deps bag from action's `requires` via depRegistry, call `invoker.run(deps)`.
   - Ongoing: build deps + InvocationCtx, call `invoker.start(ctx, opts)`, store handle keyed by a synthesized `gestureId` (e.g. `pointer-${pointerId}` or `key-held-${key}`).
5. **Pump.** On follow-up events of the same gesture (pointermove, keyup, etc.), look up the handle and call `onMove` / `onEnd`. Released handles are removed.
6. **Cleanup.** `cancelAll('cancel')` for emergency stop (tool switch per Q2 — Phase 5 wires this).

**Coexistence prep:** for now, immediate actions whose `gestureBinding` is set AND have a matching legacy `defaultBinding` get fired here. Task 5 wires the legacy bypass.

- [ ] **Step 1: Failing tests** in `dispatcher.test.ts`. Coverage:

  - Scope precedence: hotkey beats active beats ambient when same spec is bound in multiple scopes.
  - Immediate dispatch: matched binding calls `invoker.run` with composed deps from depRegistry.
  - Enabled gate: when `enabled()` returns disabled, the action does not run.
  - Ongoing dispatch: `pointerdown` calls `invoker.start`; subsequent `pointermove` calls `onMove`; `pointerup` calls `onEnd('commit')`; `pointercancel` calls `onEnd('cancel')`.
  - Handle map: `inFlight()` reflects active handles; cleared after onEnd.
  - cancelAll: in-flight handles receive `onEnd('cancel')`; map cleared.

- [ ] **Step 2: Implement `dispatcher.ts`.**

- [ ] **Step 3: Verify; commit.**

```
git add src/interactions/dispatcher/dispatcher.ts src/interactions/dispatcher/dispatcher.test.ts
git commit -m "feat(dispatcher): add pure orchestrator — scope assembly, dispatch, ongoing-handle tracking"
```

---

### Task 4: React seam — `useGestureDispatcher`

**Files:**
- Create: `src/interactions/dispatcher/useGestureDispatcher.tsx`
- Create: `src/interactions/dispatcher/useGestureDispatcher.test.tsx`

The hook ties everything together. Per Q4 decisions:
- (α) hook, not module.
- Listener placement per event class: window for key; canvas for wheel/pointer/multi-touch.
- Composes `usePointerGestures` (already exists) for pointer normalization; window keydown listener inlined; canvas wheel listener inlined; multi-touch via raw PointerEvent collection (or compose with `usePinchGesture` if its shape fits — read first).
- Side-effect only (no return value).
- Standalone hook + auto-mount in `<SceneCanvas>` (Task 6).

**Signature:**

```ts
useGestureDispatcher(options: {
  canvasRef: RefObject<HTMLCanvasElement>;
  actions: ActionsRegistry;
  toolsById: ReadonlyMap<string, Tool>;
  // ActiveToolContext read internally via useActiveToolContext()
  // DepRegistry read internally via useDepRegistry()
  enabled?: boolean; // default true; opt-out for tests / disabled-mode demos
}): void;
```

Implementation outline:
- Mount a `<DispatcherPresenceProvider>` so legacy `useKeybinding` can detect us (Task 5).
- Compute ambient bindings derived from `actions` walking each action's `gestureBinding`.
- Use a `useRef` for the `Dispatcher` instance from Task 3.
- `useEffect` to attach window keydown / canvas wheel / canvas pointer / canvas touch listeners; each normalizes the event into the `InputEvent` shape and calls `dispatcher.handleInput(event, ctx)`.
- `ctx` is rebuilt per call (lightweight — it's mostly refs and registry lookups).
- Cleanup on unmount: detach listeners; `dispatcher.cancelAll('cancel')`.

- [ ] **Step 1: Failing tests.** Render a tree with `<DepRegistryProvider>`, `<ActiveToolContextProvider>`, `<ActionsProvider>`. Register a probe action with `gestureBinding: { kind: 'key', key: 'a' }`. Dispatch a keydown event on the window. Assert the probe's `run` was called.

  Cover: keydown firing immediate action; cleanup on unmount; `enabled: false` opts out.

- [ ] **Step 2: Implement.** Lean on `usePointerGestures` for pointer normalization to avoid rebuilding that logic.

- [ ] **Step 3: Verify + commit.**

```
git add src/interactions/dispatcher/useGestureDispatcher.tsx src/interactions/dispatcher/useGestureDispatcher.test.tsx
git commit -m "feat(dispatcher): add useGestureDispatcher hook — React seam over the pure orchestrator"
```

---

### Task 5: Legacy coexistence — dispatcher-presence context

**Files:**
- Create: `src/interactions/dispatcher/dispatcherPresence.tsx`
- Create: `src/interactions/dispatcher/dispatcherPresence.test.tsx`
- Modify: `src/interactions/actions/useKeybinding.ts`

**Module:**

```tsx
const DispatcherPresenceContext = createContext(false);

export function DispatcherPresenceProvider({ children }: { children: ReactNode }) {
  return <DispatcherPresenceContext.Provider value={true}>{children}</DispatcherPresenceContext.Provider>;
}

export function useIsDispatcherMounted(): boolean {
  return useContext(DispatcherPresenceContext);
}
```

**Modification to `useKeybinding`:** add a top-of-hook check. If `useIsDispatcherMounted()` is true AND the calling action (passed via a new optional `actionId` parameter, or the caller passes in a check) has a `gestureBinding` set, the hook skips attaching its listener. Otherwise behavior is unchanged.

Actually — simpler approach: extend `useKeybinding({ ..., disabledIfDispatcherActive: boolean })` so callers (specifically, the `ActionsRegistry`'s internal keybinding wiring) can opt into the coexistence check. Default `false` for backwards compat. The registry's internal hook that wires each action's `defaultBinding` passes `disabledIfDispatcherActive: !!action.gestureBinding` per action.

Wiring concretely: in `registry.tsx`, the keybinding subscription for each action is gated. Read the current implementation first to find the exact integration point.

- [ ] **Step 1: Failing tests.** Cover:
  - With no dispatcher mounted: legacy `useKeybinding` fires as before.
  - With dispatcher mounted + action has `gestureBinding`: legacy bypass — keydown does NOT fire the legacy listener (only the dispatcher's path).
  - With dispatcher mounted + action has NO `gestureBinding`: legacy still fires.

- [ ] **Step 2: Implement.** Add the presence context + extend the keybinding integration. Be minimal — touch as little of registry.tsx as possible.

- [ ] **Step 3: Verify + commit.**

```
git add src/interactions/dispatcher/dispatcherPresence.tsx src/interactions/dispatcher/dispatcherPresence.test.tsx src/interactions/actions/useKeybinding.ts src/interactions/actions/registry.tsx
git commit -m "feat(dispatcher): wire legacy useKeybinding coexistence via DispatcherPresence context"
```

---

### Task 6: Auto-mount in `<SceneCanvas>`

**Files:**
- Modify: `src/canvas/SceneCanvas.tsx` (or wherever `<SceneCanvas>` lives)
- Update: relevant tests in `src/canvas/SceneCanvas.tools.test.tsx` (or add a new test file)

`<SceneCanvas>` wraps its children with:
- `<DepRegistryProvider>` (if not already in scope — detect via a no-throw probe or just always wrap)
- `<ActiveToolContextProvider>` (Phase 1 already shipped this; check whether SceneCanvas already auto-wraps; if not, do so here)
- Internally calls `useGestureDispatcher` with the canvas ref + actions registry + tools map

The dispatcher is enabled by default; opt-out via a new prop `enableGestureDispatcher?: boolean = true` (mirroring the existing `enableKeybindings` pattern from Phase 1's `SceneCanvas` work).

- [ ] **Step 1: Failing test.** Smoke test that mounting a `<SceneCanvas>` with a registered action `{ id: 'demo', gestureBinding: { kind: 'key', key: 'a' }, run: spy }` and dispatching a window keydown for 'a' calls `spy`.

- [ ] **Step 2: Implement.** Read `SceneCanvas.tsx` first to find the right insertion point (likely near the existing keybinding wiring).

- [ ] **Step 3: Verify + commit.**

```
git add src/canvas/SceneCanvas.tsx src/canvas/SceneCanvas.tools.test.tsx
git commit -m "feat(dispatcher): auto-mount gesture dispatcher in <SceneCanvas>"
```

---

### Task 7: Barrel + end-to-end verification

**Files:**
- Modify: `src/index.ts`
- Modify: `docs/TODO.md`

**Barrel additions (in the appropriate sections):**

```ts
// ─── Dep registry (Phase 3 of registry unification) ───
export {
  DepRegistryProvider,
  useDepRegistry,
  useDepSource,
} from './interactions/actions/depRegistry';
export type {
  DepSchema,
  DepName,
  DepRegistry,
} from './interactions/actions/depRegistry';

// ─── Gesture dispatcher (Phase 3 of registry unification) ───
export {
  useGestureDispatcher,
  DispatcherPresenceProvider,
  useIsDispatcherMounted,
} from './interactions/dispatcher';
export type {
  Dispatcher,
  DispatcherContext,
  InputEvent,
} from './interactions/dispatcher';
```

(Create or update `src/interactions/dispatcher/index.ts` to re-export the relevant names.)

- [ ] **Step 1: Add barrel exports + a tiny barrel parity test.**
- [ ] **Step 2: Run full gate.** `npm run prepublishOnly` — expect green. `npm run build:demo` — expect green.
- [ ] **Step 3: Smoke-test the end-to-end path manually** by spinning up the dev server briefly and confirming an existing keybinding (e.g. Cmd-A select-all in any demo) still fires. (Optional but worth doing once.)
- [ ] **Step 4: Update `docs/TODO.md`** — extend the Phase status block:

```
- Phase 3 (dispatcher + dep registry): shipped 2026-05-16 — gesture dispatcher built; immediate actions with gestureBinding now dispatch through the new path; legacy useKeybinding coexists via DispatcherPresence context. No user-facing behavior change.
```

- [ ] **Step 5: Commit.**

```
git add src/index.ts src/interactions/dispatcher/index.ts docs/TODO.md
git commit -m "docs+barrel(registry): export Phase 3 dispatcher surface; note shipped"
```

---

## Done criteria for Phase 3

- All seven tasks complete.
- `npm run prepublishOnly` green.
- `npm run build:demo` green.
- An existing immediate-action keybinding (e.g. `Backspace`, `Escape`, `Cmd-A`) still fires when used in any demo — the dispatch path moved to the new dispatcher (verified via Task 5's coexistence tests).
- No existing test was deleted or weakened to make a new one pass.

## Risks / open items

- **DepRegistry typing under empty initial schema.** Phase 3 ships `DepSchema` as an empty interface. Until Phase 4 adds entries via declaration merging, the type `DepName` is `never`, which makes `register/get` call sites need casts. The Task 1 test uses `as any`. This is fine for Phase 3 (the dispatcher doesn't use deps until Phase 4 migrates factories), but may surface awkwardness — flag if so.
- **Pointer/drag/multitouch testing depth.** Phase 3 lands the structural support but only keystroke + wheel are exercised end-to-end (because Phase 2 only populated keystroke bindings). Pointer/drag/multitouch paths are covered by Tasks 2 and 3 with synthesized events; Tasks 4–6 may have light coverage for these. Phase 6 (port `move`) is the real validation.
- **`isMac` detection.** Decide where this comes from — `navigator.userAgent` sniff, a constant injected via context, an option to the dispatcher. Read existing kit precedent first (probably already established).
- **Hotkey-stack tool cancellation (Q2).** When the active tool changes, `dispatcher.cancelAll('cancel')` should be called. Phase 5 (ActiveToolContext migration) wires this; Phase 3 just exposes the `cancelAll` method.

## What's next

Phase 4 — migrate the 9 existing immediate-action factories from closure-style to descriptor form using the dep registry. Apply parametric-action compression (nudge 8→4, reorder 4→2, flip 2→1) per the spec's § "Parametric actions". Will be its own plan.
