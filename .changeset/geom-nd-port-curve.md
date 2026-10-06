---
"@weasel-js/geom": patch
---

Add a `@weasel-js/geom/nd` subpath: the port-curve rule over plain number
arrays, in any dimension.

`PORT_REACH`, `portControls`, `portCurvePoints` and `cubicAt` take and return
`readonly number[]`, so a tuple `[x, y, z]` passes as it is, with no conversion
to `{ x, y, z }`. They are the same functions the root barrel and `./3d` wrap,
so the three entries return the same numbers. `portCurvePoints` is new at this
level. As in the other entries it leaves out the start point, and the 2D and 3D
`portCurvePoints` now both call it.
