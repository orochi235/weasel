---
"@weasel-js/core": patch
---

`LayerRecord.locked` now does something. A locked layer still paints, but its
nodes are out of reach:

- A click, marquee, lasso, double-click text edit, the `nodeAtPoint` dep (drop
  targets, the eyedropper) and Select All all pass over them. A pick query that
  only samples paint can take them back with `includeLocked: true`.
- The scene's selection never holds one: `setSelection` drops them, and locking
  a layer drops its nodes from the selection. Undoing the lock puts them back.
- Every node mutation on them throws: `add` onto the layer or under a locked
  container, `setPose`, `update`, `remove`/`removeMany` (including a cascade
  that reaches one), `setLayer` from or onto the layer, `setDependsOn`, `move`
  and `reorder`. Kit actions commit through those, so delete, nudge, move,
  resize, rotate, group, ungroup, reorder, cut and the paint actions refuse too.
- A lock covers a container's whole subtree, whatever layers its descendants
  are tagged to. There is no per-node lock.

`scene.isLocked(id)` answers the question, and `scene.unlocked(fn)` runs a
programmatic edit with the guard lifted. Undo and redo never need it. The
layer operations — the lock toggle itself, visibility, rename, reorder and
`removeLayer` — are not gated.

`scene.applyBatch`, `scene.batch` and `scene.history.apply`/`applyOps` are now
all-or-nothing: an op that throws partway reverts everything the call already
applied and records no undo entry. Before, the ops ahead of the throw stayed
applied with no entry to undo them.
