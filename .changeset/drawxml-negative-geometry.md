---
"@weasel-js/diagram-formats": patch
---

A draw.io cell whose geometry has a negative `width` or `height` now reads as the box draw.io renders, reaching back from `x` and `y` with a positive size, instead of a node with a negative size. An edge label cell, whose relative geometry places it along its edge, keeps its place as written.
