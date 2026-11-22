---
'@weasel-js/svg': patch
---

`svgNodesFromKit` with `roots` below the top of the tree writes an `'inherit'` fill or stroke on the first node it walks, so the exported shape is drawn in its ancestors' paint instead of SVG's default black.

<!-- entry: fix data -->
