# Findings: apps.draw.src.modality

## Discarding a journal-less soft mode leaves its edits on the redo stack, so Redo brings the discarded work back
- where: apps/draw/src/modality/machine.ts:85 (undoSinceEntry, called from discardMode)
- scenario: with the `modes.undo` pref set to anything other than `'mode'`, enter path-edit, move two anchors (two entries on `history`), then discard (Cmd+Escape). `undoSinceEntry` undoes both entries with `history.undo()`, which moves them to the redo stack. Cmd+Shift+Z right after puts the discarded anchor moves back. With the pref at `'mode'` the same discard calls `activeJournal.cancel()`, and nothing can redo it. "Discard" gets two different answers depending on the pref; the journal-less path should finish with `history.dropRedo()`, which the History API offers for this purpose.
- evidence: read (machine.ts discardMode/undoSinceEntry; packages/history/src/historyTypes.ts:128 `dropRedo`)
- severity: low
- fix: apps/draw/src/modality/machine.ts
- size: line
- cause: discard implemented as plain undo, redo stack kept
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

<!-- done: 1 findings, files read: 13 -->
