---
'@weasel-js/labkit': major
---

The rects a tiled surface hands its painters and frames name their size `width` and `height`, not `w` and `h`.

labkit's surface `Rect` is geom's `Rect`.

```ts
// before
surface.registerPainter(id, (rect) => draw(rect.x, rect.y, rect.w, rect.h));
// after
surface.registerPainter(id, (rect) => draw(rect.x, rect.y, rect.width, rect.height));
```

<!-- entry: breaking api -->
