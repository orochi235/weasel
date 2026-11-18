---
'@weasel-js/core': minor
---

`renderOrderCompare(scene)` returns a `compareZ` over the scene's paint order that ranks the order once per structural edit.

```ts
const adapter = { ...rest, compareZ: renderOrderCompare(scene) };
```

<!-- entry: api perf -->
