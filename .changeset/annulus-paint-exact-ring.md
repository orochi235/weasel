---
'@weasel-js/core': patch
---

An annulus affordance paints exactly the ring its hit test takes, wherever its cutout sits.

A cutout off the ellipse's center is cut where it is, a ring whose rect corners fall inside the ellipse fills its corners, and a stroke traces only the ring's outline.

<!-- entry: fix visual -->
