---
'@weasel-js/geom': major
'@weasel-js/core': major
---

`mat3.apply` is renamed `mat3.transformPoint`, matching the affine `transformPoint` it mirrors.

```ts
// before
const [x, y] = mat3.apply(m, px, py);
// after
const [x, y] = mat3.transformPoint(m, px, py);
```

<!-- entry: breaking api -->
