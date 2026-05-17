# Registry unification — Phase 8: dissolve ambient wrapper-tools

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dissolve the ambient wrapper-tools that exist purely as scaffolding to register keybindings or wheel handlers. The eight wrappers split into two camps: (a) **simple wrappers** around already-migrated actions (`useNudgeTool`, `useDeleteTool`, `useDuplicateTool`, `useUndoRedoTool`) — pure deletion, since the descriptor's `gestureBinding` already handles the keybinding via dispatcher; and (b) **viewport wrappers** (`useWheelPanTool`, `useWheelZoomTool`, `useKeyboardZoomTool`) — need new `viewport.pan` / `viewport.zoom` descriptors before they can be deleted. Phase 8 handles (a); (b) becomes Phase 8.5.

**Architecture:** For each simple wrapper, verify the descriptor's gestureBinding covers the wrapper's keybinding. Delete the wrapper + its tests. Remove it from `SceneCanvas`'s tools list (where it was auto-included). Update any demo that references it.

**Tech Stack:** TypeScript, Vitest. Builds on Phases 1–7.

---

## Prerequisites

Phase 7 must be shipped on main. Verify:
```
grep -q "resizeAction" src/interactions/actions/useStandardActions.ts
```

## File map

**Delete (per simple wrapper):**
- `src/tools/builtin/useNudgeTool/` — entire directory
- `src/tools/builtin/useDeleteTool/` — entire directory
- `src/tools/builtin/useDuplicateTool/` — entire directory
- `src/tools/builtin/useUndoRedoTool/` — entire directory

**Modify:**
- `src/tools/builtin/index.ts` — drop the deleted-tool exports.
- `src/canvas/SceneCanvas.tsx` (or `useBuiltinShapeTools.tsx` / `useBuiltinTools.tsx`) — wherever these wrapper-tools were auto-mounted, drop them.
- `src/index.ts` — barrel-export adjustments if any of these wrappers were re-exported.
- `apps/swillustrator/src/App.tsx` (or wherever) — if Swill explicitly references the wrappers, drop the references.

## Scope boundaries

