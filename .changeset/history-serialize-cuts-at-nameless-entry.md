---
'@weasel-js/history': patch
---

`serialize()` left an entry with a nameless op out of the snapshot and kept the entries on its far side, so after `restore` an undo stepped underneath a change that was still applied and could no longer be undone. The snapshot is now cut there: it keeps the undo entries newer than the last such entry, the redo entries nearer than the first, and the branches that fork from an entry it kept, and `droppedEntries` counts everything left out. A history holding a nameless entry reloads with less to undo than it did before.
