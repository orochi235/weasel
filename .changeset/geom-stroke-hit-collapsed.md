---
'@weasel-js/geom': patch
---

`strokeHitTest` with a `slop` whose transform has no scale (a view mid-collapse) divided the pixel slop by zero and hit every path from any distance. It now hits nothing.
