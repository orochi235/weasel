# Findings: apps.draw.src.modality

## Enter and double-click answer "can path edit open this node" two different ways
- where: apps/draw/src/modality/useCanvasModes.ts:31 (pathToEdit)
- scenario: `pathToEdit` (the Enter key) takes a node only when `data.path != null` and it is unlocked; the double-click route (`triggers.canEnter` here, plus the canvas's `enterPathEdit` reached through `modePathEdit`'s `hasEditablePath`) asks `hasEditablePath`, which also accepts a polygon pose (`pose.kind === 'polygon'`, no `data.path`) and a `mark` drawn as its rect pose alone (`classifyPathStorage` in packages/core/src/domains/paths/editablePath.ts:43), and never asks `isLocked`. With such a node selected, Enter does nothing (the key falls through), but a double-click opens its anchors. With a locked path selected, Enter refuses it, but a double-click can still enter path-edit on it. It should be one predicate shared by both routes.
- evidence: read
- severity: medium
- fix: apps/draw/src/modality/useCanvasModes.ts
- size: function
- cause: duplicate path-editable predicate
- confidence: likely

## A double-click on a path is swallowed while a strict mode is open
- where: apps/draw/src/modality/useCanvasModes.ts:55 (useCanvasModes, triggers)
- scenario: In free-transform or crop, double-click a `path` node whose path has no anchors. The trigger's `canEnter` says yes because the only check is `hasEditablePath`, so the action is enabled and claims the double-click. Its `enter` is `enterModeOn`, which returns without doing anything while a strict mode is open (enterModeOn.ts:14). The gesture is used up and nothing happens, when it should fall through to the next binding on the double-click. `canEnter` should answer no while a strict mode is current, as `enterModeOn` does.
- evidence: read
- severity: low
- fix: apps/draw/src/modality/useCanvasModes.ts
- size: line
- cause: canEnter ignores enterModeOn's strict-mode refusal
- confidence: likely

## The breadcrumb's key caps are hard-coded instead of read from the mode's shortcuts
- where: apps/draw/src/modality/chrome/ModeBreadcrumb.tsx:46 (ModeBreadcrumb)
- scenario: The Cancel and Commit buttons always show `⎋` and `⏎`, but the keys that actually commit and cancel come from `mode.commit.shortcut` and `mode.cancel.shortcut` (`createModeShortcutsContribution`). A strict mode with other keys, or none on this platform (`shortcutOn` returns nothing), still shows Escape and Enter. The bar should render the mode's own chords.
- evidence: read
- severity: low
- size: function
- cause: second copy of the shortcut decision
- confidence: likely

## Discarding a soft mode without a journal keeps pre-mode entries undone during the mode
- where: apps/draw/src/modality/machine.ts:82 (undoSinceEntry)
- scenario: Set `modes.undo` to something other than `mode` (no journal). Enter path-edit, press undo twice so an entry made before the mode is undone (its id is < `firstEntryId`), edit once, then discard (Meta+Escape). `undoSinceEntry` undoes only entries with id >= `firstEntryId`, so the new edit is taken back. The pre-mode entry stays undone, and redoing it is no longer possible because the new edit cleared the redo stack. The document does not return to its state at entry, which is what "take back the session's edits" means.
- evidence: read
- severity: low
- size: function
- cause: discard tracks only entries pushed, not undos past entry
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

<!-- done: 4 findings, files read: 13 -->
