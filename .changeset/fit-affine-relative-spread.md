---
"@weasel-js/geom": patch
---

`fitAffine` now judges whether its points are distinct against their own scale: one point repeated far from the origin answers null instead of a collapsing map, and distinct points with tiny coordinates are fitted instead of refused.
