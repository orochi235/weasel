---
'@weasel-js/plot': major
---

`setQuadrantPoint` is `setQuadrantPointAt`: it moves a point to a position and leaves its name and class alone.

```ts
// before
const next = setQuadrantPoint(data, 1, { x: 0.25, y: 0.75 });
// after
const next = setQuadrantPointAt(data, 1, { x: 0.25, y: 0.75 });
```

<!-- entry: breaking api -->
