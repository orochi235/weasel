---
'@weasel-js/geom': major
---

geom's `closest…` functions are `nearest…`, the word the rest of the kit uses for the same idea.

`closestPointOnSegment`, `closestOpenEnds`, `closestOnFlat` and `closestBetweenFlats` are `nearestPointOnSegment`, `nearestOpenEnds`, `nearestOnFlat` and `nearestBetweenFlats`; `@weasel-js/geom/3d`'s `closestPointOnLine`, `closestPointOnSegment` and `closestPointsRayLine` are `nearestPointOnLine`, `nearestPointOnSegment` and `nearestPointsRayLine`.

```ts
// before
const p = closestPointOnSegment(point, a, b);
// after
const p = nearestPointOnSegment(point, a, b);
```

<!-- entry: breaking api -->
