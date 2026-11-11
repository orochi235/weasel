---
"@weasel-js/geom": patch
---

`fitAffine` judges whether its points are distinct against their own scale. One point repeated far from the origin answers null, and distinct points with tiny coordinates are fitted.

<!-- entry: rank=-5 fix -->
