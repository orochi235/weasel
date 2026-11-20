---
'@weasel-js/path-tools': patch
---

An install that nests `@weasel-js/geom` under path-tools now resolves `earcut` and `polygon-clipping`, which path-tools depends on.

geom's `./warp` and `./booleans` load them, and geom lists them only as optional peers.

<!-- entry: fix -->
