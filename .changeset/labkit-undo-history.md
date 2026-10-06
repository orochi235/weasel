---
'@weasel-js/labkit': patch
---

A trial's state undo now runs on weasel-history. `TrialRecord.undoStack` is gone; a trial holds a `History` in `TrialRecord.history`, which it makes on its first snapshot, so a new, cloned, swapped or reloaded trial has none — the same session-only lifetime as before. The store's `updateTrialUndoStack` is replaced by `setTrialHistory`. Breaking for anything reading `undoStack` off a record. `emptyStack`, `pushSnapshot`, `undo`, `redo`, `clearUndo` and `UndoStack` are still exported but deprecated, for code that used them as an undo of its own; use `createHistory` from `@weasel-js/core` instead.
