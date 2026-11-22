---
'@weasel-js/ui': patch
---

`GradientEditor` keeps its stop selection when a caller declines a stop's removal.

The selection moves, and `onSelectionChange` fires, once the removal's commit arrives.

<!-- entry: fix -->
