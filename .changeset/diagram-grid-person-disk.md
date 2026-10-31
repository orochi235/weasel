---
"@weasel-js/diagram": patch
---

A `grid` layout, in `LAYOUTS` and exported: nodes stand in rows of a fixed number of columns, left to right and top
to bottom, as a block diagram does. Its `grid` layout option gives the top level's `columns`, each group's own under
`groupColumns`, how many columns an item `spans`, and how many empty cells it `skips` before it. A group, or a
container fitted to what it holds, is a grid of its own inside its cells. `diagramScene`'s `layout` now also names
`'radial'` and `'grid'`.

Two outlines: `person`, a head over a body with rounded shoulders, its rows in the body; and `disk`, a drive seen
from above, standing over its label as the other devices do.
