---
'@weasel-js/geom': major
---

geom's `boxToBox` is renamed `rectToRect`, since it maps an x/y/width/height rect and geom's `Box` is a min/max tuple.

```ts
// before
const m = boxToBox(sx, sy, sw, sh, dx, dy, dw, dh);
// after
const m = rectToRect(sx, sy, sw, sh, dx, dy, dw, dh);
```

<!-- entry: breaking api -->
