---
'@weasel-js/editing': minor
'@weasel-js/core': minor
---

`setFill`, `setStroke`, and the other paint actions take an `ids` param naming the nodes to paint in place of the selection.

```ts
registry.begin('setFill', { paint, ids: ['node-1'] });
```

<!-- entry: new api -->
