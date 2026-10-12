---
'@weasel-js/core': patch
---

Fixes: a line drawn with the line tool was inserted with a fill beside its stroke, so the Pathfinder actions, which count an operand as its stroke only when it has no fill, read it as its bare path: Unite of a rect and a line across it gave back the rect alone.

Changes behavior: a line is inserted with `fill: null`, as an open pen path already was, whatever the `insertPaint` option gives it. `paletteInsertPaint` now answers a stroke alone for a line.
