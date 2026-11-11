---
"@weasel-js/stroke": patch
"@weasel-js/renderer": patch
"@weasel-js/core": patch
---

`markerReach` measures how far a marker head reaches in any direction, not along its own axes. A head turns
to its segment, so an arrow on a slanted edge reached past the reach reported for it, and the cull could drop
a node whose marker tip was on screen. A node's grab reach and paint box grow to match.
