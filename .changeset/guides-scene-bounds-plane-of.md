---
'@weasel-js/guides': minor
---

`siblingBounds`, `worldBoundsOf` and `worldUnionOf` take `planeOf`, to measure a parallax layer's boxes in the camera's world.

That is the world `deriveAlignmentGuides` puts its lines in.

```ts
const targets = siblingBounds(scene, ids, { planeOf: (id) => view.planeOf(scene.get(id)!.layer) });
```

<!-- entry: api fix -->
