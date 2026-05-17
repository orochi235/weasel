# Registry unification — Phase 1: Types and skeleton

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the new `Action` / `Invoker` / `GestureSpec` / `GestureBinding` / `ActiveToolContext` type surface as additive extensions to the existing registry, without changing any runtime dispatch behavior. This is the foundation Phase 2+ build on.

**Architecture:** All Phase 1 work is type-shape changes plus a context-provider scaffold. No dispatcher, no porting of existing actions, no behavior changes. The existing `Action.run` field stays untouched (continues to work via existing keybinding dispatch); a new optional `Action.invoker` field opens the door for Phase 2+. The existing `Tool` type gains an optional `bindings` field on the same principle.

**Tech Stack:** TypeScript (strict), Vitest (incl. `expectTypeOf` for type-level assertions), React Context (for `ActiveToolContext` provider scaffold). The spec is at `docs/superpowers/specs/2026-05-16-registry-unification-design.md`.

---

## Prerequisites

Before starting Phase 1:

- Merge `taxonomy-alignment-interactions-reorg` and `taxonomy-alignment-drag-events-consolidation` worktree branches into main. The spec references `ActionBehavior` and the new `src/interactions/actions/<name>/` layout. If those aren't merged, file paths in the tasks below won't resolve.
- Confirm `npm run prepublishOnly` is green on main after the merges.

## File map

Phase 1 creates four new files and modifies three:

**Create:**
- `src/interactions/gestures/spec.ts` — `GestureSpec`, `TargetSpec`, `ModSpec` types + small spec helpers
- `src/interactions/actions/invoker.ts` — `Invoker`, `OngoingHandle`, `InvocationCtx`, `BindingOpts`, `ActionDeps` types
- `src/interactions/actions/binding.ts` — `GestureBinding` type
- `src/interactions/actions/activeToolContext.tsx` — `ActiveToolContextValue` type + `ActiveToolContextProvider` + `useActiveToolContext` hook

**Modify:**
- `src/interactions/actions/registry.tsx` — extend `Action` with optional `invoker?: Invoker` field (existing `run` field preserved)
- `src/tools/types.ts` — extend `Tool` with optional `bindings?: GestureBinding[]` field
- `src/index.ts` — export the new types

**Test files (co-located):**
- `src/interactions/gestures/spec.test.ts`
- `src/interactions/actions/invoker.test.ts`
- `src/interactions/actions/binding.test.ts`
- `src/interactions/actions/activeToolContext.test.tsx`
- Updates to `src/interactions/actions/registry.test.tsx`
- Updates to `src/tools/types.test.ts` (or add one if missing)

## Scope boundaries (what Phase 1 does NOT do)

- Does NOT remove or modify `Action.run`. Existing actions continue to dispatch via `useKeybinding`.
- Does NOT introduce the gesture dispatcher (Phase 3).
- Does NOT port any existing action to use `invoker`.
- Does NOT touch ambient tools (Phase 7).
- Does NOT touch Swill's color context (Phase 8).
- Does NOT modify the tool registry's runtime — only adds optional `bindings` to the `Tool` type.

---

### Task 1: `ModSpec` and `GestureSpec` base types

**Files:**
- Create: `src/interactions/gestures/spec.ts`
- Test: `src/interactions/gestures/spec.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/interactions/gestures/spec.test.ts`:

