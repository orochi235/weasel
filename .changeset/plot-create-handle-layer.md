---
'@weasel-js/plot': major
---

`plotHandleLayer` is `createPlotHandleLayer`, spelled like the other layer factories.

```ts
// before
registerLayer(plotHandleLayer(scene));
// after
registerLayer(createPlotHandleLayer(scene));
```

<!-- entry: breaking api -->
