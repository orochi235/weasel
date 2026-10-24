---
"@weasel-js/labkit": patch
---

`useUndoKeys(history)` binds Mod+Z, Shift+Mod+Z and Mod+Y on the document to a history's undo and redo, the way a trial binds them to its own, for a lab laid out without `<Lab>`. It takes anything with `canUndo`, `canRedo`, `undo` and `redo` — a weasel `History` or a `TrialHistorySource` — leaves the chord to a text field, and leaves a chord with nothing to step to the browser. `undoKeyStep(event)` is the test both it and the trial use: which step a keydown asks for, or null.
