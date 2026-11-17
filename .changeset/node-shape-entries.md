---
'@weasel-js/core': major
---

`getNodeShapes` is `nodeShapeEntries`, since it lists a registry's entries.

```ts
// before
const ids = getNodeShapes().map((s) => s.id);
// after
const ids = nodeShapeEntries().map((s) => s.id);
```

<!-- entry: breaking api -->
