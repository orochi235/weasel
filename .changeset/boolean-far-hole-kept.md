---
'@weasel-js/geom': patch
---

Path booleans keep a small hole in a path that lies far from the origin, where rounding could read it as filled.

<!-- entry: fix -->
