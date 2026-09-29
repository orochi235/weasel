---
"@weasel-js/core": patch
---

A container's layout can be changed after `add`, undoably. `scene.setLayout(id, layout)` takes a `LayoutStrategy`, its key in `SceneRegistry.layout`, or `null` for none, and re-arranges the container's children under the new layout in the same undo step. A registered layout is recorded by its key, so a serialized history restores it. `createSetLayoutOp({ id, from, to })` is the same change as an op, applied through the new `setLayout` method on `sceneToAdapter`'s and `defaultCommitAdapter`'s adapters; name the layouts by key for an op that has to survive a persisted history. Additive.
