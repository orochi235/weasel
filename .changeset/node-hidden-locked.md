---
'@weasel-js/core': patch
'@weasel-js/svg': patch
'@weasel-js/guides': patch
'@weasel-js/path-tools': patch
---

A scene node can be hidden or locked on its own, not only through its layer. `SceneNode.hidden` keeps a node and its whole subtree from being drawn; `SceneNode.locked` keeps a node and its subtree drawn but out of reach, the way a locked layer's nodes are. Both are set through `scene.setHidden(id, hidden)` and `scene.setLocked(id, locked)`, each one undo step that neither lock blocks, or through the new `createSetHiddenOp` / `createSetLockedOp` against an adapter's `setHidden` / `setLocked`. Both go on `AddNodeSpec`, ride a snapshot, and come back with an undone removal. Additive.

`scene.isHidden(id)` is new, and `scene.isLocked(id)` now folds in the node flags. Both answer from `nodeGates`, now exported with `isNodeHidden`, `isNodeLocked` and `hidesSubtree`, which every reader asks: painting, point picking, the marquee and lasso, select-all, path snapping, measurement picking and snapping, sibling spacing guides, the slice and Girth tools, and text editing all pass over a hidden node, and the pickers over a locked one. The selection now drops a hidden node as it drops a locked one, so hiding a layer or a node deselects what it hides.

`@weasel-js/svg`: `svgNodesFromKit` writes a node carrying `hidden` with `display="none"`, which `parseSvg(…, { keepHidden: true })` reads back as hidden, and `unpackSvgFiles` now keeps a dropped file's hidden content, inserting it hidden rather than leaving it out.
