---
'@weasel-js/core': patch
---

Dragging a container that holds a derived-pose child no longer shows that child jumping to its authored placeholder for the length of the drag. The move action now captures each dragged node and descendant at the pose it is painted at (`effectivePose`), and commits the authored pose translated by the drag, so undo restores the placeholder exactly. No API change.