```ts
import { expectTypeOf, describe, it } from 'vitest';
import type { ModSpec, GestureSpec, KeySpec, KeyHeldSpec, WheelSpec, ClickSpec, DragSpec, MultiTouchSpec } from './spec';

describe('ModSpec', () => {
  it('all fields optional booleans', () => {
    expectTypeOf<ModSpec>().toEqualTypeOf<
      Partial<{ alt: boolean; ctrl: boolean; meta: boolean; shift: boolean }>
    >();
  });
});

describe('GestureSpec', () => {
  it('KeySpec requires key', () => {
    const ok: KeySpec = { kind: 'key', key: 'a' };
    const okWithMods: KeySpec = { kind: 'key', key: 'a', mods: { meta: true } };
    expectTypeOf(ok).toMatchTypeOf<KeySpec>();
    expectTypeOf(okWithMods).toMatchTypeOf<KeySpec>();
  });

  it('KeyHeldSpec is distinct from KeySpec by kind', () => {
    const held: KeyHeldSpec = { kind: 'key-held', key: ' ' };
    expectTypeOf(held).toMatchTypeOf<KeyHeldSpec>();
  });

  it('WheelSpec needs no fields beyond kind + optional mods', () => {
    const ok: WheelSpec = { kind: 'wheel' };
    const withMods: WheelSpec = { kind: 'wheel', mods: { ctrl: true } };
    expectTypeOf(ok).toMatchTypeOf<WheelSpec>();
    expectTypeOf(withMods).toMatchTypeOf<WheelSpec>();
  });

  it('ClickSpec and DragSpec accept optional target', () => {
    const c: ClickSpec = { kind: 'click' };
    const cWithTarget: ClickSpec = { kind: 'click', target: 'selected-body' };
    const d: DragSpec = { kind: 'drag', target: 'kind:rect' };
    expectTypeOf(c).toMatchTypeOf<ClickSpec>();
    expectTypeOf(cWithTarget).toMatchTypeOf<ClickSpec>();
    expectTypeOf(d).toMatchTypeOf<DragSpec>();
  });

  it('MultiTouchSpec requires fingers count', () => {
    const m: MultiTouchSpec = { kind: 'multiTouch', fingers: 2 };
    expectTypeOf(m).toMatchTypeOf<MultiTouchSpec>();
  });

  it('GestureSpec is the union of all kinds', () => {
    const specs: GestureSpec[] = [
      { kind: 'key', key: 'a' },
      { kind: 'key-held', key: ' ' },
      { kind: 'wheel' },
      { kind: 'click' },
      { kind: 'drag' },
      { kind: 'multiTouch', fingers: 2 },
    ];
    expectTypeOf(specs).toMatchTypeOf<GestureSpec[]>();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/interactions/gestures/spec.test.ts`
Expected: FAIL — `Cannot find module './spec'`.

- [ ] **Step 3: Create `src/interactions/gestures/spec.ts` with the types**

```ts
/**
 * GestureSpec — describes the form of a user input event that can fire an action.
 *
 * Used by `Action.defaultBinding` (the action's preferred gesture) and by
 * `GestureBinding.spec` (a tool's binding table entry). The dispatcher matches
 * incoming input events against registered specs to determine which action to
 * invoke.
 *
 * See `docs/superpowers/specs/2026-05-16-registry-unification-design.md` § "Types".
 */

/** Optional modifier-key requirement for a gesture spec. All fields are
 *  optional; an omitted field means "either is acceptable." A `true` means
 *  the modifier MUST be held; `false` means it MUST NOT be held. */
export type ModSpec = Partial<{
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}>;

/** Target selector for click and drag gesture specs. String forms are sugar
 *  for the kit-owned object-kind registry (TODO.md Tier 1 follow-up); until
 *  that ships, consumers can pass `{ kindOf: predicate }` to classify hits
 *  themselves. */
export type TargetSpec =
  | 'empty'
  | 'selected-body'
  | 'unselected-body'
  | `kind:${string}`
  | `kind:${string}:selected`
  | `affordance:${string}`
  | { kindOf: (hit: unknown) => boolean };

/** Single-keystroke gesture (keydown). */
export interface KeySpec {
  kind: 'key';
  key: string;
  mods?: ModSpec;
}

/** Key-held gesture (keydown opens, keyup closes). Drives "hold space for
 *  hand tool"-style interactions. */
export interface KeyHeldSpec {
  kind: 'key-held';
  key: string;
  mods?: ModSpec;
}

/** Wheel-event gesture. */
export interface WheelSpec {
  kind: 'wheel';
  mods?: ModSpec;
}

/** Click gesture (pointerdown + pointerup without movement past the
 *  threshold). */
export interface ClickSpec {
  kind: 'click';
  target?: TargetSpec;
  mods?: ModSpec;
}

/** Drag gesture (pointerdown + pointermove past the threshold). */
export interface DragSpec {
  kind: 'drag';
  target?: TargetSpec;
  mods?: ModSpec;
}

/** Multi-touch gesture. `fingers` is the required touch count. */
export interface MultiTouchSpec {
  kind: 'multiTouch';
  fingers: number;
  mods?: ModSpec;
}

/** The full union of supported gesture spec kinds. New invocation forms
 *  (long-press, two-stage, modal-dialog) extend this union without touching
 *  the `Action` type. */
export type GestureSpec =
  | KeySpec
  | KeyHeldSpec
  | WheelSpec
  | ClickSpec
  | DragSpec
  | MultiTouchSpec;
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/interactions/gestures/spec.test.ts`
Expected: PASS (7 tests).

Run: `npx tsc --noEmit`
Expected: clean (no new errors).

- [ ] **Step 5: Commit**

```bash
git add src/interactions/gestures/spec.ts src/interactions/gestures/spec.test.ts
git commit -m "feat(registry): add GestureSpec types (KeySpec, KeyHeldSpec, WheelSpec, ClickSpec, DragSpec, MultiTouchSpec)"
```

