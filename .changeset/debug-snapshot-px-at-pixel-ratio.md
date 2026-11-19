---
'@weasel-js/core': patch
---

`renderDebugSnapshot` at a `pixelRatio` above 1 draws `{ px }` strokes, hairlines and font sizes at the size the screen showed them, not a fraction of it.

<!-- entry: fix visual -->
