---
'@weasel-js/minimap': major
---

`crosshairRects` returns rects whose size is `width` and `height`, so a 2D canvas painter reads them as it reads any other rect.

```ts
// before
for (const r of bars) ctx.fillRect(r.x, r.y, r.w, r.h);
// after
for (const r of bars) ctx.fillRect(r.x, r.y, r.width, r.height);
```

<!-- entry: breaking api -->
