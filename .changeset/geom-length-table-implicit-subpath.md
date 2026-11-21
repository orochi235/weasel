---
'@weasel-js/geom': patch
---

A path's length table answers anchor queries on the right subpath when a drawing command opens a subpath after `Z` with no `M`.

The segment that opens such a subpath has no anchor of its own at its start, so it takes no share of the anchor range.

<!-- entry: fix -->
