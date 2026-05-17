# Registry unification — Phase 15: per-dep wiring modules

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract the dep-wiring logic currently lumped inside `StandardActionsRegistrar` (in `src/canvas/SceneCanvas.tsx`) into per-dep modules under `src/canvas/deps/`. Each kit-standard dep source gets its own file with a small focused hook (`useXDepSource`) that constructs the dep and calls `useDepSource`. SceneCanvas just calls each hook.

**Prerequisites:** Phase 14f (the rename) shipped — registry unification is otherwise complete. Doing this earlier collides with in-flight parallel work that touches SceneCanvas's StandardActionsRegistrar.

## Why

The Phase 14 wave surfaced the architectural pain: every dep-source wiring (insert, lassoSelect, areaSelect, view, scene, history, activeTool, textEdit, anchor-affordance thunk, ...) lives in one Registrar. Parallel agents adding new dep sources all collide there. Beyond the merge-conflict pressure (temporary), there are real design wins:

- Mirrors the descriptor pattern (actions are per-file; deps should be too).
- Consumer apps that augment DepSchema see a clear template for their own dep modules.
- "Which deps wire where" becomes a directory listing.
- SceneCanvas.tsx (currently 800+ lines) shrinks.
- Per-dep tests become focused instead of tangled in SceneCanvas integration tests.

## Architecture

```
src/canvas/deps/
  ├── index.ts                    — barrel re-exports
  ├── useSelectionDepSource.ts    — constructs SelectionApi, calls useDepSource('selection', ...)
  ├── useViewDepSource.ts          — view get/set via currentViewRef + onViewChange
  ├── useSceneDepSource.ts         — exposes the Scene
  ├── useHistoryDepSource.ts       — exposes the History
  ├── useActiveToolDepSource.ts    — wraps useActiveToolContext
  ├── useAreaSelectDepSource.ts    — constructs AreaSelectDep (hitTestArea AABB scan)
  ├── useInsertDepSource.ts        — constructs InsertDep with per-kind factory map
  ├── useTextEditDepSource.ts      — wraps useTextEdit
  ├── useLassoSelectDepSource.ts   — constructs LassoSelectDep
  ├── useEditAnchorsDepSource.ts   — constructs EditAnchorsDep
  └── usePointerDepSource.ts       — exposes pointer
```

(Names approximate; finalize during execution.)

`StandardActionsRegistrar` then becomes a thin shell:

```tsx
function StandardActionsRegistrar(props) {
  useSelectionDepSource(props.selection);
  useViewDepSource(props.currentViewRef, props.onViewChange);
  useSceneDepSource(props.scene);
  useHistoryDepSource(props.history);
  useActiveToolDepSource();
  useAreaSelectDepSource(props.scene, props.selection);
  useInsertDepSource(props.scene, props.actionDefaults);
  useTextEditDepSource(/* ... */);
  useLassoSelectDepSource(props.scene, props.selection);
  useEditAnchorsDepSource(/* ... */);
  usePointerDepSource(/* ... */);
  // Plus the action-registration useEffect for KIT_STANDARD_DESCRIPTORS.
  return null;
}
```

## Tasks

### Task 1: Survey existing wiring

Read `StandardActionsRegistrar` carefully. Identify each dep source + its inputs + its construction logic. Probably 8–11 deps.

### Task 2: Per-dep module extractions

For each dep, create `src/canvas/deps/use<Name>DepSource.ts`:
- Function signature: takes whatever inputs the original construction needed (refs, callbacks, etc.).
- Body: constructs the dep object (often via `useMemo`); calls `useDepSource(name, () => dep)`.
- Test: focused test that mounts the hook in isolation + asserts the registry now has the dep.

One commit per extracted dep (so review is digestible).

### Task 3: SceneCanvas slim-down

Replace the inline wiring with the per-hook calls. Verify all integration tests still pass (the Registrar's observable behavior is unchanged).

### Task 4: Consumer-side template

Add a brief example to `docs/concepts/dep-sources.md` (or equivalent) showing: "Here's how the kit wires its standard deps; here's how you wire your own (e.g., Swill's `color` dep)." Use Swill's existing ColorContext dep wiring as the reference.

### Task 5: Verify + TODO

prepublishOnly + build:demo green. Update TODO.md.

## Done criteria

- `src/canvas/deps/` directory exists with one file per kit-standard dep source.
- `StandardActionsRegistrar` is < 50 lines (just hook calls).
- Each dep has its own test.
- All existing tests pass.
- Docs example for consumer dep-wiring exists.

## Non-goals

- Doesn't change the dep registry contract.
- Doesn't introduce per-feature "dep contributor" plugin patterns (could come later).
- Doesn't move action descriptors around.

## Risks

- **Hook ordering.** Some dep sources may need to mount after others (e.g., `useActiveToolDepSource` reads the context; would need a provider above). Preserve current ordering when extracting.
- **Inline branches.** The current Registrar has logic like "register the duplicate bridge only when `actionDefaults.cloneNode` is provided." Each per-dep hook can encapsulate its own branch.
- **Test re-snapshotting.** Integration tests that snapshot the registry's dep keys may need updates if naming shifts (it shouldn't, but watch).
