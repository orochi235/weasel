---
'@weasel-js/svg': patch
---

A boolean group whose result is empty now survives an SVG round trip. `svgNodesFromKit` writes it as its hidden operands with no path before them, rather than a `<path d="">` that `parseSvg` warned about and dropped, and `svgNodesToKitDrafts` reads that back as a boolean group (`boolean` on the mark draft) in the group's own paint, posed over its operands, instead of a plain hidden group.
