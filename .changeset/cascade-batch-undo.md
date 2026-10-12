---
'@weasel-js/core': patch
---

core: a batch applied through `sceneToAdapter(scene, { cascadeContainerPose: true }).applyOps(ops, label)` that posed a container and also its descendants came back wrong on undo, because each container's inverse cascaded a second time: A, B, and C at x = 0, 100, and 200 moved by 5 undid to 0, 95, and 190. Each op now remembers the poses it changed, its own and the cascade's, and its inverse restores them, so the batch undoes and redoes to the poses it started from. Not breaking. A history restored from a snapshot, and ops passed straight to `scene.applyBatch` with that adapter, still replay the old way.