---

### Task 2: `Invoker`, `OngoingHandle`, `InvocationCtx`, `BindingOpts`, `ActionDeps`

**Files:**
- Create: `src/interactions/actions/invoker.ts`
- Test: `src/interactions/actions/invoker.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/interactions/actions/invoker.test.ts`:

```ts
import { describe, it, expectTypeOf } from 'vitest';
import type {
  Invoker,
  ImmediateInvoker,
  OngoingInvoker,
  OngoingHandle,
  InvocationCtx,
  BindingOpts,
  ActionDeps,
} from './invoker';

describe('Invoker', () => {
  it('ImmediateInvoker has timing "immediate" and run', () => {
    const inv: ImmediateInvoker = {
      timing: 'immediate',
      run: (_deps) => {},
    };
    expectTypeOf(inv).toMatchTypeOf<ImmediateInvoker>();
  });

  it('OngoingInvoker has timing "ongoing" and start returning OngoingHandle', () => {
    const inv: OngoingInvoker = {
      timing: 'ongoing',
      start: (_ctx, _opts) => ({
        onMove: (_ctx) => {},
        onEnd: (_ctx, _reason) => {},
      }),
    };
    expectTypeOf(inv).toMatchTypeOf<OngoingInvoker>();
  });

  it('OngoingHandle fields are all optional', () => {
    const empty: OngoingHandle = {};
    const partial: OngoingHandle = { onMove: () => {} };
    const full: OngoingHandle = { onMove: () => {}, onEnd: () => {} };
    expectTypeOf(empty).toMatchTypeOf<OngoingHandle>();
    expectTypeOf(partial).toMatchTypeOf<OngoingHandle>();
    expectTypeOf(full).toMatchTypeOf<OngoingHandle>();
  });

  it('Invoker is the discriminated union', () => {
    const inv: Invoker = {
      timing: 'immediate',
      run: () => {},
    };
    expectTypeOf(inv).toMatchTypeOf<Invoker>();
  });

  it('discriminator narrows correctly', () => {
    const dispatch = (inv: Invoker, deps: ActionDeps) => {
      if (inv.timing === 'immediate') {
        expectTypeOf(inv).toMatchTypeOf<ImmediateInvoker>();
        inv.run(deps);
      } else {
        expectTypeOf(inv).toMatchTypeOf<OngoingInvoker>();
      }
    };
    expect(dispatch).toBeDefined();
  });

  it('InvocationCtx has the documented fields', () => {
    const ctx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    expectTypeOf(ctx).toMatchTypeOf<InvocationCtx>();
  });

  it('BindingOpts has optional behaviors', () => {
    const empty: BindingOpts = {};
    const withBehaviors: BindingOpts = { behaviors: [] };
    expectTypeOf(empty).toMatchTypeOf<BindingOpts>();
    expectTypeOf(withBehaviors).toMatchTypeOf<BindingOpts>();
  });
});

import { expect } from 'vitest';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/interactions/actions/invoker.test.ts`
Expected: FAIL — `Cannot find module './invoker'`.

- [ ] **Step 3: Create `src/interactions/actions/invoker.ts`**

