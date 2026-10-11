---
'@weasel-js/core': patch
---

The inverses of `createReorderOp`, `createMoveToIndexOp`, and a cascading `createDeleteOp` had no `name`, so a history entry built from one could not be serialized and took the older undo entries out of the snapshot with it. They are now named ops that rebuild from their args. Two additions carry them: `createSetChildOrderOp` (op name `setChildOrder`) writes a parent's whole child order and inverts to the order it replaced, and `InsertArgs` gains an optional `cascaded` list, so one `insert` op can bring back a node together with everything a delete of it took. Both are additions to the persisted history format; a snapshot written before them still loads.
