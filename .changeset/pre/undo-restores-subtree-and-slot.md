---
'@weasel-js/core': patch
---

Undo of a delete restores the subtree; undo of a group restores the slot

Two ops inverted to something narrower than what they applied, so undo
silently lost data.

`createDeleteOp.invert()` re-inserted a single node while `apply()` called
`removeNode`, which cascades the whole subtree. Delete a container with two
children, undo, and the container came back with `children: []` while both
children were gone. The op now snapshots its descendants preorder through the
adapter's optional `getNode` / `getChildren` — the snapshot is written back
into `args`, so an op rebuilt from a serialized entry still inverts — and
re-inserts each descendant at its captured slot. A flat adapter's `removeNode`
does not cascade, so the inverse skips any descendant the adapter still reports
as live rather than duplicating it.

`createReparentOp` carried only the parent ids, so undoing a Cmd+G appended
instead of restoring the sibling slot and paint order changed. `ReparentArgs`
now carries `fromIndex` / `toIndex` and places through the existing
`getChildren` / `setChildOrder` seam that `createReorderOp` already uses —
`setParent`'s signature is unchanged. Adapters without that seam no-op as
before. `groupAction` captures each member's index before mutating; `move` and
`snapToContainer` pass none and are byte-identical.

`ops/delete.test.ts` stubbed `removeNode` as a one-id delete that did not
cascade, which is why nothing caught the first bug. It now runs against a
tree-backed fake.
