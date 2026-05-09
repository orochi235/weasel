# Actions Registry Design

**Status:** approved 2026-05-09 (informal back-and-forth in chat)
**Tag:** `@experimental` in the public barrel

## Problem

Today every weasel hook that wants a keybinding (`useSelectAll`, `useEscape`, `useDuplicate`, `useNudge`, `useReorder`, plus tool-internal handlers) calls `useKeybinding` which adds a `document.addEventListener('keydown', ...)` listener. Five+ separate listeners per demo. No central registry, so:

- A command palette / shortcuts overlay can't enumerate active bindings.
- Conflicting bindings between modes (e.g. tool-active vs idle) can't be resolved centrally.
- Every consumer of `<SceneCanvas>` writes the same `useSelectAll`/`useEscape`/`useDuplicate` boilerplate even though the kit already has all the inputs (scene, selection, adapter) needed to wire them.
- Hot-reload sometimes leaves stale listeners attached when components remount in dev.

## Goal

A single registry, owned by the framework, that:

1. Holds the active set of actions for a scope.
2. Wires one `keydown` listener per scope and dispatches to the matching action.
3. Auto-registers defaults (selectAll / escape / duplicate / nudge / reorder) when `<SceneCanvas>` mounts with a scene + selection.
4. Lets consumers customize defaults and add app-specific actions through one prop on `<SceneCanvas>`.
5. Stays composable for advanced cases (bare `<Canvas>`, multiple scopes on a page, sibling UI like a command palette).
6. Ships `@experimental` — API may evolve before v2.

## Non-goals

- Replacing the existing `useKeybinding` primitive. It stays as the underlying mechanism.
- Removing the standalone action hooks (`useSelectAll`, etc.). They become kit primitives — useful for bare-`<Canvas>` consumers and for the registry itself to import.
- Multi-step gesture chords (e.g. Cmd+K then C). v1 supports single bindings only.
- Conflict resolution between tools and consumer actions. v1 is "first registered wins"; consumer can disable defaults to avoid collisions.

## Architecture

### §A — Action descriptor

```ts
export interface KeyBinding {
  key: string;        // 'a', 'Escape', 'ArrowLeft', etc.
  mod?: boolean;      // Cmd/Ctrl required
  alt?: boolean;
  shift?: boolean | 'optional';
}

export interface Action {
  id: string;
  label: string;
  defaultBinding?: KeyBinding;
  run: () => void;
}
```

Actions are descriptors. The `run` closure captures the adapter / scene / selection it needs at registration time.

### §B — Registry + Provider

```tsx
export interface ActionsRegistry {
  register(action: Action): () => void;  // returns unregister
  unregister(id: string): void;
  list(): readonly Action[];
  trigger(id: string): void;             // imperative trigger (palette, menu, test)
}

export const ActionsContext = createContext<ActionsRegistry | null>(null);

export function ActionsProvider({ children }: { children: ReactNode }): JSX.Element;
export function useActionsRegistry(): ActionsRegistry | null;
```

`ActionsProvider` mounts a registry, attaches **one** `document.addEventListener('keydown', dispatch)` to its scope, and dispatches incoming key events through `list()` looking for `defaultBinding` matches. When matched, calls `action.run()`.

Multiple providers on a page (rare) get separate scopes. The dispatch listener on each is added in mount order; the first matching action runs first. Cleaner solutions (per-scope focus, scope visibility) are deferred.

### §C — Default actions

Five built-in actions matching today's hooks. Each is a factory `(deps) => Action`:

```ts
function selectAllAction(deps: SelectAllDeps): Action;
function escapeAction(deps: EscapeDeps): Action;
function duplicateAction(deps: DuplicateDeps): Action;
function nudgeAction(deps: NudgeDeps): Action;       // emits arrow-key actions; really 8 actions (4 plain + 4 shift)
function reorderAction(deps: ReorderDeps): Action;   // really 2 actions: forward + backward
```

`SceneCanvas` derives `deps` from its `scene`, `selection`, and `adapter` props and registers each action via the registry it auto-mounts internally (see §D).

### §D — `<SceneCanvas>` integration

```tsx
export interface SceneCanvasProps<...> {
  // ...existing props...
  actions?: ActionsProp;
}

export type ActionsProp =
  | null                        // disable all defaults; no actions registered
  | Record<string, ActionEntry>;

export type ActionEntry =
  | null                        // disable this default
  | Partial<Action>             // partial override of a matching default (keeps id/label/defaultBinding from default)
  | Action;                     // full new action (or full override)
```

