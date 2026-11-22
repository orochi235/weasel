---
'@weasel-js/geom': patch
---

`lengthAtCurve` floors a fractional `run` as it floors `segment`, and answers NaN for a NaN field, rather than throwing.

<!-- entry: fix -->
