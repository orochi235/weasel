---
'@weasel-js/geom': patch
---

Curve flattening treated a Bezier whose control points sit on the line through its endpoints as flat, even when they lie past an end: `M0 0 Q200 0 100 0` reaches x = 133.3 but flattened to one segment ending at x = 100, so its stroke, hit test, and boolean geometry disagreed with `boundsOfPath`. Flatness is now measured to the chord segment, so such a curve is subdivided along its real extent.
