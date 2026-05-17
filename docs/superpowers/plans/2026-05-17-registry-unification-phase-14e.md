# Registry unification — Phase 14e: legacy retirement (substantive)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

> **Note:** Earlier drafts of this plan billed it as a "mechanical grep-and-delete sweep" after Phase 12. The Phase 12 partial execution surfaced that this framing was wrong: the legacy hooks own *two* concerns (gesture handling AND ghost-overlay rendering), and the latter has no dispatcher-side replacement yet. This rewrite owns that work as well.

**Goal:** End the registry-unification arc. Replace every legacy-hook responsibility with dispatcher-path equivalents in a single coherent change, then delete the legacy hooks, the legacy keystroke loop, `Action.run`, `withLegacyRunBridge`, `DispatcherPresenceProvider`, singular `useKeybinding`, and the legacy `Action.defaultBinding: KeyBinding` field.

**Architecture:** The substantive new work is a **dispatcher-side preview-overlay mechanism**. Today's `<preview-ghost>` layer (`src/canvas/SceneCanvas/usePreviewGhostLayer.ts`) walks the `tools` registry looking for `tool.previewIds()` + `tool.previewPose(id)`. Phase 14e extends the `OngoingHandle` contract so dispatcher-path actions can expose the same surface; the preview-ghost layer additionally walks the dispatcher's in-flight handles. Once that's in place, the legacy hooks become removable without losing ghost rendering during drags.

**Tech Stack:** TypeScript, React, Vitest. Builds on Phases 1–14d + Phase 12 (partial).

---

## Why this is one plan, not several

Six interlocking concerns, each load-bearing for the others:

1. **Overlay handoff**: dispatcher actions need a preview surface before legacy hooks can be removed.
2. **Route-table deletion**: useSelectTool's `routes` field still classifies/forwards drags; its removal must coincide with the legacy hook imports leaving its file.
3. **Legacy hook deletion**: only safe after (1) is shipped and (2) lands.
4. **Legacy keystroke loop deletion**: depends on every kit-standard descriptor moving off `defaultBinding: KeyBinding` onto `gestureBinding`.
5. **Factory-bridge rewrites**: every default-action factory (`defaultDeleteAction`, `defaultGroupAction`, ...) currently spreads `defaultBinding` into its output. 40+ tests assert on `factory(deps).defaultBinding`. The descriptor migration in (4) requires the factories and tests to update simultaneously.
6. **`Action.run` / `withLegacyRunBridge` / `DispatcherPresenceProvider` / singular `useKeybinding` deletion**: only safe after (4) + (5).

Doing any one of these without the others leaves the codebase in a half-state where some things route through the dispatcher and others don't, with subtle behavioral inconsistencies. Phase 12 already proved that splitting the work surfaces ambiguity that the executor can't resolve cleanly.

## File map

**Modify (substantive):**
- `src/interactions/actions/invoker.ts` — extend `OngoingHandle` with optional `previewIds()` + `previewPose(id)`.
- `src/interactions/dispatcher/dispatcher.ts` — surface in-flight handles for the preview-ghost layer.
- `src/canvas/SceneCanvas/usePreviewGhostLayer.ts` — walk dispatcher handles alongside tool registry.
- `src/interactions/actions/defaults/{move,resize,rotate,clone,areaSelect,lassoSelect,editAnchors,insert}.ts` — invokers gain preview tracking (maintain a per-handle `Map<id,pose>` and return it via the new `previewPose`/`previewIds` methods).
- `src/canvas/SceneCanvas.tsx` — drop `DispatcherPresenceProvider` mounting; thread dispatcher into preview-ghost layer.
- `src/interactions/actions/registry.tsx` — delete `Action.run`, legacy `defaultBinding: KeyBinding`, legacy keydown loop, `DispatcherPresence` consumption.
- `src/interactions/actions/useStandardActions.ts` — delete `withLegacyRunBridge`, simplify factory wiring.
- Every default-action factory in `src/interactions/actions/defaults/` that spreads `defaultBinding` — switch to `gestureBinding` (where appropriate; some bindings have no GestureSpec equivalent and need to be deleted entirely).
- `packages/weasel-ui/src/components/ActionBar/ActionBar.tsx` — already migrated to `registry.trigger` (Phase 12 Task 7). No change.
- `src/tools/builtin/useSelectTool/useSelectTool.ts` — delete `routes` field entirely; remove `useMove` / `useAreaSelect` imports.
- `src/tools/builtin/useRotateTool/useRotateTool.ts`, `src/tools/builtin/useCloneTool/useCloneTool.ts`, `src/tools/builtin/useLassoTool/useLassoTool.ts`, `src/tools/builtin/useEditAnchorsTool/useEditAnchorsTool.ts`, `src/tools/builtin/useTextTool/useTextTool.ts` — remove legacy hook imports.
- `src/tools/types.ts` — once no tool uses `previewIds`/`previewPose`, decide whether to keep them on `Tool` (consumers can still need them) or remove. Lean keep.

