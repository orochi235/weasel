---
'@weasel-js/core': patch
---

The pen joins paths. Finishing a path by clicking (or dragging on) another open path's endpoint now makes one node: the drawn path's anchors followed by the other path's, turned around when you land on its last anchor, with the other node deleted in the same undo step. The path being drawn keeps its identity — a continued node keeps its id and style, and a new path is minted like any other pen path.

Two optional additions make that one op batch: `EditAnchorsDep.editOps(id, worldPath, label)` returns the ops `applyEdit` would commit without applying them, and the pen adapter's `makeNode(pose)` builds the node `addNode` would insert. `<SceneCanvas>` supplies both. Without them the click places an anchor, as before.
