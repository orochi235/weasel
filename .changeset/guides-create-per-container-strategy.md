---
'@weasel-js/guides': major
---

`perContainer` is `createPerContainerStrategy`, spelled like the other factories: the strategy it builds keeps state.

This is a breaking rename, with no alias. Its arguments and the `forget` it returns are unchanged.

```ts
// before
const layout = perContainer((c) => quadtree(), { snap: nearestSnap() });
// after
const layout = createPerContainerStrategy((c) => quadtree(), { snap: nearestSnap() });
```

<!-- entry: breaking api -->
