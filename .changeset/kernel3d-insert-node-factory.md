---
'@weasel-js/kernel3d': minor
---

`createInsert` takes a `node` factory and commits the node itself, as one undo step with the insert's selection change.

```ts
createInsert({
  world, // with its `scene`
  node: ({ center, width, depth }) => ({ data, pose: pose3({ ...center, y: 0.5 }, { x: width, y: 1, z: depth }) }),
});
```

The node goes on the factory's `layer`, or the scene's first. The dep also implements `build`. `mint` still works for a host that commits on its own.

<!-- entry: rank=5 new api -->
