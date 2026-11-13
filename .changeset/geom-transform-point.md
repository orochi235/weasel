---
'@weasel-js/geom': major
---

geom's `applyToPoint` is renamed `transformPoint`, as `@weasel-js/geom/3d` names it, beside `transformCoords` and `transformPath`.

```ts
// before
const [x, y] = applyToPoint(m, px, py);
// after
const [x, y] = transformPoint(m, px, py);
```

<!-- entry: breaking -->
