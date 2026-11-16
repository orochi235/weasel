---
'@weasel-js/geom': patch
---

`sampleCatmullRom` answers finite points for anchors spaced past 1e154 or below 1e-154 apart, instead of `NaN`.

<!-- entry: fix -->
