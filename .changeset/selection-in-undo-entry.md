---
'@weasel-js/core': patch
---

Cut at Crossings, Join, Duplicate, Delete (and the delete half of Cut), Group and an Alt-drag clone put their selection change in their own undo entry, as the Boolean operations and Create Outlines do. Undo now restores the selection the action started from under a consumer's `applyOps` history too, where it used to leave the action's result selected, or nothing. `commitOps` takes `{ select }` for this; with it the batch ends in a `setSelection` op, so an `applyOps` adapter sees one more op than before. A selection op in a batch committed to the scene now lands on the `selection` dep through its `get` and `set`.
