---
'@weasel-js/core': patch
---

core: a batch that posed a container and also its descendants through a cascading adapter (`sceneToAdapter(scene, { cascadeContainerPose: true })`, what `<SceneCanvas>` uses without a composing strategy) came back wrong on undo, because each container's inverse cascaded a second time: A, B, and C at x = 0, 100, and 200 moved by 5 undid to 0, 95, and 190. The scene now records, with each op, every pose that op changed when it carried any for another node, and replaying the op in either direction puts those poses back without working the cascade out again. This holds for `adapter.applyOps`, for ops handed straight to `scene.applyBatch`, and for a history serialized and restored.

Additive: `Scene.carry(id, pose)` writes a pose on behalf of the op now applying, for an adapter that moves more than it was asked to. Outside an op it is `setPose`.

Changes what a snapshot holds: an op that carried poses serializes as `{ name: 'carry', args: { op, poses } }` around the op it stands for. An op that carried nothing serializes as before, and a snapshot written before this change restores and replays the way it did, the wrong undo of a mixed batch included.
