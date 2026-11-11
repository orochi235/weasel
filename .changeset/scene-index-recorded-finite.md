---
'@weasel-js/core': patch
---

`scene.add`, `scene.move`, and `scene.reorder` record the index a node lands at, held to the ends of its siblings,
rather than the index they were given, so a history read back from JSON places it alike. An add or move at
`Infinity` (the end) was written as `null` and redid at the start, and a reorder at `NaN` of a node already first
recorded an entry that changed nothing.
