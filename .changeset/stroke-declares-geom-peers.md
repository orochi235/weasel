---
'@weasel-js/stroke': patch
---

An install that nests `@weasel-js/geom` under stroke now resolves `earcut` and `polygon-clipping`, which stroke depends on.

geom's `./tessellate` and `./booleans` load them, and geom lists them only as optional peers.

<!-- entry: fix -->
