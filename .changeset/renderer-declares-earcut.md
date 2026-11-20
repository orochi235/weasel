---
'@weasel-js/renderer': patch
---

An install that nests `@weasel-js/geom` under renderer now resolves `earcut`, which renderer depends on.

geom's `./tessellate` loads it, and geom lists it only as an optional peer.

<!-- entry: fix -->
