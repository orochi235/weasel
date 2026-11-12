---
'@weasel-js/geom': patch
---

`lerp`, and `lerpPoint` and the vector lerps built on it, give `b` itself at `t = 1` rather than a value an ulp away.

<!-- entry: fix -->
