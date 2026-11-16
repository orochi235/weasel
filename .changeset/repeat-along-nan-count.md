---
'@weasel-js/geom': patch
---

`stationsAlongPath` and `repeatAlongPath` read a `count` that is not a finite number as unset rather than throwing.

<!-- entry: fix -->
