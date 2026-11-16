---
'@weasel-js/core': minor
---

A node painter can declare its kind's geometry: its outline as paths, the generation it moves on, and the pieces a path effect lays.

`NodeShapeEntry` takes four optional members. `outline(node, pose, ctx)` answers a `NodeOutline` (`path()`, `parts()` split by paint, `stroked`, `load()`) for a kind whose silhouette is not its geometry, as text's line boxes are not its glyphs; booleans, Create Outlines and Outline Stroke read it. `geometryGeneration()` is a counter the kind bumps when that geometry changes with no edit, as a face landing does: the silhouette memo, the snap index and every derivation reading the kind are checked against it. `silhouetteKey(node, ctx)` names anything else the silhouette depends on, such as the view scale. `effectItems(node, pose)` gives the pieces a path effect lays one by one.

```ts
nodeShapesOf(scene).register({
  id: 'app:gem', matches: isGem, paint: paintGem, silhouette: gemBox,
  outline: (node, pose) => gemFacets(node, pose),   // a NodeOutline
  geometryGeneration: () => facetTableVersion,
});
const outline = sceneNodeOutline(scene, id);         // what an adapter's getOutline answers
```

`findNodeOutline`, `sceneNodeOutline`, `geometryGenerationOf`, `NodeOutlineError` and the `NodeOutline`, `NodeOutlineCtx` and `PaintedPath` types are exported.

<!-- entry: rank=10 new api -->
