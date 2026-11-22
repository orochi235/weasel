---
'@weasel-js/geom': patch
---

`bezierCubic.discriminators` no longer offers an in handle on the first anchor or an out handle on the last, which no segment reads.

<!-- entry: fix -->
