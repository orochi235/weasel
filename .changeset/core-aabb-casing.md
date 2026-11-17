---
'@weasel-js/core': major
---

core's AABB helpers spell it `Aabb`, as the rest of the kit does: `unionAABB`, `drawnAABBOf` and `rotateAroundAABBCenter` are `unionAabb`, `drawnAabbOf` and `rotateAroundAabbCenter`.

```ts
// before
const box = unionAABB(boxes);
// after
const box = unionAabb(boxes);
```

<!-- entry: breaking api -->
