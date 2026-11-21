---
'@weasel-js/svg': patch
---

Importing SVG reads a `marker-start`, `marker-mid`, or `marker-end` set on a `<g>` into the group's stroke, so a shape that takes the group's stroke keeps its marker when exported again.

<!-- entry: fix visual data -->
