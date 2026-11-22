---
'@weasel-js/svg': patch
---

A `stroke-dasharray` length in a unit the SVG reader does not convert is read as its number, as `stroke-width` reads it. It warns, as before, and no longer drops the whole declaration.

<!-- entry: fix -->
