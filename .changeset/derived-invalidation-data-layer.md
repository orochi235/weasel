---
'@weasel-js/core': patch
---

A derived node now recomputes when a dependency's `data` or `layer` changes.

`derivePath` is handed its dependencies' nodes, not only their poses — so a
connector that thickens with a node's weight, or draws only for nodes on a given
layer, is answering off `data` and `layer`. `kit:setPose` and `kit:move`
invalidated the dependent's memo; `kit:setData` and `kit:setLayer` did not, so
the derived geometry kept the old answer with nothing on screen to show it was
stale. Undo and redo were wrong the same way.

Both ops now invalidate dependents on `apply` and on `revert`, matching the two
that already did.
