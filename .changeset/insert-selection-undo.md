---
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
'@weasel-js/diagram': patch
'@weasel-js/kernel3d': patch
---

Undoing an insert restores the selection from before it. The insert and place actions clear the selection at the press, and the pen and spiro tools select the path they finish; each of those changes now commits in the insert's own undo entry, so under an `applyOps` history that knows nothing about the selection, undo no longer leaves it empty or still on the removed node. A pen join commits its selection the same way.

This changes the `InsertDep` contract, which breaks a consumer's own `insert` dep. `commit` takes a fourth argument, `select` (an `InsertSelection`: `from`, the selection before the insert, and `selectNew`). A `commit` that applies ops appends `insertSelectionOps(select, id, label)` to its batch; one that applies none must set the selection itself, to the new node with `selectNew` and to nothing otherwise. A dep that ignores `select` leaves the selection empty after an insert, and the pen and spiro tools no longer select what they draw through it. The batch now carries a `setSelection` op, so a consumer history's adapter needs `setSelection`. kernel3d's `createInsert` passes `select` to `mint` as a third argument.
