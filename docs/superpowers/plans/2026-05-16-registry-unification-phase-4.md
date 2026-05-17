# Registry unification — Phase 4: migrate factories to descriptor form + parametric compression

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the 9 existing default-action factories from closure-style (`defaultEscapeAction(deps)`) to pure descriptors (`escapeAction: Action<['selection']>`) using Phase 3's dep registry. Apply parametric-action compression where indicated (`nudge` 8→4, `reorder` 4→2, `flip` 2→1).

**Architecture:** Build a central `DepSchema` augmentation for kit-standard deps. Rewrite each factory to a pure static descriptor that reads from the deps bag at invocation time. `useStandardActions` keeps its external API but internally registers dep sources with the registry instead of closure-passing them to factories. Per-action `XDeps` interfaces collapse into the central schema.

**Tech Stack:** TypeScript, Vitest. Builds on Phases 1–3.

---

## Prerequisites

Phase 3 must be shipped on main (DepRegistry + dispatcher exist). Verify:
```
grep -q "DepRegistryProvider" src/index.ts && grep -q "useGestureDispatcher" src/index.ts
```
Both should return success.

## File map

**Create:**
- `src/interactions/actions/depSchema.ts` — central `DepSchema` declaration-merging augmentation for kit-standard deps (`selection`, `view`, `scene`, `history`, `pointer`, `activeTool`).

**Modify (each factory → descriptor):**
- `src/interactions/actions/defaults/escape.ts` + test
- `src/interactions/actions/defaults/selectAll.ts` + test
- `src/interactions/actions/defaults/duplicate.ts` + test
- `src/interactions/actions/defaults/delete.ts` + test
- `src/interactions/actions/defaults/group.ts` + test (group + ungroup, no compression)
- `src/interactions/actions/defaults/undoRedo.ts` + test (no compression)
- `src/interactions/actions/defaults/align.tsx` + test (no compression — 6 stay)
- `src/interactions/actions/defaults/distribute.tsx` + test (no compression — 2 stay)
- `src/interactions/actions/defaults/booleans.tsx` + test (no compression — 6 stay)

**Modify (with parametric compression):**
- `src/interactions/actions/defaults/flip.ts` + test (2 → 1)
- `src/interactions/actions/defaults/reorder.ts` + test (4 → 2)
- `src/interactions/actions/defaults/nudge.ts` + test (8 → 4)

**Modify (internal restructure, external API preserved):**
- `src/interactions/actions/useStandardActions.ts` + test — register dep sources instead of constructing factories.

**Modify (barrel cleanup):**
- `src/index.ts` — the `XDeps` interface exports (`SelectAllDeps`, `EscapeDeps`, etc.) get removed once factories are pure descriptors.

## DepSchema entries

Phase 4 Task 1 augments `DepSchema` with these kit-standard names:

| Name | Type | Provided by |
|---|---|---|
| `selection` | `SelectionApi` | `useStandardActions({ selection })` |
| `view` | `{ get(): View; set(v: View): void }` (or whatever the canonical View setter API is — read kit) | `useStandardActions({ view })` |
| `scene` | `SceneApi` | `useStandardActions({ scene })` or `<SceneCanvas>` directly |
| `history` | `History` | `<SceneCanvas>` or `useUndoRedo`-style deps |
| `pointer` | `PointerContextValue` (already exists) | `<PointerContextProvider>` |
| `activeTool` | `ActiveToolContextValue` (Phase 1) | `<ActiveToolContextProvider>` |

If a kit-canonical type doesn't yet exist for one of these (e.g. a `ViewApi`), Task 1 defines the minimum surface and Phase 5+ can refine.

## BindingOpts.params extension

The parametric-compression tasks (T4 / T5 / T6) need per-binding params. Extend `BindingOpts` (in `src/interactions/actions/invoker.ts`) once at the start of Task 4 (the first parametric task that needs it):

