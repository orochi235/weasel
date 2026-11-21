---
'@weasel-js/svg': patch
---

SVG import drops a mesh gradient patch with a point missing a coordinate, such as `10,`, with a warning. It had read the missing one as 0.

<!-- entry: fix -->