- ONLY dissolves the 4 simple wrappers.
- Does NOT create viewport descriptors (Phase 8.5).
- Does NOT delete `useWheelPanTool`, `useWheelZoomTool`, `useKeyboardZoomTool` (Phase 8.5).
- Does NOT delete `usePinchZoomTool` (Phase 7.5).
- Does NOT delete the legacy `useNudge`/`useDelete`/`useDuplicate`/`useUndoRedo` action hooks (the wrappers are what's deleted; the action hooks they wrap stay as bridge implementations in their factory files).

---

### Per-wrapper dissolution checklist

For each of the 4 simple wrappers, do this sequence:

**Step 1: Verify the descriptor covers the wrapper's behavior.**

The wrapper registers a keybinding via the tool-slot system (`defineTool({ initial: { keyDown: { ... } } })`). The descriptor's `gestureBinding` should declare the equivalent. Cross-check:

- `useNudgeTool` registers ArrowUp/Down/Left/Right (+ shift variants). Descriptors `nudgeUpAction` etc. have `gestureBinding: { kind: 'key', key: 'ArrowUp' }` (small) + `{ kind: 'key', key: 'ArrowUp', mods: { shift: true } }` (big). ✓ matches.
- `useDeleteTool` registers Backspace + Delete. Descriptor `deleteAction` has `gestureBinding: { kind: 'key', key: ['Delete', 'Backspace'] }`. ✓ matches.
- `useDuplicateTool` registers Cmd+D. Descriptor `duplicateAction` has `gestureBinding: { kind: 'key', key: 'd', mods: { mod: true } }`. ✓ matches.
- `useUndoRedoTool` registers Cmd+Z / Cmd+Shift+Z. Descriptors `undoAction` / `redoAction` have matching `gestureBinding`. ✓ matches.

Verify by reading each wrapper's source AND its associated descriptor.

**Step 2: Verify the dispatcher actually invokes the action when the keybinding fires.**

This is the load-bearing question. The dispatcher's coexistence path: when an action has `gestureBinding` AND the dispatcher is mounted, legacy `useKeybinding` bypasses; dispatcher routes the keydown to the action's invoker. For immediate-timing actions where `invoker.run` is real (delete/duplicate/nudge/undo descriptors): direct invocation. For descriptors whose `invoker.run` is a stub (delete/duplicate/group/ungroup per Phase 4 T8.5 — they have stub invokers but the LEGACY BRIDGE provides `Action.run`): the dispatcher's `Action.run` fallback fires the bridge's working logic.

Both paths should work. Verify by integration test: with `<SceneCanvas>` mounted and an action registered with a working bridge, dispatching a keydown for its keybinding should mutate the expected state.

If the integration test FAILS for any of the 4 actions, STOP. The wrapper can't be safely deleted until the dispatcher path works. Document the gap as a Phase 8 blocker.

**Step 3: Delete the wrapper.**

```
rm -r src/tools/builtin/useDeleteTool/
```

Update barrels:
- `src/tools/builtin/index.ts` — drop `export { useDeleteTool } from './useDeleteTool';` (or equivalent).
- `src/index.ts` — drop `useDeleteTool` exports if present.

**Step 4: Remove from auto-mount list.**

Find where `<SceneCanvas>` auto-includes these tools. Likely in `src/canvas/SceneCanvas.tsx` or `src/canvas/SceneCanvas/useBuiltinTools.tsx` or similar. Search:

```
grep -rn "useDeleteTool\|useNudgeTool\|useDuplicateTool\|useUndoRedoTool" src/canvas/
```

Remove the wrapper from the tools array.

**Step 5: Update consumers.**

```
grep -rn "useDeleteTool\|useNudgeTool\|useDuplicateTool\|useUndoRedoTool" demo/ apps/
```

Update each reference. Likely just dropping the import; the action keybinding still works via the descriptor.

**Step 6: Verify.**

```
npx vitest run --project=kit --project=weasel-ui --project=swillustrator 2>&1 | tail -10
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -5
```

All tests pass; tsc clean.

**Step 7: Commit.**

```
git commit -m "refactor(tools): dissolve useDeleteTool wrapper — action descriptor + dispatcher cover the keybinding (Phase 8)"
```

(Per wrapper.)

---

### Task 1: Dissolve `useNudgeTool`

Follow the checklist for `useNudgeTool`.

### Task 2: Dissolve `useDeleteTool`

Same.

### Task 3: Dissolve `useDuplicateTool`

Same.

### Task 4: Dissolve `useUndoRedoTool`

Same.

### Task 5: End-to-end verification + TODO note

- [ ] vitest + tsc + build:demo green.
- [ ] Update `docs/TODO.md`:

```
- Phase 8 (dissolve simple ambient wrappers): shipped 2026-05-17 — deleted useNudgeTool, useDeleteTool, useDuplicateTool, useUndoRedoTool. The underlying actions (already migrated to descriptors in Phase 4) cover the same keybindings via the dispatcher; their legacy `run` bridges from `useStandardActions` provide working invocation. Three viewport wrappers (useWheelPanTool, useWheelZoomTool, useKeyboardZoomTool) deferred to Phase 8.5 — they need new viewport.pan/viewport.zoom descriptors before deletion.
```

Update "Phases 8–10 + 7.5: pending" → "Phases 8.5, 9, 10 + 7.5: pending."

- [ ] Commit + done.

## Done criteria

- 4 wrapper directories deleted.
- Tests pass; tsc clean.
- No demo broken — keybinding behavior preserved.

## Risks

- **Test wrappers may still reference the deleted tools.** Search broadly and update. Common: `useBuiltinTools()` aggregator was wrapping these; remove the calls.
- **Descriptor with stub invoker.** For delete/duplicate (whose descriptor invoker is a stub, with bridge providing `Action.run`): the dispatcher's `Action.run` fallback path (Phase 3 T3 dispatcher.ts) handles this. Verify the fallback actually fires for these actions via existing tests or add one.
- **`useStandardActions` calls these wrappers internally?** Read it. If yes, drop those calls. (Unlikely — they're auto-mounted at the SceneCanvas tools level, not via useStandardActions.)
