---
'@weasel-js/paint': patch
---

`parseColor` reads `none`, CSS's missing component, as 0 in the space-separated syntax, so it reads back what `cssColorNotation` writes.

<!-- entry: fix -->
