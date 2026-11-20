---
'@weasel-js/path-tools': minor
---

A node deleted while Create Outlines waits for a face is left out of the selection the conversion sets, and undo restores the selection in force when it ran.

`runCreateOutlines` takes the ids to convert as an optional third argument, and `applyOutlineStroke` as an optional third argument after its options; both default to the selection.

<!-- entry: fix api -->
