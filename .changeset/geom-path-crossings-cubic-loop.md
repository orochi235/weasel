---
'@weasel-js/geom': patch
---

`pathCrossings` and `crossingStops` report where a single cubic segment loops over itself, so a trim can cut at a loop's crossing.

<!-- entry: fix -->
