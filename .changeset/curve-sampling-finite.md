---
"@weasel-js/ui": patch
---

`sampleByInterpolation`, and so a `CurveEditor`'s curve, no longer gives `NaN` points past a repeated anchor in the Catmull-Rom modes or for anchors near the double range in any mode. A fractional sample count is taken as the whole count below it, and a `NaN` or infinite one as 1, where `NaN` gave no points and a fraction dropped every anchor after the first.
