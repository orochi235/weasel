---
'@weasel-js/core': major
---

core's AABB helpers spell it `Aabb`, as the rest of the kit does: `unionAABB` and `drawnAABBOf` are `unionAabb` and `drawnAabbOf`.

```ts
// before
const box = unionAABB(boxes);
// after
const box = unionAabb(boxes);
```

<!-- entry: breaking api -->
