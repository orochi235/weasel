---
'@weasel-js/core': minor
---

`sceneDataTarget` animates one field of a scene node's data, and a clip names it `data:<node id>.<field>` through `sceneClipTargets`' new `lenses`.

A `DataLens` says how to read the field and how to write it into a copy of the data. Animations of a node's fields show through one data override per node, which painting and picking read, and commit to the stored data unrecorded, as the pose target commits poses.

```ts
const opacity: DataLens<MyData, number> = { key: 'opacity', get: (d) => d.opacity, with: (d, v) => ({ ...d, opacity: v }) };
animator.tween({ target: sceneDataTarget(scene, id, opacity)!, to: 0, ms: 300 });
bindClip(clip, { target: sceneClipTargets(scene, { lenses: { opacity } }) });
```

<!-- entry: rank=5 new api -->
