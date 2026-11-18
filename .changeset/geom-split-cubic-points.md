---
'@weasel-js/geom': major
---

`splitCubicAtT` is renamed `splitCubicPoints`: it is the point-shaped form of `splitCubicAt`.

```ts
// before
const { left, right } = splitCubicAtT(p0, p1, p2, p3, t);
// after
const { left, right } = splitCubicPoints(p0, p1, p2, p3, t);
```

<!-- entry: breaking api -->
