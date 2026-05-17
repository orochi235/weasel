# Registry unification — Phase 10: delete legacy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Delete every transition-era shim, bridge, and legacy field. After Phase 10, the registry-unification refactor is fully done: one registry, one binding surface (`GestureSpec`), one `Action` shape with `Invoker` as the only invocation mechanism.

**Architecture:** Pure deletion + rename. The descriptors and dispatcher were proven correct in Phases 6–9; Phase 10 removes the safety nets that allowed them to coexist with legacy.

## Prerequisites

All of:
- Phase 6 shipped (moveAction validates dispatcher).
- Phase 7 shipped (5 simple ports OR Phase 7.5 also shipped for the 3 complex ones).
- Phase 8 shipped (simple wrappers dissolved).
- Phase 8.5 shipped (viewport wrappers dissolved).
- Phase 9 shipped (Swill ColorContext restructured).

Each ongoing action's invoker body must be REAL (not stubbed). If any action is still stubbed, it gets fixed before Phase 10 (or Phase 10 makes the stub the only path, removing the legacy fallback bridge — which would break those actions).

## Deletions

### Task 1: Delete `useMove` / `useResize` / `useRotate` / `useAreaSelect` / `useInsert` / `useClone` / `useLassoSelect` / `useEditAnchors`

Each hook lives in `src/interactions/actions/<name>/`. The hook is now replaced by the action descriptor + dispatcher. Delete:
- The hook file (`<name>.ts`).
- Its tests.
- The directory if it becomes empty.

Update imports throughout the codebase. Any consumer that imported the hook now imports the action descriptor + uses the actions registry.

Per hook: one commit.

### Task 2: Delete `Action.run` + `Action.defaultBinding`

`Action.run` is the legacy run thunk (made optional in Phase 4). Now delete it entirely.

`Action.defaultBinding: KeyBinding` is the legacy keybinding field (still present per Phase 1's parallel-field strategy from Q1 fix). Delete it; the new field stays under its current name OR gets renamed (next task).

Update every reference to `action.run` to use `action.invoker.run` (or `start` for ongoing). Update every reference to `action.defaultBinding` to use `action.gestureBinding`.

### Task 3: Rename `gestureBinding` → `defaultBinding`

Per spec's end-state. Type-level rename + every callsite update. Significant grep-and-replace; verify with tsc.

### Task 4: Delete the old tool-slot dispatcher (`src/tools/dispatcher.ts`)

The dispatcher's slot mechanics (active/hotkey/ambient) are obsolete. After Phases 5+8, all dispatch flows through the GestureSpec dispatcher.

But WAIT — the declarative routing dispatcher (from `docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md`) also lives at `src/tools/dispatcher.ts`. That's a SEPARATE system; deleting it would break every tool that uses `defineTool` with route tables.

Phase 10 only deletes the slot-mechanic parts of the old dispatcher, not the route-table machinery. The route-table dispatcher is its own concern; deletion of it is a separate (post-Phase-10) decision.

### Task 5: Delete `useKeybinding`

The legacy keybinding hook (`src/interactions/actions/useKeybinding.ts`). After all actions migrate, no consumer needs it. Delete + remove every import.

Note: `useKeybindings` (with the trailing s, in `src/tools/`) is different — that's the tool-keybinding hook. Phase 5 partially gutted it; Phase 10 may need to clean it up further.

### Task 6: Delete the legacy bridge in `useStandardActions`

The `withLegacyRunBridge` helper (Phase 4 T8 introduced) is dead code once all descriptors have real invokers. Delete the helper; `useStandardActions` registers descriptors as-is.

### Task 7: Delete `DispatcherPresenceProvider`

The presence context (Phase 3 T5) existed to let legacy `useKeybinding` bypass actions handled by the dispatcher. With `useKeybinding` deleted, the presence context is dead. Delete + remove from `<SceneCanvas>`.

### Task 8: Update `docs/taxonomy.md`

Remove the "narrower historical definition" caveats. The taxonomy doc declares the unified vocabulary as the reality, not the aspiration.

### Task 9: Update `docs/TODO.md`

Delete the "Taxonomy alignment" → "Unify the registry" entry entirely (the work is done). Or leave a brief retrospective note.

### Task 10: Update demos that hand-wired old hooks

Any demo that used `useMove` directly etc. should now consume the action via the registry. Most demos use `<SceneCanvas>` which handles everything automatically — only custom-wired demos need updates.

### Task 11: Final verification

prepublishOnly + build:demo + manual smoke test of every kit-shipped demo.

## Done criteria

- 8 legacy hooks deleted.
- `Action.run` + `Action.defaultBinding: KeyBinding` deleted.
- `gestureBinding` renamed to `defaultBinding`.
- `useKeybinding` (singular) deleted.
- `DispatcherPresenceProvider` + the bypass mechanism deleted.
- `withLegacyRunBridge` deleted.
- Docs updated.
- All tests pass; tsc clean; build:demo clean.
- No demo broken.

## Risks

- **Rename surface area.** `gestureBinding → defaultBinding` is a kit-wide rename. ~50+ call sites. Tooling: scripted grep-replace + tsc verification.
- **Hidden consumers.** If any app outside the kit uses the legacy API (unlikely pre-1.0 but check), they break. Document in the release notes.
- **Test deletions.** Many tests of the legacy hooks are now redundant; review carefully — some may have been testing actual behavior that's still important, just at a different layer.
