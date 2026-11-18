---
'@weasel-js/diagram': major
---

The helper that returns the ops inserting a stencil is `stencilInsertOps`, named for what it returns.

`stencilBuild` is renamed `stencilInsertOps`; its arguments and its `{ id, ops }` result are unchanged.

```ts
// before
const { id, ops } = stencilBuild(stencil, bounds, { layer: 'shapes', newId });
// after
const { id, ops } = stencilInsertOps(stencil, bounds, { layer: 'shapes', newId });
```

<!-- entry: breaking api -->