```ts
/**
 * Invoker — pluggable invocation strategy for an Action.
 *
 * An Action's `invoker` field describes how it's run. `immediate` invokers
 * fire once (delete, align, undo). `ongoing` invokers open a phase machine
 * driven by the dispatcher (move, resize, pinch-zoom).
 *
 * See `docs/superpowers/specs/2026-05-16-registry-unification-design.md`
 * § "Types" for the full design.
 */

import type { ActionBehavior } from '../gestures/types';

/** A 2D point in either world or screen coordinates. */
export interface Point2 {
  x: number;
  y: number;
}

/** Modifier-key state at the time of invocation. */
export interface ModifierState {
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

/** Per-invocation runtime context the dispatcher hands to an Invoker.
 *  Gesture-kind-specific fields (`drag`, `wheel`, `multiTouch`, `key`) are
 *  populated only for matching gesture kinds. */
export interface InvocationCtx {
  world: Point2;
  screen: Point2;
  modifiers: ModifierState;
  deps: ActionDeps;
  drag?: { start: Point2; current: Point2; delta: Point2 };
  wheel?: { deltaX: number; deltaY: number; deltaZ: number };
  multiTouch?: { centroid: Point2; spread: number; rotation: number };
  key?: { key: string; repeat: boolean };
}

/** Per-invocation options the dispatcher reads from a `GestureBinding`'s
 *  `opts` field and passes to `OngoingInvoker.start`. Today carries
 *  behaviors; extensible. */
export interface BindingOpts {
  behaviors?: ActionBehavior<unknown, unknown, unknown>[];
}

/** Convention-shaped action dependencies bag. Actions declare which
 *  contexts they consume; the dispatcher composes them per call.
 *  Consumer-side contexts (e.g. ColorContext) plug in by extending. */
export interface ActionDeps {
  // Common kit contexts (all optional; actions consume what they need):
  selection?: unknown;
  view?: unknown;
  scene?: unknown;
  pointer?: unknown;
  activeTool?: unknown;
  // Consumer-side contexts pass through:
  [k: string]: unknown;
}

/** Handle returned from an `OngoingInvoker.start`. The dispatcher pumps
 *  `onMove` on subsequent input events of the same gesture and calls
 *  `onEnd` exactly once (with `'commit'` on natural completion or `'cancel'`
 *  on pointercancel / blur / escape). */
export interface OngoingHandle {
  onMove?(ctx: InvocationCtx): void;
  onEnd?(ctx: InvocationCtx, reason: 'commit' | 'cancel'): void;
}

/** Fire-once invocation. Runs to completion synchronously (or fires off an
 *  async side-effect; the registry doesn't wait). */
export interface ImmediateInvoker {
  timing: 'immediate';
  run(deps: ActionDeps): void;
}

/** Phase-machine invocation. `start` opens the phase and returns the handle
 *  the dispatcher pumps. */
export interface OngoingInvoker {
  timing: 'ongoing';
  start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle;
}

/** Pluggable invocation strategy for an Action. Future variants
 *  (`longPress`, `twoStage`, `modal`) extend this union without touching
 *  the `Action` type. */
export type Invoker = ImmediateInvoker | OngoingInvoker;
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/interactions/actions/invoker.test.ts`
Expected: PASS (7 tests).

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/interactions/actions/invoker.ts src/interactions/actions/invoker.test.ts
git commit -m "feat(registry): add Invoker, OngoingHandle, InvocationCtx, BindingOpts, ActionDeps types"
```

---

### Task 3: `GestureBinding` type

**Files:**
- Create: `src/interactions/actions/binding.ts`
- Test: `src/interactions/actions/binding.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/interactions/actions/binding.test.ts`:

```ts
import { describe, it, expectTypeOf } from 'vitest';
import type { GestureBinding } from './binding';

