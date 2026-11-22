---
'@weasel-js/geom': patch
---

`reachToMeet` reads a `maxDistance` of `Infinity` as no limit, as when it is unset, where in tangent and eased modes it met nothing.

<!-- entry: fix -->
