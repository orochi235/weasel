---
'@weasel-js/geom': patch
---

`schneiderFit`, `polygonFromPoints`, `polylineFromPoints`, `linePath`, `ellipsePath`, `regularPolygonPath` and `starPath` keep far-out fractions.

Each measures a shape past `ORIGIN_THRESHOLD` from an origin of its own, so a freehand pencil stroke drawn far from 0 no longer snaps to float32's grid.

<!-- entry: fix -->