```ts
export interface BindingOpts {
  behaviors?: ActionBehavior<unknown, unknown, unknown>[];
  /** Phase 4+: per-binding action parameters. The action's invoker reads
   *  these via `opts.params.<key>`. Loose typing (Record<string, unknown>)
   *  for now; consider per-action typing later via BindingOpts<A>. */
  params?: Record<string, unknown>;
}
```

Update the existing test for `BindingOpts` to cover the new field.

## Scope boundaries

- Does NOT modify Phase 3's dispatcher or dep registry implementation (only adds DepSchema entries).
- Does NOT touch ongoing-action ports (Phase 6+).
- Does NOT change action ids except where parametric compression collapses them (documented per task).
- Preserves `useStandardActions`'s external API — consumers pass the same `deps` object; the hook restructures internally.

---

### Task 1: `DepSchema` augmentation for kit-standard deps

**Files:**
- Create: `src/interactions/actions/depSchema.ts`
- Create: `src/interactions/actions/depSchema.test.ts`

- [ ] **Step 1: Read the canonical APIs.** Look up the exact shape of `SelectionApi` (from `src/core/selection/useSelection.ts`), `History` (`src/core/history/...`), `SceneApi`/scene-related (`src/core/scene/...` or `src/features/scene/`), `PointerContextValue`, `ActiveToolContextValue`. Note any naming subtleties.

- [ ] **Step 2: Failing test**

```ts
import { describe, it, expectTypeOf } from 'vitest';
import type { DepSchema } from './invoker'; // or wherever DepSchema is re-exported
import type { SelectionApi } from 'core/selection/useSelection';

describe('DepSchema kit-standard augmentation', () => {
  it('declares selection: SelectionApi', () => {
    expectTypeOf<DepSchema['selection']>().toEqualTypeOf<SelectionApi>();
  });
  // … one test per dep name above
});
```

- [ ] **Step 3: Implement `depSchema.ts`** with declaration merging:

```ts
/**
 * Kit-standard DepSchema augmentation. Adds the named entries the kit's
 * default actions consume. Consumer apps add their own entries (e.g.
 * `color`) via the same declaration-merging pattern in their own files.
 *
 * Side-effect import: importing this file augments the shared DepSchema
 * type. Re-exported from `src/index.ts` so consumers get the entries
 * automatically.
 */
import type { SelectionApi } from 'core/selection/useSelection';
// … additional imports per the table

declare module './depRegistry' {
  // (or wherever DepSchema lives — verify the actual module path)
  interface DepSchema {
    selection: SelectionApi;
    view: ViewApi; // define below or import canonical
    scene: SceneApi;
    history: History;
    pointer: PointerContextValue;
    activeTool: ActiveToolContextValue;
  }
}

export {};
```

If a canonical type doesn't exist (e.g. `ViewApi`), define a minimal one in this file: `export interface ViewApi { get(): View; set(v: View): void }`. Mark with a TODO referencing Phase 5+ for refinement.

- [ ] **Step 4: Verify** tests pass + tsc clean across whole project.

- [ ] **Step 5: Commit**

```
git add src/interactions/actions/depSchema.ts src/interactions/actions/depSchema.test.ts
git commit -m "feat(registry): augment DepSchema with kit-standard deps (selection, view, scene, history, pointer, activeTool)"
```

---

### Task 2: `BindingOpts.params` extension

**Files:**
- Modify: `src/interactions/actions/invoker.ts`
- Modify: `src/interactions/actions/invoker.test.ts`

- [ ] **Step 1: Failing test** in `invoker.test.ts`:

```ts
it('BindingOpts accepts a params bag for action-defined parameters', () => {
  const opts: BindingOpts = {
    behaviors: [],
    params: { magnitude: 'big', axis: 'x' },
  };
  expectTypeOf(opts).toMatchTypeOf<BindingOpts>();
});
```

- [ ] **Step 2: Extend** `BindingOpts` per the JSDoc-annotated snippet in this plan's "BindingOpts.params extension" section.

- [ ] **Step 3: Verify + commit.**

