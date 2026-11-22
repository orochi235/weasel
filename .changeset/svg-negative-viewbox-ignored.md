---
'@weasel-js/svg': patch
---

An SVG `viewBox` with a negative width or height is ignored, as SVG says, instead of flipping percentages, markers, and the document's view box.

<!-- entry: fix -->
