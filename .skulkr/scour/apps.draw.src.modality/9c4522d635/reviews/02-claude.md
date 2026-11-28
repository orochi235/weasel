## Double-clicking a path with anchors does nothing from a soft mode other than normal, while a path without anchors switches modes
- where: apps/draw/src/modality/useCanvasModes.ts:58 (useCanvasModes, triggers `canEnter`)
- scenario: the machine is in `text-edit` (soft, non-scoping), and the user double-clicks a polygon path that has anchors. The trigger's `canEnter` refuses because `hasEditablePath` is true, leaving it to the canvas's `enterPathEdit`. But `enterPathEditAction` is `eligible: { mode: 'normal' }` (packages/path-tools/src/pathEdit/enterPathEdit.ts:58), so nothing takes the double-click and path edit never opens. Double-click a path with no anchors from the same mode and the trigger runs `enterModeOn`, which exits text-edit and enters path-edit. So whether a double-click moves the mode onto a path depends on whether the path has anchors. It should move the mode in both cases, as `createModeTriggersContribution`'s doc promises ("a double-click on another node moves a mode onto it").
- evidence: read
- severity: medium
- fix: apps/draw/src/modality/useCanvasModes.ts
- size: line
- cause: canEnter hands off to an action gated to normal mode
- confidence: likely

## Enter refuses a locked path, but a double-click opens path edit on one
- where: apps/draw/src/modality/useCanvasModes.ts:58 (useCanvasModes, triggers `canEnter`)
- scenario: a locked path is selected. Enter goes through `pathToEdit` (line 31), which returns null on `scene.isLocked`, so the key falls through. A double-click on the same path goes through the mode trigger, whose `canEnter` checks only `hasEditablePath`, and through `enterPathEdit`, which checks no lock either. Path edit opens on the locked path and lets its anchors be edited. The two ways of entering path edit give different answers on whether a locked path can be edited.
- evidence: read
- severity: low
- fix: apps/draw/src/modality/useCanvasModes.ts
- size: line
- cause: lock check only on the keyboard pathway
- confidence: likely

## A soft mode with no journal doesn't seal history on entry, so an edit can fold into a pre-mode entry that discard won't undo
- where: apps/draw/src/modality/machine.ts:59 (createModeMachine.enterMode)
- scenario: the `modes.undo` pref isn't `'mode'`, so a soft mode records straight to `history` and only notes `firstEntryId`. `enterMode` never calls `history.seal()`. The first `recordEntry` after entry can carry the same `coalesceKey` as the entry on top, which was pushed before the mode opened (`record` in packages/history/src/recording.ts:95 folds it with no time window, since nothing has stepped the stack in between). The in-mode edit then lives inside an entry whose id is below `firstEntryId`. `discardMode` → `undoSinceEntry` stops at that entry, so the edit survives Discard. Sealing at entry would make every in-mode edit a fresh entry with id ≥ `firstEntryId`.
- evidence: read
- severity: low
- size: line
- cause: missing history.seal() at mode entry
- confidence: likely

## Files read
apps/draw/src/modality/chrome/ModeBreadcrumb.module.css
apps/draw/src/modality/chrome/ModeBreadcrumb.tsx
apps/draw/src/modality/chrome/ModeStatusIndicator.tsx
apps/draw/src/modality/enterModeOn.ts
apps/draw/src/modality/enteredGroup.ts
apps/draw/src/modality/index.ts
apps/draw/src/modality/machine.ts
apps/draw/src/modality/modeScope.ts
apps/draw/src/modality/pathEditHost.ts
apps/draw/src/modality/shortcuts.ts
apps/draw/src/modality/useCanvasModes.ts
apps/draw/src/modality/useModality.ts
apps/draw/src/modality/useModeId.ts

<!-- done: 3 findings, files read: 13 -->
