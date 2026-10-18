---
'@weasel-js/labkit': patch
---

Removes the deprecated snapshot undo exports — `emptyStack`, `pushSnapshot`, `undo`, `redo`, `clearUndo`, and `UndoStack` — from `@weasel-js/labkit` and `@weasel-js/labkit/undo`. Use `createHistory` from `@weasel-js/history` (re-exported by `@weasel-js/core`) instead. Breaking for anything still importing them; a trial's own undo is unaffected.
