---
"@weasel-js/core": patch
"@weasel-js/diagram": patch
"@weasel-js/diagram-formats": patch
---

`documentFromScene` exports a shape sitting in the gap between pages on the nearest page rather
than the first, and marks a connector cross-page exactly when the scene's off-page split does. A
connector from a gap shape to another page stays whole, keeping its waypoints in world
coordinates. core gains `pageHolding`, the page a box is on, else the nearest one.
diagram gains `documentBoundsOf`, the box a node has in document space, which off-page splitting and
export now both read.
