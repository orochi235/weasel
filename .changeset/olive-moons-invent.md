---
'@weasel-js/core': patch
---

Memoize the per-node AABB in the area hit-test, for silhouette poses.

`hitTestArea` — the marquee and lasso dep source — recomputed every node's
bounding box on every query. For a polygon pose that means walking the whole
command stream and allocating a rect, per node, before the fast-reject could
discard it. The box is now cached through `nodeMemo`, keyed on the node's
`pose` and `data` references, so a repeat query over an unedited scene reuses
it and an edit through any scene op invalidates it.

Measured on 24-gon scenes (`npm run bench`, `min` column, same machine
back-to-back): 10,000 nodes 11.85 ms → 1.16 ms per query, 1,000 nodes
1.14 ms → 0.15 ms. Query-rect size now moves the number (0.117 ms at 17 hits
against 0.141 ms at 1,000 hits on a 1,000-node scene, previously flat at
~1.15 ms either way) because the silhouette kernel, not the bounds
computation, is what survives the reject.

Rect-pose scenes pay 5–17% for it: `aabbOfPose` returns a rect pose
unchanged, so there is nothing to cache, and deciding that per node costs
more than the call it skips. 10,000 rect nodes go 0.76 ms → 0.85 ms.
