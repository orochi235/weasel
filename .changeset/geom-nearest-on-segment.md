---
'@weasel-js/geom': major
---

`nearestOnLine` is renamed `nearestOnSegment`, since it clamps to the segment's ends.

`closestPointOnLine` in `@weasel-js/geom/3d` is the one that reads an infinite line.

```ts
// before
const hit = nearestOnLine(px, py, x0, y0, x1, y1);
// after
const hit = nearestOnSegment(px, py, x0, y0, x1, y1);
```

<!-- entry: breaking api -->
