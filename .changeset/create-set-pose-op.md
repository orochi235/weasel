---
'@weasel-js/core': major
---

`createTransformOp` and `TransformArgs` are `createSetPoseOp` and `SetPoseArgs`, like the other `createSet…Op` factories.

The op's recorded name stays `'transform'`, so saved histories still replay.

```ts
// before
ctx.adapter.applyOps?.([createTransformOp({ id, from, to })]);
// after
ctx.adapter.applyOps?.([createSetPoseOp({ id, from, to })]);
```

<!-- entry: breaking api -->
