---
'@weasel-js/geom': patch
---

`distance`, `pointSegmentDist`, `segmentT`, and `nearestOnLine` answer finite, full-precision results for points past 1e154 or below 1e-154 apart, where their squares used to overflow to `Infinity` or `NaN` or underflow to 0.

<!-- entry: fix -->
