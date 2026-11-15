---
'@weasel-js/core': minor
---

A text node with a `{ px }` `fontSize` or `letterSpacing` keeps its screen size as the view zooms, and is picked and boxed where it draws.

The node painters' paint and silhouette contexts carry the view scale as `scale`, which `SceneCanvas` and `renderSceneToCanvas` fill in.

```ts
scene.add({ id, kind: 'mark', layer, pose, data: { text: 'A', style: { fontSize: { px: 14 } } } });
```

<!-- entry: rank=5 api fix visual -->
