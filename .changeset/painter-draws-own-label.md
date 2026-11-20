---
'@weasel-js/core': minor
---

A node-shape painter can draw a node's `data.label` itself: `drawsLabel: true` on its entry stops the kit drawing a second label over it.

```ts
registerNodeShape({ id: 'app:card', matches, paint, drawsLabel: true });
```

Such a node is culled by the painter's `bounds` again, where a `data.label` used to keep it always painted.

<!-- entry: api fix visual -->
