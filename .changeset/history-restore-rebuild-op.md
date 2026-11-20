---
'@weasel-js/history': minor
---

`History.restore` takes a `rebuildOp`, asked before the history's own, for ops an owner learns to rebuild only after creating it.

```ts
history.restore(saved, { rebuildOp: (name, args) => (name === 'my:op' ? myOp(args) : null) });
```

<!-- entry: api -->
