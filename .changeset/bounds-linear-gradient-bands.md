---
'@weasel-js/renderer': patch
---

A diagonal `units: 'bounds'` linear gradient on a non-square shape draws the same color bands as its SVG `objectBoundingBox` export.

`paintToLocalUnits` and `paintToBoundsUnits` now move a diagonal gradient's `to` so the bands keep their place across the conversion; gradient handles show and commit that point.

<!-- entry: fix visual -->
