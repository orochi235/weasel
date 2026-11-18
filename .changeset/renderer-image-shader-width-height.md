---
'@weasel-js/renderer': major
---

An image draw command, its `source` rect and a shader command's `bounds` name their size `width` and `height`, not `w` and `h`.

`frameRect` returns the same shape. Each is now the `Rect` shape geom and the rest of the renderer use, so a box passes straight in.

```ts
// before
{ kind: 'image', image, x: 0, y: 0, w: 64, h: 32, source: { x: 0, y: 0, w: 16, h: 16 } }
// after
{ kind: 'image', image, x: 0, y: 0, width: 64, height: 32, source: { x: 0, y: 0, width: 16, height: 16 } }
```

<!-- entry: breaking api -->
