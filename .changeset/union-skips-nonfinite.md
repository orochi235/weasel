---
'@weasel-js/core': patch
---

`unionBounds` and `unionAABB` skip a box with a corner that is not finite, as `unionAABB` skips a hole, and a
union of only such boxes is `null`. A `NaN` width was half read (its `x` counted, its far edge not), and a union of
such boxes alone came back with a width of `-Infinity`.
