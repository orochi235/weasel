---
"@weasel-js/ui": patch
---

A `CurveEditor`'s curve has no `NaN` points past a repeated anchor in the Catmull-Rom modes, or for anchors near the double range in any mode. `sampleByInterpolation` takes a fractional sample count as the whole count below it, and a `NaN` or infinite one as 1.

<!-- entry: fix -->
