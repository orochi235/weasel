---
"@weasel-js/geom": patch
---

`nearestOnCubic`, and `nearestOnQuadratic` and `nearestOnPath` with it, find the nearest point where two candidates lie closer together than its sampling could tell apart: on either side of a fold in the curve, or beside an end whose handle sits on its anchor. It could answer the far one, 5e-7 away from a point the curve passes through.
