---
'@weasel-js/geom': patch
---

`PathBuilder` writes the moveto a drawing command implies after `close()`, at the closed subpath's start, as `pathFromD` does for SVG data, and so does a builder seeded by `PathBuilder.fromPath` from a closed path. Left implicit, the anchors after it were numbered one apart by the walkers that count that start and those that do not, so the Girth tool read each per-vertex width there from the anchor before it.
