---
'@weasel-js/diagram': patch
---

`hops` and `labels="dodge"` on `DiagramView` read each shape and edge end where it draws, as `router="avoid"` now does. Both read a container member's pose, which specs store in the container's frame, as a world box: an edge to a member found no crossing where it crossed, and a member covering a label did not move it.
