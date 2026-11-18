---
'@weasel-js/core': minor
---

A `SceneRegistry` can carry `upgrades`, which rewrite old saved nodes as they load so a rename keeps old saves loading.

`sceneFromJSON`, `Scene.loadState` and `specsFromSerialized` run every upgrade in the registry, in key order, on each node of the save before resolving its keys. An upgrade is a `NodeUpgrade`, `(node: SavedNode) => SavedNode`: it returns a new node and leaves one already in the current shape as it is.

```ts
const registry: SceneRegistry<RectPose> = {
  derivePose: { 'mine:follow': follow },
  upgrades: { 'mine:rename': (n) => (n.derivePoseKey === 'mine:old' ? { ...n, derivePoseKey: 'mine:follow' } : n) },
};
```

<!-- entry: api data -->
