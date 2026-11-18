---
'@weasel-js/labkit': major
---

An annotation target's `content` and `shown`, and a mark's `frac`, name their size `width` and `height`, not `w` and `h`.

`FracRect` and `ContentWindow` are geom's `Rect`, and `ContentSize` and `PaneSize` are core's `Dims`. Saved marks load unchanged: the scene stores their bounds as poses, which already said `width` and `height`.

```ts
// before
targets: () => [{ id: 'pane', ref, content: { w: 260, h: 180 } }]
// after
targets: () => [{ id: 'pane', ref, content: { width: 260, height: 180 } }]
```

<!-- entry: breaking api -->