```
git add src/interactions/actions/invoker.ts src/interactions/actions/invoker.test.ts
git commit -m "feat(registry): BindingOpts gains optional params bag for parametric actions"
```

---

### Task 3: Migrate simple non-compressed factories (escape, selectAll, duplicate, delete, group, undoRedo)

**Files:** modify each factory's `.ts` + `.test.ts`.

The migration shape per factory (using escape as the canonical):

**Before:**
```ts
export interface EscapeDeps { getSelection: () => NodeId[]; setSelection: (ids: NodeId[]) => void }
export function defaultEscapeAction(deps: EscapeDeps): Action {
  return {
    id: 'escape',
    label: 'Escape',
    defaultBinding: { key: 'Escape' },
    gestureBinding: { kind: 'key', key: 'Escape' },
    run: () => { /* uses deps closure */ },
    enabled: () => /* uses deps closure */,
  };
}
```

**After:**
```ts
export const escapeAction: Action<['selection']> = {
  id: 'escape',
  label: 'Escape',
  defaultBinding: { key: 'Escape' },
  gestureBinding: { kind: 'key', key: 'Escape' },
  requires: ['selection'] as const,
  invoker: {
    timing: 'immediate',
    run: ({ selection }) => {
      const sel = selection.get();
      if (sel.length === 0) return;
      selection.set([]);
    },
  },
  enabled: ({ selection }) => selection.get().length > 0
    ? true
    : ActionDisabledReason.SelectionRequired,
  // Phase 9 deletes `run`; transition keeps it for legacy useKeybinding callers.
  run: () => { /* delegates to invoker.run via a useStandardActions-supplied dep-bag */ },
};
```

**Transition wrinkle:** during Phases 4–8, the legacy `Action.run: () => void` field is still required by the registry shape. The descriptor's `run` field becomes a thin wrapper that resolves deps from the current registry (via a `withDeps(action)` helper or similar) and calls `invoker.run`. Phase 10 deletes `Action.run` entirely.

Option A — **wrapper helper at descriptor-definition time**: a `makeImmediateAction({ id, ..., run })` helper that returns an Action with both `invoker.run` (the pure form) and `run` (legacy bridge that reads from a global/contextual registry). Cleaner, but requires a "current dep registry" reference at run-time on the registry; not available outside React.

Option B — **`useStandardActions` constructs the bridge**: the hook holds a registry reference, wraps each descriptor's `invoker.run` into a `run: () => invoker.run({...resolveDeps(...)})`, and registers the result. This keeps descriptors pure and puts the bridging logic in one place.

**Pick B.** Phase 4 Task 8 (useStandardActions rewrite) builds the bridge once; per-action files stay pure descriptors with no `run` legacy field.

**Implication:** the `Action` interface's `run` field must become optional during Phases 4–8. Update its JSDoc to note the transition.

- [ ] **Step 0: Modify `Action.run` to be optional** in `src/interactions/actions/registry.tsx`. JSDoc: "Legacy run thunk; required during Phases 1–3, optional Phases 4–8 (factories construct it from `invoker` via `useStandardActions`), removed Phase 10." Stage this as part of Task 3 since it unblocks the migration.

- [ ] **Step 1: Write failing test** for `escapeAction` in `escape.test.ts`:

```ts
import { escapeAction } from './escape';

describe('escapeAction descriptor', () => {
  it('declares the descriptor shape (id, requires, invoker, enabled)', () => {
    expect(escapeAction.id).toBe('escape');
    expect(escapeAction.requires).toEqual(['selection']);
    expect(escapeAction.invoker.timing).toBe('immediate');
  });

  it('invoker.run clears selection when non-empty', () => {
    const sel: NodeId[] = [asNodeId('a')];
    const selection = { get: () => sel.slice(), set: (ids) => { sel.length = 0; sel.push(...ids); } };
    if (escapeAction.invoker.timing !== 'immediate') throw new Error();
    escapeAction.invoker.run({ selection } as any);
    expect(sel).toEqual([]);
  });

  it('invoker.run is no-op when selection empty', () => {
    const setSpy = vi.fn();
    if (escapeAction.invoker.timing !== 'immediate') throw new Error();
    escapeAction.invoker.run({ selection: { get: () => [], set: setSpy } } as any);
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('enabled returns SelectionRequired when empty', () => {
    expect(escapeAction.enabled?.({ selection: { get: () => [] } } as any)).toBe(ActionDisabledReason.SelectionRequired);
  });

  it('declares both defaultBinding (legacy) and gestureBinding', () => {
    expect(escapeAction.defaultBinding).toEqual({ key: 'Escape' });
    expect(escapeAction.gestureBinding).toEqual({ kind: 'key', key: 'Escape' });
  });
});
```

