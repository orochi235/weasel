---
'@weasel-js/core': minor
---

Shape painters can be registered for one scene: `nodeShapesOf(scene).register(painter)` paints and picks with it there and nowhere else.

Every scene has a registry of its own, resolved ahead of `defaultNodeShapes`, which holds the built-ins and what `registerNodeShape` adds for every scene. Drawing, picking, region selection, bounds, selection outlines, clips, snapping, and path effects made for a scene ask its registry. `findNodeShape(node, shapes)`, `getNodeShapes(shapes)`, and a `shapes` field on the paint, silhouette, ink, and `shapeCoversPoint` contexts take one explicitly; `createNodeShapes({ parent })` makes a free-standing one.

```ts
const release = nodeShapesOf(scene).register(gemPainter);
findNodeShape(node, nodeShapesOf(scene)); // gemPainter
findNodeShape(node);                      // the default registry's answer
```

<!-- entry: rank=5 new api -->
