---
'@weasel-js/core': patch
'@weasel-js/diagram': patch
---

`PoseOverrides` has a new method, `read(id)`. It returns what a node is drawn and picked with: every source of overrides for that node folded into one, as of the last write or `commit()`. `get(id)` still returns the entry a writer stored, by reference. Painting, picking and `effectivePose` now call `read`. Today the only source is the entries table, so `read` and `get` agree. Once animations write overrides too, `read` will fold them in with the table.

Anyone who implements `PoseOverrides`, or the `overrides` of a `PoseSource` stand-in or of diagram's `ParticipantScene`, has to add `read`. For a stand-in, `read: (id) => entries.get(id)` reproduces the old behavior.

Core now depends on `@msb235/blits`, which does the folding.
