---
'@weasel-js/geom': major
---

`transformCoords` takes the matrix first, as `transformPoint` does.

```ts
// before
const out = transformCoords(path.coords, m);
// after
const out = transformCoords(m, path.coords);
```

<!-- entry: breaking api -->
