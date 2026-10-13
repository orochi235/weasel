---
'@weasel-js/core': patch
---

Adds API: a rig skins paths. `bindRig` and `useRig` take `skins`, a map from node id to a `Skin`, beside `bindings`, which is now optional. A bound node moves whole with one joint; a skinned node's path bends, each point following its own joints by weight, so one outline flexes at a joint. The rig shows the bent path through the node's pose override, posed at the path's bounds with no rotation, so paint, picking, and the selection box all follow it. `bake` writes the bent path into the node's `data.path` and its bounds into the pose, in the same undo entry as the bound nodes. A node cannot be both bound and skinned.

The rest path is read once, when the rig is bound, from the node's `data.path` carried through its pose. `restPath` reads it from elsewhere, and `dataRestPath` is the default.

Breaking for a hand-written `RigScene`: it now needs `update(id, { data })`, which `bake` uses for a skinned node, and its `get` may answer `data`. A `Scene` already has both.
