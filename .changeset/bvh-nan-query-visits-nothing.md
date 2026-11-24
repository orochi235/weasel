---
'@weasel-js/geom': patch
---

A BVH's `queryBox`, `queryPoint`, and `queryHalfSpaces` visit nothing for a query with a `NaN` or missing coordinate, as `raycast` already did, rather than every key in the tree.

<!-- entry: fix -->
