---
'@weasel-js/core': patch
---

A drag into or out of a turned layout container now shows the container to its strategy upright, as the layout pass already did for `childPoses`, `arrive` and `depart`: `getDropTargets`, `reflowPoses`, `commitDrop`, `acceptsDrop` and `releaseDrop` get the container's box in its own frame, with its children and the dragged child taken into that frame, and what they return is taken back to world. A drop preview or commit into a rotated grid or stack now runs along the container's axes. An upright container's hooks see world, as before. A container's `bounds` handed to a drag hook now carry only `x`, `y`, `width` and `height`, where they used to carry the whole pose the descriptor measured.
