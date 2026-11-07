---
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
'@weasel-js/diagram': patch
'@weasel-js/kernel3d': patch
---

Undoing an insert restores the selection from before it. The insert and place actions clear the selection at the press, and the pen and spiro tools select the path they finish or continue; each of those changes now commits in the same undo entry as the node, so under an `applyOps` history that knows nothing about the selection, undo no longer leaves it empty or still on the node it removed. A pen join commits its selection the same way.

This changes two dep contracts, which breaks a consumer's own `insert` or `editAnchors` dep. Both take a `CommitSelection` (`from`, the selection before the change, and `selectNode`): `InsertDep.commit` as a fourth argument and `EditAnchorsDep.applyEdit` as a fifth, both named `select`. A dep that applies ops appends `commitSelectionOps(select, id, label)` to its batch. An insert that applies none must set the selection itself, to the new node with `selectNode` and to nothing otherwise; an edit that commits nothing changes no selection. A dep that ignores `select` leaves the selection empty after an insert, and the pen and spiro tools no longer select what they draw or continue through it. These batches now carry a `setSelection` op, so a consumer history's adapter needs `setSelection`. kernel3d's `createInsert` passes `select` to `mint` as a third argument.
