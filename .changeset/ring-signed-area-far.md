---
'@weasel-js/geom': patch
---

`ringSignedArea` keeps a ring's sign and area however far from 0 it lies. A small ring far out keeps the winding the renderer and tessellation read.

<!-- entry: fix -->
