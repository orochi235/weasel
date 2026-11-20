---
'@weasel-js/text-tools': patch
---

An install that nests `@weasel-js/geom` under text-tools now resolves `polygon-clipping`, which text-tools depends on.

geom's `./booleans` loads it, and geom lists it only as an optional peer.

<!-- entry: fix -->
