---
'@weasel-js/path-tools': minor
---

A node deleted while Create Outlines waits for a face no longer stays selected after the conversion.

`runCreateOutlines` takes the ids to convert as an optional third argument, and `applyOutlineStroke` as an optional third argument after its options; both default to the selection.

<!-- entry: fix api -->
