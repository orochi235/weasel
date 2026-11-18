---
'@weasel-js/guides': major
---

Guides' op factories are `createAddGuideOp`, `createReplaceGuideOp` and `createRemoveGuideOp`, spelled like the other op factories.

```ts
// before
ctx.applyBatch([addGuideOp(store, guide)]);
// after
ctx.applyBatch([createAddGuideOp(store, guide)]);
```

<!-- entry: breaking api -->
