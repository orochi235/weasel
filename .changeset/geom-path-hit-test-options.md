---
'@weasel-js/geom': major
'@weasel-js/core': major
---

`PointInPathOptions` is renamed `PathHitTestOptions`: it is the options type of every path-versus-region test, not only the point test.

```ts
// before
const opts: PointInPathOptions = { flattenTolerance: 0.25 };
// after
const opts: PathHitTestOptions = { flattenTolerance: 0.25 };
```

<!-- entry: breaking api -->
