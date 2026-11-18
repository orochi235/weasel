---
'@weasel-js/history': major
---

`touchedIdsFromOps` is `touchedIdsOf`: the node ids an op list touches.

```ts
// before
const ids = touchedIdsFromOps(ops);
// after
const ids = touchedIdsOf(ops);
```

<!-- entry: breaking api -->
