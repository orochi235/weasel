---
'@weasel-js/diagram': minor
---

A `LayoutFrame` can answer a pose's box in three dimensions, and `createSolidFrame` builds one for a host of solids.

`LayoutFrame` gains optional `box3(pose)` and `translate3(pose, d)`; `box` is then the solid's face on the plane. `createSolidFrame({ box3, fromBox3 })` derives the whole frame from how a host reads and places a solid's 3D box, keeping the solid's depth when a box is set on the plane.

<!-- entry: api -->
