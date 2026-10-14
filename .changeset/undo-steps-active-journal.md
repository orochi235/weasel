---
'@weasel-js/core': patch
---

While a scene has an active journal (`getActiveJournal` / `setActiveJournalAccessor`), `scene.undo`, `scene.redo`, `canUndo`, and `canRedo` (and the same on `scene.history`) now step that journal, the same place `applyBatch` sends edits. Before, undo stepped the scene's own history and skipped the journal's edits entirely: the `undo` action took back whatever came before the journal opened instead of the edit just made. Once the journal is suspended, committed, or canceled, undo steps the scene's history again. `historyEntries`, `historyIndex`, and `jumpToHistoryIndex` still read the scene's own history.