describe('GestureBinding', () => {
  it('requires spec and actionId; opts optional', () => {
    const minimal: GestureBinding = {
      spec: { kind: 'key', key: 'a' },
      actionId: 'select-all',
    };
    const withOpts: GestureBinding = {
      spec: { kind: 'drag', target: 'selected-body' },
      actionId: 'move',
      opts: { behaviors: [] },
    };
    expectTypeOf(minimal).toMatchTypeOf<GestureBinding>();
    expectTypeOf(withOpts).toMatchTypeOf<GestureBinding>();
  });

  it('accepts every GestureSpec variant via the spec field', () => {
    const bindings: GestureBinding[] = [
      { spec: { kind: 'key', key: 'a' }, actionId: 'x' },
      { spec: { kind: 'key-held', key: ' ' }, actionId: 'x' },
      { spec: { kind: 'wheel' }, actionId: 'x' },
      { spec: { kind: 'click', target: 'empty' }, actionId: 'x' },
      { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'x' },
      { spec: { kind: 'multiTouch', fingers: 2 }, actionId: 'x' },
    ];
    expectTypeOf(bindings).toMatchTypeOf<GestureBinding[]>();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/interactions/actions/binding.test.ts`
Expected: FAIL — `Cannot find module './binding'`.

- [ ] **Step 3: Create `src/interactions/actions/binding.ts`**

```ts
/**
 * GestureBinding — connects a GestureSpec to an Action id (with per-binding
 * options). Tools own arrays of these on their `bindings` field; ambient
 * gesture-bindings are registered globally.
 *
 * See `docs/superpowers/specs/2026-05-16-registry-unification-design.md`.
 */

import type { GestureSpec } from '../gestures/spec';
import type { BindingOpts } from './invoker';

export interface GestureBinding {
  spec: GestureSpec;
  actionId: string;
  opts?: BindingOpts;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/interactions/actions/binding.test.ts`
Expected: PASS (2 tests).

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/interactions/actions/binding.ts src/interactions/actions/binding.test.ts
git commit -m "feat(registry): add GestureBinding type"
```

---

### Task 4: Extend `Action` with optional `invoker` field

**Files:**
- Modify: `src/interactions/actions/registry.tsx` (the `Action` interface declaration, starting at line 24)
- Modify: `src/interactions/actions/registry.test.tsx` (add coexistence test)

- [ ] **Step 1: Write the failing test**

Open `src/interactions/actions/registry.test.tsx` and add a new test block at the end (preserve existing tests):

```ts
import type { Action } from './registry';
import type { Invoker } from './invoker';
import type { GestureSpec } from '../gestures/spec';

describe('Action with new invoker / GestureSpec fields (Phase 1 additive)', () => {
  it('accepts an immediate invoker', () => {
    const action: Action = {
      id: 'demo.immediate',
      label: 'Demo immediate',
      run: () => {},
      invoker: {
        timing: 'immediate',
        run: (_deps) => {},
      },
    };
    expect(action.invoker?.timing).toBe('immediate');
  });

  it('accepts an ongoing invoker', () => {
    const action: Action = {
      id: 'demo.ongoing',
      label: 'Demo ongoing',
      run: () => {},
      invoker: {
        timing: 'ongoing',
        start: () => ({}),
      },
    };
    expect(action.invoker?.timing).toBe('ongoing');
  });

  it('accepts a GestureSpec on defaultBinding', () => {
    const gestureSpec: GestureSpec = { kind: 'wheel', mods: { ctrl: true } };
    const action: Action = {
      id: 'demo.wheel',
      label: 'Demo wheel',
      defaultBinding: gestureSpec,
      run: () => {},
    };
    expect(action.defaultBinding).toEqual({ kind: 'wheel', mods: { ctrl: true } });
  });

  it('legacy KeyBinding shape on defaultBinding still compiles', () => {
    const action: Action = {
      id: 'demo.legacy',
      label: 'Demo legacy',
      defaultBinding: { key: 'a', meta: true },
      run: () => {},
    };
    expect(action.defaultBinding).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/interactions/actions/registry.test.tsx`
Expected: FAIL — type errors on `invoker:` (Action doesn't have that field yet) and on the `GestureSpec`-shaped `defaultBinding`.

- [ ] **Step 3: Modify `src/interactions/actions/registry.tsx`**

Add the imports at the top (alongside existing imports):

```ts
import type { GestureSpec } from '../gestures/spec';
import type { Invoker } from './invoker';
```

Modify the `Action` interface (currently at lines 24–65) — the change is two-fold:
1. Widen `defaultBinding` to accept both the legacy `KeyBinding` and the new `GestureSpec`.
2. Add an optional `invoker` field.

```ts
export interface Action {
  id: string;
  label: string;
  /** v1 (legacy): KeyBinding for keydown-only dispatch.
   *  Phase 1+: GestureSpec for the unified dispatcher.
   *  Both forms accepted during the registry-unification transition;
   *  the gesture dispatcher (Phase 3) reads GestureSpec; the existing
   *  `useKeybinding` reads KeyBinding. */
  defaultBinding?: KeyBinding | GestureSpec;
  icon?: ReactNode | (() => ReactNode);
  group?: string;
  shortcut?: string;
  run: () => void;
  /** Phase 1+: pluggable invocation strategy. When present, the gesture
   *  dispatcher routes matched bindings through `invoker` rather than
   *  calling `run`. When absent, only the legacy `run` path applies.
   *
   *  `run` stays required during the transition (Phases 1–8); Phase 9
   *  deletes it once all actions have migrated to `invoker`. */
  invoker?: Invoker;
  enabled?: () => true | ActionDisabledReason;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/interactions/actions/registry.test.tsx`
Expected: PASS (all existing tests still pass + 4 new ones).

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/interactions/actions/registry.tsx src/interactions/actions/registry.test.tsx
git commit -m "feat(registry): Action gains optional invoker field; defaultBinding accepts GestureSpec"
```

---

### Task 5: `ActiveToolContext` provider scaffold

**Files:**
- Create: `src/interactions/actions/activeToolContext.tsx`
- Test: `src/interactions/actions/activeToolContext.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/interactions/actions/activeToolContext.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import {
  ActiveToolContextProvider,
  useActiveToolContext,
  type ActiveToolContextValue,
} from './activeToolContext';

describe('ActiveToolContext', () => {
  function Probe({ onValue }: { onValue: (v: ActiveToolContextValue) => void }) {
    const value = useActiveToolContext();
    onValue(value);
    return null;
  }

  it('default initialActive is "select"', () => {
    let captured: ActiveToolContextValue | null = null;
    render(
      <ActiveToolContextProvider>
        <Probe onValue={(v) => { captured = v; }} />
      </ActiveToolContextProvider>,
    );
    expect(captured?.active).toBe('select');
    expect(captured?.hotkeyStack).toEqual([]);
  });

  it('initialActive prop overrides the default', () => {
    let captured: ActiveToolContextValue | null = null;
    render(
      <ActiveToolContextProvider initialActive="rect">
        <Probe onValue={(v) => { captured = v; }} />
      </ActiveToolContextProvider>,
    );
    expect(captured?.active).toBe('rect');
  });

  it('setActive updates the active id', () => {
    let captured: ActiveToolContextValue | null = null;
    render(
      <ActiveToolContextProvider>
        <Probe onValue={(v) => { captured = v; }} />
      </ActiveToolContextProvider>,
    );
    act(() => { captured!.setActive('text'); });
    expect(captured?.active).toBe('text');
  });

  it('pushHotkey appends to hotkeyStack; popHotkey removes the top', () => {
    let captured: ActiveToolContextValue | null = null;
    render(
      <ActiveToolContextProvider>
        <Probe onValue={(v) => { captured = v; }} />
      </ActiveToolContextProvider>,
    );
    act(() => { captured!.pushHotkey('hand'); });
    expect(captured?.hotkeyStack).toEqual(['hand']);
    act(() => { captured!.pushHotkey('eyedropper'); });
    expect(captured?.hotkeyStack).toEqual(['hand', 'eyedropper']);
    act(() => { captured!.popHotkey(); });
    expect(captured?.hotkeyStack).toEqual(['hand']);
    act(() => { captured!.popHotkey(); });
    expect(captured?.hotkeyStack).toEqual([]);
  });

  it('popHotkey on empty stack is a safe no-op', () => {
    let captured: ActiveToolContextValue | null = null;
    render(
      <ActiveToolContextProvider>
        <Probe onValue={(v) => { captured = v; }} />
      </ActiveToolContextProvider>,
    );
    act(() => { captured!.popHotkey(); });
    expect(captured?.hotkeyStack).toEqual([]);
  });

  it('useActiveToolContext outside a provider throws a clear error', () => {
    function Bare() {
      useActiveToolContext();
      return null;
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow(/ActiveToolContextProvider/);
    spy.mockRestore();
  });
});

import { vi } from 'vitest';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/interactions/actions/activeToolContext.test.tsx`
Expected: FAIL — `Cannot find module './activeToolContext'`.

- [ ] **Step 3: Create `src/interactions/actions/activeToolContext.tsx`**

```tsx
/**
 * ActiveToolContext — runtime selection state for tools.
 *
 * Holds the currently active tool id and a hotkey stack (tools held active
 * temporarily, e.g. space-for-hand). Read by the gesture dispatcher to
 * determine which tool's bindings are in scope; written by tool-switching
 * actions (`tool.activate:<id>`) and hold-hotkey actions (`tool.hold:<id>`).
 *
 * See `docs/superpowers/specs/2026-05-16-registry-unification-design.md`
 * § "Types" and § "Dispatcher contract".
 */

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

export interface ActiveToolContextValue {
  active: string;
  hotkeyStack: string[];
  setActive(id: string): void;
  pushHotkey(id: string): void;
  popHotkey(): void;
}

const ActiveToolContext = createContext<ActiveToolContextValue | null>(null);

export interface ActiveToolContextProviderProps {
  children: ReactNode;
  initialActive?: string;
}

export function ActiveToolContextProvider({
  children,
  initialActive = 'select',
}: ActiveToolContextProviderProps) {
  const [active, setActiveState] = useState(initialActive);
  const [hotkeyStack, setHotkeyStack] = useState<string[]>([]);

  const setActive = useCallback((id: string) => {
    setActiveState(id);
  }, []);
  const pushHotkey = useCallback((id: string) => {
    setHotkeyStack((s) => [...s, id]);
  }, []);
  const popHotkey = useCallback(() => {
    setHotkeyStack((s) => (s.length === 0 ? s : s.slice(0, -1)));
  }, []);

  const value = useMemo<ActiveToolContextValue>(
    () => ({ active, hotkeyStack, setActive, pushHotkey, popHotkey }),
    [active, hotkeyStack, setActive, pushHotkey, popHotkey],
  );

  return (
    <ActiveToolContext.Provider value={value}>{children}</ActiveToolContext.Provider>
  );
}

export function useActiveToolContext(): ActiveToolContextValue {
  const value = useContext(ActiveToolContext);
  if (value === null) {
    throw new Error(
      'useActiveToolContext: no ActiveToolContextProvider in scope. Wrap your tree with <ActiveToolContextProvider> (typically inside <SceneCanvas>).',
    );
  }
  return value;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/interactions/actions/activeToolContext.test.tsx`
Expected: PASS (6 tests).

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/interactions/actions/activeToolContext.tsx src/interactions/actions/activeToolContext.test.tsx
git commit -m "feat(registry): add ActiveToolContext provider + useActiveToolContext hook"
```

---

### Task 6: Extend `Tool` with optional `bindings` field

**Files:**
- Modify: `src/tools/types.ts`
- Modify or create: `src/tools/types.test.ts` (check whether one exists)

- [ ] **Step 1: Locate the `Tool` type and check for an existing test file**

Run: `grep -n "export interface Tool\|export type Tool\b" /Users/mike/src/weasel/src/tools/types.ts`
Expected: shows the `Tool` interface line.

Run: `ls /Users/mike/src/weasel/src/tools/types.test.ts 2>&1`
Expected: either lists the file (modify) or shows `No such file` (create).

- [ ] **Step 2: Write the failing test**

Add (or create) `src/tools/types.test.ts` with this test (preserve any existing tests if the file already existed). The `Pick` target is what forces the compile-time gap to surface — it strips out the `as unknown` escape hatch:

```ts
import { describe, it, expect, expectTypeOf } from 'vitest';
import type { Tool } from './types';
import type { GestureBinding } from '../interactions/actions/binding';

describe('Tool.bindings (Phase 1 additive)', () => {
  it('bindings field is optional and typed when present', () => {
    const t: Pick<Tool<null>, 'id' | 'bindings'> = {
      id: 'demo',
      bindings: [
        { spec: { kind: 'key', key: 'a' }, actionId: 'select-all' },
      ],
    };
    expect(t.bindings?.length).toBe(1);
  });

  it('bindings accepts an array of GestureBinding', () => {
    const bindings: GestureBinding[] = [
      { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'move' },
      { spec: { kind: 'drag', target: 'affordance:handle:bottom-right' }, actionId: 'resize' },
    ];
    expectTypeOf(bindings).toMatchTypeOf<GestureBinding[]>();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/tools/types.test.ts`
Expected: FAIL — `Property 'bindings' does not exist on type 'Pick<Tool<null>, "id" | "bindings">'` (or the equivalent — TS can't `Pick` a key that doesn't exist on the source).

- [ ] **Step 4: Modify `src/tools/types.ts`**

Add the import near other type imports:

```ts
import type { GestureBinding } from '../interactions/actions/binding';
```

Inside the `Tool` interface declaration, add the optional field (placement: near the existing `presentation` and `cursor` fields — keep alphabetically grouped if the file uses that convention; otherwise group at end):

```ts
  /** Phase 1+ (registry-unification): declarative gesture-bindings the
   *  dispatcher consults while this tool is active. Empty/undefined keeps
   *  legacy imperative-channel behavior. See
   *  `docs/superpowers/specs/2026-05-16-registry-unification-design.md`.
   */
  bindings?: GestureBinding[];
```

- [ ] **Step 5: Run tests to verify pass and commit**

Run: `npx vitest run src/tools/types.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add src/tools/types.ts src/tools/types.test.ts
git commit -m "feat(registry): Tool gains optional bindings field for declarative GestureBindings"
```

---

### Task 7: Barrel exports

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Confirm current barrel structure**

Run: `grep -n "interactions/actions\|interactions/gestures" /Users/mike/src/weasel/src/index.ts | head -20`
Expected: lists existing re-exports from the actions and gestures dirs.

- [ ] **Step 2: Add the new exports**

In `src/index.ts`, add to the appropriate sections (the post-reorg barrel has section headers — find the "Actions registry" and "Gesture/action types" sections):

In the **Gesture/action types** section, after existing exports from `interactions/gestures/types`:

```ts
// ─── Gesture specs (Phase 1 of registry unification) ───
export type {
  ModSpec,
  TargetSpec,
  KeySpec,
  KeyHeldSpec,
  WheelSpec,
  ClickSpec,
  DragSpec,
  MultiTouchSpec,
  GestureSpec,
} from './interactions/gestures/spec';
```

In the **Actions registry** section, after existing re-exports from `interactions/actions/registry`:

```ts
// ─── Invoker / GestureBinding / ActiveToolContext (Phase 1 of registry unification) ───
export type {
  Point2,
  ModifierState,
  InvocationCtx,
  BindingOpts,
  ActionDeps,
  OngoingHandle,
  ImmediateInvoker,
  OngoingInvoker,
  Invoker,
} from './interactions/actions/invoker';
export type { GestureBinding } from './interactions/actions/binding';
export {
  ActiveToolContextProvider,
  useActiveToolContext,
} from './interactions/actions/activeToolContext';
export type {
  ActiveToolContextValue,
  ActiveToolContextProviderProps,
} from './interactions/actions/activeToolContext';
```

- [ ] **Step 3: Verify exports resolve**

Run: `npx tsc --noEmit`
Expected: clean (no missing-export errors).

- [ ] **Step 4: Write a barrel coverage test**

Add to `src/index.barrel.test.ts` (existing file) — or create a new section if the file uses a particular structure (read the file first to match style):

```ts
import * as Weasel from './index';

describe('Phase 1 registry-unification exports', () => {
  it('exposes Phase 1 type and value exports on the main barrel', () => {
    // value-level
    expect(Weasel.ActiveToolContextProvider).toBeDefined();
    expect(Weasel.useActiveToolContext).toBeDefined();
    // (type-only exports compile via the imports above; runtime check not applicable)
  });
});
```

Run: `npx vitest run src/index.barrel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/index.barrel.test.ts
git commit -m "feat(registry): export Phase 1 types (GestureSpec, Invoker, GestureBinding, ActiveToolContext) from main barrel"
```

---

### Task 8: End-to-end Phase 1 verification

**Files:** none modified — verification only.

- [ ] **Step 1: Run the full pre-publish gate**

Run: `npm run prepublishOnly`
Expected: all three gates green —
- `tsc --noEmit`: clean
- `vitest run`: all tests pass (new tests added in Tasks 1–7 included)
- `tsup build`: success

If anything fails, do NOT proceed. Fix the underlying cause. Phase 1's invariant is that the kit ships green with the new surface area additive on top of the existing runtime.

- [ ] **Step 2: Sanity-check that existing Actions registry behavior is unchanged**

Run: `npx vitest run src/interactions/actions/registry.test.tsx src/interactions/actions/registry.conflicts.test.tsx src/interactions/actions/registry.useAction.test.tsx src/interactions/actions/useKeybinding.test.ts src/interactions/actions/resolveActions.test.ts`
Expected: PASS — every existing registry test still passes (the only changes were type widenings; no runtime change).

- [ ] **Step 3: Sanity-check that the demo still builds and runs**

Run: `npm run build:demo`
Expected: success.

(Skip the live `npm run dev` check — Phase 1 has no UI-visible change, so eyeball verification adds no signal.)

- [ ] **Step 4: Document what shipped in the TODO follow-up note**

Open `docs/TODO.md` and edit the "Taxonomy alignment" section's remaining bullet (the "Action vs gesture taxonomy" item — should be the only or one of the only bullets left in the section after the two reorg merges). Add a sub-bullet noting Phase 1 progress:

```
- **Action vs gesture taxonomy: registry unification.** Spec:
  `docs/superpowers/specs/2026-05-16-registry-unification-design.md`.
  Plans per phase under `docs/superpowers/plans/2026-05-16-registry-unification-phase-N.md`.
  Status:
  - Phase 1 (types + skeleton): shipped — additive types only, no runtime change.
  - Phases 2–9: pending.
```

(Match the indentation style of nearby bullets; if the section uses different conventions, adapt.)

- [ ] **Step 5: Commit the doc update**

```bash
git add docs/TODO.md
git commit -m "docs(todo): note Phase 1 of registry unification shipped"
```

---

## Done criteria for Phase 1

- All eight tasks above show green checkboxes.
- `npm run prepublishOnly` is green.
- `npm run build:demo` is green.
- No existing test was deleted or weakened to make a new one pass.
- No runtime behavior changed — Phase 1 is purely additive type surface plus an unused-by-default context provider.
- `docs/TODO.md` reflects Phase 1 shipped.

## Deviation from the original plan (Task 4)

Task 4 as written widened `Action.defaultBinding` to `KeyBinding | GestureSpec`. That broke 7 existing consumers that narrow `defaultBinding as KeyBinding`. The fix (commit `85d5063c`) keeps `defaultBinding?: KeyBinding` unchanged and adds a parallel new field `gestureBinding?: GestureSpec`. Phase 9 deletes legacy `defaultBinding` and renames `gestureBinding` → `defaultBinding`. The end-state Action shape is unchanged from the spec; only the interim shape during Phases 1–8 differs.

## What's next (after Phase 1)

Phase 2 — populate `gestureBinding: GestureSpec` on every existing immediate action (`selectAll`, `escape`, `delete`, …). Pure structural; no behavioral change. Will be its own plan: `docs/superpowers/plans/2026-05-16-registry-unification-phase-2.md`.
