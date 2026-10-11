---
'@weasel-js/geom': patch
---

`splitPathBySegment`, `splitPathByPolyline`, and `snipPathByPolyline` scale their tolerances by the path's extent. A shape drawn in a very small coordinate space (0 to 0.001, say) had every cut piece discarded as negligible, so a knife cut returned `[]`, and a snip could merge two distinct crossings into none.
