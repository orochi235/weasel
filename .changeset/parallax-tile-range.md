---
'@weasel-js/parallax': major
---

`tiledProject` is `tileRange`, named for the `TileRange` it returns.

```ts
// before
const { from, to } = tiledProject(visStart, visEnd, period);
// after
const { from, to } = tileRange(visStart, visEnd, period);
```

<!-- entry: breaking api -->
