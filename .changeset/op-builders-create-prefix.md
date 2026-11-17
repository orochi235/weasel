---
'@weasel-js/core': major
---

`commitSelectionOps`, `deleteNode` and `insertAt` are `createCommitSelectionOps`, `createDeleteNodeOp` and `createInsertNodeOp`.

They return ops and commit nothing.

Their arguments are unchanged.

```ts
// before
ops.push(deleteNode(scene, node, label), insertAt(copy, index, label));
// after
ops.push(createDeleteNodeOp(scene, node, label), createInsertNodeOp(copy, index, label));
```

<!-- entry: breaking api -->
