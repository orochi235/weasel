---
'@weasel-js/geom': patch
---

`ringSignedArea` keeps a ring's sign and area however far from 0 it lies, so a small ring far out keeps its winding where the renderer and tessellation read it.

<!-- entry: fix -->
