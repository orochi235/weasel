---
'@weasel-js/geom': patch
---

`pathLengthTable` and `pointAtLength` measure and point along a curve whose coordinates sit past 1e154 or below 1e-154, instead of answering an infinite length or no tangent.

<!-- entry: fix -->