Resolution order:

1. `<SceneCanvas>` builds the default action map: `{ selectAll: defaultSelectAllAction(deps), escape: defaultEscapeAction(deps), ... }`.
2. If `props.actions === null` → final map is empty.
3. Else, for each `[id, entry]` in `props.actions`:
   - `entry === null` → delete defaults[id]
   - `entry` is a partial → defaults[id] = `{ ...defaults[id], ...entry }` (only valid if id is in defaults; otherwise treat as a new action and require a full descriptor)
   - `entry` is a full `Action` → defaults[id] = entry (overrides any default)
4. Final map's values get registered against the registry (auto-mounted by `<SceneCanvas>` if no parent provider exists).

The auto-mount logic: `<SceneCanvas>` does `useActionsRegistry()`; if `null`, it renders `<ActionsProvider>` internally wrapping its children. If non-null (consumer wrapped externally), it skips the inner provider and registers into the parent.

### §E — Standalone hooks (back-compat)

`useSelectAll(adapter, options)` etc. stay exported. Their bodies refactor to:

1. If `useActionsRegistry()` returns a non-null registry → register the action there (clean up on unmount).
2. Else → fall back to `useKeybinding` as today (so bare-`<Canvas>` consumers and tests-without-provider still work).

Net effect: existing demos that call `useSelectAll(...)` directly keep working without modification, even if `<SceneCanvas>` is wrapping them. The hook just routes through the registry instead of binding its own listener.

For demos using `<SceneCanvas>`, the consumer-level `useSelectAll(...)` calls become **redundant** with the SceneCanvas auto-default. Demo migration step removes them.

### §F — Public API surface

Added to `@orochi235/weasel` barrel:

```ts
export { ActionsProvider, useActionsRegistry, useAction } from './interactions/actions/registry';
export type { Action, ActionEntry, ActionsProp, ActionsRegistry, KeyBinding } from './interactions/actions/registry';
export {
  defaultSelectAllAction, defaultEscapeAction, defaultDuplicateAction,
  defaultNudgeActions, defaultReorderActions,
} from './interactions/actions/defaults';
```

`useAction(action)` is a convenience hook for advanced consumers who construct an Action descriptor and want to register it without going through `<SceneCanvas>`'s `actions` prop.

## API examples

### Default case — every demo using `<SceneCanvas>`

```tsx
return <SceneCanvas scene={scene} selection={selection} ... />;
// Cmd+A, Esc, Cmd+D, arrows, Cmd+[/] all work.
```

### Disable defaults selectively

```tsx
<SceneCanvas
  actions={{
    selectAll: null,           // no Cmd+A here
    duplicate: { run: myDup }, // override Cmd+D's run
  }}
/>
```

### Add app-specific actions

```tsx
<SceneCanvas
  actions={{
    copy: {
      label: 'Copy',
      defaultBinding: { key: 'c', mod: true },
      run: () => clipboard.copy(selection.current),
    },
  }}
/>
```

### Bare `<Canvas>` consumer

Same as today — call `useSelectAll(adapter)` etc. directly. The hooks register into a parent `<ActionsProvider>` if present, else fall back to direct `useKeybinding`.

### Command palette / shortcuts overlay

```tsx
function ShortcutsOverlay() {
  const reg = useActionsRegistry();
  if (!reg) return null;
  return (
    <ul>
      {reg.list().map(a => (
        <li key={a.id}>{a.label}: {formatBinding(a.defaultBinding)}</li>
      ))}
    </ul>
  );
}
```

Sits inside `<ActionsProvider>` or `<SceneCanvas>` — reads the live action set.

## Migration

- Demos using `<SceneCanvas>` + `useSelectAll`/`useEscape`/`useDuplicate`: delete the hook calls. Defaults take over. Verify Cmd+A still works.
- Demos using bare `<Canvas>`: no change required (hooks still work; they register into the auto-provider).
- Consumer apps: same — additive change, no breakage.

## Risks / Open questions

