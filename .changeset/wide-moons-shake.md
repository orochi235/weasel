---
'@weasel-js/core': patch
'@weasel-js/kernel3d': patch
---

Resolve a screen rectangle at a pose's own depth, and stop deriving a group's
bounds from poses the kit cannot read.

`kernel3d`'s `PoseDescriptor.remapBounds` and `fromBounds` threw: a rectangle on
screen names a pose only once something says how far away it is. Both now
resolve it on the plane through the pose they were handed, facing the camera, so
neither changes depth. A resize scales uniformly — two screen extents cannot
name three — and `fromBounds` returns a world-axis-aligned box whose third
extent is the mean of the two the rectangle gives it.

`core`'s `unionOfChildren`, which every scene carries under
`kit:unionOfChildren`, read its members as rects with no check and produced a
box of `NaN` in a scene posed otherwise. It now declines, and the container
keeps its authored pose; `unionOfChildrenVia(descriptor)` remains the way to
make such a container track its members.
