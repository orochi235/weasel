---
"@weasel-js/diagram-formats": patch
---

A draw.io cell with a negative `width` or `height` reads as the box draw.io renders, reaching back from `x` and `y` with a positive size. An edge label cell, placed along its edge by relative geometry, keeps its place as written.

<!-- entry: fix data -->
