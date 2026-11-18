---
'@weasel-js/geom': major
---

geom's nearest-point results name their distance `distance`, not `dist`.

This covers `CurveNearest`, `TrackNearest` and `PathNearestStation`.

```ts
// before
const { t, dist } = nearestOnLine(px, py, ax, ay, bx, by);
// after
const { t, distance } = nearestOnLine(px, py, ax, ay, bx, by);
```

<!-- entry: breaking api -->
