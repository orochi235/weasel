---
'@weasel-js/geom': patch
---

`nearestPointsRayLine` finds the true closest pair for a line within a few microradians of the ray, treating it as parallel only to the `SINGULAR_RATIO` the other ray tests use.

<!-- entry: fix -->
