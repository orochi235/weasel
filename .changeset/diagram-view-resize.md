---
"@weasel-js/core": patch
"@weasel-js/diagram": patch
---

`DiagramView` takes `onResize`. With it set, a selected node shows resize handles; the box resizes
live under the drag, and on release the view reports `{ id, x, y, width, height }` for each resized
node and changes nothing until the specs follow. Store the box as the data node's `width`, `height`,
and `at`; the size is a minimum, so a box dragged smaller than its rows grows back to them.
`diagramResizable` now refuses a group's box, whose size comes from its members.

Core adds `createResizeAction({ commit })`, the resize action with its commit swapped: `commit` is
handed each resized node's pose at release, and the scene is left as it was.
