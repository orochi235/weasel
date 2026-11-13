---
'@weasel-js/geom': major
---

`aabbOfPoints([])` returns `null`, as `boundsOfCoords` and `unionRects` do for nothing to bound, not an inverted box at ±Infinity.

```ts
// before
const box = aabbOfPoints(points); // min +Infinity, max -Infinity when empty
// after
const box = aabbOfPoints(points); // null when empty
if (box) …
```

<!-- entry: breaking -->