- **Multiple `<SceneCanvas>` instances on one page** today share the document `keydown` listener via individual `useKeybinding` calls; under the registry, each gets its own provider scope. Cmd+A pressed while focus is in canvas A might still trigger canvas B's selectAll because both providers' listeners are at document level. Resolution: scope dispatch by canvas focus (a future refinement). v1 ships with naive document-level dispatch; document the limitation.
- **`Partial<Action>` validation**: if a consumer passes `{ duplicate: { run: foo } }` for an id not in defaults, what happens? Plan: warn-once and skip. Defaults provide `label` + `defaultBinding`; without those, the action can't render or trigger.
- **Tool-internal actions** (e.g. `useEditAnchorsTool` registering Escape to exit) collide with default `escape`. Resolution: the tool's hook registers its action with the same `escape` id, overwriting the default while the tool is active; on unmount, the default re-registers (registry's `register` returns an unregister, so the tool's effect cleans up). Document the precedence.
- **`useNudge` actually wires 8 keybindings** (4 arrows × 2 with-shift). Expanding the action API to support multi-binding actions is a v2 concern; for v1, register them as 8 separate Action descriptors (`nudge.up`, `nudge.up.big`, etc.).

## File structure

```
src/interactions/actions/
  registry.ts                        NEW — Action, ActionsProp, ActionsRegistry, ActionsProvider, useActionsRegistry, useAction
  registry.test.ts                   NEW
  defaults/
    selectAll.ts                     NEW — defaultSelectAllAction(deps)
    escape.ts                        NEW
    duplicate.ts                     NEW
    nudge.ts                         NEW (8 actions)
    reorder.ts                       NEW (2 actions)
    index.ts                         NEW — barrel
  select-all/select-all.ts           MODIFY — register into provider when present, else fall back to useKeybinding
  escape/escape.ts                   MODIFY — same
  duplicate/duplicate.ts             MODIFY — same
  nudge/nudge.ts                     MODIFY — same
  reorder/reorder.ts                 MODIFY — same

src/canvas/SceneCanvas.tsx           MODIFY — auto-mount ActionsProvider; resolve `actions` prop; register defaults
src/canvas/Canvas.tsx                no change

src/index.ts                         MODIFY — export new public surface

demo/demos/MultiSelectDemo.tsx       MODIFY — delete useSelectAll(...) call
demo/demos/ActionsDemo.tsx           MODIFY — delete redundant useEscape/useSelectAll/useDuplicate/useNudge/useReorder
... (other demos that fall under defaults)

docs/superpowers/specs/2026-05-09-actions-registry-design.md   THIS FILE
```

## Tests

**Hard requirement:** exhaustive coverage. The registry is shared
infrastructure — every other action hook builds on it. Aim for
1-test-per-public-method on the registry, plus integration tests that
exercise every reachable state in the resolution rules.

### Registry unit tests (`registry.test.ts`)

