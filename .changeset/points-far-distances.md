---
'@weasel-js/geom': patch
---

`distance`, `pointSegmentDist`, `segmentT`, and `nearestOnLine` stay finite and exact for points past 1e154 or below 1e-154 apart.

<!-- entry: fix -->
