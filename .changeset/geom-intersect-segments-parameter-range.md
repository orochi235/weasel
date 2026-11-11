---
"@weasel-js/geom": patch
---

`intersectSegments` reports every crossing's parameters inside 0..1. A crossing at the very end of a curve could come back a hair outside, at -1e-6, when the curve was too short for refinement to move it.
