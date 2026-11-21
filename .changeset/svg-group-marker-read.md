---
'@weasel-js/svg': patch
---

Importing SVG reads the markers a `<g>` sets. A shape that takes the group's stroke keeps its marker when exported again.

<!-- entry: fix visual data -->
