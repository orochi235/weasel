---
'@weasel-js/geom': major
---

`pointSegmentDist` and `pointSegmentDist2` are renamed `pointSegmentDistance` and `pointSegmentDistance2`.

Both the main entry and `@weasel-js/geom/nd` carry the new names, matching `distance` and `distance2`.

```ts
// before
const d = pointSegmentDist(px, py, ax, ay, bx, by);
// after
const d = pointSegmentDistance(px, py, ax, ay, bx, by);
```

<!-- entry: breaking api -->
