---
'@weasel-js/geom': major
---

`intersectRayAabb` takes an `Aabb`, the way `transformAabb` and `aabbAround` already do.

```ts
// before
intersectRayAabb(ray, box.min, box.max);
// after
intersectRayAabb(ray, box);
```

<!-- entry: breaking -->
