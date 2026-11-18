---
'@weasel-js/diagram': major
---

The diagram trait's `group` field is `cluster`, and its box's derive key is `'diagram:cluster'`, which was `'diagram:group'`.

A scene saved under the old names still loads: `withDiagramRegistry` carries `upgradeClusterNames`, a core `NodeUpgrade` under `DIAGRAM_CLUSTER_UPGRADE`, which rewrites each old node as `sceneFromJSON` or `loadState` reads it. A registry built without `withDiagramRegistry` adds it to its `upgrades` to do the same.

```ts
// before
scene.add({ kind: 'mark', layer: 'main', pose, data: { diagram: { group: { inset: 12 } } }, dependsOn: members });
// after
scene.add({ kind: 'mark', layer: 'main', pose, data: { diagram: { cluster: { inset: 12 } } }, dependsOn: members });
```

<!-- entry: rank=5 breaking api data -->
