---
'@weasel-js/geom': patch
---

A rotated node far from 0 keeps its silhouette to the fraction. `rotatePathAbout` and `pathThroughPoseFrame` measure a far-out result from an origin, as `transformPath` does.

<!-- entry: fix -->
