---
'@weasel-js/diagram-formats': patch
---

Writing draw-style XML gives a shape the font of its first text row, a header included, bold by its numeric `weight` where it has one.

A shape whose text rows are styled apart warns, since a cell holds one font for all its lines.

<!-- entry: fix data -->
