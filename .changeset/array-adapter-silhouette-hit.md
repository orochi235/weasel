---
'@weasel-js/core': patch
'@weasel-js/geom': patch
---

`arrayAdapter`'s marquee and lasso now take a node by its outline, as `sceneToAdapter`'s do, instead of by its bounding box. A marquee over the empty corner of a triangle, or past the tip of a rotated rect, no longer selects it, and `enclosed` lasso mode takes a shape the lasso fits around even when its box pokes out. A polygon pose is its own outline; any other pose is its rect, rotated by `rotation`. The new `silhouette` option supplies what the painters draw — pass `findShapeSilhouette` when the items are scene nodes. The descriptor's `intersectsRect` is no longer consulted.

`@weasel-js/geom` now holds path hit-testing: `pointInPath`, `strokeHitTest`, `pathContainsPoint`, `pathContainsRect`, `pathIntersectsRect`, `pathContainsPolygon`, `pathIntersectsPolygon`, `polygonContainsPath` and `polygonIntersectsPath`. Core's exports of the same names are unchanged.
