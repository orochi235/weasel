---
'@weasel-js/svg': patch
---

`svgNodesFromKit` with `roots` below the top writes an `'inherit'` paint on the first node it walks. The shape takes its ancestors' paint, not black.

<!-- entry: fix data -->
