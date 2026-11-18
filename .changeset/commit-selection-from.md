---
'@weasel-js/core': major
---

`selectCommitted` is `commitSelectionFrom`, since it builds a `CommitSelection` and selects nothing.

```ts
// before
edit.applyEdit(id, path, label, origins, selectCommitted(deps.operands));
// after
edit.applyEdit(id, path, label, origins, commitSelectionFrom(deps.operands));
```

<!-- entry: breaking api -->
