---
'@weasel-js/geom': patch
---

`trackSlice` of a path or any other read-through shape finds the stretch's own nearest point. It clamped the whole shape's nearest point to the stretch, so on a path that bends back, a point beside another part of it answered at the stretch's end and at that end's distance rather than at the nearest point of the stretch.