1. `register(action)` adds the action; `list()` returns it.
2. `register(action)` returns an unregister function; calling it removes the action.
3. `register(action)` with an id already present **replaces** the existing entry (last-writer-wins) — verifies tool-overrides-default semantics.
4. After unregister, `register(default)` again restores the default — verifies tool-unmount restores default.
5. `unregister(id)` for an absent id is a no-op (no throw).
6. `trigger(id)` calls the registered action's `run`; returns true.
7. `trigger(id)` for an absent id returns false (no throw).
8. `list()` returns a stable readonly snapshot — mutating the returned array doesn't affect internal state.
9. The Provider attaches one `keydown` listener on mount and removes it on unmount.
10. Multiple Providers nested → each owns its own scope (registering in inner doesn't leak to outer).
11. KeyMatch: every modifier combination (no-mod, Cmd, Ctrl, Cmd+Shift, Alt, Cmd+Alt, etc.) routes correctly.
12. KeyMatch: `shift: 'optional'` accepts both shifted and unshifted; `shift: false` rejects shifted; `shift: true` requires shifted.
13. KeyMatch: skipInEditable behavior — keydowns in `<input>`/`<textarea>`/contentEditable do NOT trigger actions.
14. KeyMatch: preventDefault is called when an action matches.
15. Multiple actions with overlapping bindings: first registered runs, others skipped (or document the loud-warning if we choose that).

### Default action factories (`defaults/*.test.ts`, one file each)

Per default (selectAll, escape, duplicate, nudge×8, reorder×2):

- Action has the correct `id`, `label`, `defaultBinding`.
- `run()` calls the right adapter method with the right arguments (e.g. selectAll calls `setSelection(listAll())`).
- `run()` is a no-op when preconditions fail (e.g. selectAll on empty scene; nudge with empty selection).

### `<SceneCanvas>` integration (`SceneCanvas.actions.test.tsx`)

For each prop shape:

1. No `actions` prop → all 5 defaults registered (verify via the registry's `list()` length and ids).
2. `actions={null}` → registry empty.
3. `actions={{ selectAll: null }}` → 4 defaults, no selectAll.
4. `actions={{ duplicate: { run: customRun } }}` → defaults still 5, duplicate's `run` is `customRun` but `label`/`defaultBinding` retained from default.
5. `actions={{ copy: fullAction }}` for a new id → defaults + copy (6 total).
6. Mixed: one disabled, one overridden, one new → correct final size and content.
7. Auto-provider: when no parent `<ActionsProvider>`, SceneCanvas mounts one. Verify by querying `useActionsRegistry()` from a child component.
8. Parent provider preserved: when wrapped in `<ActionsProvider>`, SceneCanvas does NOT mount a second one. Children see the parent.
9. Unmount cleanup: unmounting `<SceneCanvas>` unregisters all the defaults it owned.
10. Re-mount: a fresh mount re-registers the defaults.

### Behavioral / keydown dispatch (`SceneCanvas.actions.behavior.test.tsx`)

11. Mock-dispatch a `keydown` for Cmd+A → the default `selectAll.run` is invoked.
12. Mock-dispatch Esc → escape.run invoked.
13. Mock-dispatch a key with no matching action → no run is invoked.
14. Mock-dispatch in an `<input>` inside the provider → action does NOT run (skipInEditable).
15. Action's `run` throws → registry catches and logs (verify console.error called once); subsequent dispatches still work.

### Back-compat hooks (one test file per affected hook)

For `useSelectAll` (and analogously useEscape, useDuplicate, useNudge, useReorder):

16. Called inside `<ActionsProvider>` → registers an action there; unmount removes it.
17. Called outside any provider → falls back to direct `useKeybinding` (verify document.addEventListener was called).
18. Called inside a provider that already has an `id: 'selectAll'` registered → the hook's registration still takes effect (last-writer-wins, per registry test #3).
19. Imperative `selectAll()` return still works in both modes (provider and standalone).

### Conflict resolution (`registry.conflicts.test.tsx`)

20. Default `escape` registered → `useEditAnchorsTool` mounts and registers its own `escape` → mock-dispatch Esc → tool's run fires (not default's).
21. Tool unmounts → default escape's run is the one fired on next Esc.
22. Two consumers register the same custom id `copy` → both register attempts succeed; last-writer-wins; both unregister independently.

### Spec → behavior contracts

These tests assert each line of the resolution rules in §D resolves as documented. They double as living documentation of the merge semantics.

23. `actions={{ selectAll: null }}` resolves to defaults minus selectAll.
24. `actions={{ duplicate: { run: r } }}` resolves with id/label/defaultBinding from default, run from override.
25. `actions={{ copy: { id: 'copy', label: 'Copy', defaultBinding: { key: 'c', mod: true }, run: r } }}` resolves with full descriptor.
26. `actions={{ duplicate: { run: r, label: 'Replicate' } }}` resolves with both run and label overridden, defaultBinding from default.
27. `actions={{ duplicate: { id: 'wrong', run: r } }}` — explicit id mismatch in partial override: warn-once, ignore the id field, treat as override of `duplicate` slot.

### Estimated count

~50 tests across the new registry + defaults + integration + back-compat + conflict files. Aim to add >40 net new vitest tests; the suite should grow from 1477 → ~1520+.

## Done criteria

1. New API ships in `@orochi235/weasel` barrel under `@experimental`.
2. `<SceneCanvas>` auto-registers default actions; `actions` prop honored per the resolution rules.
3. All existing standalone hooks (`useSelectAll`, etc.) refactored to register-when-provider-exists; behavior unchanged for bare-Canvas users.
4. At least 3 demos (MultiSelect, Actions, NestedGroups) migrated — `useSelectAll`/`useEscape`/`useDuplicate` calls deleted; Cmd+A / Esc / Cmd+D still work.
5. `tests/visual` rig untouched (no visual change expected).
6. Vitest count grows by ~30 tests (registry + defaults + integration + back-compat).