**Delete:**
- `src/interactions/useMove.ts`
- `src/interactions/useResize.ts`
- `src/interactions/useRotate.ts`
- `src/interactions/useAreaSelect.ts`
- `src/interactions/useInsert.ts`
- `src/interactions/useClone.ts`
- `src/interactions/useLassoSelect.ts`
- `src/interactions/useEditAnchors.ts`
- `src/tools/useKeybinding.ts` (singular)
- `src/interactions/dispatcher/dispatcherPresence.tsx`
- `withLegacyRunBridge` (wherever it lives)
- The `Tool.bindingsOverrideDrag` flag if nothing sets it after the migration (audit at the end)

**Test updates:**
- ~40 factory-output tests that assert on `factory(deps).defaultBinding` need to either (a) move to asserting on `gestureBinding`, or (b) delete (if redundant with the descriptor's own tests).
- Smoke + integration tests that mount tools should now pass without the legacy hooks; verify the preview-ghost layer still renders during drag (visual smoke OK; or a focused test of the new preview surface).

## Tasks

### Task 1: Design + implement the dispatcher preview surface

Two sub-decisions:

1. **Where preview state lives.** Each `OngoingHandle` keeps its own preview `Map<id, TPose>` (or whatever shape the action mutates). Add optional methods to `OngoingHandle`:
   ```ts
   previewIds?(): Iterable<string> | null;
   previewPose?(id: string): unknown | null;
   ```
2. **How the canvas reads from it.** The dispatcher exposes its `inFlightHandles` (today private to `dispatcher.ts`) via a small read-only iterator: `getInFlightHandles(): Iterable<OngoingHandle>`. The preview-ghost layer queries both `tools.<x>.previewIds/Pose` AND `dispatcher.getInFlightHandles().*.previewIds/Pose`, merging by first-non-null semantics.

Write a focused test: an `OngoingHandle` exposes a preview pose for `id: 'a'` while in-flight; the canvas's preview-ghost layer renders a ghost at that pose; on commit, the ghost goes away.

### Task 2: Wire preview state into existing dispatcher-path actions

For each action that produces visible drag motion, replace the "write directly to scene on every onMove" pattern with "buffer in preview Map; commit on onEnd":

- `moveAction` (Phase 6 REAL) — preview the moved poses; commit on onEnd.
- `resizeAction` (Phase 12 REAL) — preview the resized pose.
- `rotateAction` (Phase 11 REAL) — preview the rotated pose.
- `cloneAction` (Phase 11 REAL) — preview the cloned-node poses.
- `lassoSelectAction` (Phase 14b) — no pose preview; selection-overlay-only. Skip.
- `editAnchorsAction` (Phase 14b/14d) — preview the moved anchor positions.
- `areaSelectAction` (Phase 11) — selection-overlay; skip pose preview.
- `insertAction` (Phase 11 / 14c.3) — preview the inserted pose at commit-time only (or live during drag if the tool wants).

This is where the substance lives. Each action needs to be reviewed against its legacy hook counterpart to make sure the dispatcher path produces the same visible behavior during drag, not just the same final commit. Use the legacy hook's `previewPose` impl as a reference.

### Task 3: Per-tool legacy hook removal

For each tool that imports a legacy hook, delete the import. The tool's drag now flows entirely through `Tool.bindings` → dispatcher → action invoker → preview surface → scene commit:

- `useSelectTool` — delete `useMove`, `useAreaSelect` imports; delete `routes` field.
- `useRotateTool` — delete `useRotate` import.
- `useCloneTool` — delete `useClone` import.
- `useLassoTool` — delete `useLassoSelect` import.
- `useEditAnchorsTool` — delete `useEditAnchors` import.
- `useTextTool` — delete `useInsert` (or similar) import. If no Tool.bindings binding exists for text-edit gesture yet, leave a clear TODO and don't break the tool.

Run smoke tests + full vitest after each tool migration. Drag behavior should be unchanged; ghost rendering should still appear.

### Task 4: Delete legacy gesture hooks

After Task 3: `git grep useMove\\|useResize\\|useRotate\\|useAreaSelect\\|useInsert\\|useClone\\|useLassoSelect\\|useEditAnchors` should return only the files themselves and the kit's barrel re-exports.

Delete the eight files. Remove their entries from `src/index.ts` and `src/import-shims/`. Update `tsup.config.ts` if any of them were standalone entrypoints.

### Task 5: Migrate kit-standard descriptors `defaultBinding` → `gestureBinding`

For each of: `escape`, `selectAll`, `delete`, `duplicate`, `group`, `ungroup`, `undoRedo`, `flip`, `nudge`, `reorder`:

```ts
// BEFORE
defaultBinding: { key: 'Escape' },

// AFTER
gestureBinding: { kind: 'key', key: 'Escape' },
```

Modifier and parametric variants follow Phase 4's patterns (nudge 8→4, reorder 4→2, flip 2→1).

For each, also update the corresponding legacy factory (`defaultEscapeAction`, etc.) so the spread-into-output no longer pulls in `defaultBinding`. Decide per factory: either (a) preserve the factory's output for backwards-compat by deriving a `defaultBinding`-like shape from the descriptor (verbose), or (b) delete the legacy factory entirely if no external consumer depends on it. (a) is safer; (b) is cleaner. Pick per-factory based on consumer audit.

### Task 6: Update factory-output tests

~40 tests assert on `factory(deps).defaultBinding`. For each:
- If the test is verifying "this action has a keybinding" — switch to assert on `gestureBinding`.
- If the test is asserting "the factory bridges descriptor → action correctly" — restructure to test the descriptor directly.
- If the test is redundant with descriptor-level tests — delete.

### Task 7: Delete the legacy keystroke loop + adjacent plumbing

In `src/interactions/actions/registry.tsx`:
- Delete the `useKeybinding`-walking-`defaultBinding` keydown listener.
- Delete the `Action.run?` field from the `Action` type.
- Delete the `Action.defaultBinding?: KeyBinding` field from the `Action` type.
- Delete the `DispatcherPresence` context consumption.

In `src/interactions/actions/useStandardActions.ts`:
- Delete `withLegacyRunBridge`.
- Simplify the factory-wiring code path to skip the legacy bridge.

Delete `src/tools/useKeybinding.ts` (singular). Migrate any remaining consumers (`escape`, `reorder` per the Phase 12 audit; verify) to use `useKeybindings` (plural) or fire through the dispatcher.

Delete `src/interactions/dispatcher/dispatcherPresence.tsx`. Remove `<DispatcherPresenceProvider>` mounting in `<SceneCanvas>`. Any tool that consults `useIsDispatcherMounted()` (`useSelectTool`, `useLassoTool`, shape tools) now unconditionally treats itself as dispatcher-driven — the `bindingsOverrideDrag: gestureDispatcherMounted` pattern becomes `bindingsOverrideDrag: true`.

If no tool sets `bindingsOverrideDrag` after this audit (it's now redundant since route-table drags are deleted), delete the flag from `Tool` type as well.

### Task 8: Verify + commit

- `npm run prepublishOnly` green from main checkout.
- `npm run build:demo` green.
- `npm run test:stories` green.
- Manual visual smoke: `npm run dev:kit` — every tool's drag produces a ghost during the gesture, commits cleanly on release, cancels cleanly on Escape.
- Per-task commits (~8 commits). Each commit message names what it deletes and what it migrates.
- Update `docs/TODO.md`: close out the Phase 10/12/14e blocker note. Mark the registry-unification arc as complete (Phase 14f remains as a cosmetic rename pass).

## Done criteria

- The eight legacy gesture-hook files are deleted.
- `useSelectTool.routes` is empty/undefined.
- No tool imports a legacy gesture hook.
- All kit-standard descriptors use `gestureBinding`, not `defaultBinding: KeyBinding`.
- `Action.run`, `Action.defaultBinding: KeyBinding`, `withLegacyRunBridge`, `DispatcherPresenceProvider`, singular `useKeybinding` all deleted.
- Dispatcher-path actions surface preview state via `OngoingHandle.previewIds/Pose`; the preview-ghost layer renders them.
- All tests pass; tsc clean; build:demo green; visual smoke confirms ghost rendering still works.
- Phase 14f (the cosmetic `gestureBinding → defaultBinding` rename) becomes the mechanical sweep the original Phase 14f plan describes.

## Risks

- **Overlay-handoff visual regressions.** A ghost that renders at a slightly different pose than the legacy hook (e.g., subtly different pivot for resize) is easy to miss in tests but obvious in dev. After Task 2, run each builtin tool in `npm run dev:kit` and compare drag behavior to a pre-14e baseline.
- **Containers + nested children.** The legacy preview layer clips children to a container's previewed silhouette (see `usePreviewGhostLayer.ts` lines 95–100). Dispatcher-path actions writing to `OngoingHandle.previewPose` must include all displaced children, not just the active selection roots, or container drags will look broken. Audit `moveAction` first.
- **`defaultDuplicateAction`-style factories with non-keystroke bindings.** Some factories accept bindings as constructor args (e.g., `defaultDuplicateAction({ key: 'D', meta: true })`). The migration needs to preserve the override surface — agent should grep external callers (apps/swillustrator) for these patterns before refactoring.
- **`useKeybinding` (singular) callers beyond `escape`/`reorder`.** Phase 12's audit found those two; verify exhaustively before deleting.
- **Tool-bindingsOverrideDrag flag drift.** If any tool still legitimately wants route-table drag (i.e., not migrated), don't delete the flag yet — leave with a TODO.

## What's next

Phase 14f: rename `gestureBinding → defaultBinding` kit-wide now that the legacy field is gone. Pure mechanical sweep — was always meant to be the cosmetic close-out.
