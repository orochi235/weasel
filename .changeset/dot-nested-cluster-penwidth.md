---
'@weasel-js/diagram-formats': patch
---

A box with no stroke width inside one with a stroke width keeps its width unset through DOT, not the outer box's. Reading DOT takes a size or pen width set to `""` as unset, as Graphviz does, with no warning.

<!-- entry: fix data -->
