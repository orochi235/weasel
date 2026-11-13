---
'@weasel-js/history': major
---

A journal applies ops with `applyOps`, the same name its `History` uses; `Journal.applyBatch` is gone.

```ts
// before
journal.applyBatch(ops, 'Rename');
// after
journal.applyOps(ops, 'Rename');
```

<!-- entry: breaking api -->
