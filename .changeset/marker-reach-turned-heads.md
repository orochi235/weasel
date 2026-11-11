---
"@weasel-js/stroke": patch
"@weasel-js/renderer": patch
"@weasel-js/core": patch
---

An arrowhead on a slanted edge is no longer culled while its tip is on screen, and its node's grab reach and paint box cover it.

`markerReach` now measures how far a marker head reaches in any direction, not along its own axes.

<!-- entry: fix visual -->
