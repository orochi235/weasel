---
'@weasel-js/editing': patch
---

An install that nests `@weasel-js/geom` under editing now resolves `polygon-clipping`, which editing depends on.

geom's `./booleans` loads it, and geom lists it only as an optional peer.

<!-- entry: fix -->
