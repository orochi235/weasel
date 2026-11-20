---
'@weasel-js/geom': patch
---

A shifted closed track read past its seam, by an open `at` or `nearest`, goes round the shifted track again, so items placed past the end of a run over it land where they belong.

<!-- entry: fix -->
