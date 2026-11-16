---
'@weasel-js/core': minor
---

An insert node factory can say how its commit batches and what runs once it lands.

An `InsertNodeFactory` returns an `InsertedNode`: `data`, an optional `pose`, `batch(id)` for the options of the batch the commit applies (a node made to be typed into opens a run its first edit joins), and `inserted(id, deps)`, run with the canvas's deps once the commit has applied.

<!-- entry: new api -->
