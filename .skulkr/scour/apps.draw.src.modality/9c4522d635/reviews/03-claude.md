## Discarding an unjournaled soft mode leaves edits that coalesced into the entry pushed before the mode opened
- where: apps/draw/src/modality/machine.ts:58 (enterMode) and :84 (undoSinceEntry)
- scenario: `modes.undo` pref is not `'mode'`, so a soft mode records straight to `history` and `enterMode` only notes `firstEntryId = history.nextEntryId()`. It never calls `history.seal()`, so the first edit inside the mode can merge into the pre-mode top entry: same `coalesceKey` within `coalesceWindowMs`, or a keyed run (recording.ts:95 merges with no window). The merged entry keeps its old id (< `firstEntryId`), and `undoSinceEntry` stops at it, so Discard leaves that in-mode edit applied. The entry also now mixes pre-mode and in-mode work, so undoing it later takes back both. What should happen: everything done in the mode is taken back, and nothing from before it.
- evidence: read (packages/history/src/recording.ts:37-38, 93-97; historyTypes.ts:141-144 documents `seal` for exactly this case)
- severity: medium
- fix: apps/draw/src/modality/machine.ts
- size: line
- cause: mode boundary not sealed on history
- confidence: likely

## Discard is redoable in one soft-mode setting and not in the other
- where: apps/draw/src/modality/machine.ts:112 (discardMode)
- scenario: With the `modes.undo` = `'mode'` pref, Discard calls `activeJournal.cancel()`, and the session's edits are gone with nothing to redo. With the other setting, `undoSinceEntry` calls `history.undo()`, which moves every in-mode entry onto the redo stack, so Redo (Shift+Mod+Z) right after Discard puts the discarded edits back. One action, "take back the session's edits", gives two different answers depending on a pref that the doc says only controls undo granularity.
- evidence: read
- severity: low
- fix: apps/draw/src/modality/machine.ts (drop the undone entries from the redo stack, e.g. via history's prune/drop, or document the difference)
- size: function
- cause: undo used as discard
- confidence: likely

## The breadcrumb shows a blank name for a target or group whose label is the empty string
- where: apps/draw/src/modality/useCanvasModes.ts:77 (useModeTargetLabel); apps/draw/src/modality/enteredGroup.ts:43 (useEnteredGroupLabel)
- scenario: A node with `data.label === ''` (a label the user cleared in the layers panel) gets `'' ?? …`, which stays `''`. For a mode target, ModeBreadcrumb's `props.targetLabel &&` hides it, so the target isn't named at all, not even by its text or id. For an entered group, the bar renders "Group · " followed by an empty span. The fallback should treat an empty label as missing (`||`), as the doc ("its label, its text, or its id") intends.
- evidence: read
- severity: low
- fix: apps/draw/src/modality/useCanvasModes.ts, apps/draw/src/modality/enteredGroup.ts
- size: line
- cause: `??` keeps empty string
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
