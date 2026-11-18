---
'@weasel-js/measure': major
---

`measureAt` is `measureHitAt`, since it hit-tests the measurements near a point rather than measuring anything.

```ts
// before
const hit = measureAt(scene, measurements, point, reach);
// after
const hit = measureHitAt(scene, measurements, point, reach);
```

<!-- entry: breaking api -->
