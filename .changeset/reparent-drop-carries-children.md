---
'@weasel-js/core': patch
---

With `reparentOnDrop` on, dragging a container onto another container moved and reparented the container but left its children at their old positions, though the drag preview showed the whole subtree moving. `moveAction` now moves the dragged node's descendants in the same undo step as the reparent.
