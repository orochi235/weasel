---
'@weasel-js/geom': patch
---

`mergeRegion` throws a `RangeError` for a `tolerance` that is not a positive finite number, where a zero tolerance used to erase the whole shape.

<!-- entry: fix -->
