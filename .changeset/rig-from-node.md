---
'@weasel-js/core': patch
---

Adds API: a rig can live in the scene. `rigFromNode(scene, id)` reads a skeleton from a node's `data.skeleton`, with its joints relative to that node's box and turned as the node is, and gathers from every node under it a `data.skin` (a path that bends) or a `data.joint` (a node that rides that joint whole). It answers the `skeleton`, `bindings`, and `skins` `bindRig` takes. `useRigNode({ scene, node })` binds that rig for a component's lifetime and binds it again when the rig node or anything under it changes its pose or data; an edit elsewhere in the scene leaves the rig, and its `target`, alone.