The existing `defaultEscapeAction` factory tests need to either be removed (preferred — the factory is going away) or kept as a thin compat wrapper test. Decide based on consumers — if `defaultEscapeAction` is still called from `useStandardActions` callers, keep a deprecated re-export that calls back to the descriptor.

For escape: remove the factory entirely. `useStandardActions`'s Task 8 wires the descriptor.

- [ ] **Step 2: Run to verify failures** (descriptor doesn't exist; factory tests still pass against old shape).

- [ ] **Step 3: Implement** the descriptor. Delete the old factory + `EscapeDeps` interface. Same shape for selectAll, duplicate, delete, group (group + ungroup are both descriptors in the same file), undoRedo (undo + redo descriptors).

- [ ] **Step 4: Verify** tests pass + tsc clean.

- [ ] **Step 5: Commit**

```
git add src/interactions/actions/defaults/{escape,selectAll,duplicate,delete,group,undoRedo}.{ts,test.ts} src/interactions/actions/registry.tsx
git commit -m "refactor(registry): migrate simple immediate actions to descriptor form (Phase 4)

escape, selectAll, duplicate, delete, group/ungroup, undoRedo: closure
factories → pure Action descriptors with requires + invoker. Action.run
becomes optional during the transition; useStandardActions (Task 8)
builds the legacy bridge from descriptors."
```

---

### Task 4: Migrate `flip` with axis-param compression (2 → 1)

**Files:**
- Modify: `src/interactions/actions/defaults/flip.ts` + test

**Before:** 2 actions (`flip.x`, `flip.y`), each with its own `defaultBinding` (Shift+H / Shift+V).

**After:** 1 action (`flip`), takes `axis: 'x' | 'y'` from `opts.params.axis`. Two bindings on the same action:

```ts
export const flipAction: Action<['selection', 'scene']> = {
  id: 'flip',
  label: 'Flip',
  // Two bindings, both ambient: shift-H → axis x, shift-V → axis y.
  gestureBinding: [
    { kind: 'key', key: ['h', 'H'], mods: { shift: true } },
    { kind: 'key', key: ['v', 'V'], mods: { shift: true } },
  ],
  requires: ['selection', 'scene'] as const,
  invoker: {
    timing: 'immediate',
    run: ({ selection, scene }, ?? hmm) => { /* …need params */ },
  },
};
```

**Problem:** the run signature today is `run(deps)`. Per Phase 4's BindingOpts.params, the dispatcher should pass `opts.params` somewhere. Update `ImmediateInvoker.run` to accept a second argument:

```ts
type ImmediateInvoker = { timing: 'immediate'; run(deps: Pick<DepSchema, R[number]>, params?: Record<string, unknown>): void };
```

(Or use a `Bag` shape: `run({ deps, params })`. Decide between flat 2-arg vs object. Flat 2-arg is simpler.)

- [ ] **Step 0: Extend `ImmediateInvoker.run` signature** to accept `params?: Record<string, unknown>` as the second argument. Update Phase 1's `invoker.test.ts` tests to match. (Backwards-compat: existing immediate invokers from Task 3 ignore the second arg; no source change needed.)

- [ ] **Step 1: Failing test** for `flipAction`:

```ts
describe('flipAction (axis param)', () => {
  it('declares one action with two ambient bindings (shift-H, shift-V)', () => {
    expect(flipAction.id).toBe('flip');
    expect(Array.isArray(flipAction.gestureBinding)).toBe(true);
    expect((flipAction.gestureBinding as GestureSpec[]).length).toBe(2);
  });

  it('axis: "x" flips horizontally', () => {
    const captured: { ops: any[] } = { ops: [] };
    const deps = { selection: ..., scene: { applyBatch: (ops) => { captured.ops = ops; } } };
    if (flipAction.invoker.timing !== 'immediate') throw new Error();
    flipAction.invoker.run(deps as any, { axis: 'x' });
    // assert the produced op is a horizontal flip
  });

  it('axis: "y" flips vertically', () => { /* analogous */ });
});
```

- [ ] **Step 2: Implement** `flipAction` reading `params.axis`. Internal helper: `flipSelection(selection, scene, axis)`. (Today's `defaultFlipActions` factory exposes `flipPoseAboutBounds` or similar — refactor to extract the per-axis logic into a shared helper the descriptor calls.)

- [ ] **Step 3:** The `defaultFlipActions` factory is deleted. Consumers move to `flipAction` (one entry). Tools/menus that listed two flip-X / flip-Y rows now list a single "Flip" entry with two binding hints (`Shift+H / Shift+V`).

- [ ] **Step 4: Verify + commit.**

```
git add src/interactions/actions/defaults/flip.{ts,test.ts} src/interactions/actions/invoker.{ts,test.ts}
git commit -m "refactor(registry): collapse flip 2→1 action (axis as binding param) — Phase 4 parametric compression"
```

---

### Task 5: Migrate `reorder` with distance-param compression (4 → 2)

**Files:**
- Modify: `src/interactions/actions/defaults/reorder.ts` + test

**Before:** 4 actions (`bringForward`, `sendBackward`, `bringToFront`, `sendToBack`), each with its own keybinding.

**After:** 2 actions (`reorder.forward`, `reorder.backward`), each with two bindings whose `params.distance: 'adjacent' | 'extreme'` selects the magnitude.

```ts
export const reorderForwardAction: Action<['selection', 'scene']> = {
  id: 'reorder.forward',
  label: 'Bring forward',
  gestureBinding: [
    { kind: 'key', key: [']', '}'], mods: { mod: true } },                          // adjacent
    { kind: 'key', key: [']', '}'], mods: { mod: true, shift: true } },              // extreme
  ],
  requires: ['selection', 'scene'] as const,
  invoker: {
    timing: 'immediate',
    run: ({ selection, scene }, params) => {
      const distance = (params?.distance as 'adjacent' | 'extreme') ?? 'adjacent';
      // call existing reorder helpers with the appropriate magnitude
    },
  },
};
// reorderBackwardAction: mirror with [ '[', '{' ] keys
```

**Wait** — the dispatcher needs to know which binding fired to pass the right `params`. The binding's `opts.params` provides the per-binding payload. So the two bindings need distinct opts:

```ts
gestureBinding: [...] // gesture-spec only; opts attach via Tool bindings or ambient binding registration
```

Hmm — `Action.gestureBinding` is just `GestureSpec | GestureSpec[]`; it doesn't carry opts. Opts attach to a `GestureBinding` (the tool/ambient-binding-table entry):

```ts
interface GestureBinding {
  spec: GestureSpec;
  actionId: string;
  opts?: BindingOpts; // params live here
}
```

So when the dispatcher walks `action.gestureBinding` to derive ambient bindings (Phase 3 dispatcher logic), it produces `GestureBinding` instances — but it has no per-spec opts to attach.

**Resolution:** widen `Action.gestureBinding` further to support `(GestureSpec | { spec: GestureSpec; opts: BindingOpts })[]`. The dispatcher's ambient-derivation reads opts when present.

Or — simpler — `Action.gestureBinding?: GestureBinding[]` where each entry can carry opts. But that introduces a circular shape (binding references actionId, but on the Action itself the actionId is implicit). So a cleaner shape: `Action.gestureBinding?: (GestureSpec | { spec: GestureSpec; opts?: BindingOpts })[]` (or always-array, always-with-opts).

**Pick: rename the field**. The clean shape is:

```ts
gestureBinding?: BoundGesture[]
type BoundGesture = GestureSpec | { spec: GestureSpec; opts?: BindingOpts }
```

This is a Phase 4 spec amendment. Update the spec doc accordingly during Task 5. Or — even cleaner — push the rename to Phase 10 and have Phase 4 use a parallel field name like `parametricBindings: BoundGesture[]` until Phase 10 unifies.

For now, the pragmatic call: **extend `gestureBinding` to also accept `{ spec, opts }` entries**. The existing single-spec and bare-spec-array forms keep working. Parametric actions use the object form.

- [ ] **Step 0: Extend `Action.gestureBinding` type** to accept `(GestureSpec | { spec: GestureSpec; opts?: BindingOpts })[]` in addition to existing forms. Update Phase 1/2 tests if needed (likely no change — they don't use opts). Phase 3's dispatcher derives ambient bindings: when an entry has `opts`, use it; else default to `opts: undefined`.

  Actually — to keep this self-contained in Phase 4 without revisiting Phase 3's dispatcher, the cleaner move: ALL parametric actions use the object form via a new field `parametricBindings: GestureBinding[]` (with explicit opts) that the dispatcher walks alongside `gestureBinding`. Phase 10 unifies.

  Decide on the day of execution based on whether Phase 3's dispatcher cleanly supports the extended `gestureBinding` shape (low cost) or whether adding `parametricBindings` is safer (slightly more code).

- [ ] **Step 1: Failing test** for `reorderForwardAction`:

```ts
describe('reorderForwardAction (distance param)', () => {
  it('declares one action with two parametric bindings', () => {
    // assert two bindings with distinct opts.params.distance values
  });
  it('distance: "adjacent" moves up one z-level', () => { /* … */ });
  it('distance: "extreme" moves to top', () => { /* … */ });
});
// same for reorderBackwardAction
```

- [ ] **Step 2: Implement** the two descriptors. Internal helpers: `reorderSelection(selection, scene, direction, distance)`.

- [ ] **Step 3: Verify + commit.**

```
git add src/interactions/actions/defaults/reorder.{ts,test.ts} src/interactions/actions/registry.tsx
git commit -m "refactor(registry): collapse reorder 4→2 actions (distance as binding param) — Phase 4 parametric compression"
```

---

### Task 6: Migrate `nudge` with magnitude-param compression (8 → 4)

**Files:**
- Modify: `src/interactions/actions/defaults/nudge.ts` + test

**Before:** 8 actions (`nudge.{up,down,left,right}{,.big}`), each with its own arrow-key binding.

**After:** 4 actions (`nudge.up`, `nudge.down`, `nudge.left`, `nudge.right`), each with two parametric bindings (small step on bare arrow; big step on shift+arrow).

```ts
function makeNudgeAction(dir: Direction): Action<['selection', 'scene']> {
  return {
    id: `nudge.${dir}`,
    label: `Nudge ${LABEL_FOR[dir]}`,
    gestureBinding: [
      { spec: { kind: 'key', key: KEY_FOR[dir] }, opts: { params: { magnitude: 'small' } } },
      { spec: { kind: 'key', key: KEY_FOR[dir], mods: { shift: true } }, opts: { params: { magnitude: 'big' } } },
    ],
    requires: ['selection', 'scene'] as const,
    invoker: {
      timing: 'immediate',
      run: ({ selection, scene }, params) => {
        const step = (params?.magnitude === 'big') ? BIG_STEP : SMALL_STEP;
        // … translate selection by (dx*step, dy*step) per dir
      },
    },
  };
}

export const nudgeUpAction = makeNudgeAction('up');
// … down, left, right
```

(Note: the small-step binding has no `mods` — strict semantics, matches bare arrow only. The big-step binding has `mods: { shift: true }`. This mirrors what Phase 2 populated for the 8-action shape; here it collapses into a single action with two parametric bindings.)

- [ ] **Step 1: Failing test** for the 4 descriptors.

- [ ] **Step 2: Implement.**

- [ ] **Step 3: Verify + commit.**

```
git add src/interactions/actions/defaults/nudge.{ts,test.ts}
git commit -m "refactor(registry): collapse nudge 8→4 actions (magnitude as binding param) — Phase 4 parametric compression"
```

---

### Task 7: Migrate `align`, `distribute`, `booleans` (no compression)

**Files:** modify `align.tsx`, `distribute.tsx`, `booleans.tsx` + tests.

These are "N distinct verbs" per the spec's parametric-actions table. Migration is pure shape change — closure → descriptor — with no count reduction.

Each file currently emits N descriptors via a factory; rewrite each as N pure static descriptors.

- [ ] **Steps 1–5:** Same TDD shape as Task 3, applied to align (6 descriptors), distribute (2), booleans (6). Single commit per file (`align`, `distribute`, `booleans`) at the end.

Commit messages (one per file):
- `refactor(registry): migrate align actions to descriptor form`
- `refactor(registry): migrate distribute actions to descriptor form`
- `refactor(registry): migrate booleans actions to descriptor form`

---

### Task 8: Rewrite `useStandardActions` to register dep sources

**Files:**
- Modify: `src/interactions/actions/useStandardActions.ts` + test

**Before:** the hook calls each factory (`defaultEscapeAction(deps)`, etc.) and registers the resulting Actions.

**After:** the hook (a) registers dep sources with the dep registry via `useDepSource`, (b) collects the kit-standard descriptor list and (c) registers them with the actions registry. Each descriptor is wrapped at registration time with a `run: () => invoker.run(resolveDeps(action.requires), undefined)` legacy bridge so existing keybinding consumers still work pre-Phase-10.

```ts
export interface UseStandardActionsOptions {
  // Same external API:
  selection?: SelectionApi;
  view?: ViewApi;
  scene?: SceneApi;
  history?: History;
  // …
}

export function useStandardActions(opts: UseStandardActionsOptions) {
  // 1. Register dep sources for whatever was passed.
  if (opts.selection) useDepSource('selection', () => opts.selection!);
  if (opts.view)      useDepSource('view',      () => opts.view!);
  if (opts.scene)     useDepSource('scene',     () => opts.scene!);
  if (opts.history)   useDepSource('history',   () => opts.history!);

  // 2. Register each kit-standard descriptor, wrapping with the legacy
  //    run bridge (until Phase 10 deletes Action.run).
  const registry = useActionsRegistry();
  const depReg = useDepRegistry();
  useEffect(() => {
    const descriptors = [escapeAction, selectAllAction, deleteAction, /* … */];
    const unregisters = descriptors.map(action => registry.register(withLegacyRunBridge(action, depReg)));
    return () => { unregisters.forEach(u => u()); };
  }, [registry, depReg]);
}
```

`withLegacyRunBridge` is a small helper:

```ts
function withLegacyRunBridge<R extends readonly DepName[]>(action: Action<R>, depReg: DepRegistry): Action {
  if (action.invoker.timing !== 'immediate') return action; // ongoing has no legacy bridge
  const inv = action.invoker;
  return {
    ...action,
    run: () => {
      const deps = Object.fromEntries((action.requires ?? []).map(name => [name, depReg.get(name)]));
      // also need to handle the params argument — legacy callers don't pass it; default undefined
      inv.run(deps as any, undefined);
    },
  };
}
```

(Conditional on Task 5/6 decisions about parametric bindings: legacy `useKeybinding` doesn't know which binding fired, so it can't pass `params`. For parametric actions, the legacy bridge always uses the small/default variant. The dispatcher (Phase 3+) DOES know the params from the matched binding's `opts.params`.)

- [ ] **Step 1: Failing tests** — restructure existing `useStandardActions.test.tsx` tests against the new internal shape. Same external behavior (kit-standard actions registered after the hook runs), different internal mechanism.

- [ ] **Step 2: Implement** the rewrite. Delete the old factory-calling code.

- [ ] **Step 3:** Remove the now-orphaned `XDeps` interface exports from `src/index.ts` (`SelectAllDeps`, `EscapeDeps`, etc. — these no longer exist).

- [ ] **Step 4: Verify** all `useStandardActions` tests pass; tsc clean; existing demos still work.

- [ ] **Step 5: Commit**

```
git add src/interactions/actions/useStandardActions.ts src/interactions/actions/useStandardActions.test.tsx src/index.ts
git commit -m "refactor(registry): useStandardActions registers dep sources + descriptors (Phase 4)

Drops closure-style factory calls; instead registers dep sources with
the dep registry and registers each kit-standard descriptor with a
legacy run-bridge for pre-Phase-10 useKeybinding compatibility.
External API unchanged."
```

---

### Task 9: End-to-end verification + TODO note

**Files:** none modified except docs.

- [ ] **Step 1:** Run `npm run prepublishOnly` — expect green.
- [ ] **Step 2:** Run `npm run build:demo` — expect green.
- [ ] **Step 3:** Run a small kit-level smoke: do existing demos still respond to keystrokes the same way? (Cmd-A, Backspace, Cmd-Z, arrow-key nudge, shift-arrow big-nudge, ]/[ reorder, Shift+H flip-X — each should fire as before.)
- [ ] **Step 4:** Update `docs/TODO.md` Phase status block:

```
- Phase 4 (factories → descriptors + parametric compression): shipped 2026-05-16 — 9 default-action factories collapsed into pure static descriptors using the dep registry. nudge 8→4, reorder 4→2, flip 2→1 via binding params. useStandardActions restructured (external API preserved); XDeps interfaces removed. Action.run becomes optional (legacy bridge via useStandardActions).
- Phases 5–10: pending.
```

- [ ] **Step 5: Commit.**

```
git add docs/TODO.md
git commit -m "docs(todo): note Phase 4 of registry unification shipped"
```

## Done criteria for Phase 4

- All 9 default-action factory files migrated to descriptor form.
- Parametric compression applied: nudge 8→4, reorder 4→2, flip 2→1.
- `useStandardActions` external API unchanged; internally registers dep sources + descriptors.
- `XDeps` interface exports removed from main barrel.
- `Action.run` field optional; descriptors don't declare it; useStandardActions builds the bridge.
- `npm run prepublishOnly` + `npm run build:demo` green.
- No existing behavior regression in demos.

## Risks / open items

- **`Action.run` optionality ripples.** Today's registry assumes `run` exists. Optional `run` means call sites must either narrow or invoke via the new dispatcher path. Audit existing call sites (`registry.tsx` line ~291 for the keybinding path) and gate them on `action.run !== undefined`.
- **Parametric bindings + `Action.gestureBinding` shape.** Task 5 surfaces a choice: extend `gestureBinding` to accept `{ spec, opts }` entries, or add a parallel `parametricBindings` field, or attach opts via ambient-registration-time wrapper. Default to extension; revisit during execution if Phase 3's dispatcher derivation gets ugly.
- **Legacy bridge ignores params.** For parametric actions, the legacy `useKeybinding` path can't know which binding fired, so the bridge always invokes with `params: undefined`. The action's `run` handler must handle that case (e.g., default to "small magnitude"). Document this in each parametric descriptor.
- **Test rewrites.** Each factory test today calls the factory and asserts on the returned Action. After migration, tests assert on the static descriptor directly. Migration may surface tests that were really testing the factory contract rather than the action behavior; rework or delete as appropriate.

## What's next

Phase 5 — introduce `ActiveToolContext` migration: replace the existing tools-state machinery with the context Phase 1 added. The dispatcher reads from context; tool-switching becomes an action on the context. Will be its own plan (drafted alongside Phase 4 execution per the lookahead-one cadence).
