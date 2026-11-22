---
'@weasel-js/editing': patch
'@weasel-js/core': patch
---

A Pathfinder result on a canvas is plain geometry, with no star or polygon generator and no per-vertex colors or widths. It also drops the source's skin, constraints, warp, and the form it was drawn from.

<!-- entry: fix -->
