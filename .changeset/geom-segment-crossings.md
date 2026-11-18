---
'@weasel-js/geom': major
'@weasel-js/core': major
---

`intersectSegments` is renamed `segmentCrossings`: it returns the crossings of two segments, as its twin `pathCrossings` does for two paths.

```ts
// before
const hits = intersectSegments(a, b);
// after
const hits = segmentCrossings(a, b);
```

<!-- entry: breaking api -->
