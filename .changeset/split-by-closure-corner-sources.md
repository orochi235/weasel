---
'@weasel-js/geom': patch
---

`splitByClosure` keeps each rounded corner on its own anchor in a path where a subpath starts after a `Z` without an `M`, so such a path exports with its corners in place.

<!-- entry: fix -->
