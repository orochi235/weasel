---
'@weasel-js/core': patch
---

Resizing a multi-selection that held a rotated node stretched that node along the wrong axis (a horizontal drag made a quarter-turned rect taller), and the dragged corner drifted away from the pointer. `resizeAction` now scales a rotated member of a multi-selection along its own axes, as it already did inside a group, and measures the drag against the same union box the handles are drawn on.
