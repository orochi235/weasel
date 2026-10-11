---
'@weasel-js/core': patch
---

Holding Shift while dragging a resize handle on a node whose pose is a polygon `Path` wrote a path with NaN coordinates, and a `pointSnap` rule on the same node was handed NaN corners and left stray `x`/`y`/`width`/`height` fields on the path. `resizeAction` now hands its constraints and point snaps the pose's bounds, and writes a snap back through the pose descriptor.
