---
'@weasel-js/stroke': major
---

`strokeEdgeNear` is renamed `nearestStrokeEdge`: it returns the single nearest edge, where a `…Near` name elsewhere returns every match in reach.

```ts
// before
const hit = strokeEdgeNear(path, stroke, x, y);
// after
const hit = nearestStrokeEdge(path, stroke, x, y);
```

<!-- entry: breaking api -->
