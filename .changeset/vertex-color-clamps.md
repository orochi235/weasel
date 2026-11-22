---
'@weasel-js/editing': patch
---

`setVertexColor` clamps each RGBA channel to 0..1 before writing it, as the opacity actions clamp alpha.

<!-- entry: fix -->
