---
'@weasel-js/core': minor
---

`worldPoseOf(scene, id)` answers where a node is in world, folded up through its containers under the scene's composition.

It reads the pose as shown by default, an in-flight gesture's override and scrolled containers included; pass `'document'` for the stored pose. `worldPoses(scene, reading)` builds the lookup once for a pass over many nodes.

```ts
const shown = worldPoseOf(scene, id);
const stored = worldPoseOf(scene, id, 'document');
```

<!-- entry: new api -->
